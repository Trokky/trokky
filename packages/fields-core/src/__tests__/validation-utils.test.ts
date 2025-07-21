import {
  createValidationError,
  createValidationErrors,
  getFieldPath,
  createFieldValidationResult,
  createValidationResult
} from '../utils/validation'

// Mock field context for testing
const mockContext = {
  document: {},
  fieldPath: ['user', 'profile', 'name'],
  user: { 
    id: 'user1',
    username: 'testuser',
    email: 'test@example.com', 
    firstName: 'Test', 
    lastName: 'User', 
    passwordHash: 'hash',
    role: 'viewer' as const,
    permissions: [],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  permissions: [],
  userRole: 'viewer' as const,
  httpClient: {} as any,
  apiClient: {} as any,
  getValue: jest.fn(),
  setValue: jest.fn(),
  getFieldConfig: jest.fn(),
  errors: [],
  touched: {},
  isStudio: false,
  isPreview: false,
  emit: jest.fn(),
  on: jest.fn()
}

describe('Validation Utilities', () => {
  
  describe('createValidationError', () => {
    it('should create a validation error with correct structure', () => {
      const error = createValidationError('field.name', 'Field is required', 'REQUIRED')
      
      expect(error).toEqual({
        field: 'field.name',
        message: 'Field is required',
        code: 'REQUIRED'
      })
    })
  })

  describe('createValidationErrors', () => {
    it('should create multiple validation errors', () => {
      const errors = createValidationErrors('user.email', [
        { message: 'Email is required', code: 'REQUIRED' },
        { message: 'Invalid email format', code: 'INVALID_EMAIL' }
      ])
      
      expect(errors).toHaveLength(2)
      expect(errors[0]).toEqual({
        field: 'user.email',
        message: 'Email is required',
        code: 'REQUIRED'
      })
      expect(errors[1]).toEqual({
        field: 'user.email',
        message: 'Invalid email format',
        code: 'INVALID_EMAIL'
      })
    })

    it('should handle empty error array', () => {
      const errors = createValidationErrors('field.name', [])
      expect(errors).toEqual([])
    })
  })

  describe('getFieldPath', () => {
    it('should join field path array with dots', () => {
      const path = getFieldPath(mockContext)
      expect(path).toBe('user.profile.name')
    })

    it('should handle single-level path', () => {
      const singleContext = { 
        ...mockContext, 
        fieldPath: ['name'],
        user: { 
          id: 'user1',
          username: 'testuser',
          email: 'test@example.com', 
          firstName: 'Test', 
          lastName: 'User', 
          passwordHash: 'hash',
          role: 'viewer' as const,
          permissions: [],
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      }
      const path = getFieldPath(singleContext)
      expect(path).toBe('name')
    })

    it('should handle empty path', () => {
      const emptyContext = { 
        ...mockContext, 
        fieldPath: [],
        user: { 
          id: 'user1',
          username: 'testuser',
          email: 'test@example.com', 
          firstName: 'Test', 
          lastName: 'User', 
          passwordHash: 'hash',
          role: 'viewer' as const,
          permissions: [],
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      }
      const path = getFieldPath(emptyContext)
      expect(path).toBe('')
    })
  })

  describe('createFieldValidationResult', () => {
    it('should create valid result when no errors', () => {
      const result = createFieldValidationResult([], 'field.name')
      
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should create invalid result when errors exist', () => {
      const result = createFieldValidationResult([
        { message: 'Field is required', code: 'REQUIRED' }
      ], 'field.name')
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toEqual({
        field: 'field.name',
        message: 'Field is required',
        code: 'REQUIRED'
      })
    })
  })

  describe('createValidationResult', () => {
    it('should create valid result when no errors', () => {
      const result = createValidationResult([])
      
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
    })

    it('should create invalid result when errors exist', () => {
      const errors = [
        createValidationError('field.name', 'Field is required', 'REQUIRED')
      ]
      const result = createValidationResult(errors)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toEqual(errors)
    })

    it('should handle multiple errors', () => {
      const errors = [
        createValidationError('field.email', 'Email is required', 'REQUIRED'),
        createValidationError('field.email', 'Invalid email format', 'INVALID_EMAIL')
      ]
      const result = createValidationResult(errors)
      
      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)
      expect(result.errors).toEqual(errors)
    })
  })
})