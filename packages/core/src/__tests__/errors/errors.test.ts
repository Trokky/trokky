import {
  TrokkyError,
  ValidationError,
  SchemaNotFoundError,
  DocumentNotFoundError,
  InvalidInputError,
  RateLimitError,
  ValidationErrorDetail
} from '../../errors/index'

describe('Error Classes', () => {
  describe('TrokkyError', () => {
    test('should create error with message and code', () => {
      const error = new TrokkyError('Test error', 'TEST_ERROR')
      
      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_ERROR')
      expect(error.name).toBe('TrokkyError')
      expect(error.details).toBeUndefined()
    })

    test('should create error with details', () => {
      const details = { field: 'test', value: 123 }
      const error = new TrokkyError('Test error', 'TEST_ERROR', details)
      
      expect(error.details).toEqual(details)
    })

    test('should be instance of Error', () => {
      const error = new TrokkyError('Test', 'TEST')
      
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(TrokkyError)
    })

    test('should have proper stack trace', () => {
      const error = new TrokkyError('Test', 'TEST')
      
      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('TrokkyError')
    })

    test('should handle undefined details', () => {
      const error = new TrokkyError('Test', 'TEST', undefined)
      
      expect(error.details).toBeUndefined()
    })
  })

  describe('ValidationError', () => {
    test('should create validation error with error details', () => {
      const validationErrors: ValidationErrorDetail[] = [
        { field: 'title', message: 'Required field missing', code: 'REQUIRED' },
        { field: 'email', message: 'Invalid email format', code: 'INVALID_FORMAT' }
      ]
      
      const error = new ValidationError('Validation failed', validationErrors)
      
      expect(error.message).toBe('Validation failed')
      expect(error.code).toBe('VALIDATION_FAILED')
      expect(error.name).toBe('ValidationError')
      expect(error.validationErrors).toEqual(validationErrors)
      expect(error.details?.errors).toEqual(validationErrors)
    })

    test('should be instance of TrokkyError', () => {
      const error = new ValidationError('Test', [])
      
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(TrokkyError)
      expect(error).toBeInstanceOf(ValidationError)
    })

    test('should handle empty validation errors', () => {
      const error = new ValidationError('No specific errors', [])
      
      expect(error.validationErrors).toEqual([])
      expect(error.details?.errors).toEqual([])
    })
  })

  describe('SchemaNotFoundError', () => {
    test('should create schema not found error', () => {
      const error = new SchemaNotFoundError('posts')
      
      expect(error.message).toBe('Schema not found for collection: posts')
      expect(error.code).toBe('SCHEMA_NOT_FOUND')
      expect(error.name).toBe('SchemaNotFoundError')
      expect(error.details?.collection).toBe('posts')
    })

    test('should be instance of TrokkyError', () => {
      const error = new SchemaNotFoundError('test')
      
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(TrokkyError)
      expect(error).toBeInstanceOf(SchemaNotFoundError)
    })
  })

  describe('DocumentNotFoundError', () => {
    test('should create document not found error', () => {
      const error = new DocumentNotFoundError('posts', 'post-123')
      
      expect(error.message).toBe('Document not found: posts/post-123')
      expect(error.code).toBe('DOCUMENT_NOT_FOUND')
      expect(error.name).toBe('DocumentNotFoundError')
      expect(error.details?.collection).toBe('posts')
      expect(error.details?.id).toBe('post-123')
    })

    test('should be instance of TrokkyError', () => {
      const error = new DocumentNotFoundError('test', 'id')
      
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(TrokkyError)
      expect(error).toBeInstanceOf(DocumentNotFoundError)
    })
  })

  describe('InvalidInputError', () => {
    test('should create invalid input error', () => {
      const error = new InvalidInputError('Invalid collection name')
      
      expect(error.message).toBe('Invalid collection name')
      expect(error.code).toBe('INVALID_INPUT')
      expect(error.name).toBe('InvalidInputError')
      expect(error.details?.field).toBeUndefined()
    })

    test('should create invalid input error with field', () => {
      const error = new InvalidInputError('Invalid email format', 'email')
      
      expect(error.message).toBe('Invalid email format')
      expect(error.details?.field).toBe('email')
    })

    test('should be instance of TrokkyError', () => {
      const error = new InvalidInputError('Test')
      
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(TrokkyError)
      expect(error).toBeInstanceOf(InvalidInputError)
    })
  })

  describe('RateLimitError', () => {
    test('should create rate limit error', () => {
      const error = new RateLimitError('getDocument')
      
      expect(error.message).toBe('Rate limit exceeded for operation: getDocument')
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(error.name).toBe('RateLimitError')
      expect(error.details?.operation).toBe('getDocument')
    })

    test('should be instance of TrokkyError', () => {
      const error = new RateLimitError('test')
      
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(TrokkyError)
      expect(error).toBeInstanceOf(RateLimitError)
    })
  })

  describe('Error serialization', () => {
    test('should serialize TrokkyError to JSON', () => {
      const error = new TrokkyError('Test error', 'TEST_CODE', { field: 'test' })
      
      const serialized = JSON.stringify(error)
      const parsed = JSON.parse(serialized)
      
      expect(parsed.name).toBe('TrokkyError')
      expect(parsed.message).toBe('Test error')
      expect(parsed.code).toBe('TEST_CODE')
      expect(parsed.details).toEqual({ field: 'test' })
    })

    test('should serialize ValidationError to JSON', () => {
      const validationErrors: ValidationErrorDetail[] = [
        { field: 'title', message: 'Required', code: 'REQUIRED' }
      ]
      const error = new ValidationError('Validation failed', validationErrors)
      
      const serialized = JSON.stringify(error)
      const parsed = JSON.parse(serialized)
      
      expect(parsed.name).toBe('ValidationError')
      expect(parsed.validationErrors).toEqual(validationErrors)
    })

    test('should handle circular references in details', () => {
      const circularDetails: any = { field: 'test' }
      circularDetails.self = circularDetails
      
      // Should not throw when creating error with circular details
      expect(() => {
        new TrokkyError('Test', 'TEST', circularDetails)
      }).not.toThrow()
    })
  })

  describe('Error inheritance chain', () => {
    test('should maintain proper inheritance chain', () => {
      const errors = [
        new TrokkyError('Test', 'TEST'),
        new ValidationError('Test', []),
        new SchemaNotFoundError('test'),
        new DocumentNotFoundError('test', 'id'),
        new InvalidInputError('Test'),
        new RateLimitError('test')
      ]

      errors.forEach(error => {
        expect(error).toBeInstanceOf(Error)
        expect(error).toBeInstanceOf(TrokkyError)
        expect(error.code).toBeDefined()
        expect(error.message).toBeDefined()
        expect(error.name).toBeDefined()
      })
    })

    test('should allow instanceof checks', () => {
      const validationError = new ValidationError('Test', [])
      const schemaError = new SchemaNotFoundError('test')
      const inputError = new InvalidInputError('Test')
      
      expect(validationError instanceof ValidationError).toBe(true)
      expect(validationError instanceof TrokkyError).toBe(true)
      expect(validationError instanceof Error).toBe(true)
      
      expect(schemaError instanceof SchemaNotFoundError).toBe(true)
      expect(schemaError instanceof TrokkyError).toBe(true)
      expect(schemaError instanceof ValidationError).toBe(false)
      
      expect(inputError instanceof InvalidInputError).toBe(true)
      expect(inputError instanceof TrokkyError).toBe(true)
      expect(inputError instanceof ValidationError).toBe(false)
    })
  })

  describe('Error handling in try-catch', () => {
    test('should be catchable as specific error types', () => {
      const throwValidationError = (): void => {
        throw new ValidationError('Test validation error', [])
      }

      const throwSchemaError = (): void => {
        throw new SchemaNotFoundError('posts')
      }

      try {
        throwValidationError()
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError)
        expect((error as ValidationError).code).toBe('VALIDATION_FAILED')
      }

      try {
        throwSchemaError()
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaNotFoundError)
        expect((error as SchemaNotFoundError).code).toBe('SCHEMA_NOT_FOUND')
      }
    })

    test('should be catchable as TrokkyError', () => {
      const throwSpecificError = (): void => {
        throw new RateLimitError('test')
      }

      try {
        throwSpecificError()
      } catch (error) {
        expect(error).toBeInstanceOf(TrokkyError)
        expect((error as TrokkyError).code).toBe('RATE_LIMIT_EXCEEDED')
      }
    })

    test('should be catchable as generic Error', () => {
      const throwSpecificError = (): void => {
        throw new InvalidInputError('Test')
      }

      try {
        throwSpecificError()
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Test')
      }
    })
  })
})