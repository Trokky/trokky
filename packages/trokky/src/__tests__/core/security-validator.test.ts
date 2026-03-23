import { describe, it, expect } from 'vitest'
import { SecurityValidator } from '../../core/security/validation.js'
import { InvalidInputError } from '../../core/errors/index.js'

describe('SecurityValidator', () => {
  describe('validateCollectionName', () => {
    it('should accept valid collection names', () => {
      expect(() => SecurityValidator.validateCollectionName('article')).not.toThrow()
      expect(() => SecurityValidator.validateCollectionName('blog-post')).not.toThrow()
      expect(() => SecurityValidator.validateCollectionName('page_section')).not.toThrow()
    })

    it('should reject empty collection names', () => {
      expect(() => SecurityValidator.validateCollectionName('')).toThrow(InvalidInputError)
    })

    it('should reject names exceeding max length', () => {
      const longName = 'a'.repeat(51)
      expect(() => SecurityValidator.validateCollectionName(longName)).toThrow(InvalidInputError)
    })

    it('should reject path traversal attempts', () => {
      expect(() => SecurityValidator.validateCollectionName('../etc')).toThrow(InvalidInputError)
      expect(() => SecurityValidator.validateCollectionName('..\\windows')).toThrow(InvalidInputError)
      expect(() => SecurityValidator.validateCollectionName('foo/../bar')).toThrow(InvalidInputError)
    })

    it('should reject names with special characters', () => {
      expect(() => SecurityValidator.validateCollectionName('col;DROP')).toThrow(InvalidInputError)
      expect(() => SecurityValidator.validateCollectionName('col<script>')).toThrow(InvalidInputError)
    })
  })

  describe('validateDocumentId', () => {
    it('should accept valid document IDs', () => {
      expect(() => SecurityValidator.validateDocumentId('doc-abc123')).not.toThrow()
      expect(() => SecurityValidator.validateDocumentId('article-mdl3it54-e53aa19f')).not.toThrow()
    })

    it('should reject empty IDs', () => {
      expect(() => SecurityValidator.validateDocumentId('')).toThrow(InvalidInputError)
    })

    it('should reject IDs exceeding max length', () => {
      const longId = 'a'.repeat(101)
      expect(() => SecurityValidator.validateDocumentId(longId)).toThrow(InvalidInputError)
    })

    it('should reject path traversal in IDs', () => {
      expect(() => SecurityValidator.validateDocumentId('../../../etc/passwd')).toThrow(InvalidInputError)
    })
  })

  describe('sanitizeListOptions', () => {
    it('should return undefined for undefined input', () => {
      expect(SecurityValidator.sanitizeListOptions(undefined)).toBeUndefined()
    })

    it('should cap limit to MAX_LIMIT', () => {
      const result = SecurityValidator.sanitizeListOptions({ limit: 5000 })
      expect(result?.limit).toBeLessThanOrEqual(1000)
    })

    it('should set non-negative offset', () => {
      const result = SecurityValidator.sanitizeListOptions({ offset: -10 })
      expect(result?.offset).toBeGreaterThanOrEqual(0)
    })

    it('should pass through valid options', () => {
      const result = SecurityValidator.sanitizeListOptions({ limit: 10, offset: 5 })
      expect(result?.limit).toBe(10)
      expect(result?.offset).toBe(5)
    })
  })

  describe('validateUsername', () => {
    it('should accept valid usernames', () => {
      expect(() => SecurityValidator.validateUsername('admin')).not.toThrow()
      expect(() => SecurityValidator.validateUsername('john_doe')).not.toThrow()
      expect(() => SecurityValidator.validateUsername('user-123')).not.toThrow()
    })

    it('should reject empty usernames', () => {
      expect(() => SecurityValidator.validateUsername('')).toThrow(InvalidInputError)
    })

    it('should reject usernames with path traversal', () => {
      expect(() => SecurityValidator.validateUsername('../admin')).toThrow(InvalidInputError)
    })
  })

  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      expect(() => SecurityValidator.validateEmail('test@example.com')).not.toThrow()
      expect(() => SecurityValidator.validateEmail('user.name+tag@domain.co')).not.toThrow()
    })

    it('should reject empty emails', () => {
      expect(() => SecurityValidator.validateEmail('')).toThrow(InvalidInputError)
    })

    it('should reject emails without @', () => {
      expect(() => SecurityValidator.validateEmail('notanemail')).toThrow(InvalidInputError)
    })

    it('should reject emails without domain', () => {
      expect(() => SecurityValidator.validateEmail('user@')).toThrow(InvalidInputError)
    })
  })

  describe('validatePassword', () => {
    it('should accept valid passwords', () => {
      expect(() => SecurityValidator.validatePassword('SecureP@ss123')).not.toThrow()
    })

    it('should reject empty passwords', () => {
      expect(() => SecurityValidator.validatePassword('')).toThrow(InvalidInputError)
    })

    it('should reject passwords exceeding max length', () => {
      const longPassword = 'a'.repeat(129)
      expect(() => SecurityValidator.validatePassword(longPassword)).toThrow(InvalidInputError)
    })

    it('should accept passwords at max length boundary', () => {
      const maxPassword = 'A1!' + 'a'.repeat(125)
      expect(() => SecurityValidator.validatePassword(maxPassword)).not.toThrow()
    })
  })

  describe('validateDocumentData', () => {
    it('should accept valid document objects', () => {
      expect(() => SecurityValidator.validateDocumentData({ title: 'Test' })).not.toThrow()
    })

    it('should reject null', () => {
      expect(() => SecurityValidator.validateDocumentData(null)).toThrow(InvalidInputError)
    })

    it('should reject non-objects', () => {
      expect(() => SecurityValidator.validateDocumentData('string')).toThrow(InvalidInputError)
      expect(() => SecurityValidator.validateDocumentData(42)).toThrow(InvalidInputError)
    })

    it('should reject arrays', () => {
      expect(() => SecurityValidator.validateDocumentData([1, 2, 3])).toThrow(InvalidInputError)
    })
  })
})
