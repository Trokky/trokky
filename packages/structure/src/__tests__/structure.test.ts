/**
 * Basic Structure System Tests
 * Smoke tests to verify the package is working correctly
 */

import { StructureBuilder, TrokkyStructureSchema, QueryBuilder } from '../index'
import { SchemaRegistry } from '@trokky/core'

describe('Structure System', () => {
  let schemaRegistry: SchemaRegistry
  let structureBuilder: StructureBuilder

  beforeEach(() => {
    // Create mock schema registry with test schemas
    const testSchema = {
      name: 'testDocument',
      title: 'Test Document',
      fields: []
    }
    schemaRegistry = new SchemaRegistry([testSchema])
    structureBuilder = new StructureBuilder(schemaRegistry)
  })

  describe('StructureBuilder', () => {
    it('should create a StructureBuilder instance', () => {
      expect(structureBuilder).toBeInstanceOf(StructureBuilder)
    })

    it('should validate a simple structure', () => {
      const structure = testUtils.createMockStructure({
        items: [
          testUtils.createMockDocumentListItem({
            schemaType: 'testDocument' // Use schema that exists in registry
          })
        ]
      })

      const result = structureBuilder.validate(structure)
      // Debug the validation result
      if (!result.isValid) {
        console.log('Validation errors:', result.errors)
        console.log('Validation warnings:', result.warnings)
      }
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect validation errors in invalid structures', () => {
      const invalidStructure = {
        title: 123, // Should be string, not number
        items: 'not-an-array' // Should be array, not string
      }

      const result = structureBuilder.validate(invalidStructure as any)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('QueryBuilder', () => {
    it('should create a QueryBuilder instance', () => {
      const queryBuilder = new QueryBuilder()
      expect(queryBuilder).toBeInstanceOf(QueryBuilder)
    })

    it('should calculate query complexity', () => {
      const queryBuilder = new QueryBuilder()
      const filter = testUtils.createMockQueryFilter({
        $and: [
          { status: { $eq: 'published' } },
          { author: { $in: ['user1', 'user2'] } }
        ]
      })

      const complexity = queryBuilder.calculateComplexity(filter)
      expect(complexity.score).toBeGreaterThan(0)
      expect(complexity.recommendations).toBeInstanceOf(Array)
      expect(complexity.operatorCounts).toBeInstanceOf(Object)
    })
  })

  describe('Schema Validation', () => {
    it('should validate structure with Zod schema', () => {
      const structure = testUtils.createMockStructure({
        items: [
          testUtils.createMockDocumentListItem()
        ]
      })

      const result = TrokkyStructureSchema.safeParse(structure)
      expect(result.success).toBe(true)
    })

    it('should reject invalid structure with Zod schema', () => {
      const invalidStructure = {
        title: 123, // Should be string
        items: 'not-an-array' // Should be array
      }

      const result = TrokkyStructureSchema.safeParse(invalidStructure)
      expect(result.success).toBe(false)
    })
  })

  describe('Navigation Building', () => {
    it('should build navigation tree', async () => {
      const structure = testUtils.createMockStructure({
        items: [
          testUtils.createMockDocumentListItem({
            title: 'Test Documents',
            schemaType: 'testDocument' // Use schema that exists in registry
          })
        ]
      })

      const mockUser = testUtils.createMockUser()
      const navigationTree = await structureBuilder.buildNavigation(structure, mockUser)

      expect(navigationTree).toBeDefined()
      expect(navigationTree.items).toBeInstanceOf(Array)
      expect(navigationTree.metadata).toBeDefined()
      expect(navigationTree.metadata.totalItems).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid queries gracefully', () => {
      const queryBuilder = new QueryBuilder({ maxComplexity: 10 })
      const documentListItem = testUtils.createMockDocumentListItem({
        filter: {
          // Complex nested query that should exceed limit
          $and: Array(50).fill(null).map((_, i) => ({
            [`field${i}`]: { $regex: `pattern${i}` }
          }))
        }
      })

      expect(async () => {
        await queryBuilder.buildQuery(documentListItem)
      }).rejects.toThrow()
    })
  })
})