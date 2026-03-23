import { describe, it, expect, beforeEach } from 'vitest'
import { SchemaRegistry } from '../../core/schema/registry.js'
import { testSchemas, articleSchema, categorySchema, settingsSchema } from '../fixtures/schemas.js'

describe('SchemaRegistry', () => {
  let registry: SchemaRegistry

  beforeEach(() => {
    registry = new SchemaRegistry(testSchemas as any)
  })

  describe('getSchema', () => {
    it('should return schema by name', () => {
      const schema = registry.getSchema('article')
      expect(schema).toBeDefined()
      expect(schema?.name).toBe('article')
    })

    it('should return null for unknown schema', () => {
      expect(registry.getSchema('nonexistent')).toBeNull()
    })

    it('should return schema with fields', () => {
      const schema = registry.getSchema('article')
      expect(schema).toBeDefined()
      expect(schema?.fields).toBeDefined()
      // Fields are validated by Zod - check they exist in some form
      const fields = schema?.fields
      if (Array.isArray(fields)) {
        expect(fields.length).toBeGreaterThan(0)
      } else {
        // Fields may be a Map or object after validation
        expect(Object.keys(fields as any).length).toBeGreaterThan(0)
      }
    })
  })

  describe('hasSchema', () => {
    it('should return true for registered schemas', () => {
      expect(registry.hasSchema('article')).toBe(true)
      expect(registry.hasSchema('category')).toBe(true)
    })

    it('should return false for unregistered schemas', () => {
      expect(registry.hasSchema('unknown')).toBe(false)
    })
  })

  describe('getAllSchemas', () => {
    it('should return all registered schemas', () => {
      const all = registry.getAllSchemas()
      expect(Array.isArray(all)).toBe(true)
      expect(all.length).toBeGreaterThanOrEqual(3)
    })

    it('should include all test schemas', () => {
      const names = registry.getSchemaNames()
      expect(names).toContain('article')
      expect(names).toContain('category')
      expect(names).toContain('settings')
    })
  })

  describe('registerSchema', () => {
    it('should add a new schema', () => {
      const newSchema = {
        name: 'page',
        title: 'Page',
        type: 'document' as const,
        fields: [{ name: 'title', type: 'string' }],
      }
      registry.registerSchema(newSchema as any)
      expect(registry.hasSchema('page')).toBe(true)
    })

    it('should allow overwriting existing schema', () => {
      const updatedSchema = {
        ...articleSchema,
        title: 'Updated Article',
      }
      registry.registerSchema(updatedSchema as any)
      const schema = registry.getSchema('article')
      expect(schema?.title).toBe('Updated Article')
    })
  })

  describe('unregisterSchema', () => {
    it('should remove a registered schema', () => {
      expect(registry.hasSchema('category')).toBe(true)
      registry.unregisterSchema('category')
      expect(registry.hasSchema('category')).toBe(false)
    })

    it('should return false for non-existent schema', () => {
      const result = registry.unregisterSchema('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('getSchemaNames', () => {
    it('should return array of schema names', () => {
      const names = registry.getSchemaNames()
      expect(Array.isArray(names)).toBe(true)
      expect(names.length).toBeGreaterThanOrEqual(3)
      for (const name of names) {
        expect(typeof name).toBe('string')
      }
    })
  })
})
