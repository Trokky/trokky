/**
 * Crypto adapter interface for different deployment environments
 * Supports both Node.js and edge runtime environments
 */

import { createRequire } from 'module'

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
   * Whether a stored hash uses an outdated format or work factor and should be
   * re-hashed the next time the password is successfully verified.
   */
  needsRehash(hash: string): boolean

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
   * Custom salt rounds for password hashing with bcrypt (default: 12)
   */
  saltRounds?: number

  /**
   * PBKDF2 iteration count for WebCrypto adapter (default: 100,000 per OWASP).
   * Only used when WebCryptoAdapter is selected.
   *
   * New hashes are written in the versioned format
   * `$pbkdf2-sha256$<iterations>$<base64 salt>$<base64 dk>`, so the iteration
   * count is stored alongside each hash and verification always uses the value
   * the hash was created with. Changing this value therefore does not invalidate
   * existing hashes; it only affects newly created ones and makes older hashes
   * report `needsRehash() === true`.
   */
  pbkdf2Iterations?: number
}

/**
 * Dynamically load NodeCryptoAdapter using createRequire for ESM compatibility
 */
function loadNodeCryptoAdapter(options: CryptoAdapterOptions): CryptoAdapter | null {
  try {
    // Use createRequire for ESM compatibility (imported at top of file)
    const require2 = createRequire(import.meta.url)
    const { NodeCryptoAdapter } = require2('./node-adapter.js')
    return new NodeCryptoAdapter(options)
  } catch (error) {
    // Silently fail - caller will handle fallback
    return null
  }
}

/**
 * Detect the best crypto adapter for the current environment
 */
export function detectCryptoAdapter(options: CryptoAdapterOptions = {}): CryptoAdapter {
  const { adapterType = 'auto' } = options

  // Force Node adapter (bcrypt) when explicitly requested
  if (adapterType === 'node') {
    const nodeAdapter = loadNodeCryptoAdapter(options)
    if (nodeAdapter) {
      return nodeAdapter
    }
    console.warn('[CryptoAdapter] NodeCryptoAdapter not available, falling back to WebCrypto or Fallback adapter')
    // Fall through to WebCrypto or fallback
  }

  // Prefer Web Crypto when available (Cloudflare Workers, modern Node, browsers)
  if (adapterType === 'webcrypto' || (adapterType === 'auto' && hasWebCrypto())) {
    return new WebCryptoAdapter(options)
  }

  // Auto-detect in Node environment - try NodeCryptoAdapter first for bcrypt support
  if (adapterType === 'auto' && isNodeEnvironment()) {
    const nodeAdapter = loadNodeCryptoAdapter(options)
    if (nodeAdapter) {
      return nodeAdapter
    }
    // NodeCryptoAdapter dependencies (bcrypt, jsonwebtoken) not available
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
