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

export type UserRole = 'admin' | 'editor' | 'viewer'

export type Permission = 
  | 'read'
  | 'write' 
  | 'delete'
  | 'manage_users'
  | 'manage_settings'
  | 'upload_media'
  | 'delete_media'

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