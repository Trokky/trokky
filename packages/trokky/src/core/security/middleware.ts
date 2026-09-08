/**
 * Authentication and Authorization Middleware
 * 
 * Provides Express middleware for protecting routes with authentication
 * and permission-based authorization.
 */

import type { Request, Response, NextFunction } from 'express'
import type { AuthContext, Permission } from '../types/user.js'
import type { AuthenticationService } from './auth.js'

// Extend Express Request to include auth context
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

export interface AuthMiddlewareConfig {
  authService: AuthenticationService
  getUserById?: (id: string) => Promise<any>
  getAppTokenByHash?: (hash: string) => Promise<any>
}

export class AuthMiddleware {
  private authService: AuthenticationService
  private getUserById?: (id: string) => Promise<any>
  private getAppTokenByHash?: (hash: string) => Promise<any>

  constructor(config: AuthMiddlewareConfig) {
    this.authService = config.authService
    this.getUserById = config.getUserById
    this.getAppTokenByHash = config.getAppTokenByHash
  }

  /**
   * Middleware to authenticate requests
   * Supports both JWT tokens (Authorization: Bearer) and App tokens (X-API-Token)
   */
  authenticate() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Try JWT authentication first (Authorization header)
        const authHeader = req.headers.authorization
        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.substring(7)
          const result = await this.authService.validateToken(token)
          
          if (result.valid && result.context) {
            // For user tokens, verify user still exists and is active
            if (result.context.type === 'user' && this.getUserById) {
              const user = await this.getUserById(result.context.user.id)
              if (!user || !user.isActive) {
                return res.status(401).json({ error: 'User account is inactive' })
              }
              // Update context with fresh user data
              result.context.user = {
                ...result.context.user,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                isActive: user.isActive
              }
            }
            
            req.auth = result.context
            return next()
          }
        }

        // Try app token authentication (X-API-Token header)
        const apiToken = req.headers['x-api-token'] as string
        if (apiToken && this.getAppTokenByHash) {
          const validation = await this.authService.validateAppToken(apiToken)
          
          if (validation.valid && validation.hash) {
            const appToken = await this.getAppTokenByHash(validation.hash)
            
            if (appToken && appToken.isActive) {
              // Check expiration
              if (appToken.expiresAt && new Date() > new Date(appToken.expiresAt)) {
                return res.status(401).json({ error: 'App token has expired' })
              }

              // Update usage tracking
              appToken.lastUsedAt = new Date().toISOString()
              appToken.usageCount = (appToken.usageCount || 0) + 1
              
              req.auth = {
                type: 'app_token',
                token: {
                  id: appToken.id,
                  name: appToken.name,
                  permissions: appToken.permissions,
                  createdBy: appToken.createdBy,
                  isActive: appToken.isActive
                }
              }
              return next()
            }
          }
        }

        // No valid authentication found
        req.auth = { type: 'anonymous' }
        next()
      } catch (error) {
        console.error('Authentication error:', error)
        return res.status(500).json({ error: 'Authentication service error' })
      }
    }
  }

  /**
   * Middleware to require authentication
   */
  requireAuth() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.auth || req.auth.type === 'anonymous') {
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'Please provide a valid Bearer token or X-API-Token header'
        })
      }
      next()
    }
  }

  /**
   * Middleware to require specific permissions
   */
  requirePermission(permission: Permission) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.auth || req.auth.type === 'anonymous') {
        return res.status(401).json({ error: 'Authentication required' })
      }

      if (!this.authService.hasPermission(req.auth, permission)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permission
        })
      }

      next()
    }
  }

  /**
   * Middleware to require any of the specified permissions
   */
  requireAnyPermission(permissions: Permission[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.auth || req.auth.type === 'anonymous') {
        return res.status(401).json({ error: 'Authentication required' })
      }

      if (!this.authService.hasAnyPermission(req.auth, permissions)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: `One of: ${permissions.join(', ')}`
        })
      }

      next()
    }
  }

  /**
   * Middleware to require all of the specified permissions
   */
  requireAllPermissions(permissions: Permission[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.auth || req.auth.type === 'anonymous') {
        return res.status(401).json({ error: 'Authentication required' })
      }

      if (!this.authService.hasAllPermissions(req.auth, permissions)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: `All of: ${permissions.join(', ')}`
        })
      }

      next()
    }
  }

  /**
   * Middleware to require admin role (user authentication only)
   */
  requireAdmin() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (!req.auth || req.auth.type !== 'user') {
        return res.status(401).json({ error: 'User authentication required' })
      }

      if (req.auth.user.role !== 'admin') {
        return res.status(403).json({ 
          error: 'Admin access required',
          currentRole: req.auth.user.role
        })
      }

      next()
    }
  }

  /**
   * Middleware to require Studio access
   */
  requireStudioAccess() {
    return this.requirePermission('studio:access')
  }

  /**
   * Middleware for optional authentication (sets context but doesn't require it)
   */
  optionalAuth() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Use the authenticate middleware but don't fail on anonymous
      await this.authenticate()(req, res, (error?: any) => {
        // Always continue, even if authentication failed
        if (!req.auth) {
          req.auth = { type: 'anonymous' }
        }
        next(error)
      })
    }
  }

  /**
   * Get current authentication context from request
   */
  static getAuthContext(req: Request): AuthContext {
    return req.auth || { type: 'anonymous' }
  }

  /**
   * Check if current request is from an authenticated user
   */
  static isAuthenticatedUser(req: Request): boolean {
    return req.auth?.type === 'user'
  }

  /**
   * Check if current request is from an app token
   */
  static isAppToken(req: Request): boolean {
    return req.auth?.type === 'app_token'
  }

  /**
   * Get user ID from authenticated request (if user auth)
   */
  static getUserId(req: Request): string | null {
    return req.auth?.type === 'user' ? req.auth.user.id : null
  }

  /**
   * Get app token ID from authenticated request (if app token auth)
   */
  static getAppTokenId(req: Request): string | null {
    return req.auth?.type === 'app_token' ? req.auth.token.id : null
  }
}

/**
 * Helper function to create common middleware combinations
 */
export function createAuthMiddleware(config: AuthMiddlewareConfig) {
  const middleware = new AuthMiddleware(config)

  return {
    // Core middleware
    authenticate: middleware.authenticate(),
    requireAuth: middleware.requireAuth(),
    optionalAuth: middleware.optionalAuth(),
    
    // Permission-based middleware
    requirePermission: (permission: Permission) => middleware.requirePermission(permission),
    requireAnyPermission: (permissions: Permission[]) => middleware.requireAnyPermission(permissions),
    requireAllPermissions: (permissions: Permission[]) => middleware.requireAllPermissions(permissions),
    
    // Role-based middleware
    requireAdmin: middleware.requireAdmin(),
    requireStudioAccess: middleware.requireStudioAccess(),
    
    // Common combinations
    authAndPermission: (permission: Permission) => [
      middleware.authenticate(),
      middleware.requireAuth(),
      middleware.requirePermission(permission)
    ],
    
    studioAuth: () => [
      middleware.authenticate(),
      middleware.requireAuth(),
      middleware.requireStudioAccess()
    ],
    
    adminAuth: () => [
      middleware.authenticate(),
      middleware.requireAuth(),
      middleware.requireAdmin()
    ],

    // Utility functions
    getAuthContext: AuthMiddleware.getAuthContext,
    isAuthenticatedUser: AuthMiddleware.isAuthenticatedUser,
    isAppToken: AuthMiddleware.isAppToken,
    getUserId: AuthMiddleware.getUserId,
    getAppTokenId: AuthMiddleware.getAppTokenId
  }
}