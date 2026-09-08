/**
 * Fallback crypto adapter for environments without proper crypto support
 * WARNING: This adapter provides minimal security and should only be used for development
 */

import type { CryptoAdapter, JWTOptions, CryptoAdapterOptions } from './adapter.js'
import { getUniversalCrypto, generateRandomHex } from '../utils/universal-crypto.js'

export class FallbackCryptoAdapter implements CryptoAdapter {
  private saltRounds: number
  private hasLoggedWarning: boolean = false

  constructor(options: CryptoAdapterOptions = {}) {
    this.saltRounds = options.saltRounds || 12
    this.logSecurityWarning()
  }

  private logSecurityWarning(): void {
    if (this.hasLoggedWarning) return
    
    const nodeEnv = (typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined)
    const isProduction = nodeEnv === 'production'
    const isDevelopment = nodeEnv === 'development' || nodeEnv === 'test'
    
    console.log('')
    console.log('🚨🚨🚨 CRITICAL SECURITY WARNING 🚨🚨🚨')
    console.log('┌─────────────────────────────────────────────────────────────┐')
    console.log('│  USING FALLBACK CRYPTO ADAPTER - NOT SECURE FOR PRODUCTION  │')
    console.log('├─────────────────────────────────────────────────────────────┤')
    console.log('│                                                             │')
    console.log('│  • Passwords are NOT properly hashed                       │')
    console.log('│  • JWT tokens are NOT cryptographically signed             │')
    console.log('│  • Random values are NOT cryptographically secure          │')
    console.log('│                                                             │')
    console.log('│  This adapter should ONLY be used for:                     │')
    console.log('│  • Development/testing purposes                             │')
    console.log('│  • Environments where crypto APIs are unavailable          │')
    console.log('│                                                             │')
    
    if (isProduction) {
      console.log('│  🔥 PRODUCTION ENVIRONMENT DETECTED!                       │')
      console.log('│  🔥 THIS IS EXTREMELY DANGEROUS!                           │')
      console.log('│  🔥 SWITCH TO PROPER CRYPTO ADAPTER IMMEDIATELY!           │')
    } else if (!isDevelopment) {
      console.log('│  ⚠️  Unknown environment - ensure this is not production   │')
    } else {
      console.log('│  ℹ️  Development environment detected                       │')
    }
    
    console.log('│                                                             │')
    console.log('│  To fix this:                                               │')
    console.log('│  • For Node.js: Install bcrypt and jsonwebtoken packages   │')
    console.log('│  • For edge runtimes: Ensure Web Crypto API is available   │')
    console.log('│  • Or manually specify a crypto adapter in TrokkyCore      │')
    console.log('│                                                             │')
    console.log('└─────────────────────────────────────────────────────────────┘')
    console.log('')
    
    if (isProduction) {
      console.log('🔥🔥🔥 PRODUCTION DEPLOYMENT WITH INSECURE CRYPTO 🔥🔥🔥')
      console.log('🔥🔥🔥 YOUR APPLICATION IS VULNERABLE TO ATTACKS 🔥🔥🔥')
      console.log('')
    }
    
    this.hasLoggedWarning = true
  }

  async hashPassword(password: string): Promise<string> {
    // Log warning on first use
    if ((typeof process === 'undefined') || process.env?.NODE_ENV !== 'test') {
      console.warn('⚠️ INSECURE: Using fallback password hashing')
    }
    
    // Simple hash using built-in string methods (NOT SECURE)
    const salt = this.generateSimpleSalt()
    const hash = this.simpleHash(password + salt)
    return `fallback:${salt}:${hash}`
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      if (!hash.startsWith('fallback:')) {
        return false
      }
      
      const [, salt, storedHash] = hash.split(':')
      const computedHash = this.simpleHash(password + salt)
      
      // Simple comparison (NOT constant-time)
      return computedHash === storedHash
    } catch {
      return false
    }
  }

  needsRehash(hash: string): boolean {
    return !hash.startsWith('fallback:')
  }

  async generateJWT(payload: Record<string, any>, secret: string, options: JWTOptions = {}): Promise<string> {
    // Log warning on first use
    if ((typeof process === 'undefined') || process.env?.NODE_ENV !== 'test') {
      console.warn('⚠️ INSECURE: Using fallback JWT generation')
    }
    
    // Simple JWT-like token (NOT SECURE)
    const header = { alg: 'HS256', typ: 'JWT' }
    const now = Math.floor(Date.now() / 1000)
    
    const jwtPayload: any = {
      ...payload,
      iat: now
    }
    
    if (options.expiresIn) {
      if (typeof options.expiresIn === 'string') {
        jwtPayload.exp = now + this.parseExpirationString(options.expiresIn)
      } else {
        jwtPayload.exp = now + options.expiresIn
      }
    }
    
    const encodedHeader = this.base64Encode(JSON.stringify(header))
    const encodedPayload = this.base64Encode(JSON.stringify(jwtPayload))
    const message = `${encodedHeader}.${encodedPayload}`
    
    // Simple signature (NOT SECURE)
    const signature = this.base64Encode(this.simpleHash(message + secret))
    
    return `${message}.${signature}`
  }

  async verifyJWT(token: string, secret: string): Promise<Record<string, any> | null> {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        return null
      }
      
      const [encodedHeader, encodedPayload, signature] = parts
      const message = `${encodedHeader}.${encodedPayload}`
      
      // Verify simple signature
      const expectedSignature = this.base64Encode(this.simpleHash(message + secret))
      if (signature !== expectedSignature) {
        return null
      }
      
      const payload = JSON.parse(this.base64Decode(encodedPayload))
      
      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null
      }
      
      return payload
    } catch {
      return null
    }
  }

  generateSecureRandom(length: number = 64): string {
    // Use universal crypto which will provide the best available random source
    return generateRandomHex(length)
  }

  // Helper methods (NOT SECURE)
  private generateSimpleSalt(): string {
    return Math.random().toString(36).substring(2, 15)
  }

  private simpleHash(input: string): string {
    // Simple string hash (NOT CRYPTOGRAPHICALLY SECURE)
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  private base64Encode(str: string): string {
    if (typeof btoa !== 'undefined') {
      return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
    }
    
    // Fallback base64 encoding
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    let result = ''
    let i = 0
    
    while (i < str.length) {
      const a = str.charCodeAt(i++)
      const b = i < str.length ? str.charCodeAt(i++) : 0
      const c = i < str.length ? str.charCodeAt(i++) : 0
      
      const bitmap = (a << 16) | (b << 8) | c
      
      result += chars.charAt((bitmap >> 18) & 63)
      result += chars.charAt((bitmap >> 12) & 63)
      result += i - 2 < str.length ? chars.charAt((bitmap >> 6) & 63) : '='
      result += i - 1 < str.length ? chars.charAt(bitmap & 63) : '='
    }
    
    return result.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  private base64Decode(str: string): string {
    if (typeof atob !== 'undefined') {
      const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
      return atob(padded)
    }
    
    // Fallback - minimal implementation
    throw new Error('Base64 decoding not available in this environment')
  }

  private parseExpirationString(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhdw])$/)
    if (!match) {
      return 3600 // Default 1 hour
    }
    
    const value = parseInt(match[1])
    const unit = match[2]
    
    const multipliers = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 }
    return value * (multipliers[unit as keyof typeof multipliers] || 3600)
  }
}
