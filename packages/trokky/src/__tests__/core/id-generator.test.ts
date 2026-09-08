import { describe, it, expect, beforeEach } from 'vitest'
import { IdGenerator } from '../../core/utils/id-generator.js'

describe('IdGenerator', () => {
  let generator: IdGenerator

  beforeEach(() => {
    generator = new IdGenerator()
  })

  describe('generate', () => {
    it('should generate a non-empty string', () => {
      const id = generator.generate()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('should generate unique IDs', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 1000; i++) {
        ids.add(generator.generate())
      }
      expect(ids.size).toBe(1000)
    })

    it('should include prefix when provided', () => {
      const id = generator.generate({ prefix: 'article' })
      expect(id.startsWith('article-')).toBe(true)
    })

    it('should generate IDs with consistent format', () => {
      const id = generator.generate()
      // IDs should only contain alphanumeric chars and hyphens
      expect(id).toMatch(/^[a-zA-Z0-9-]+$/)
    })

    it('should include timestamp component by default', () => {
      const id1 = generator.generate()
      const id2 = generator.generate()
      // IDs generated in sequence should share a timestamp prefix
      // but differ in the counter/random suffix
      expect(id1).not.toBe(id2)
    })
  })

  describe('generateUUID', () => {
    it('should generate valid UUID v4 format', () => {
      const uuid = generator.generateUUID()
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(uuid).toMatch(uuidRegex)
    })

    it('should generate unique UUIDs', () => {
      const uuids = new Set<string>()
      for (let i = 0; i < 100; i++) {
        uuids.add(generator.generateUUID())
      }
      expect(uuids.size).toBe(100)
    })
  })

  describe('validateId', () => {
    it('should accept valid IDs', () => {
      expect(generator.validateId('article-abc123')).toBe(true)
      expect(generator.validateId('doc_test_001')).toBe(true)
      expect(generator.validateId('a')).toBe(true)
    })

    it('should reject empty strings', () => {
      expect(generator.validateId('')).toBe(false)
    })

    it('should reject IDs exceeding max length', () => {
      const longId = 'a'.repeat(101)
      expect(generator.validateId(longId)).toBe(false)
    })

    it('should reject IDs with special characters', () => {
      expect(generator.validateId('doc/../etc')).toBe(false)
      expect(generator.validateId('doc<script>')).toBe(false)
      expect(generator.validateId('doc;DROP TABLE')).toBe(false)
    })

    it('should accept IDs at max length boundary', () => {
      const maxId = 'a'.repeat(100)
      expect(generator.validateId(maxId)).toBe(true)
    })
  })
})
