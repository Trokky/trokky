/**
 * Crypto adapter interface for different deployment environments
 * Supports both Node.js and edge runtime environments
 */

export interface CryptoAdapter {
  /**
   * Hash a password using the environment's best available method
   */
  hashPassword(password: string): Promise<string>
  
  /**
   * Verify a password against its hash
   */
  verifyPassword(password: string, hash: string): Promise<boolean>
  
  /**
   * Generate a JWT token
   */
  generateJWT(payload: Record<string, any>, secret: string, options?: JWTOptions): Promise<string>
  
  /**
   * Verify and decode a JWT token
   */
  verifyJWT(token: string, secret: string): Promise<Record<string, any> | null>
  
  /**
   * Generate a cryptographically secure random string
   */
  generateSecureRandom(length: number): string
}

export interface JWTOptions {
  expiresIn?: string | number
  issuer?: string
  audience?: string
}

export interface CryptoAdapterOptions {
  /**
   * Force a specific adapter type
   */
  adapterType?: 'node' | 'webcrypto' | 'auto'
  
  /**
   * Custom salt rounds for password hashing (default: 12)
   */
  saltRounds?: number
}

/**
 * Detect the best crypto adapter for the current environment
 */
export function detectCryptoAdapter(options: CryptoAdapterOptions = {}): CryptoAdapter {
  const { adapterType = 'auto' } = options

  // Prefer Web Crypto when available (Cloudflare Workers, modern Node, browsers)
  if (adapterType === 'webcrypto' || (adapterType === 'auto' && hasWebCrypto())) {
    return new WebCryptoAdapter(options)
  }

  // Node-specific adapter deliberately NOT statically imported to keep edge bundles clean.
  // Modern Node has WebCrypto; if not available, fall back to universal adapter.
  if (adapterType === 'node' || (adapterType === 'auto' && isNodeEnvironment())) {
    // In older Node environments without WebCrypto, use the fallback adapter.
    console.warn('WebCrypto not detected; using fallback crypto adapter in Node environment.')
    return new FallbackCryptoAdapter(options)
  }

  // Fallback to basic adapter (less secure but universal)
  console.warn('⚠️ Using fallback crypto adapter. This is not recommended for production.')
  return new FallbackCryptoAdapter(options)
}

function isNodeEnvironment(): boolean {
  return typeof process !== 'undefined' && 
         process.versions !== undefined && 
         typeof process.versions.node === 'string'
}

function hasWebCrypto(): boolean {
  const g: any = typeof globalThis !== 'undefined' ? globalThis : undefined
  return !!(g && g.crypto && typeof g.crypto.subtle !== 'undefined')
}

// Import only edge-safe adapters statically
import { WebCryptoAdapter } from './webcrypto-adapter.js'
import { FallbackCryptoAdapter } from './fallback-adapter.js'
