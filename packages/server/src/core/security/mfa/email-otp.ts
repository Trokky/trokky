/**
 * Email OTP Service
 *
 * Implements email-based one-time password for MFA.
 * Uses the existing Trokky mail system for email delivery.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createLogger } from '../../utils/logger.js'

const logger = createLogger('security', 'EmailOTP')

// =============================================================================
// TYPES
// =============================================================================

export interface EmailOTPConfig {
  codeLength?: number // Number of digits (default: 6)
  expiryMinutes?: number // Minutes until code expires (default: 10)
  maxAttempts?: number // Max verification attempts (default: 5)
}

export interface EmailOTPResult {
  code: string // Plain text code (for email template)
  codeHash: string // Hashed code (for storage)
  expiresAt: string // ISO timestamp
}

export interface StoredEmailOTP {
  codeHash: string
  expiresAt: string
  attempts: number
  createdAt: string
}

export interface EmailOTPVerificationResult {
  valid: boolean
  expired?: boolean
  maxAttemptsExceeded?: boolean
  attemptsRemaining?: number
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_CODE_LENGTH = 6
const DEFAULT_EXPIRY_MINUTES = 10
const DEFAULT_MAX_ATTEMPTS = 5

// =============================================================================
// EMAIL OTP SERVICE
// =============================================================================

export class EmailOTPService {
  private config: Required<EmailOTPConfig>

  constructor(config: EmailOTPConfig = {}) {
    this.config = {
      codeLength: config.codeLength || DEFAULT_CODE_LENGTH,
      expiryMinutes: config.expiryMinutes || DEFAULT_EXPIRY_MINUTES,
      maxAttempts: config.maxAttempts || DEFAULT_MAX_ATTEMPTS,
    }
    logger.debug('EmailOTPService initialized', {
      codeLength: this.config.codeLength,
      expiryMinutes: this.config.expiryMinutes,
    })
  }

  /**
   * Generate a new email OTP code
   * Returns both the plain code (for email) and hashed code (for storage)
   */
  generateCode(): EmailOTPResult {
    // Generate random numeric code
    const code = this.generateNumericCode(this.config.codeLength)

    // Hash the code for secure storage
    const codeHash = this.hashCode(code)

    // Calculate expiry time
    const expiresAt = new Date(
      Date.now() + this.config.expiryMinutes * 60 * 1000
    ).toISOString()

    logger.info('Generated email OTP', {
      expiresAt,
      codeLength: this.config.codeLength,
    })

    return {
      code,
      codeHash,
      expiresAt,
    }
  }

  /**
   * Verify an email OTP code
   * Handles expiry and attempt counting
   */
  verifyCode(
    inputCode: string,
    stored: StoredEmailOTP
  ): EmailOTPVerificationResult {
    // Check if expired
    if (new Date(stored.expiresAt) < new Date()) {
      logger.debug('Email OTP expired')
      return {
        valid: false,
        expired: true,
      }
    }

    // Check max attempts
    if (stored.attempts >= this.config.maxAttempts) {
      logger.debug('Email OTP max attempts exceeded')
      return {
        valid: false,
        maxAttemptsExceeded: true,
      }
    }

    // Clean input code (remove spaces, dashes)
    const cleanCode = inputCode.replace(/[\s-]/g, '')

    // Hash and compare
    const inputHash = this.hashCode(cleanCode)

    if (this.timingSafeCompareHex(inputHash, stored.codeHash)) {
      logger.info('Email OTP verified successfully')
      return {
        valid: true,
      }
    }

    // Invalid code
    const attemptsRemaining =
      this.config.maxAttempts - (stored.attempts + 1)

    logger.debug('Email OTP verification failed', { attemptsRemaining })

    return {
      valid: false,
      attemptsRemaining,
    }
  }

  /**
   * Check if a stored OTP has expired
   */
  isExpired(stored: StoredEmailOTP): boolean {
    return new Date(stored.expiresAt) < new Date()
  }

  /**
   * Check if max attempts have been exceeded
   */
  isMaxAttemptsExceeded(stored: StoredEmailOTP): boolean {
    return stored.attempts >= this.config.maxAttempts
  }

  /**
   * Get the time remaining until expiry (in seconds)
   */
  getTimeRemaining(stored: StoredEmailOTP): number {
    const remaining = new Date(stored.expiresAt).getTime() - Date.now()
    return Math.max(0, Math.floor(remaining / 1000))
  }

  /**
   * Create a stored OTP object from a generated code result
   */
  createStoredOTP(result: EmailOTPResult): StoredEmailOTP {
    return {
      codeHash: result.codeHash,
      expiresAt: result.expiresAt,
      attempts: 0,
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * Increment attempts for a stored OTP
   */
  incrementAttempts(stored: StoredEmailOTP): StoredEmailOTP {
    return {
      ...stored,
      attempts: stored.attempts + 1,
    }
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Generate a random numeric code of specified length
   */
  private generateNumericCode(length: number): string {
    // Generate enough random bytes
    const bytes = randomBytes(length)
    let code = ''

    for (let i = 0; i < length; i++) {
      // Map each byte to 0-9
      code += (bytes[i] % 10).toString()
    }

    return code
  }

  /**
   * Hash a code for secure storage
   */
  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex')
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
 * Create a new Email OTP service instance
 */
export function createEmailOTPService(
  config: EmailOTPConfig = {}
): EmailOTPService {
  return new EmailOTPService(config)
}

// =============================================================================
// EMAIL TEMPLATE HELPERS
// =============================================================================

/**
 * Get subject line for OTP email
 */
export function getOTPEmailSubject(issuer: string): string {
  return `Your ${issuer} verification code`
}

/**
 * Get plain text body for OTP email
 */
export function getOTPEmailBody(
  code: string,
  issuer: string,
  expiryMinutes: number
): string {
  return `Your ${issuer} verification code is: ${code}

This code will expire in ${expiryMinutes} minutes.

If you didn't request this code, please ignore this email or contact support if you have concerns.

Do not share this code with anyone.`
}

/**
 * Get HTML body for OTP email
 */
export function getOTPEmailHTML(
  code: string,
  issuer: string,
  expiryMinutes: number
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .code-container {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
    }
    .code {
      font-size: 32px;
      font-weight: bold;
      letter-spacing: 8px;
      color: #333;
      font-family: monospace;
    }
    .expiry {
      color: #666;
      font-size: 14px;
      margin-top: 10px;
    }
    .warning {
      color: #666;
      font-size: 12px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
  </style>
</head>
<body>
  <h2>Your verification code</h2>
  <p>Use the following code to verify your identity on ${issuer}:</p>

  <div class="code-container">
    <div class="code">${code}</div>
    <div class="expiry">This code expires in ${expiryMinutes} minutes</div>
  </div>

  <p class="warning">
    If you didn't request this code, please ignore this email or contact support if you have concerns.<br>
    <strong>Do not share this code with anyone.</strong>
  </p>
</body>
</html>
`
}
