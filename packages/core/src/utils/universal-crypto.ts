/**
 * Universal crypto utilities that work across all JavaScript environments
 * Supports: Browser, Node.js, Cloudflare Workers, Deno, Bun, etc.
 */

export interface UniversalCrypto {
  getRandomBytes(length: number): Uint8Array
}

/**
 * Detect and return the best crypto implementation for the current environment
 */
export function getUniversalCrypto(): UniversalCrypto {
  // Web Crypto API (browser, Cloudflare Workers, Deno)
  if (typeof globalThis !== 'undefined' && globalThis.crypto && 'getRandomValues' in globalThis.crypto) {
    return {
      getRandomBytes(length: number): Uint8Array {
        const array = new Uint8Array(length)
        globalThis.crypto.getRandomValues(array)
        return array
      }
    }
  }

  // Node.js environment - use dynamic import to avoid bundling
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    return {
      getRandomBytes(length: number): Uint8Array {
        try {
          // Use eval to prevent bundlers from trying to resolve this
          const crypto = eval('require')('crypto')
          return new Uint8Array(crypto.randomBytes(length))
        } catch (error) {
          // Fallback if crypto is not available
          return getFallbackRandomBytes(length)
        }
      }
    }
  }

  // Fallback for any other environment
  return {
    getRandomBytes: getFallbackRandomBytes
  }
}

/**
 * Fallback random bytes implementation using Math.random()
 * Not cryptographically secure - only for environments without crypto support
 */
function getFallbackRandomBytes(length: number): Uint8Array {
  console.warn('⚠️ Using Math.random() fallback for crypto operations. This is not cryptographically secure.')
  const array = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    array[i] = Math.floor(Math.random() * 256)
  }
  return array
}

/**
 * Convert byte array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a cryptographically secure random hex string
 */
export function generateRandomHex(length: number): string {
  const crypto = getUniversalCrypto()
  const bytes = crypto.getRandomBytes(Math.ceil(length / 2))
  return bytesToHex(bytes).slice(0, length)
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  const crypto = getUniversalCrypto()
  const bytes = crypto.getRandomBytes(16)
  
  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80

  const hex = bytesToHex(bytes)
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-')
}