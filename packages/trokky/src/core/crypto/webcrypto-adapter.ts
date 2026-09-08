/**
 * Web Crypto API adapter for edge environments
 * Compatible with Cloudflare Workers, Deno, Vercel Edge, etc.
 */

import type { CryptoAdapter, JWTOptions, CryptoAdapterOptions } from './adapter.js'
import {
  PBKDF2_DEFAULT_ITERATIONS,
  hashPasswordPbkdf2,
  pbkdf2NeedsRehash,
  verifyPasswordHash,
} from './password-hash.js'

export class WebCryptoAdapter implements CryptoAdapter {
  private pbkdf2Iterations: number

  constructor(options: CryptoAdapterOptions = {}) {
    // PBKDF2 needs a high iteration count for security.
    // bcrypt's saltRounds=12 means 2^12=4096 iterations, but PBKDF2 requires
    // much higher counts. Default to 100,000 per OWASP recommendations.
    this.pbkdf2Iterations = options.pbkdf2Iterations ?? PBKDF2_DEFAULT_ITERATIONS
    
    if (!crypto || !crypto.subtle) {
      throw new Error('Web Crypto API not available in this environment')
    }
  }

  async hashPassword(password: string): Promise<string> {
    try {
      return await hashPasswordPbkdf2(password, this.pbkdf2Iterations)
    } catch (error) {
      throw new Error(`Failed to hash password: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return verifyPasswordHash(password, hash)
  }

  needsRehash(hash: string): boolean {
    return pbkdf2NeedsRehash(hash, this.pbkdf2Iterations)
  }

  async generateJWT(payload: Record<string, any>, secret: string, options: JWTOptions = {}): Promise<string> {
    try {
      // Create header
      const header = {
        alg: 'HS256',
        typ: 'JWT'
      }
      
      // Add standard claims to payload
      const now = Math.floor(Date.now() / 1000)
      const jwtPayload: any = {
        ...payload,
        iat: now
      }
      
      // Add expiration if specified
      if (options.expiresIn) {
        if (typeof options.expiresIn === 'string') {
          // Parse expiration string (e.g., "24h", "7d")
          jwtPayload.exp = now + this.parseExpirationString(options.expiresIn)
        } else {
          jwtPayload.exp = now + options.expiresIn
        }
      }
      
      if (options.issuer) jwtPayload.iss = options.issuer
      if (options.audience) jwtPayload.aud = options.audience
      
      // Encode header and payload
      const encodedHeader = this.base64UrlEncode(JSON.stringify(header))
      const encodedPayload = this.base64UrlEncode(JSON.stringify(jwtPayload))
      
      // Create signature
      const message = `${encodedHeader}.${encodedPayload}`
      const signature = await this.sign(message, secret)
      
      return `${message}.${signature}`
    } catch (error) {
      throw new Error(`Failed to generate JWT: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async verifyJWT(token: string, secret: string): Promise<Record<string, any> | null> {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        return null
      }
      
      const [encodedHeader, encodedPayload, signature] = parts
      
      // Verify signature
      const message = `${encodedHeader}.${encodedPayload}`
      const isValid = await this.verify(message, signature, secret)
      
      if (!isValid) {
        return null
      }
      
      // Decode payload
      const payload = JSON.parse(this.base64UrlDecode(encodedPayload))
      
      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null
      }
      
      return payload
    } catch (error) {
      return null
    }
  }

  generateSecureRandom(length: number = 64): string {
    const buffer = crypto.getRandomValues(new Uint8Array(length))
    return Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  // Helper methods
  private async sign(message: string, secret: string): Promise<string> {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
    return this.base64UrlEncode(new Uint8Array(signature))
  }

  private async verify(message: string, signature: string, secret: string): Promise<boolean> {
    try {
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      )
      
      const signatureBuffer = this.base64UrlDecodeToBuffer(signature)
      const messageBuffer = encoder.encode(message)
      return await crypto.subtle.verify('HMAC', key, signatureBuffer.buffer as ArrayBuffer, messageBuffer.buffer as ArrayBuffer)
    } catch {
      return false
    }
  }

  private base64UrlEncode(data: string | Uint8Array): string {
    const base64 = typeof data === 'string' 
      ? btoa(data)
      : btoa(String.fromCharCode(...data))
    
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  private base64UrlDecode(data: string): string {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    return atob(padded)
  }

  private base64UrlDecodeToBuffer(data: string): Uint8Array {
    const decoded = this.base64UrlDecode(data)
    return new Uint8Array(decoded.split('').map(char => char.charCodeAt(0)))
  }

  private parseExpirationString(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhdw])$/)
    if (!match) {
      throw new Error(`Invalid expiration format: ${expiration}`)
    }
    
    const value = parseInt(match[1])
    const unit = match[2]
    
    const multipliers = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 60 * 60 * 24,
      w: 60 * 60 * 24 * 7
    }
    
    return value * multipliers[unit as keyof typeof multipliers]
  }
}