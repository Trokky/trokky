import { describe, it, expect } from 'vitest'
import {
  TrokkyError,
  ValidationError,
  SchemaNotFoundError,
  DocumentNotFoundError,
  InvalidInputError,
  RateLimitError,
} from '../../core/errors/index.js'

describe('Error classes', () => {
  describe('TrokkyError', () => {
    it('should create error with message and code', () => {
      const err = new TrokkyError('Something failed', 'CUSTOM_ERROR')
      expect(err.message).toBe('Something failed')
      expect(err.code).toBe('CUSTOM_ERROR')
      expect(err.name).toBe('TrokkyError')
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(TrokkyError)
    })

    it('should include details when provided', () => {
      const err = new TrokkyError('Failed', 'ERR', { userId: '123', context: 'test' })
      expect(err.details).toEqual({ userId: '123', context: 'test' })
    })

    it('should have a stack trace', () => {
      const err = new TrokkyError('test', 'TEST')
      expect(err.stack).toBeDefined()
      expect(err.stack).toContain('TrokkyError')
    })

    it('should serialize to JSON', () => {
      const err = new TrokkyError('test', 'TEST_CODE', { key: 'val' })
      const json = err.toJSON()
      expect(json.message).toBe('test')
      expect(json.code).toBe('TEST_CODE')
      expect(json.details).toEqual({ key: 'val' })
    })
  })

  describe('ValidationError', () => {
    it('should include validation error details', () => {
      const errors = [
        { field: 'title', message: 'Title is required', code: 'required' },
        { field: 'email', message: 'Invalid email format', code: 'invalid_format' },
      ]
      const err = new ValidationError('Validation failed', errors)
      expect(err.code).toBe('VALIDATION_FAILED')
      expect(err.validationErrors).toHaveLength(2)
      expect(err.validationErrors[0].field).toBe('title')
      expect(err.validationErrors[1].field).toBe('email')
      expect(err).toBeInstanceOf(TrokkyError)
    })

    it('should handle empty validation errors', () => {
      const err = new ValidationError('No specific errors', [])
      expect(err.validationErrors).toHaveLength(0)
    })
  })

  describe('SchemaNotFoundError', () => {
    it('should include collection name in details', () => {
      const err = new SchemaNotFoundError('nonexistent')
      expect(err.code).toBe('SCHEMA_NOT_FOUND')
      expect(err.details?.collection).toBe('nonexistent')
      expect(err.message).toContain('nonexistent')
    })
  })

  describe('DocumentNotFoundError', () => {
    it('should include collection and id in details', () => {
      const err = new DocumentNotFoundError('article', 'doc-999')
      expect(err.code).toBe('DOCUMENT_NOT_FOUND')
      expect(err.details?.collection).toBe('article')
      expect(err.details?.id).toBe('doc-999')
    })
  })

  describe('InvalidInputError', () => {
    it('should include field name when provided', () => {
      const err = new InvalidInputError('Invalid value', 'username')
      expect(err.code).toBe('INVALID_INPUT')
      expect(err.details?.field).toBe('username')
    })

    it('should work without field name', () => {
      const err = new InvalidInputError('Bad request')
      expect(err.code).toBe('INVALID_INPUT')
    })
  })

  describe('RateLimitError', () => {
    it('should include operation in details', () => {
      const err = new RateLimitError('login')
      expect(err.code).toBe('RATE_LIMIT_EXCEEDED')
      expect(err.details?.operation).toBe('login')
      expect(err.message).toContain('login')
    })
  })
})
