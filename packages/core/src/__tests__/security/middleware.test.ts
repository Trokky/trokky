/**
 * Authentication Middleware Tests
 * 
 * Tests for Express middleware authentication and authorization
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import type { Request, Response, NextFunction } from 'express'
import { AuthMiddleware, createAuthMiddleware } from '../../security/middleware.js'
import { AuthenticationService, DEFAULT_AUTH_CONFIG } from '../../security/auth.js'
import type { User, AppToken, AuthContext, Permission } from '../../types/user.js'

// Mock Express Request/Response
const mockRequest = (headers: Record<string, string> = {}): Partial<Request> => ({
  headers,
  auth: undefined
})

const mockResponse = (): Partial<Response> => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis()
  }
  return res
}

const mockNext: NextFunction = jest.fn()

describe('AuthMiddleware', () => {
  let authService: AuthenticationService
  let authMiddleware: AuthMiddleware
  let mockGetUserById: jest.Mock
  let mockGetAppTokenByHash: jest.Mock

  beforeEach(() => {
    authService = new AuthenticationService(DEFAULT_AUTH_CONFIG)
    mockGetUserById = jest.fn()
    mockGetAppTokenByHash = jest.fn()
    
    authMiddleware = new AuthMiddleware({
      authService,
      getUserById: mockGetUserById,
      getAppTokenByHash: mockGetAppTokenByHash
    })

    jest.clearAllMocks()
  })

  describe('authenticate middleware', () => {
    it('should authenticate valid JWT Bearer tokens', async () => {
      const mockUser: User = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin',
        permissions: ['content:read'],
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      mockGetUserById.mockResolvedValue(mockUser)
      
      // Mock AuthenticationService.validateToken
      jest.spyOn(authService, 'validateToken').mockResolvedValue({
        valid: true,
        context: {
          type: 'user',
          user: {
            id: 'user123',
            username: 'testuser',
            email: '',
            firstName: '',
            lastName: '',
            role: 'admin',
            permissions: ['content:read'],
            isActive: true
          }
        }
      })

      const req = mockRequest({ authorization: 'Bearer valid_jwt_token' }) as Request
      const res = mockResponse() as Response
      
      await authMiddleware.authenticate()(req, res, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(req.auth?.type).toBe('user')
      expect(req.auth?.user?.id).toBe('user123')
      expect(mockGetUserById).toHaveBeenCalledWith('user123')
    })

    it('should authenticate valid app tokens', async () => {
      const mockAppToken: AppToken = {
        id: 'token123',
        name: 'Test Token',
        description: 'Test app token',
        tokenHash: 'hash123',
        permissions: ['content:read'],
        createdBy: 'user123',
        isActive: true,
        usageCount: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }

      mockGetAppTokenByHash.mockResolvedValue(mockAppToken)
      
      // Mock AuthenticationService.validateAppToken
      jest.spyOn(authService, 'validateAppToken').mockResolvedValue({
        valid: true,
        hash: 'hash123'
      })

      const req = mockRequest({ 'x-api-token': 'raw_app_token' }) as Request
      const res = mockResponse() as Response
      
      await authMiddleware.authenticate()(req, res, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(req.auth?.type).toBe('app_token')
      expect(req.auth?.token?.id).toBe('token123')
      expect(mockGetAppTokenByHash).toHaveBeenCalledWith('hash123')
    })

    it('should set anonymous context when no auth provided', async () => {
      const req = mockRequest() as Request
      const res = mockResponse() as Response
      
      await authMiddleware.authenticate()(req, res, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(req.auth?.type).toBe('anonymous')
    })

    it('should reject inactive users', async () => {
      const mockUser = {
        id: 'user123',
        isActive: false
      }

      mockGetUserById.mockResolvedValue(mockUser)
      
      jest.spyOn(authService, 'validateToken').mockResolvedValue({
        valid: true,
        context: {
          type: 'user',
          user: {
            id: 'user123',
            username: 'testuser',
            email: '',
            firstName: '',
            lastName: '',
            role: 'admin',
            permissions: ['content:read'],
            isActive: true
          }
        }
      })

      const req = mockRequest({ authorization: 'Bearer valid_jwt_token' }) as Request
      const res = mockResponse() as Response
      
      await authMiddleware.authenticate()(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'User account is inactive' })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject expired app tokens', async () => {
      const mockAppToken = {
        id: 'token123',
        isActive: true,
        expiresAt: '2023-01-01T00:00:00Z' // Expired
      }

      mockGetAppTokenByHash.mockResolvedValue(mockAppToken)
      
      jest.spyOn(authService, 'validateAppToken').mockResolvedValue({
        valid: true,
        hash: 'hash123'
      })

      const req = mockRequest({ 'x-api-token': 'raw_app_token' }) as Request
      const res = mockResponse() as Response
      
      await authMiddleware.authenticate()(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'App token has expired' })
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('requireAuth middleware', () => {
    it('should allow authenticated requests', () => {
      const req = mockRequest() as Request
      req.auth = {
        type: 'user',
        user: {
          id: 'user123',
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'admin',
          permissions: ['content:read'],
          isActive: true
        }
      }
      const res = mockResponse() as Response

      authMiddleware.requireAuth()(req, res, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should reject anonymous requests', () => {
      const req = mockRequest() as Request
      req.auth = { type: 'anonymous' }
      const res = mockResponse() as Response

      authMiddleware.requireAuth()(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required',
        message: 'Please provide a valid Bearer token or X-API-Token header'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject requests without auth context', () => {
      const req = mockRequest() as Request
      // req.auth is undefined
      const res = mockResponse() as Response

      authMiddleware.requireAuth()(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('permission middleware', () => {
    const mockUserWithPermissions = (permissions: Permission[]) => ({
      type: 'user' as const,
      user: {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin' as const,
        permissions,
        isActive: true
      }
    })

    it('should allow requests with required permission', () => {
      const req = mockRequest() as Request
      req.auth = mockUserWithPermissions(['content:read', 'content:write'])
      const res = mockResponse() as Response

      jest.spyOn(authService, 'hasPermission').mockReturnValue(true)

      authMiddleware.requirePermission('content:read')(req, res, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should reject requests without required permission', () => {
      const req = mockRequest() as Request
      req.auth = mockUserWithPermissions(['content:read'])
      const res = mockResponse() as Response

      jest.spyOn(authService, 'hasPermission').mockReturnValue(false)

      authMiddleware.requirePermission('content:delete')(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        required: 'content:delete'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should handle requireAnyPermission correctly', () => {
      const req = mockRequest() as Request
      req.auth = mockUserWithPermissions(['content:read'])
      const res = mockResponse() as Response

      jest.spyOn(authService, 'hasAnyPermission').mockReturnValue(true)

      authMiddleware.requireAnyPermission(['content:read', 'content:write'])(req, res, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should handle requireAllPermissions correctly', () => {
      const req = mockRequest() as Request
      req.auth = mockUserWithPermissions(['content:read', 'content:write'])
      const res = mockResponse() as Response

      jest.spyOn(authService, 'hasAllPermissions').mockReturnValue(true)

      authMiddleware.requireAllPermissions(['content:read', 'content:write'])(req, res, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe('role-based middleware', () => {
    it('should allow admin users with requireAdmin', () => {
      const req = mockRequest() as Request
      req.auth = {
        type: 'user',
        user: {
          id: 'user123',
          username: 'admin',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin',
          permissions: [],
          isActive: true
        }
      }
      const res = mockResponse() as Response

      authMiddleware.requireAdmin()(req, res, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it('should reject non-admin users with requireAdmin', () => {
      const req = mockRequest() as Request
      req.auth = {
        type: 'user',
        user: {
          id: 'user123',
          username: 'editor',
          email: 'editor@example.com',
          firstName: 'Editor',
          lastName: 'User',
          role: 'editor',
          permissions: [],
          isActive: true
        }
      }
      const res = mockResponse() as Response

      authMiddleware.requireAdmin()(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(403)
      expect(res.json).toHaveBeenCalledWith({
        error: 'Admin access required',
        currentRole: 'editor'
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should reject app tokens with requireAdmin', () => {
      const req = mockRequest() as Request
      req.auth = {
        type: 'app_token',
        token: {
          id: 'token123',
          name: 'Test Token',
          permissions: ['content:read'],
          createdBy: 'user123',
          isActive: true
        }
      }
      const res = mockResponse() as Response

      authMiddleware.requireAdmin()(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(401)
      expect(res.json).toHaveBeenCalledWith({ error: 'User authentication required' })
      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  describe('utility functions', () => {
    it('should get auth context correctly', () => {
      const req = mockRequest() as Request
      const mockContext: AuthContext = { type: 'anonymous' }
      req.auth = mockContext

      const context = AuthMiddleware.getAuthContext(req)
      expect(context).toBe(mockContext)
    })

    it('should identify authenticated users', () => {
      const req = mockRequest() as Request
      req.auth = { type: 'user', user: {} as any }

      expect(AuthMiddleware.isAuthenticatedUser(req)).toBe(true)
      expect(AuthMiddleware.isAppToken(req)).toBe(false)
    })

    it('should identify app tokens', () => {
      const req = mockRequest() as Request
      req.auth = { type: 'app_token', token: {} as any }

      expect(AuthMiddleware.isAppToken(req)).toBe(true)
      expect(AuthMiddleware.isAuthenticatedUser(req)).toBe(false)
    })

    it('should get user ID from authenticated request', () => {
      const req = mockRequest() as Request
      req.auth = { type: 'user', user: { id: 'user123' } as any }

      expect(AuthMiddleware.getUserId(req)).toBe('user123')
    })

    it('should get app token ID from authenticated request', () => {
      const req = mockRequest() as Request
      req.auth = { type: 'app_token', token: { id: 'token123' } as any }

      expect(AuthMiddleware.getAppTokenId(req)).toBe('token123')
    })
  })

  describe('createAuthMiddleware helper', () => {
    it('should create middleware bundle correctly', () => {
      const middleware = createAuthMiddleware({
        authService,
        getUserById: mockGetUserById,
        getAppTokenByHash: mockGetAppTokenByHash
      })

      expect(middleware.authenticate).toBeDefined()
      expect(middleware.requireAuth).toBeDefined()
      expect(middleware.requirePermission).toBeDefined()
      expect(middleware.requireAdmin).toBeDefined()
      expect(middleware.studioAuth).toBeDefined()
      expect(middleware.adminAuth).toBeDefined()
    })

    it('should create combined middleware correctly', () => {
      const middleware = createAuthMiddleware({
        authService,
        getUserById: mockGetUserById,
        getAppTokenByHash: mockGetAppTokenByHash
      })

      const studioAuthMiddleware = middleware.studioAuth()
      const adminAuthMiddleware = middleware.adminAuth()

      expect(Array.isArray(studioAuthMiddleware)).toBe(true)
      expect(studioAuthMiddleware).toHaveLength(3) // authenticate, requireAuth, requireStudioAccess
      expect(Array.isArray(adminAuthMiddleware)).toBe(true)
      expect(adminAuthMiddleware).toHaveLength(3) // authenticate, requireAuth, requireAdmin
    })
  })

  describe('error handling', () => {
    it('should handle authentication service errors gracefully', async () => {
      jest.spyOn(authService, 'validateToken').mockRejectedValue(new Error('Service error'))

      const req = mockRequest({ authorization: 'Bearer token' }) as Request
      const res = mockResponse() as Response

      await authMiddleware.authenticate()(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication service error' })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it('should handle database errors gracefully', async () => {
      mockGetUserById.mockRejectedValue(new Error('Database error'))
      
      jest.spyOn(authService, 'validateToken').mockResolvedValue({
        valid: true,
        context: {
          type: 'user',
          user: {
            id: 'user123',
            username: 'testuser',
            email: '',
            firstName: '',
            lastName: '',
            role: 'admin',
            permissions: ['content:read'],
            isActive: true
          }
        }
      })

      const req = mockRequest({ authorization: 'Bearer valid_jwt_token' }) as Request
      const res = mockResponse() as Response
      
      await authMiddleware.authenticate()(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication service error' })
      expect(mockNext).not.toHaveBeenCalled()
    })
  })
})