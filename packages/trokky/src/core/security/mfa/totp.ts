/**
 * TOTP (Time-based One-Time Password) Service
 *
 * Implements RFC 6238 TOTP for authenticator app-based MFA.
 * Uses the otpauth library for TOTP generation/verification.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createLogger } from '../../utils/logger.js'

const logger = createLogger('security', 'TOTP')

// =============================================================================
// TYPES
// =============================================================================

export interface TOTPConfig {
  issuer: string // Organization name shown in authenticator apps
  algorithm?: 'SHA1' | 'SHA256' | 'SHA512'
  digits?: number // Number of digits in code (default: 6)
  period?: number // Time step in seconds (default: 30)
}

export interface TOTPSecretResult {
  secret: string // Base32 encoded secret
  uri: string // otpauth:// URI for QR code
  qrCodeDataUrl: string // Data URL for QR code image
  manualEntryKey: string // Human-readable key for manual entry
}

export interface BackupCodeVerificationResult {
  valid: boolean
  remainingCodes: string[] // Updated list with used code removed
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_ALGORITHM = 'SHA1'
const DEFAULT_DIGITS = 6
const DEFAULT_PERIOD = 30
const SECRET_LENGTH = 20 // 160 bits, recommended for SHA1
const BACKUP_CODE_LENGTH = 8 // 8 character backup codes
const BACKUP_CODE_COUNT = 10 // Number of backup codes to generate

// Base32 alphabet for secret encoding
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

// =============================================================================
// TOTP SERVICE
// =============================================================================

export class TOTPService {
  private config: Required<TOTPConfig>

  constructor(config: TOTPConfig) {
    this.config = {
      issuer: config.issuer,
      algorithm: config.algorithm || DEFAULT_ALGORITHM,
      digits: config.digits || DEFAULT_DIGITS,
      period: config.period || DEFAULT_PERIOD,
    }
    logger.debug('TOTPService initialized', { issuer: config.issuer })
  }

  /**
   * Generate a new TOTP secret for a user
   * Returns the secret, URI for QR code generation, and a data URL for the QR code
   */
  async generateSecret(accountName: string): Promise<TOTPSecretResult> {
    // Generate cryptographically secure random bytes
    const secretBytes = randomBytes(SECRET_LENGTH)

    // Encode as base32
    const secret = this.base32Encode(secretBytes)

    // Build otpauth URI
    const uri = this.buildTOTPUri(secret, accountName)

    // Generate QR code data URL
    const qrCodeDataUrl = await this.generateQRCode(uri)

    // Format secret for manual entry (groups of 4 for readability)
    const manualEntryKey = secret.match(/.{1,4}/g)?.join(' ') || secret

    logger.info('Generated TOTP secret', { accountName })

    return {
      secret,
      uri,
      qrCodeDataUrl,
      manualEntryKey,
    }
  }

  /**
   * Verify a TOTP code against a secret
   * Allows for time drift by checking adjacent time windows
   */
  verifyCode(secret: string, code: string, window: number = 1): boolean {
    if (!code || code.length !== this.config.digits) {
      return false
    }

    // Clean the code (remove spaces, ensure digits only)
    const cleanCode = code.replace(/\s/g, '')
    if (!/^\d+$/.test(cleanCode)) {
      return false
    }

    const currentTime = Math.floor(Date.now() / 1000)

    // Check current time step and adjacent windows
    for (let i = -window; i <= window; i++) {
      const timeStep = Math.floor((currentTime + i * this.config.period) / this.config.period)
      const expectedCode = this.generateTOTP(secret, timeStep)

      if (this.timingSafeCompare(cleanCode, expectedCode)) {
        logger.debug('TOTP code verified', { window: i })
        return true
      }
    }

    logger.debug('TOTP code verification failed')
    return false
  }

  /**
   * Generate backup codes for account recovery
   * These are one-time use codes stored hashed
   */
  generateBackupCodes(count: number = BACKUP_CODE_COUNT): string[] {
    const codes: string[] = []

    for (let i = 0; i < count; i++) {
      // Generate random bytes and convert to alphanumeric
      const bytes = randomBytes(BACKUP_CODE_LENGTH)
      let code = ''

      for (const byte of bytes) {
        // Map to alphanumeric (0-9, A-Z)
        const char = byte % 36
        code += char < 10 ? char.toString() : String.fromCharCode(55 + char) // A=65, but we start at 10
      }

      // Format with dash for readability: XXXX-XXXX
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`)
    }

    logger.info('Generated backup codes', { count })
    return codes
  }

  /**
   * Hash a backup code for secure storage
   * Uses SHA-256 for fast comparison while still being secure
   */
  hashBackupCode(code: string): string {
    // Normalize: remove dashes, uppercase
    const normalized = code.replace(/-/g, '').toUpperCase()
    return createHash('sha256').update(normalized).digest('hex')
  }

  /**
   * Verify a backup code against stored hashed codes
   * Returns the updated list with the used code removed (consumed)
   */
  verifyBackupCode(
    hashedCodes: string[],
    code: string
  ): BackupCodeVerificationResult {
    // Hash the provided code
    const hashedInput = this.hashBackupCode(code)

    // Find and remove matching code
    const index = hashedCodes.findIndex((stored) =>
      this.timingSafeCompareHex(stored, hashedInput)
    )

    if (index === -1) {
      logger.debug('Backup code verification failed')
      return {
        valid: false,
        remainingCodes: hashedCodes,
      }
    }

    // Remove the used code
    const remainingCodes = [...hashedCodes]
    remainingCodes.splice(index, 1)

    logger.info('Backup code verified and consumed', {
      remainingCount: remainingCodes.length,
    })

    return {
      valid: true,
      remainingCodes,
    }
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Build otpauth:// URI for QR code
   */
  private buildTOTPUri(secret: string, accountName: string): string {
    const params = new URLSearchParams({
      secret,
      issuer: this.config.issuer,
      algorithm: this.config.algorithm,
      digits: this.config.digits.toString(),
      period: this.config.period.toString(),
    })

    // Encode account name and issuer for the label
    const label = encodeURIComponent(`${this.config.issuer}:${accountName}`)

    return `otpauth://totp/${label}?${params.toString()}`
  }

  /**
   * Generate QR code as data URL
   * Uses dynamic import to handle optional qrcode dependency
   * If qrcode is not installed, returns the URI as base64 for client-side QR generation
   */
  private async generateQRCode(data: string): Promise<string> {
    try {
      // Dynamic import to handle optional dependency
      const QRCode = await import('qrcode').catch(() => null)

      if (QRCode && typeof QRCode.toDataURL === 'function') {
        return await QRCode.toDataURL(data, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        })
      }

      // Fallback: return URI as base64 encoded data URL
      // The frontend can generate the QR code using a client-side library
      logger.debug('QR code package not available, returning URI as fallback')
      return `data:text/plain;base64,${Buffer.from(data).toString('base64')}`
    } catch (error) {
      // If qrcode package is not available, return the URI
      logger.debug('QR code generation failed, returning URI as fallback', { error })
      return `data:text/plain;base64,${Buffer.from(data).toString('base64')}`
    }
  }

  /**
   * Generate TOTP code for a given time step
   * Implements RFC 6238
   */
  private generateTOTP(secret: string, timeStep: number): string {
    // Decode base32 secret
    const secretBytes = this.base32Decode(secret)

    // Convert time step to 8-byte big-endian buffer
    const timeBuffer = Buffer.alloc(8)
    timeBuffer.writeBigInt64BE(BigInt(timeStep))

    // Generate HMAC using the configured algorithm
    const algorithm = this.config.algorithm.toLowerCase()
    const hmacResult = createHmac(algorithm, secretBytes)
      .update(timeBuffer)
      .digest()

    // Dynamic truncation (RFC 4226)
    const offset = hmacResult[hmacResult.length - 1] & 0x0f
    const binary =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff)

    // Generate code with specified number of digits
    const code = binary % Math.pow(10, this.config.digits)
    return code.toString().padStart(this.config.digits, '0')
  }

  /**
   * Base32 encode bytes
   */
  private base32Encode(buffer: Buffer): string {
    let result = ''
    let bits = 0
    let value = 0

    for (const byte of buffer) {
      value = (value << 8) | byte
      bits += 8

      while (bits >= 5) {
        result += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
        bits -= 5
      }
    }

    if (bits > 0) {
      result += BASE32_ALPHABET[(value << (5 - bits)) & 31]
    }

    return result
  }

  /**
   * Base32 decode string to bytes
   */
  private base32Decode(encoded: string): Buffer {
    // Remove padding and convert to uppercase
    const input = encoded.replace(/=+$/, '').toUpperCase()
    const bytes: number[] = []
    let bits = 0
    let value = 0

    for (const char of input) {
      const index = BASE32_ALPHABET.indexOf(char)
      if (index === -1) continue

      value = (value << 5) | index
      bits += 5

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255)
        bits -= 8
      }
    }

    return Buffer.from(bytes)
  }

  /**
   * Timing-safe string comparison
   */
  private timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)

    return timingSafeEqual(bufA, bufB)
  }

  /**
   * Timing-safe hex string comparison
   */
  private timingSafeCompareHex(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false
    }

    try {
      const bufA = Buffer.from(a, 'hex')
      const bufB = Buffer.from(b, 'hex')
      return timingSafeEqual(bufA, bufB)
    } catch {
      return false
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a new TOTP service instance
 */
export function createTOTPService(config: TOTPConfig): TOTPService {
  return new TOTPService(config)
}
