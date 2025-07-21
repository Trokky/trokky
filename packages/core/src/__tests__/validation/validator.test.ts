import { DocumentValidator } from '../../validation/validator'
import { SchemaRegistry } from '../../schema/registry'
import { testSchemas, sampleBlogPost, sampleUser, invalidBlogPost } from '../fixtures/test-schemas'
import { ContentSchema } from '../../types/index'

describe('DocumentValidator', () => {
  let validator: DocumentValidator
  let registry: SchemaRegistry

  beforeEach(() => {
    registry = new SchemaRegistry(testSchemas)
    validator = new DocumentValidator(registry)
  })

  describe('validateDocument', () => {
    test('should validate correct document', () => {
      const result = validator.validateDocument('posts', sampleBlogPost)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    test('should reject document with missing required fields', () => {
      const result = validator.validateDocument('posts', invalidBlogPost)
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.field.includes('title'))).toBe(true)
      expect(result.errors.some(e => e.field.includes('author'))).toBe(true)
    })

    test('should reject document for unknown collection', () => {
      const result = validator.validateDocument('unknown', sampleBlogPost)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('_collection')
      expect(result.errors[0].code).toBe('SCHEMA_NOT_FOUND')
    })

    test('should validate optional fields', () => {
      const minimalPost = {
        title: 'Test',
        content: 'Content',
        author: 'Author'
        // publishedAt, tags, metadata are optional
      }

      const result = validator.validateDocument('posts', minimalPost)
      expect(result.valid).toBe(true)
    })

    test('should validate array fields', () => {
      const postWithTags = {
        ...sampleBlogPost,
        tags: ['tech', 'programming', 'javascript']
      }

      const result = validator.validateDocument('posts', postWithTags)
      expect(result.valid).toBe(true)
    })

    test('should reject invalid array items', () => {
      const postWithInvalidTags = {
        ...sampleBlogPost,
        tags: ['valid', 123, 'also-valid'] // number in string array
      }

      const result = validator.validateDocument('posts', postWithInvalidTags)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field.includes('tags'))).toBe(true)
    })

    test('should validate object fields', () => {
      const postWithMetadata = {
        ...sampleBlogPost,
        metadata: {
          excerpt: 'Short description',
          readingTime: 5,
          featured: true
        }
      }

      const result = validator.validateDocument('posts', postWithMetadata)
      expect(result.valid).toBe(true)
    })

    test('should reject invalid object properties', () => {
      const postWithInvalidMetadata = {
        ...sampleBlogPost,
        metadata: {
          excerpt: 'Valid excerpt',
          readingTime: 'not a number', // should be number
          featured: true
        }
      }

      const result = validator.validateDocument('posts', postWithInvalidMetadata)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.field.includes('metadata.readingTime'))).toBe(true)
    })

    test('should validate date fields', () => {
      const postWithDate = {
        ...sampleBlogPost,
        publishedAt: new Date()
      }

      const result = validator.validateDocument('posts', postWithDate)
      expect(result.valid).toBe(true)
    })

    test('should accept date strings and convert them', () => {
      const postWithDateString = {
        ...sampleBlogPost,
        publishedAt: '2024-01-01T00:00:00Z'
      }

      const result = validator.validateDocument('posts', postWithDateString)
      expect(result.valid).toBe(true)
    })

    test('should reject invalid date strings', () => {
      const postWithInvalidDate = {
        ...sampleBlogPost,
        publishedAt: 'not a date'
      }

      const result = validator.validateDocument('posts', postWithInvalidDate)
      expect(result.valid).toBe(false)
    })

    test('should validate reference fields', () => {
      const schemaWithReference: ContentSchema = {
        name: 'comments',
        type: 'document',
        fields: {
          content: { type: 'string', required: true },
          postId: { type: 'reference', required: true, collection: 'posts' },
          authorId: { type: 'reference', required: false, collection: 'users' }
        }
      }

      registry.registerSchema(schemaWithReference)

      const comment = {
        content: 'Great post!',
        postId: 'post-123',
        authorId: 'user-456'
      }

      const result = validator.validateDocument('comments', comment)
      expect(result.valid).toBe(true)
    })

    test('should validate media fields', () => {
      const postWithMedia = {
        ...sampleBlogPost,
        featuredImage: 'media-123'
      }

      const result = validator.validateDocument('posts', postWithMedia)
      expect(result.valid).toBe(true)
    })

    test('should reject non-string reference fields', () => {
      const schemaWithReference: ContentSchema = {
        name: 'comments',
        type: 'document',
        fields: {
          content: { type: 'string', required: true },
          postId: { type: 'reference', required: true }
        }
      }

      registry.registerSchema(schemaWithReference)

      const commentWithInvalidRef = {
        content: 'Great post!',
        postId: 123 // should be string
      }

      const result = validator.validateDocument('comments', commentWithInvalidRef)
      expect(result.valid).toBe(false)
    })

    test('should handle nested object validation', () => {
      const postWithNestedMetadata = {
        ...sampleBlogPost,
        metadata: {
          excerpt: 'Valid excerpt',
          readingTime: 5,
          featured: true,
          extraField: 'should be ignored if not in schema'
        }
      }

      const result = validator.validateDocument('posts', postWithNestedMetadata)
      expect(result.valid).toBe(true)
    })

    test('should validate boolean fields', () => {
      const user = {
        ...sampleUser,
        active: false
      }

      const result = validator.validateDocument('users', user)
      expect(result.valid).toBe(true)
    })

    test('should reject wrong type for boolean fields', () => {
      const userWithInvalidBoolean = {
        ...sampleUser,
        active: 'yes' // should be boolean
      }

      const result = validator.validateDocument('users', userWithInvalidBoolean)
      expect(result.valid).toBe(false)
    })

    test('should validate number fields', () => {
      const postWithReadingTime = {
        ...sampleBlogPost,
        metadata: {
          readingTime: 10
        }
      }

      const result = validator.validateDocument('posts', postWithReadingTime)
      expect(result.valid).toBe(true)
    })

    test('should reject string for number fields', () => {
      const postWithStringNumber = {
        ...sampleBlogPost,
        metadata: {
          readingTime: '10' // should be number
        }
      }

      const result = validator.validateDocument('posts', postWithStringNumber)
      expect(result.valid).toBe(false)
    })

    test('should provide detailed error information', () => {
      const invalidDoc = {
        title: 123, // should be string
        content: true, // should be string
        // missing required author field
        tags: ['valid', 456], // invalid array item
        metadata: {
          readingTime: 'invalid' // should be number
        }
      }

      const result = validator.validateDocument('posts', invalidDoc)
      
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      
      // Check that errors have proper structure
      result.errors.forEach(error => {
        expect(error).toHaveProperty('field')
        expect(error).toHaveProperty('message')
        expect(error).toHaveProperty('code')
        expect(typeof error.field).toBe('string')
        expect(typeof error.message).toBe('string')
        expect(typeof error.code).toBe('string')
      })
    })

    test('should reject schemas with unknown field types', () => {
      const schemaWithUnknownType: ContentSchema = {
        name: 'test',
        type: 'document',
        fields: {
          unknownField: { type: 'unknown' as any, required: false }
        }
      }

      // Should reject invalid schema during registration
      expect(() => registry.registerSchema(schemaWithUnknownType))
        .toThrow(/Invalid schema/)
    })
  })

  describe('Error handling', () => {
    test('should handle validation errors gracefully', () => {
      // Test with completely invalid data
      const result = validator.validateDocument('posts', null)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].field).toBe('_root')
    })

    test('should handle circular references in data', () => {
      const circularData: any = {
        title: 'Test',
        content: 'Content',
        author: 'Author'
      }
      circularData.self = circularData

      // Should not crash, but may reject the document
      const result = validator.validateDocument('posts', circularData)
      expect(result).toBeDefined()
    })

    test('should provide meaningful error messages', () => {
      const result = validator.validateDocument('posts', { title: 123 })
      
      expect(result.valid).toBe(false)
      const titleError = result.errors.find(e => e.field === 'title')
      expect(titleError?.message).toContain('string')
    })
  })

  describe('Performance', () => {
    test('should validate documents efficiently', () => {
      const documents = Array.from({ length: 1000 }, (_, i) => ({
        ...sampleBlogPost,
        title: `Test Post ${i}`
      }))

      const startTime = Date.now()
      
      documents.forEach(doc => {
        validator.validateDocument('posts', doc)
      })
      
      const endTime = Date.now()
      const duration = endTime - startTime
      
      expect(duration).toBeLessThan(1000) // Should validate 1000 docs in < 1 second
      console.log(`Validated 1000 documents in ${duration}ms`)
    })

    test('should handle complex nested structures efficiently', () => {
      const complexDoc = {
        ...sampleBlogPost,
        metadata: {
          excerpt: 'Test',
          readingTime: 5,
          featured: true,
          tags: Array.from({ length: 100 }, (_, i) => `tag${i}`),
          categories: Array.from({ length: 50 }, (_, i) => ({
            name: `category${i}`,
            weight: Math.random()
          }))
        }
      }

      const startTime = Date.now()
      const result = validator.validateDocument('posts', complexDoc)
      const endTime = Date.now()

      expect(result.valid).toBe(true)
      expect(endTime - startTime).toBeLessThan(100) // Should be fast even for complex docs
    })
  })
})