/**
 * Authentication and Authorization Service
 * 
 * Provides secure user authentication with JWT tokens and app token management.
 * Supports multiple authentication methods:
 * - User JWT sessions (for Studio access)
 * - App tokens (for API integrations)
 * - Service tokens (for internal communication)
 */

import { randomBytes, createHash } from 'node:crypto'
import type { 
  User, 
  AppToken, 
  AuthContext, 
  Permission, 
  UserRole,
  UserTokenPayload,
  AppTokenPayload,
  CreateAppTokenData,
  AuthenticatedUser,
  AuthenticatedAppToken,
  ROLE_PERMISSIONS
} from '../types/user.js'

export interface AuthConfig {
  jwtSecret: string
  jwtExpiresIn: string // e.g., '1h', '7d'
  refreshTokenExpiresIn: string // e.g., '30d'
  bcryptRounds: number
  rateLimitAttempts: number
  rateLimitWindow: number // milliseconds
}

export interface LoginResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  user?: AuthenticatedUser
  error?: string
}

export interface TokenValidationResult {
  valid: boolean
  context?: AuthContext
  error?: string
}

export interface AppTokenCreationResult {
  success: boolean
  token?: string // Plain text token (only returned once)
  appToken?: AppToken
  error?: string
}

export class AuthenticationService {
  private config: AuthConfig
  private failedAttempts: Map<string, { count: number; lastAttempt: number }> = new Map()

  constructor(config: AuthConfig) {
    this.config = config
  }

  /**
   * Hash a password using bcrypt-compatible algorithm
   */
  async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcrypt')
    return bcrypt.hash(password, this.config.bcryptRounds)
  }

  /**
   * Verify a password against its hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const bcrypt = await import('bcrypt')
      return bcrypt.compare(password, hash)
    } catch (error) {
      return false
    }
  }

  /**
   * Generate a secure JWT token for user authentication
   */
  async generateUserToken(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const jwt = await import('jsonwebtoken')
    
    const payload: UserTokenPayload = {
      type: 'user',
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseTimeToSeconds(this.config.jwtExpiresIn)
    }

    const refreshPayload = {
      type: 'refresh',
      userId: user.id,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseTimeToSeconds(this.config.refreshTokenExpiresIn)
    }

    const accessToken = jwt.sign(payload, this.config.jwtSecret)
    const refreshToken = jwt.sign(refreshPayload, this.config.jwtSecret)

    return { accessToken, refreshToken }
  }

  /**
   * Generate a secure app token for API access
   */
  async generateAppToken(): Promise<{ token: string; hash: string }> {
    // Generate a secure random token (32 bytes = 256 bits)
    const tokenBytes = randomBytes(32)
    const token = tokenBytes.toString('base64url') // URL-safe base64
    
    // Hash the token for secure storage
    const hash = createHash('sha256').update(token).digest('hex')
    
    return { token, hash }
  }

  /**
   * Create an app token with specified permissions
   */
  async createAppToken(data: CreateAppTokenData, createdBy: string): Promise<AppTokenCreationResult> {
    try {
      const { token, hash } = await this.generateAppToken()
      const now = new Date().toISOString()
      
      const appToken: AppToken = {
        id: this.generateId(),
        name: data.name,
        description: data.description,
        tokenHash: hash,
        permissions: data.permissions,
        createdBy,
        isActive: true,
        lastUsedAt: undefined,
        usageCount: 0,
        expiresAt: data.expiresAt,
        createdAt: now,
        updatedAt: now
      }

      return {
        success: true,
        token, // Return plain text token only once
        appToken
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create app token'
      }
    }
  }

  /**
   * Validate a JWT token and return authentication context
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      const jwt = await import('jsonwebtoken')
      const decoded = jwt.verify(token, this.config.jwtSecret) as UserTokenPayload | AppTokenPayload

      if (decoded.type === 'user') {
        return {
          valid: true,
          context: {
            type: 'user',
            user: {
              id: decoded.userId,
              username: decoded.username,
              email: '', // Will be populated from storage
              firstName: '', // Will be populated from storage
              lastName: '', // Will be populated from storage
              role: decoded.role,
              permissions: decoded.permissions,
              isActive: true // Will be verified from storage
            }
          }
        }
      } else if (decoded.type === 'app_token') {
        return {
          valid: true,
          context: {
            type: 'app_token',
            token: {
              id: decoded.tokenId,
              name: decoded.name,
              permissions: decoded.permissions,
              createdBy: decoded.createdBy,
              isActive: true // Will be verified from storage
            }
          }
        }
      }

      return { valid: false, error: 'Invalid token type' }
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Token validation failed' 
      }
    }
  }

  /**
   * Validate an app token using the raw token string
   */
  async validateAppToken(token: string): Promise<{ valid: boolean; hash?: string; error?: string }> {
    try {
      // Hash the provided token to compare with stored hash
      const hash = createHash('sha256').update(token).digest('hex')
      return { valid: true, hash }
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'App token validation failed' 
      }
    }
  }

  /**
   * Check if a user/token has a specific permission
   */
  hasPermission(context: AuthContext, permission: Permission): boolean {
    if (context.type === 'anonymous') {
      return false
    }

    if (context.type === 'user') {
      return context.user.permissions.includes(permission)
    }

    if (context.type === 'app_token') {
      return context.token.permissions.includes(permission)
    }

    return false
  }

  /**
   * Check if a user/token has any of the specified permissions
   */
  hasAnyPermission(context: AuthContext, permissions: Permission[]): boolean {
    return permissions.some(permission => this.hasPermission(context, permission))
  }

  /**
   * Check if a user/token has all of the specified permissions
   */
  hasAllPermissions(context: AuthContext, permissions: Permission[]): boolean {
    return permissions.every(permission => this.hasPermission(context, permission))
  }

  /**
   * Get default permissions for a role
   */
  getRolePermissions(role: UserRole): Permission[] {
    // Import here to avoid circular dependencies
    const { ROLE_PERMISSIONS } = require('../types/user.js')
    return ROLE_PERMISSIONS[role] || []
  }

  /**
   * Rate limiting for login attempts
   */
  isRateLimited(identifier: string): boolean {
    const attempts = this.failedAttempts.get(identifier)
    if (!attempts) return false

    const now = Date.now()
    const timeSinceLastAttempt = now - attempts.lastAttempt

    // Reset if window has passed
    if (timeSinceLastAttempt > this.config.rateLimitWindow) {
      this.failedAttempts.delete(identifier)
      return false
    }

    return attempts.count >= this.config.rateLimitAttempts
  }

  /**
   * Record a failed login attempt
   */
  recordFailedAttempt(identifier: string): void {
    const attempts = this.failedAttempts.get(identifier) || { count: 0, lastAttempt: 0 }
    this.failedAttempts.set(identifier, {
      count: attempts.count + 1,
      lastAttempt: Date.now()
    })
  }

  /**
   * Clear failed login attempts (on successful login)
   */
  clearFailedAttempts(identifier: string): void {
    this.failedAttempts.delete(identifier)
  }

  /**
   * Generate a unique ID for entities
   */
  private generateId(): string {
    return randomBytes(16).toString('hex')
  }

  /**
   * Parse time string to seconds (e.g., '1h' -> 3600)
   */
  private parseTimeToSeconds(timeString: string): number {
    const units: Record<string, number> = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400,
      'w': 604800
    }

    const match = timeString.match(/^(\d+)([smhdw])$/)
    if (!match) {
      throw new Error(`Invalid time format: ${timeString}`)
    }

    const [, value, unit] = match
    return parseInt(value, 10) * units[unit]
  }
}

/**
 * Default authentication configuration
 */
export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  jwtSecret: process.env.TROKKY_JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  jwtExpiresIn: '2h', // 2 hours for access tokens
  refreshTokenExpiresIn: '7d', // 7 days for refresh tokens
  bcryptRounds: 12,
  rateLimitAttempts: 5,
  rateLimitWindow: 15 * 60 * 1000 // 15 minutes
}