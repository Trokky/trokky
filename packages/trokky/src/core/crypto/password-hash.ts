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
/**
 * Upper bound on the iteration count accepted from a stored hash or from
 * configuration. A stored hash claiming billions of iterations would otherwise
 * turn every login attempt for that account into minutes of CPU.
 */
export const PBKDF2_MAX_ITERATIONS = 2 ** 24 // 16,777,216: covers legacy 2^saltRounds up to saltRounds=24
export const PBKDF2_SALT_BYTES = 16
export const PBKDF2_KEY_BYTES = 32
/** Longest hash string we are willing to parse. Real hashes are < 120 chars. */
const MAX_HASH_LENGTH = 512

const PBKDF2_TAG = 'pbkdf2-sha256'
const BCRYPT_PATTERN = /^\$2[aby]\$(\d{2})\$/

export type ParsedPasswordHash =
  | { kind: 'pbkdf2'; iterations: number; salt: Uint8Array; dk: Uint8Array }
  | { kind: 'legacy-pbkdf2'; salt: Uint8Array; dk: Uint8Array }
  | { kind: 'bcrypt'; cost: number }
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
 * True when `iterations` is an integer within the supported range.
 */
export function isValidPbkdf2Iterations(iterations: unknown): iterations is number {
  return (
    typeof iterations === 'number' &&
    Number.isInteger(iterations) &&
    iterations >= 1 &&
    iterations <= PBKDF2_MAX_ITERATIONS
  )
}

function assertValidIterations(iterations: number): void {
  if (!isValidPbkdf2Iterations(iterations)) {
    throw new Error(
      `pbkdf2Iterations must be an integer between 1 and ${PBKDF2_MAX_ITERATIONS}, got ${String(iterations)}`
    )
  }
}

/**
 * Format a PBKDF2 derivation as the versioned hash string.
 */
export function formatPbkdf2Hash(iterations: number, salt: Uint8Array, dk: Uint8Array): string {
  assertValidIterations(iterations)
  return `$${PBKDF2_TAG}$${iterations}$${toBase64(salt)}$${toBase64(dk)}`
}

/**
 * Identify the format of a stored password hash. Never throws.
 */
export function parsePasswordHash(hash: string): ParsedPasswordHash {
  if (typeof hash !== 'string' || hash.length === 0 || hash.length > MAX_HASH_LENGTH) {
    return { kind: 'unknown' }
  }

  const bcryptMatch = BCRYPT_PATTERN.exec(hash)
  if (bcryptMatch) {
    return { kind: 'bcrypt', cost: Number(bcryptMatch[1]) }
  }

  if (hash.startsWith(`$${PBKDF2_TAG}$`)) {
    // ['', tag, iterations, salt, dk]
    const parts = hash.split('$')
    if (parts.length !== 5) {
      return { kind: 'unknown' }
    }
    // Strict decimal only: Number() would accept '1e5', '0x10' or ' 100000'.
    if (!/^[1-9][0-9]{0,8}$/.test(parts[2])) {
      return { kind: 'unknown' }
    }
    const iterations = Number(parts[2])
    if (!isValidPbkdf2Iterations(iterations)) {
      return { kind: 'unknown' }
    }
    try {
      const salt = fromBase64(parts[3])
      const dk = fromBase64(parts[4])
      // We only ever write salt16/dk32; anything else is corrupt or forged.
      if (salt.length !== PBKDF2_SALT_BYTES || dk.length !== PBKDF2_KEY_BYTES) {
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

function hasSubtle(): boolean {
  return typeof globalThis.crypto?.subtle?.deriveBits === 'function'
}

/**
 * PBKDF2-SHA256 via Node's crypto module, for hosts without global WebCrypto
 * (Node 18). Same parameters, so output is identical.
 */
async function derivePbkdf2Node(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  const { pbkdf2 } = await import('crypto')
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, iterations, PBKDF2_KEY_BYTES, 'sha256', (err, key) => {
      if (err) reject(err)
      else resolve(new Uint8Array(key.buffer, key.byteOffset, key.byteLength))
    })
  })
}

async function derivePbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<Uint8Array> {
  assertValidIterations(iterations)
  if (!hasSubtle()) {
    return derivePbkdf2Node(password, salt, iterations)
  }
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

async function randomSalt(): Promise<Uint8Array> {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    return globalThis.crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES))
  }
  const { randomBytes } = await import('crypto')
  const buf = randomBytes(PBKDF2_SALT_BYTES)
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
}

/**
 * Hash a password with PBKDF2-SHA256 and return the versioned hash string.
 */
export async function hashPasswordPbkdf2(
  password: string,
  iterations: number = PBKDF2_DEFAULT_ITERATIONS
): Promise<string> {
  assertValidIterations(iterations)
  const salt = await randomSalt()
  const dk = await derivePbkdf2(password, salt, iterations)
  return formatPbkdf2Hash(iterations, salt, dk)
}

let warnedMissingBcrypt = false

async function loadBcrypt(): Promise<any | null> {
  try {
    // Resolved lazily so edge runtimes without Node builtins never load it.
    const { createRequire } = await import('module')
    return createRequire(import.meta.url)('bcrypt')
  } catch {
    if (!warnedMissingBcrypt) {
      warnedMissingBcrypt = true
      console.warn(
        '[password-hash] A bcrypt ($2…) password hash was encountered but the bcrypt package is not installed; those users cannot log in until it is.'
      )
    }
    return null
  }
}

export interface VerifyPasswordOptions {
  /**
   * Extra iteration counts to try for legacy untagged hashes, in addition to
   * the defaults (100000, then 4096). Main derived legacy hashes at
   * 2^saltRounds, so adapters pass 2^(configured saltRounds) here.
   */
  legacyIterations?: number[]
}

/**
 * Iteration counts to try, in order, for a legacy untagged hash.
 */
export function legacyIterationCandidates(extra: number[] = []): number[] {
  const out: number[] = []
  for (const n of [PBKDF2_DEFAULT_ITERATIONS, PBKDF2_LEGACY_ITERATIONS, ...extra]) {
    if (isValidPbkdf2Iterations(n) && !out.includes(n)) out.push(n)
  }
  return out
}

/**
 * Verify a password against any supported hash format. Never throws.
 */
export async function verifyPasswordHash(
  password: string,
  hash: string,
  options: VerifyPasswordOptions = {}
): Promise<boolean> {
  try {
    const parsed = parsePasswordHash(hash)

    switch (parsed.kind) {
      case 'pbkdf2': {
        const derived = await derivePbkdf2(password, parsed.salt, parsed.iterations)
        return constantTimeEqual(derived, parsed.dk)
      }
      case 'legacy-pbkdf2': {
        for (const iterations of legacyIterationCandidates(options.legacyIterations)) {
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
