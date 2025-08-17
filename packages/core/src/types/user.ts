/**
 * System user types for CMS authentication and authorization
 * These are internal system entities, separate from user-defined content schemas
 */

export interface User {
  id: string
  username: string
  email: string
  passwordHash: string
  firstName: string
  lastName: string
  role: UserRole
  permissions: Permission[]
  isActive: boolean
  profileImage?: string
  preferences?: UserPreferences
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export type UserRole = 'admin' | 'editor' | 'author' | 'viewer'

// Default permissions for each role
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'content:read', 'content:write', 'content:delete', 'content:publish',
    'media:read', 'media:upload', 'media:edit', 'media:delete',
    'users:read', 'users:write', 'users:delete', 'users:invite',
    'settings:read', 'settings:write',
    'studio:access',
    'tokens:read', 'tokens:write', 'tokens:delete'
  ],
  editor: [
    'content:read', 'content:write', 'content:delete', 'content:publish',
    'media:read', 'media:upload', 'media:edit', 'media:delete',
    'studio:access'
  ],
  author: [
    'content:read', 'content:write', 'content:publish',
    'media:read', 'media:upload',
    'studio:access'
  ],
  viewer: [
    'content:read',
    'media:read',
    'studio:access'
  ]
}

// Granular permissions with resource-based scoping
export type Permission = 
  // Content permissions
  | 'content:read'
  | 'content:write'
  | 'content:delete'
  | 'content:publish'
  | 'content:*' // Wildcard for all content operations
  // Media permissions
  | 'media:read'
  | 'media:upload'
  | 'media:edit'
  | 'media:delete'
  // User management permissions
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'users:invite'
  // Settings permissions
  | 'settings:read'
  | 'settings:write'
  // Studio access
  | 'studio:access'
  // App token management
  | 'tokens:read'
  | 'tokens:write'
  | 'tokens:delete'
  // Webhook management
  | 'webhooks:read'
  | 'webhooks:write'
  | 'webhooks:delete'
  // Dynamic schema permissions (runtime pattern matching)
  | string // Allows dynamic permissions like "articles:read", "products:write", etc.

export interface UserPreferences {
  theme?: 'light' | 'dark'
  language?: string
  timezone?: string
  [key: string]: unknown
}

export interface CreateUserData {
  username: string
  email: string
  password: string // Plain text password (will be hashed)
  firstName: string
  lastName: string
  role: UserRole
  permissions?: Permission[]
  isActive?: boolean
  profileImage?: string
  preferences?: UserPreferences
}

export interface UpdateUserData {
  username?: string
  email?: string
  firstName?: string
  lastName?: string
  role?: UserRole
  permissions?: Permission[]
  isActive?: boolean
  profileImage?: string
  preferences?: UserPreferences
  lastLoginAt?: string
}

export interface UserListOptions {
  role?: UserRole
  isActive?: boolean
  limit?: number
  offset?: number
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface UserSession {
  userId: string
  username: string
  role: UserRole
  permissions: Permission[]
  loginAt: string
  expiresAt?: string
}

// App Token types for API access
export interface AppToken {
  id: string
  name: string
  description?: string
  tokenHash: string // Hashed version of the actual token
  permissions: Permission[]
  createdBy: string // User ID who created the token
  isActive: boolean
  lastUsedAt?: string
  usageCount?: number
  expiresAt?: string // Optional expiration
  createdAt: string
  updatedAt: string
}

export interface CreateAppTokenData {
  name: string
  description?: string
  permissions: Permission[]
  expiresAt?: string // Optional expiration date
}

export interface UpdateAppTokenData {
  name?: string
  description?: string
  permissions?: Permission[]
  isActive?: boolean
  expiresAt?: string
}

export interface AppTokenListOptions {
  createdBy?: string
  isActive?: boolean
  limit?: number
  offset?: number
}

// Enhanced session types
export interface AuthenticatedUser {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  role: UserRole
  permissions: Permission[]
  isActive: boolean
}

export interface AuthenticatedAppToken {
  id: string
  name: string
  permissions: Permission[]
  createdBy: string
  isActive: boolean
}

export type AuthContext = 
  | { type: 'user'; user: AuthenticatedUser }
  | { type: 'app_token'; token: AuthenticatedAppToken }
  | { type: 'anonymous' }

// JWT token payloads
export interface UserTokenPayload {
  type: 'user'
  userId: string
  username: string
  role: UserRole
  permissions: Permission[]
  iat: number
  exp: number
}

export interface AppTokenPayload {
  type: 'app_token'
  tokenId: string
  name: string
  permissions: Permission[]
  createdBy: string
  iat: number
  exp?: number
}