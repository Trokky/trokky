import { SecurityValidator } from '../../security/validation.js'
import { InvalidInputError } from '../../errors/index.js'

describe('SecurityValidator', () => {
  describe('validateCollectionName', () => {
    test('should accept valid collection names', () => {
      const validNames = [
        'posts',
        'blog_posts',
        'user-profiles',
        'Category123',
        'a',
        'A1_test-name'
      ]

      validNames.forEach(name => {
        expect(() => SecurityValidator.validateCollectionName(name)).not.toThrow()
      })
    })

    test('should reject invalid collection names', () => {
      const invalidNames = [
        '', // empty
        '123posts', // starts with number
        'posts with spaces', // contains spaces
        'posts@email', // contains special chars
        'a'.repeat(51), // too long
        'posts/path', // contains slash
        'posts.field' // contains dot
      ]

      invalidNames.forEach(name => {
        expect(() => SecurityValidator.validateCollectionName(name))
          .toThrow(InvalidInputError)
      })
    })

    test('should reject reserved collection names', () => {
      const reservedNames = ['admin', 'api', 'system', 'config', 'schema', 'migration']

      reservedNames.forEach(name => {
        expect(() => SecurityValidator.validateCollectionName(name))
          .toThrow(InvalidInputError)
        expect(() => SecurityValidator.validateCollectionName(name.toUpperCase()))
          .toThrow(InvalidInputError)
      })
    })

    test('should reject non-string inputs', () => {
      const invalidInputs = [null, undefined, 123, {}, [], true]

      invalidInputs.forEach(input => {
        expect(() => SecurityValidator.validateCollectionName(input as any))
          .toThrow(InvalidInputError)
      })
    })
  })

  describe('validateDocumentId', () => {
    test('should accept valid document IDs', () => {
      const validIds = [
        'abc123',
        'user_123',
        'post-456',
        'a',
        '123',
        'mixed_123-test'
      ]

      validIds.forEach(id => {
        expect(() => SecurityValidator.validateDocumentId(id)).not.toThrow()
      })
    })

    test('should reject invalid document IDs', () => {
      const invalidIds = [
        '', // empty
        'id with spaces', // contains spaces
        'id@email', // contains special chars
        'id/path', // contains slash
        'a'.repeat(101), // too long
        'id.field' // contains dot
      ]

      invalidIds.forEach(id => {
        expect(() => SecurityValidator.validateDocumentId(id))
          .toThrow(InvalidInputError)
      })
    })

    test('should reject non-string inputs', () => {
      const invalidInputs = [null, undefined, 123, {}, [], true]

      invalidInputs.forEach(input => {
        expect(() => SecurityValidator.validateDocumentId(input as any))
          .toThrow(InvalidInputError)
      })
    })
  })

  describe('sanitizeListOptions', () => {
    test('should sanitize valid list options', () => {
      const options = {
        limit: 50,
        offset: 10,
        sort: 'title.asc',
        filter: { status: 'published' }
      }

      const sanitized = SecurityValidator.sanitizeListOptions(options)
      
      expect(sanitized).toEqual({
        limit: 50,
        offset: 10,
        sort: 'title.asc',
        filter: { status: 'published' }
      })
    })

    test('should enforce limits on numeric values', () => {
      const options = {
        limit: 2000, // exceeds max
        offset: -5 // negative
      }

      const sanitized = SecurityValidator.sanitizeListOptions(options)
      
      expect(sanitized?.limit).toBe(1000) // capped at max
      expect(sanitized?.offset).toBe(0) // corrected to 0
    })

    test('should validate sort fields', () => {
      expect(() => {
        SecurityValidator.sanitizeListOptions({
          sort: 'title.invalid' // invalid direction
        })
      }).toThrow(InvalidInputError)

      expect(() => {
        SecurityValidator.sanitizeListOptions({
          sort: '123field' // invalid field name
        })
      }).toThrow(InvalidInputError)
    })

    test('should limit number of sort fields', () => {
      expect(() => {
        SecurityValidator.sanitizeListOptions({
          sort: ['field1', 'field2', 'field3', 'field4', 'field5', 'field6'] // too many
        })
      }).toThrow(InvalidInputError)
    })

    test('should sanitize filter objects', () => {
      const options = {
        filter: {
          status: 'published',
          constructor: 'dangerous', // should trigger error
          normalField: 'value'
        }
      }

      expect(() => {
        SecurityValidator.sanitizeListOptions(options)
      }).toThrow(InvalidInputError)
    })

    test('should handle invalid input types', () => {
      expect(() => {
        SecurityValidator.sanitizeListOptions({
          limit: 'not a number' as any
        })
      }).toThrow(InvalidInputError)

      expect(() => {
        SecurityValidator.sanitizeListOptions({
          offset: 'not a number' as any
        })
      }).toThrow(InvalidInputError)
    })

    test('should return undefined for invalid input', () => {
      expect(SecurityValidator.sanitizeListOptions(null)).toBeUndefined()
      expect(SecurityValidator.sanitizeListOptions(undefined)).toBeUndefined()
      expect(SecurityValidator.sanitizeListOptions('string' as any)).toBeUndefined()
    })
  })

  describe('sanitizeFilter', () => {
    test('should allow simple filter values', () => {
      const filter = {
        status: 'published',
        count: 42,
        active: true,
        publishedAt: null
      }

      const sanitized = SecurityValidator.sanitizeFilter(filter)
      expect(sanitized).toEqual(filter)
    })

    test('should allow comparison operators', () => {
      const filter = {
        count: { $gte: 10, $lt: 100 },
        status: { $in: ['published', 'draft'] }
      }

      const sanitized = SecurityValidator.sanitizeFilter(filter)
      expect(sanitized).toEqual(filter)
    })

    test('should reject dangerous field names', () => {
      expect(() => {
        SecurityValidator.sanitizeFilter({ constructor: 'value' })
      }).toThrow(InvalidInputError)

      expect(() => {
        SecurityValidator.sanitizeFilter({ prototype: 'value' })
      }).toThrow(InvalidInputError)

      expect(() => {
        SecurityValidator.sanitizeFilter({ $eval: 'dangerous' })
      }).toThrow(InvalidInputError)
    })

    test('should limit filter complexity', () => {
      // Create filter with too many keys
      const filter: Record<string, unknown> = {}
      for (let i = 0; i < 15; i++) {
        filter[`field${i}`] = 'value'
      }

      const sanitized = SecurityValidator.sanitizeFilter(filter)
      expect(Object.keys(sanitized)).toHaveLength(10) // limited to 10
    })

    test('should limit array sizes in filters', () => {
      const filter = {
        status: { $in: new Array(150).fill('value') } // too large
      }

      const sanitized = SecurityValidator.sanitizeFilter(filter)
      expect((sanitized.status as any).$in).toHaveLength(100) // limited to 100
    })
  })

  describe('validateDocumentData', () => {
    test('should accept valid document data', () => {
      const validData = {
        title: 'Test Post',
        content: 'Test content',
        metadata: {
          tags: ['test'],
          published: true
        }
      }

      expect(() => SecurityValidator.validateDocumentData(validData)).not.toThrow()
    })

    test('should reject non-object data', () => {
      const invalidData = [null, undefined, 'string', 123, [], true]

      invalidData.forEach(data => {
        expect(() => SecurityValidator.validateDocumentData(data))
          .toThrow(InvalidInputError)
      })
    })

    test('should reject dangerous property names', () => {
      expect(() => {
        SecurityValidator.validateDocumentData({ constructor: 'value' })
      }).toThrow(InvalidInputError)

      expect(() => {
        SecurityValidator.validateDocumentData({ prototype: 'value' })
      }).toThrow(InvalidInputError)
    })

    test('should reject very large documents', () => {
      // Create a document that exceeds size limit
      const largeData = {
        content: 'x'.repeat(11 * 1024 * 1024) // 11MB
      }

      expect(() => SecurityValidator.validateDocumentData(largeData))
        .toThrow(InvalidInputError)
    })

    test('should reject invalid field names', () => {
      const longFieldName = 'a'.repeat(101)
      
      expect(() => {
        SecurityValidator.validateDocumentData({ '': 'empty field name' })
      }).toThrow(InvalidInputError)

      expect(() => {
        SecurityValidator.validateDocumentData({ 'field with spaces': 'value' })
      }).toThrow(InvalidInputError)

      expect(() => {
        SecurityValidator.validateDocumentData({ [longFieldName]: 'too long' })
      }).toThrow(InvalidInputError)
    })
  })
})