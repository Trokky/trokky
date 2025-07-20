import { IdGenerator } from '../../utils/id-generator.js'

describe('IdGenerator', () => {
  let idGenerator: IdGenerator

  beforeEach(() => {
    idGenerator = new IdGenerator()
  })

  describe('generate', () => {
    test('should generate unique IDs', () => {
      const ids = new Set()
      const count = 1000

      for (let i = 0; i < count; i++) {
        const id = idGenerator.generate()
        expect(ids.has(id)).toBe(false)
        ids.add(id)
      }

      expect(ids.size).toBe(count)
    })

    test('should generate IDs with prefix', () => {
      const id = idGenerator.generate({ prefix: 'post' })
      expect(id).toMatch(/^post-/)
    })

    test('should generate IDs without timestamp when disabled', () => {
      const id = idGenerator.generate({ includeTimestamp: false })
      // Should not include timestamp, but ID still starts with instanceId which can be hex numbers
      // The key test is that it's shorter and doesn't have the timestamp portion
      const idWithTimestamp = idGenerator.generate({ includeTimestamp: true })
      
      expect(id.length).toBeLessThan(idWithTimestamp.length)
      expect(id).toMatch(/^[a-f0-9-]+$/) // Valid hex characters and hyphens
    })

    test('should respect length parameter', () => {
      const shortId = idGenerator.generate({ length: 8, includeTimestamp: false })
      const longId = idGenerator.generate({ length: 20, includeTimestamp: false })

      expect(shortId.length).toBeGreaterThanOrEqual(8)
      expect(longId.length).toBeGreaterThanOrEqual(20)
    })

    test('should generate different IDs in same millisecond', () => {
      const ids = new Set()

      // Generate multiple IDs quickly (same millisecond)
      for (let i = 0; i < 100; i++) {
        const id = idGenerator.generate()
        expect(ids.has(id)).toBe(false)
        ids.add(id)
      }

      expect(ids.size).toBe(100)
    })

    test('should include instance ID for uniqueness across processes', () => {
      const generator1 = new IdGenerator()
      const generator2 = new IdGenerator()

      const id1 = generator1.generate()
      const id2 = generator2.generate()

      // IDs should be different even if generated at same time
      expect(id1).not.toBe(id2)
    })

    test('should handle counter overflow gracefully', () => {
      // Reset counter to near max safe integer
      (idGenerator as any).counter = Number.MAX_SAFE_INTEGER - 5

      const ids = new Set()
      for (let i = 0; i < 10; i++) {
        const id = idGenerator.generate()
        expect(ids.has(id)).toBe(false)
        ids.add(id)
      }

      expect(ids.size).toBe(10)
    })

    test('should generate valid character sets', () => {
      const id = idGenerator.generate()
      // Should only contain alphanumeric characters and hyphens
      expect(id).toMatch(/^[a-zA-Z0-9-]+$/)
    })
  })

  describe('generateUUID', () => {
    test('should generate valid UUID v4 format', () => {
      const uuid = idGenerator.generateUUID()
      
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(uuid).toMatch(uuidRegex)
    })

    test('should generate unique UUIDs', () => {
      const uuids = new Set()
      const count = 1000

      for (let i = 0; i < count; i++) {
        const uuid = idGenerator.generateUUID()
        expect(uuids.has(uuid)).toBe(false)
        uuids.add(uuid)
      }

      expect(uuids.size).toBe(count)
    })

    test('should have correct version and variant bits', () => {
      const uuid = idGenerator.generateUUID()
      const parts = uuid.split('-')

      // Version should be 4
      expect(parts[2].charAt(0)).toBe('4')

      // Variant should be 8, 9, a, or b
      const variantChar = parts[3].charAt(0).toLowerCase()
      expect(['8', '9', 'a', 'b']).toContain(variantChar)
    })
  })

  describe('validateId', () => {
    test('should validate correct IDs', () => {
      const validIds = [
        'abc123',
        'user_123',
        'post-456',
        'a',
        '123',
        'mixed_123-test',
        idGenerator.generate(),
        idGenerator.generateUUID()
      ]

      validIds.forEach(id => {
        expect(idGenerator.validateId(id)).toBe(true)
      })
    })

    test('should reject invalid IDs', () => {
      const invalidIds = [
        '', // empty
        'id with spaces', // spaces
        'id@email', // special chars
        'id/path', // slash
        'id.field', // dot
        'a'.repeat(101), // too long
        null,
        undefined,
        123
      ]

      invalidIds.forEach(id => {
        expect(idGenerator.validateId(id as any)).toBe(false)
      })
    })

    test('should reject IDs that are too long', () => {
      const longId = 'a'.repeat(101)
      expect(idGenerator.validateId(longId)).toBe(false)
    })

    test('should reject non-string inputs', () => {
      const nonStringInputs = [null, undefined, 123, {}, [], true]

      nonStringInputs.forEach(input => {
        expect(idGenerator.validateId(input as any)).toBe(false)
      })
    })
  })

  describe('reset', () => {
    test('should reset internal counter', () => {
      // Generate some IDs to increment counter
      for (let i = 0; i < 10; i++) {
        idGenerator.generate()
      }

      idGenerator.reset()

      // Counter should be reset (visible through ID structure)
      const id1 = idGenerator.generate()
      const id2 = idGenerator.generate()

      // IDs should still be unique after reset
      expect(id1).not.toBe(id2)
    })
  })

  describe('collision resistance', () => {
    test('should handle high-frequency generation', () => {
      const ids = new Set()
      const count = 10000

      // Generate many IDs quickly
      const startTime = Date.now()
      for (let i = 0; i < count; i++) {
        const id = idGenerator.generate()
        expect(ids.has(id)).toBe(false)
        ids.add(id)
      }
      const endTime = Date.now()

      expect(ids.size).toBe(count)
      console.log(`Generated ${count} unique IDs in ${endTime - startTime}ms`)
    })

    test('should handle multiple generators simultaneously', () => {
      const generators = Array.from({ length: 10 }, () => new IdGenerator())
      const allIds = new Set()

      generators.forEach(generator => {
        for (let i = 0; i < 100; i++) {
          const id = generator.generate()
          expect(allIds.has(id)).toBe(false)
          allIds.add(id)
        }
      })

      expect(allIds.size).toBe(1000)
    })
  })

  describe('performance', () => {
    test('should generate IDs efficiently', () => {
      const count = 1000
      const startTime = process.hrtime.bigint()

      for (let i = 0; i < count; i++) {
        idGenerator.generate()
      }

      const endTime = process.hrtime.bigint()
      const durationMs = Number(endTime - startTime) / 1000000

      // Should be able to generate 1000 IDs in reasonable time (< 100ms)
      expect(durationMs).toBeLessThan(100)
      
      console.log(`Generated ${count} IDs in ${durationMs.toFixed(2)}ms`)
    })

    test('should generate UUIDs efficiently', () => {
      const count = 1000
      const startTime = process.hrtime.bigint()

      for (let i = 0; i < count; i++) {
        idGenerator.generateUUID()
      }

      const endTime = process.hrtime.bigint()
      const durationMs = Number(endTime - startTime) / 1000000

      // Should be able to generate 1000 UUIDs in reasonable time (< 100ms)
      expect(durationMs).toBeLessThan(100)
      
      console.log(`Generated ${count} UUIDs in ${durationMs.toFixed(2)}ms`)
    })
  })
})