import { describe, it, expect } from 'vitest'
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import {
  constantTimeEqual,
  parsePasswordHash,
  verifyPasswordHash,
  PBKDF2_DEFAULT_ITERATIONS,
  PBKDF2_LEGACY_ITERATIONS,
} from '../../core/crypto/password-hash.js'
import { WebCryptoAdapter } from '../../core/crypto/webcrypto-adapter.js'
import { NodeCryptoAdapter } from '../../core/crypto/node-adapter.js'

const PASSWORD = 'correct-horse-battery-staple'
const WRONG_PASSWORD = 'incorrect-horse-battery-staple'

/**
 * Reproduces the untagged hash format written by the pre-versioning code:
 * base64(16-byte salt || 32-byte PBKDF2-SHA256 derived key).
 */
function makeLegacyHash(password: string, iterations: number): string {
  const salt = randomBytes(16)
  const dk = pbkdf2Sync(password, salt, iterations, 32, 'sha256')
  return Buffer.concat([salt, dk]).toString('base64')
}

// password: correct-horse-battery-staple, PBKDF2-SHA256, 4096 iterations, main's untagged format
const LEGACY_FIXTURE_A = 'jRy44Ly63u9bDpwpioe61qbX9oeBIi6frnMSflFdTy7mq2ziDAQSi4zNq0cRuauJ'

// password: correct-horse-battery-staple, PBKDF2-SHA256, 4096 iterations, main's untagged format
const LEGACY_FIXTURE_B = 'Fe8/hLha8SX3RDFaZT1W4J0YIs7DeUyeS1wz9eSA44X4S6r8MuJ/gxaBXwPIj6wY'

// password: correct-horse-battery-staple, bcrypt cost 10
const BCRYPT_FIXTURE = '$2b$10$DeH4vd1H41oVkDeJHS2SXOjPGzPxxuBMVbbxcfq2jkxpRND4S20h6'

const LITERAL_FIXTURES: Array<{ label: string; hash: string }> = [
  { label: 'legacy fixture A', hash: LEGACY_FIXTURE_A },
  { label: 'legacy fixture B', hash: LEGACY_FIXTURE_B },
  { label: 'bcrypt fixture', hash: BCRYPT_FIXTURE },
]

describe('password-hash compatibility', () => {
  describe('verification of hashes written by previous releases', () => {
    for (const { label, hash } of LITERAL_FIXTURES) {
      it(`should verify the ${label} with verifyPasswordHash`, async () => {
        await expect(verifyPasswordHash(PASSWORD, hash)).resolves.toBe(true)
      })

      it(`should reject the wrong password against the ${label} with verifyPasswordHash`, async () => {
        await expect(verifyPasswordHash(WRONG_PASSWORD, hash)).resolves.toBe(false)
      })

      it(`should verify the ${label} with WebCryptoAdapter`, async () => {
        const adapter = new WebCryptoAdapter()
        await expect(adapter.verifyPassword(PASSWORD, hash)).resolves.toBe(true)
        await expect(adapter.verifyPassword(WRONG_PASSWORD, hash)).resolves.toBe(false)
      })

      it(`should verify the ${label} with NodeCryptoAdapter`, async () => {
        const adapter = new NodeCryptoAdapter()
        await expect(adapter.verifyPassword(PASSWORD, hash)).resolves.toBe(true)
        await expect(adapter.verifyPassword(WRONG_PASSWORD, hash)).resolves.toBe(false)
      })
    }

    it('should verify a freshly generated legacy hash at 4096 iterations', async () => {
      const hash = makeLegacyHash(PASSWORD, PBKDF2_LEGACY_ITERATIONS)
      await expect(verifyPasswordHash(PASSWORD, hash)).resolves.toBe(true)
      await expect(verifyPasswordHash(WRONG_PASSWORD, hash)).resolves.toBe(false)
    })

    it('should verify a freshly generated legacy hash at 100000 iterations', async () => {
      const hash = makeLegacyHash(PASSWORD, PBKDF2_DEFAULT_ITERATIONS)
      await expect(verifyPasswordHash(PASSWORD, hash)).resolves.toBe(true)
      await expect(verifyPasswordHash(WRONG_PASSWORD, hash)).resolves.toBe(false)
    })
  })

  describe('parsePasswordHash', () => {
    it('should classify a tagged PBKDF2 hash as pbkdf2 and expose its iteration count', async () => {
      const hash = await new WebCryptoAdapter().hashPassword(PASSWORD)
      const parsed = parsePasswordHash(hash)
      expect(parsed.kind).toBe('pbkdf2')
      if (parsed.kind === 'pbkdf2') {
        expect(parsed.iterations).toBe(PBKDF2_DEFAULT_ITERATIONS)
        expect(parsed.salt.length).toBe(16)
        expect(parsed.dk.length).toBe(32)
      }
    })

    it('should classify untagged base64 salt+key hashes as legacy-pbkdf2', () => {
      for (const hash of [LEGACY_FIXTURE_A, LEGACY_FIXTURE_B]) {
        const parsed = parsePasswordHash(hash)
        expect(parsed.kind).toBe('legacy-pbkdf2')
        if (parsed.kind === 'legacy-pbkdf2') {
          expect(parsed.salt.length).toBe(16)
          expect(parsed.dk.length).toBe(32)
        }
      }
    })

    it('should classify $2a$, $2b$ and $2y$ prefixes as bcrypt', () => {
      const body = '10$DeH4vd1H41oVkDeJHS2SXOjPGzPxxuBMVbbxcfq2jkxpRND4S20h6'
      expect(parsePasswordHash(BCRYPT_FIXTURE).kind).toBe('bcrypt')
      expect(parsePasswordHash(`$2a$${body}`).kind).toBe('bcrypt')
      expect(parsePasswordHash(`$2y$${body}`).kind).toBe('bcrypt')
    })

    it('should classify malformed input as unknown without throwing', () => {
      const garbage = [
        '',
        'not-base64!!',
        'c2hvcnQ=',
        '$pbkdf2-sha256$notanumber$c2FsdA==$ZGs=',
        '$pbkdf2-sha256$0$c2FsdA==$ZGs=',
        '$pbkdf2-sha256$100000$c2FsdA==',
      ]
      for (const value of garbage) {
        expect(() => parsePasswordHash(value)).not.toThrow()
        expect(parsePasswordHash(value).kind).toBe('unknown')
      }
    })
  })

  describe('tagged hash round-trip with a custom iteration count', () => {
    it('should embed the iteration count and stay verifiable across adapters', async () => {
      const customAdapter = new WebCryptoAdapter({ pbkdf2Iterations: 12345 })
      const hash = await customAdapter.hashPassword(PASSWORD)

      expect(hash.startsWith('$pbkdf2-sha256$12345$')).toBe(true)

      await expect(customAdapter.verifyPassword(PASSWORD, hash)).resolves.toBe(true)
      await expect(new WebCryptoAdapter().verifyPassword(PASSWORD, hash)).resolves.toBe(true)
      await expect(new NodeCryptoAdapter().verifyPassword(PASSWORD, hash)).resolves.toBe(true)

      await expect(customAdapter.verifyPassword(WRONG_PASSWORD, hash)).resolves.toBe(false)
      await expect(new WebCryptoAdapter().verifyPassword(WRONG_PASSWORD, hash)).resolves.toBe(false)
      await expect(new NodeCryptoAdapter().verifyPassword(WRONG_PASSWORD, hash)).resolves.toBe(false)
    })
  })

  describe('needsRehash', () => {
    it('should flag legacy, bcrypt and under-iterated hashes for the WebCryptoAdapter', async () => {
      const adapter = new WebCryptoAdapter()
      const under = await new WebCryptoAdapter({
        pbkdf2Iterations: PBKDF2_LEGACY_ITERATIONS,
      }).hashPassword(PASSWORD)

      expect(adapter.needsRehash(LEGACY_FIXTURE_A)).toBe(true)
      expect(adapter.needsRehash(LEGACY_FIXTURE_B)).toBe(true)
      expect(adapter.needsRehash(BCRYPT_FIXTURE)).toBe(true)
      expect(adapter.needsRehash(under)).toBe(true)
    })

    it('should not flag a hash the WebCryptoAdapter just produced', async () => {
      const adapter = new WebCryptoAdapter()
      const fresh = await adapter.hashPassword(PASSWORD)
      expect(adapter.needsRehash(fresh)).toBe(false)
    })

    it('should flag everything but bcrypt for the NodeCryptoAdapter', async () => {
      const adapter = new NodeCryptoAdapter()
      const tagged = await new WebCryptoAdapter().hashPassword(PASSWORD)

      expect(adapter.needsRehash(BCRYPT_FIXTURE)).toBe(false)
      expect(adapter.needsRehash(tagged)).toBe(true)
      expect(adapter.needsRehash(LEGACY_FIXTURE_A)).toBe(true)
    })
  })

  describe('mixed user store', () => {
    it('should verify every stored hash format with both adapters', async () => {
      const webAdapter = new WebCryptoAdapter()
      const nodeAdapter = new NodeCryptoAdapter()

      const users: Array<{ username: string; hash: string }> = [
        { username: 'legacy-user', hash: LEGACY_FIXTURE_A },
        { username: 'bcrypt-user', hash: BCRYPT_FIXTURE },
        { username: 'fresh-user', hash: await webAdapter.hashPassword(PASSWORD) },
        {
          username: 'under-iterated-user',
          hash: await new WebCryptoAdapter({
            pbkdf2Iterations: PBKDF2_LEGACY_ITERATIONS,
          }).hashPassword(PASSWORD),
        },
      ]

      for (const user of users) {
        await expect(
          webAdapter.verifyPassword(PASSWORD, user.hash),
          `${user.username} via WebCryptoAdapter`
        ).resolves.toBe(true)
        await expect(
          nodeAdapter.verifyPassword(PASSWORD, user.hash),
          `${user.username} via NodeCryptoAdapter`
        ).resolves.toBe(true)
      }
    })
  })

  describe('constantTimeEqual', () => {
    it('should return true for identical byte arrays', () => {
      expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
      expect(constantTimeEqual(new Uint8Array(), new Uint8Array())).toBe(true)
    })

    it('should return false for same-length arrays with different content', () => {
      expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false)
      expect(constantTimeEqual(new Uint8Array([0, 0, 0]), new Uint8Array([0, 0, 1]))).toBe(false)
    })

    it('should return false for arrays of different lengths', () => {
      expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false)
      expect(constantTimeEqual(new Uint8Array(), new Uint8Array([1]))).toBe(false)
    })
  })
})
