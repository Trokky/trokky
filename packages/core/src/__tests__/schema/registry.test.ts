import { SchemaRegistry } from '../../schema/registry'
import { testSchemas, blogPostSchema, userSchema } from '../fixtures/test-schemas'
import { ContentSchema } from '../../types/index'

describe('SchemaRegistry', () => {
  describe('Array-based initialization', () => {
    let registry: SchemaRegistry

    beforeEach(() => {
      registry = new SchemaRegistry(testSchemas)
    })

    test('should load schemas from array', () => {
      expect(registry.getAllSchemas()).toHaveLength(testSchemas.length)
      expect(registry.hasSchema('posts')).toBe(true)
      expect(registry.hasSchema('users')).toBe(true)
      expect(registry.hasSchema('settings')).toBe(true)
    })

    test('should get schema by name', () => {
      const schema = registry.getSchema('posts')
      expect(schema).toEqual(blogPostSchema)
    })

    test('should return null for unknown schema', () => {
      const schema = registry.getSchema('unknown')
      expect(schema).toBeNull()
    })

    test('should check if schema exists', () => {
      expect(registry.hasSchema('posts')).toBe(true)
      expect(registry.hasSchema('unknown')).toBe(false)
    })

    test('should get all schema names', () => {
      const names = registry.getSchemaNames()
      expect(names).toContain('posts')
      expect(names).toContain('users')
      expect(names).toContain('settings')
      expect(names).toHaveLength(3)
    })

    test('should get all schemas', () => {
      const schemas = registry.getAllSchemas()
      expect(schemas).toHaveLength(testSchemas.length)
      expect(schemas).toContainEqual(blogPostSchema)
      expect(schemas).toContainEqual(userSchema)
    })
  })

  describe('Schema validation', () => {
    test('should accept valid schemas', () => {
      expect(() => new SchemaRegistry([blogPostSchema])).not.toThrow()
    })

    test('should reject invalid schemas', () => {
      const invalidSchema = {
        name: 'invalid',
        type: 'unknown' as any, // invalid type
        fields: {}
      }

      expect(() => new SchemaRegistry([invalidSchema]))
        .toThrow(/Invalid schema/)
    })

    test('should reject schemas with invalid field types', () => {
      const invalidSchema: ContentSchema = {
        name: 'invalid',
        type: 'document',
        fields: {
          invalidField: {
            type: 'invalid' as any,
            required: false
          }
        }
      }

      expect(() => new SchemaRegistry([invalidSchema]))
        .toThrow(/Invalid schema/)
    })

    test('should reject schemas with missing required properties', () => {
      const invalidSchema = {
        name: 'invalid',
        // missing type and fields
      } as any

      expect(() => new SchemaRegistry([invalidSchema]))
        .toThrow(/Invalid schema/)
    })

    test('should validate nested field definitions', () => {
      const schemaWithNestedFields: ContentSchema = {
        name: 'nested',
        type: 'document',
        fields: {
          metadata: {
            type: 'object',
            required: false,
            properties: {
              tags: {
                type: 'array',
                required: false,
                items: {
                  type: 'string',
                  required: true
                }
              }
            }
          }
        }
      }

      expect(() => new SchemaRegistry([schemaWithNestedFields])).not.toThrow()
    })
  })

  describe('Runtime schema management', () => {
    let registry: SchemaRegistry

    beforeEach(() => {
      registry = new SchemaRegistry([])
    })

    test('should register new schema', () => {
      registry.registerSchema(blogPostSchema)
      
      expect(registry.hasSchema('posts')).toBe(true)
      expect(registry.getSchema('posts')).toEqual(blogPostSchema)
    })

    test('should unregister schema', () => {
      registry.registerSchema(blogPostSchema)
      expect(registry.hasSchema('posts')).toBe(true)
      
      const removed = registry.unregisterSchema('posts')
      expect(removed).toBe(true)
      expect(registry.hasSchema('posts')).toBe(false)
    })

    test('should return false when unregistering non-existent schema', () => {
      const removed = registry.unregisterSchema('non-existent')
      expect(removed).toBe(false)
    })

    test('should update existing schema when re-registered', () => {
      registry.registerSchema(blogPostSchema)
      
      const updatedSchema: ContentSchema = {
        ...blogPostSchema,
        title: 'Updated Blog Posts'
      }
      
      registry.registerSchema(updatedSchema)
      
      expect(registry.getSchema('posts')?.title).toBe('Updated Blog Posts')
    })

    test('should validate schema before registration', () => {
      const invalidSchema = {
        name: 'invalid',
        type: 'unknown' as any,
        fields: {}
      }

      expect(() => registry.registerSchema(invalidSchema))
        .toThrow(/Invalid schema/)
    })
  })

  describe('File-based schema loading', () => {
    test('should throw error for file-based loading (not implemented)', () => {
      expect(() => new SchemaRegistry('./schemas/**/*.ts'))
        .toThrow('File-based schema loading not yet implemented')
    })
  })

  describe('Edge cases', () => {
    test('should handle empty schema array', () => {
      const registry = new SchemaRegistry([])
      
      expect(registry.getAllSchemas()).toHaveLength(0)
      expect(registry.getSchemaNames()).toHaveLength(0)
      expect(registry.hasSchema('anything')).toBe(false)
    })

    test('should handle schemas with same name (last one wins)', () => {
      const schema1: ContentSchema = {
        name: 'duplicate',
        type: 'document',
        title: 'First',
        fields: {}
      }

      const schema2: ContentSchema = {
        name: 'duplicate',
        type: 'document', 
        title: 'Second',
        fields: {}
      }

      const registry = new SchemaRegistry([schema1, schema2])
      
      expect(registry.getSchema('duplicate')?.title).toBe('Second')
      expect(registry.getAllSchemas()).toHaveLength(1)
    })

    test('should handle complex nested schema structures', () => {
      const complexSchema: ContentSchema = {
        name: 'complex',
        type: 'document',
        fields: {
          deeplyNested: {
            type: 'object',
            required: false,
            properties: {
              level1: {
                type: 'object',
                required: false,
                properties: {
                  level2: {
                    type: 'array',
                    required: false,
                    items: {
                      type: 'object',
                      required: true,
                      properties: {
                        level3: {
                          type: 'string',
                          required: true
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      expect(() => new SchemaRegistry([complexSchema])).not.toThrow()
      
      const registry = new SchemaRegistry([complexSchema])
      expect(registry.getSchema('complex')).toEqual(complexSchema)
    })

    test('should preserve schema field order and structure', () => {
      const registry = new SchemaRegistry([blogPostSchema])
      const retrievedSchema = registry.getSchema('posts')
      
      expect(Object.keys(retrievedSchema!.fields)).toEqual(Object.keys(blogPostSchema.fields))
      expect(retrievedSchema!.fields.title).toEqual(blogPostSchema.fields.title)
    })
  })

  describe('Memory usage', () => {
    test('should handle large number of schemas efficiently', () => {
      const schemas: ContentSchema[] = []
      
      // Create 1000 schemas
      for (let i = 0; i < 1000; i++) {
        schemas.push({
          name: `schema${i}`,
          type: 'document',
          fields: {
            field1: { type: 'string', required: true },
            field2: { type: 'number', required: false }
          }
        })
      }

      const startTime = Date.now()
      const registry = new SchemaRegistry(schemas)
      const endTime = Date.now()

      expect(registry.getAllSchemas()).toHaveLength(1000)
      expect(endTime - startTime).toBeLessThan(1000) // Should be fast
      
      // Verify random access is still fast
      const accessStart = Date.now()
      for (let i = 0; i < 100; i++) {
        const randomIndex = Math.floor(Math.random() * 1000)
        registry.getSchema(`schema${randomIndex}`)
      }
      const accessEnd = Date.now()
      
      expect(accessEnd - accessStart).toBeLessThan(100)
    })
  })
})