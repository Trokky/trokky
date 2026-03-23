import { describe, it, expect } from 'vitest'
import {
  getUniversalCrypto,
  bytesToHex,
  generateRandomHex,
  generateUUID,
  getSecureRandomInt,
  secureShuffleArray,
  generateSecurePassword,
} from '../../core/utils/universal-crypto.js'

describe('Universal Crypto', () => {
  describe('getUniversalCrypto', () => {
    it('should return a crypto provider with getRandomBytes', () => {
      const crypto = getUniversalCrypto()
      expect(crypto).toBeDefined()
      expect(typeof crypto.getRandomBytes).toBe('function')
    })

    it('should generate random bytes of requested length', () => {
      const crypto = getUniversalCrypto()
      const bytes = crypto.getRandomBytes(32)
      expect(bytes).toBeInstanceOf(Uint8Array)
      expect(bytes.length).toBe(32)
    })

    it('should generate different bytes on each call', () => {
      const crypto = getUniversalCrypto()
      const a = crypto.getRandomBytes(16)
      const b = crypto.getRandomBytes(16)
      // Extremely unlikely to be equal
      expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false)
    })
  })

  describe('bytesToHex', () => {
    it('should convert bytes to hex string', () => {
      const bytes = new Uint8Array([0, 1, 15, 16, 255])
      expect(bytesToHex(bytes)).toBe('00010f10ff')
    })

    it('should handle empty array', () => {
      expect(bytesToHex(new Uint8Array([]))).toBe('')
    })

    it('should produce lowercase hex', () => {
      const bytes = new Uint8Array([171, 205]) // 0xAB, 0xCD
      expect(bytesToHex(bytes)).toBe('abcd')
    })
  })

  describe('generateRandomHex', () => {
    it('should generate hex string of specified character length', () => {
      const hex = generateRandomHex(16)
      expect(hex).toMatch(/^[0-9a-f]+$/)
      expect(hex.length).toBe(16)

      const hex32 = generateRandomHex(32)
      expect(hex32.length).toBe(32)
    })

    it('should generate unique values', () => {
      const values = new Set<string>()
      for (let i = 0; i < 100; i++) {
        values.add(generateRandomHex(8))
      }
      expect(values.size).toBe(100)
    })
  })

  describe('generateUUID', () => {
    it('should generate valid UUID v4', () => {
      const uuid = generateUUID()
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      expect(uuid).toMatch(uuidRegex)
    })

    it('should generate unique UUIDs', () => {
      const uuids = new Set<string>()
      for (let i = 0; i < 500; i++) {
        uuids.add(generateUUID())
      }
      expect(uuids.size).toBe(500)
    })

    it('should have version 4 marker', () => {
      const uuid = generateUUID()
      expect(uuid.charAt(14)).toBe('4')
    })

    it('should have variant 1 marker', () => {
      const uuid = generateUUID()
      const variantChar = uuid.charAt(19)
      expect(['8', '9', 'a', 'b']).toContain(variantChar)
    })
  })

  describe('getSecureRandomInt', () => {
    it('should return integer in range [0, max)', () => {
      for (let i = 0; i < 1000; i++) {
        const val = getSecureRandomInt(10)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThan(10)
        expect(Number.isInteger(val)).toBe(true)
      }
    })

    it('should return 0 for max=1', () => {
      for (let i = 0; i < 10; i++) {
        expect(getSecureRandomInt(1)).toBe(0)
      }
    })

    it('should throw for max <= 0', () => {
      expect(() => getSecureRandomInt(0)).toThrow()
      expect(() => getSecureRandomInt(-1)).toThrow()
    })

    it('should handle max > 256 (multi-byte sampling)', () => {
      for (let i = 0; i < 100; i++) {
        const val = getSecureRandomInt(1000)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThan(1000)
      }
    })

    it('should handle large max values', () => {
      for (let i = 0; i < 50; i++) {
        const val = getSecureRandomInt(100000)
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThan(100000)
      }
    })

    it('should produce a roughly uniform distribution', () => {
      const buckets = new Array(10).fill(0)
      const iterations = 10000
      for (let i = 0; i < iterations; i++) {
        buckets[getSecureRandomInt(10)]++
      }
      // Each bucket should have ~1000 hits, allow 30% variance
      for (const count of buckets) {
        expect(count).toBeGreaterThan(700)
        expect(count).toBeLessThan(1300)
      }
    })
  })

  describe('secureShuffleArray', () => {
    it('should return a new array (not mutate original)', () => {
      const original = [1, 2, 3, 4, 5]
      const shuffled = secureShuffleArray(original)
      expect(shuffled).not.toBe(original)
      expect(original).toEqual([1, 2, 3, 4, 5])
    })

    it('should contain the same elements', () => {
      const original = [1, 2, 3, 4, 5]
      const shuffled = secureShuffleArray(original)
      expect(shuffled.sort()).toEqual(original.sort())
    })

    it('should handle empty arrays', () => {
      expect(secureShuffleArray([])).toEqual([])
    })

    it('should handle single-element arrays', () => {
      expect(secureShuffleArray([42])).toEqual([42])
    })

    it('should actually shuffle (not return same order every time)', () => {
      const original = Array.from({ length: 20 }, (_, i) => i)
      let differentOrderCount = 0
      for (let i = 0; i < 10; i++) {
        const shuffled = secureShuffleArray(original)
        if (JSON.stringify(shuffled) !== JSON.stringify(original)) {
          differentOrderCount++
        }
      }
      // At least 9 out of 10 shuffles should differ from original
      expect(differentOrderCount).toBeGreaterThanOrEqual(9)
    })

    it('should handle arrays with > 256 elements', () => {
      const large = Array.from({ length: 500 }, (_, i) => i)
      const shuffled = secureShuffleArray(large)
      expect(shuffled).toHaveLength(500)
      expect(shuffled.sort((a, b) => a - b)).toEqual(large)
    })
  })

  describe('generateSecurePassword', () => {
    it('should generate password of default length (16)', () => {
      const password = generateSecurePassword()
      expect(password.length).toBe(16)
    })

    it('should generate password of specified length', () => {
      const password = generateSecurePassword({ length: 32 })
      expect(password.length).toBe(32)
    })

    it('should include uppercase by default', () => {
      // Generate many passwords to statistically ensure uppercase presence
      let hasUpper = false
      for (let i = 0; i < 20; i++) {
        if (/[A-Z]/.test(generateSecurePassword())) {
          hasUpper = true
          break
        }
      }
      expect(hasUpper).toBe(true)
    })

    it('should include lowercase by default', () => {
      let hasLower = false
      for (let i = 0; i < 20; i++) {
        if (/[a-z]/.test(generateSecurePassword())) {
          hasLower = true
          break
        }
      }
      expect(hasLower).toBe(true)
    })

    it('should include numbers by default', () => {
      let hasNumber = false
      for (let i = 0; i < 20; i++) {
        if (/[0-9]/.test(generateSecurePassword())) {
          hasNumber = true
          break
        }
      }
      expect(hasNumber).toBe(true)
    })

    it('should respect includeSpecialChars=false', () => {
      const password = generateSecurePassword({
        length: 100,
        includeSpecialChars: false,
      })
      expect(password).toMatch(/^[a-zA-Z0-9]+$/)
    })

    it('should generate unique passwords', () => {
      const passwords = new Set<string>()
      for (let i = 0; i < 100; i++) {
        passwords.add(generateSecurePassword())
      }
      expect(passwords.size).toBe(100)
    })
  })
})
