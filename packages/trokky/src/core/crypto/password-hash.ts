/**
 * Shared, runtime-agnostic password hashing helpers.
 *
 * Supports a versioned PBKDF2 format:
 *   $pbkdf2-sha256$<iterations>$<base64 salt>$<base64 derived key>
 *
 * and can still verify:
 *   - legacy untagged hashes: base64(salt16 || pbkdf2_sha256_dk32)
 *   - bcrypt hashes ($2a$/$2b$/$2y$) when the bcrypt package is loadable
 */

export const PBKDF2_DEFAULT_ITERATIONS = 100_000
export const PBKDF2_LEGACY_ITERATIONS = 4096
export const PBKDF2_SALT_BYTES = 16
export const PBKDF2_KEY_BYTES = 32

const PBKDF2_TAG = 'pbkdf2-sha256'
const BCRYPT_PATTERN = /^\$2[aby]\$/

export type ParsedPasswordHash =
  | { kind: 'pbkdf2'; iterations: number; salt: Uint8Array; dk: Uint8Array }
  | { kind: 'legacy-pbkdf2'; salt: Uint8Array; dk: Uint8Array }
  | { kind: 'bcrypt' }
  | { kind: 'unknown' }

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }
  return result === 0
}

/**
 * Format a PBKDF2 derivation as the versioned hash string.
 */
export function formatPbkdf2Hash(iterations: number, salt: Uint8Array, dk: Uint8Array): string {
  return `$${PBKDF2_TAG}$${iterations}$${toBase64(salt)}$${toBase64(dk)}`
}

/**
 * Identify the format of a stored password hash. Never throws.
 */
export function parsePasswordHash(hash: string): ParsedPasswordHash {
  if (typeof hash !== 'string' || hash.length === 0) {
    return { kind: 'unknown' }
  }

  if (BCRYPT_PATTERN.test(hash)) {
    return { kind: 'bcrypt' }
  }

  if (hash.startsWith(`$${PBKDF2_TAG}$`)) {
    // ['', tag, iterations, salt, dk]
    const parts = hash.split('$')
    if (parts.length !== 5) {
      return { kind: 'unknown' }
    }
    const iterations = Number(parts[2])
    if (!Number.isInteger(iterations) || iterations <= 0) {
      return { kind: 'unknown' }
    }
    try {
      const salt = fromBase64(parts[3])
      const dk = fromBase64(parts[4])
      if (salt.length === 0 || dk.length === 0) {
        return { kind: 'unknown' }
      }
      return { kind: 'pbkdf2', iterations, salt, dk }
    } catch {
      return { kind: 'unknown' }
    }
  }

  if (!hash.includes('$')) {
    try {
      const bytes = fromBase64(hash)
      if (bytes.length === PBKDF2_SALT_BYTES + PBKDF2_KEY_BYTES) {
        return {
          kind: 'legacy-pbkdf2',
          salt: bytes.slice(0, PBKDF2_SALT_BYTES),
          dk: bytes.slice(PBKDF2_SALT_BYTES),
        }
      }
    } catch {
      return { kind: 'unknown' }
    }
  }

  return { kind: 'unknown' }
}

async function derivePbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const subtle = globalThis.crypto.subtle
  const keyMaterial = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const derived = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    PBKDF2_KEY_BYTES * 8
  )
  return new Uint8Array(derived)
}

/**
 * Hash a password with PBKDF2-SHA256 and return the versioned hash string.
 */
export async function hashPasswordPbkdf2(
  password: string,
  iterations: number = PBKDF2_DEFAULT_ITERATIONS
): Promise<string> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES))
  const dk = await derivePbkdf2(password, salt, iterations)
  return formatPbkdf2Hash(iterations, salt, dk)
}

async function loadBcrypt(): Promise<any | null> {
  try {
    // Resolved lazily so edge runtimes without Node builtins never load it.
    const { createRequire } = await import('module')
    return createRequire(import.meta.url)('bcrypt')
  } catch {
    return null
  }
}

/**
 * Verify a password against any supported hash format. Never throws.
 */
export async function verifyPasswordHash(password: string, hash: string): Promise<boolean> {
  try {
    const parsed = parsePasswordHash(hash)

    switch (parsed.kind) {
      case 'pbkdf2': {
        const derived = await derivePbkdf2(password, parsed.salt, parsed.iterations)
        return constantTimeEqual(derived, parsed.dk)
      }
      case 'legacy-pbkdf2': {
        for (const iterations of [PBKDF2_DEFAULT_ITERATIONS, PBKDF2_LEGACY_ITERATIONS]) {
          const derived = await derivePbkdf2(password, parsed.salt, iterations)
          if (constantTimeEqual(derived, parsed.dk)) {
            return true
          }
        }
        return false
      }
      case 'bcrypt': {
        const bcrypt = await loadBcrypt()
        if (!bcrypt) {
          return false
        }
        return await bcrypt.compare(password, hash)
      }
      default:
        return false
    }
  } catch {
    return false
  }
}

/**
 * True when the stored hash is not a PBKDF2 hash at the current iteration count.
 */
export function pbkdf2NeedsRehash(hash: string, currentIterations: number): boolean {
  const parsed = parsePasswordHash(hash)
  return !(parsed.kind === 'pbkdf2' && parsed.iterations === currentIterations)
}
