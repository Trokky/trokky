/**
 * Authentication Service Tests
 * 
 * Comprehensive test suite for the authentication and authorization system
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { AuthenticationService, DEFAULT_AUTH_CONFIG } from '../../security/auth.js'
import type { User, AppToken, Permission, UserRole } from '../../types/user.js'

// Mock bcrypt for testing
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$hashed_password'),
  compare: jest.fn().mockImplementation((password: string, hash: string) => {
    return Promise.resolve(password === 'correct_password' && hash === '$2b$12$hashed_password')
  })
}))

// Mock jsonwebtoken for testing
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockImplementation((payload: any, secret: string) => {
    return `mocked_jwt_token_${payload.type}_${payload.userId || payload.tokenId}`
  }),
  verify: jest.fn().mockImplementation((token: string, secret: string) => {
    if (token.includes('invalid')) {
      throw new Error('Invalid token')
    }
    
    if (token.includes('user')) {
      return {
        type: 'user',
        userId: 'user123',
        username: 'testuser',
        role: 'admin' as UserRole,
        permissions: ['content:read', 'content:write'] as Permission[],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      }
    }
    
    if (token.includes('app_token')) {
      return {
        type: 'app_token',
        tokenId: 'token123',
        name: 'Test App Token',
        permissions: ['content:read'] as Permission[],
        createdBy: 'user123',
        iat: Math.floor(Date.now() / 1000)
      }
    }
    
    throw new Error('Unknown token type')
  })
}))

describe('AuthenticationService', () => {
  let authService: AuthenticationService
  
  beforeEach(() => {
    authService = new AuthenticationService(DEFAULT_AUTH_CONFIG)
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  describe('Password Management', () => {
    it('should hash passwords correctly', async () => {
      const password = 'test_password'
      const hash = await authService.hashPassword(password)
      
      expect(hash).toBe('$2b$12$hashed_password')
      expect(require('bcrypt').hash).toHaveBeenCalledWith(password, DEFAULT_AUTH_CONFIG.bcryptRounds)
    })

    it('should verify passwords correctly', async () => {
      const validResult = await authService.verifyPassword('correct_password', '$2b$12$hashed_password')
      const invalidResult = await authService.verifyPassword('wrong_password', '$2b$12$hashed_password')
      
      expect(validResult).toBe(true)
      expect(invalidResult).toBe(false)
    })

    it('should handle password verification errors gracefully', async () => {
      const bcrypt = require('bcrypt')
      bcrypt.compare.mockRejectedValueOnce(new Error('Bcrypt error'))
      
      const result = await authService.verifyPassword('any_password', 'any_hash')
      expect(result).toBe(false)
    })
  })

  describe('JWT Token Management', () => {
    it('should generate user tokens correctly', async () => {
      const mockUser: User = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin',
        permissions: ['content:read', 'content:write'],
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      const tokens = await authService.generateUserToken(mockUser)
      
      expect(tokens.accessToken).toMatch(/mocked_jwt_token_user_user123/)
      expect(tokens.refreshToken).toMatch(/mocked_jwt_token_refresh_user123/)
      expect(require('jsonwebtoken').sign).toHaveBeenCalledTimes(2)
    })

    it('should validate user tokens correctly', async () => {
      const validToken = 'mocked_jwt_token_user_user123'
      const result = await authService.validateToken(validToken)
      
      expect(result.valid).toBe(true)
      expect(result.context?.type).toBe('user')
      expect(result.context?.user?.id).toBe('user123')
    })

    it('should reject invalid tokens', async () => {
      const invalidToken = 'invalid_token'
      const result = await authService.validateToken(invalidToken)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('App Token Management', () => {
    it('should generate app tokens correctly', async () => {
      const result = await authService.generateAppToken()
      
      expect(result.token).toBeDefined()
      expect(result.hash).toBeDefined()
      expect(result.token.length).toBeGreaterThan(20) // Base64url encoded 32 bytes
      expect(result.hash.length).toBe(64) // SHA256 hex string
    })

    it('should create app tokens with metadata', async () => {
      const tokenData = {
        name: 'Test App Token',
        description: 'Token for testing',
        permissions: ['content:read', 'media:read'] as Permission[]
      }
      const createdBy = 'user123'
      
      const result = await authService.createAppToken(tokenData, createdBy)
      
      expect(result.success).toBe(true)
      expect(result.token).toBeDefined()
      expect(result.appToken?.name).toBe(tokenData.name)
      expect(result.appToken?.permissions).toEqual(tokenData.permissions)
      expect(result.appToken?.createdBy).toBe(createdBy)
    })

    it('should validate app tokens correctly', async () => {
      const token = 'test_token_string'
      const result = await authService.validateAppToken(token)
      
      expect(result.valid).toBe(true)
      expect(result.hash).toBeDefined()
      expect(result.hash?.length).toBe(64) // SHA256 hex
    })
  })

  describe('Permission System', () => {
    const mockUserContext = {
      type: 'user' as const,
      user: {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin' as UserRole,
        permissions: ['content:read', 'content:write', 'media:read'] as Permission[],
        isActive: true
      }
    }

    const mockAppTokenContext = {
      type: 'app_token' as const,
      token: {
        id: 'token123',
        name: 'Test Token',
        permissions: ['content:read'] as Permission[],
        createdBy: 'user123',
        isActive: true
      }
    }

    const mockAnonymousContext = { type: 'anonymous' as const }

    it('should check single permissions correctly', () => {
      expect(authService.hasPermission(mockUserContext, 'content:read')).toBe(true)
      expect(authService.hasPermission(mockUserContext, 'content:delete')).toBe(false)
      expect(authService.hasPermission(mockAppTokenContext, 'content:read')).toBe(true)
      expect(authService.hasPermission(mockAppTokenContext, 'content:write')).toBe(false)
      expect(authService.hasPermission(mockAnonymousContext, 'content:read')).toBe(false)
    })

    it('should check multiple permissions with hasAnyPermission', () => {
      const permissions: Permission[] = ['content:write', 'content:delete']
      
      expect(authService.hasAnyPermission(mockUserContext, permissions)).toBe(true)
      expect(authService.hasAnyPermission(mockAppTokenContext, permissions)).toBe(false)
      expect(authService.hasAnyPermission(mockAnonymousContext, permissions)).toBe(false)
    })

    it('should check multiple permissions with hasAllPermissions', () => {
      const permissions: Permission[] = ['content:read', 'content:write']
      const partialPermissions: Permission[] = ['content:read', 'content:delete']
      
      expect(authService.hasAllPermissions(mockUserContext, permissions)).toBe(true)
      expect(authService.hasAllPermissions(mockUserContext, partialPermissions)).toBe(false)
      expect(authService.hasAllPermissions(mockAppTokenContext, ['content:read'])).toBe(true)
      expect(authService.hasAllPermissions(mockAppTokenContext, permissions)).toBe(false)
    })

    it('should get role permissions correctly', () => {
      const adminPermissions = authService.getRolePermissions('admin')
      const viewerPermissions = authService.getRolePermissions('viewer')
      
      expect(adminPermissions).toContain('content:read')
      expect(adminPermissions).toContain('users:write')
      expect(viewerPermissions).toContain('content:read')
      expect(viewerPermissions).not.toContain('users:write')
    })
  })

  describe('Rate Limiting', () => {
    it('should not rate limit on first attempt', () => {
      const identifier = 'test@example.com'
      expect(authService.isRateLimited(identifier)).toBe(false)
    })

    it('should rate limit after max attempts', () => {
      const identifier = 'test@example.com'
      
      // Make failed attempts up to the limit
      for (let i = 0; i < DEFAULT_AUTH_CONFIG.rateLimitAttempts; i++) {
        authService.recordFailedAttempt(identifier)
      }
      
      expect(authService.isRateLimited(identifier)).toBe(true)
    })

    it('should reset rate limiting after window expires', () => {
      const identifier = 'test@example.com'
      
      // Make failed attempts up to the limit
      for (let i = 0; i < DEFAULT_AUTH_CONFIG.rateLimitAttempts; i++) {
        authService.recordFailedAttempt(identifier)
      }
      
      expect(authService.isRateLimited(identifier)).toBe(true)
      
      // Mock time passage beyond the rate limit window
      const originalNow = Date.now
      Date.now = jest.fn().mockReturnValue(originalNow() + DEFAULT_AUTH_CONFIG.rateLimitWindow + 1000)
      
      expect(authService.isRateLimited(identifier)).toBe(false)
      
      // Restore Date.now
      Date.now = originalNow
    })

    it('should clear failed attempts on success', () => {
      const identifier = 'test@example.com'
      
      authService.recordFailedAttempt(identifier)
      authService.recordFailedAttempt(identifier)
      expect(authService.isRateLimited(identifier)).toBe(false) // Not at limit yet
      
      authService.clearFailedAttempts(identifier)
      expect(authService.isRateLimited(identifier)).toBe(false)
    })
  })

  describe('Edge Cases and Security', () => {
    it('should handle malformed JWT tokens gracefully', async () => {
      const malformedToken = 'not.a.jwt'
      const result = await authService.validateToken(malformedToken)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should generate unique app tokens', async () => {
      const token1 = await authService.generateAppToken()
      const token2 = await authService.generateAppToken()
      
      expect(token1.token).not.toBe(token2.token)
      expect(token1.hash).not.toBe(token2.hash)
    })

    it('should validate time string parsing', () => {
      expect(() => {
        const service = new AuthenticationService({
          ...DEFAULT_AUTH_CONFIG,
          jwtExpiresIn: 'invalid_time'
        })
        // @ts-ignore - accessing private method for testing
        service.parseTimeToSeconds('invalid_time')
      }).toThrow('Invalid time format')
    })

    it('should handle app token creation errors', async () => {
      const tokenData = {
        name: '', // Invalid: empty name
        permissions: ['content:read'] as Permission[]
      }
      
      const result = await authService.createAppToken(tokenData, 'user123')
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('Integration Scenarios', () => {
    it('should support full authentication flow', async () => {
      const mockUser: User = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: await authService.hashPassword('user_password'),
        firstName: 'Test',
        lastName: 'User',
        role: 'editor',
        permissions: ['content:read', 'content:write'],
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      // 1. Generate tokens for user
      const tokens = await authService.generateUserToken(mockUser)
      expect(tokens.accessToken).toBeDefined()
      expect(tokens.refreshToken).toBeDefined()

      // 2. Validate the access token
      const validation = await authService.validateToken(tokens.accessToken)
      expect(validation.valid).toBe(true)
      expect(validation.context?.type).toBe('user')

      // 3. Check permissions
      if (validation.context?.type === 'user') {
        expect(authService.hasPermission(validation.context, 'content:read')).toBe(true)
        expect(authService.hasPermission(validation.context, 'users:delete')).toBe(false)
      }
    })

    it('should support app token workflow', async () => {
      // 1. Create app token
      const tokenData = {
        name: 'Blog Frontend',
        description: 'Token for blog frontend to fetch content',
        permissions: ['content:read', 'media:read'] as Permission[]
      }
      
      const creation = await authService.createAppToken(tokenData, 'admin123')
      expect(creation.success).toBe(true)
      expect(creation.token).toBeDefined()

      // 2. Validate the raw token
      if (creation.token) {
        const validation = await authService.validateAppToken(creation.token)
        expect(validation.valid).toBe(true)
        expect(validation.hash).toBeDefined()
      }
    })
  })
})