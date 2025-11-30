/**
 * System user types for CMS authentication and authorization
 * These are internal system entities, separate from user-defined content schemas
 */

// OAuth provider types for external authentication
export type OAuthProviderType = 'google' | 'github' | 'microsoft'

export interface OAuthProvider {
  provider: OAuthProviderType
  providerId: string // Provider's unique user ID (e.g., Google's 'sub' claim)
  email: string // Email from OAuth provider
  linkedAt: string // ISO date when account was linked
  lastUsedAt?: string // Last time used for login
}

// MFA (Multi-Factor Authentication) types
export type MFAMethodType = 'totp' | 'email'

export interface MFAMethod {
  type: MFAMethodType
  enabled: boolean
  verified: boolean
  // TOTP specific - encrypted secret for authenticator apps
  secret?: string
  // Timestamp when this method was verified/enabled
  verifiedAt?: string
}

export interface TrustedDevice {
  id: string // Unique device identifier (fingerprint hash)
  name: string // Human-readable name, e.g., "Chrome on MacOS"
  trustedAt: string // ISO date when device was trusted
  expiresAt: string // ISO date when trust expires
  lastUsedAt?: string // Last time MFA was skipped due to trust
  ipAddress?: string // IP address when device was trusted
  userAgent?: string // User agent string for identification
}

export interface MFAConfig {
  enabled: boolean // Whether MFA is active for this user
  methods: MFAMethod[] // Configured MFA methods
  backupCodes?: string[] // Hashed one-time backup codes
  backupCodesGeneratedAt?: string // When backup codes were last generated
  trustedDevices?: TrustedDevice[] // Devices that can skip MFA
  enforcedAt?: string // When org MFA requirement was applied to this user
}

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
  oauthProviders?: OAuthProvider[] // Linked OAuth accounts
  mfa?: MFAConfig // Multi-factor authentication configuration
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export type UserRole = 'admin' | 'editor' | 'author' | 'viewer' | 'api'

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
  ],
  api: [
    // API tokens get their permissions from the token itself, not from role defaults
    // This is just a placeholder - actual permissions come from AppToken.permissions
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
  mfa?: MFAConfig
  lastLoginAt?: string
  passwordHash?: string
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
  oauthProviders?: OAuthProvider[]
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

// MFA pending token - issued after password verification when MFA is required
export interface MFAPendingTokenPayload {
  type: 'mfa_pending'
  userId: string
  username: string
  mfaMethods: MFAMethodType[] // Available MFA methods for this user
  iat: number
  exp: number // Short-lived: 5 minutes
}

// MFA setup token - issued when org requires MFA but user hasn't set it up
export interface MFASetupTokenPayload {
  type: 'mfa_setup'
  userId: string
  username: string
  allowedMethods: MFAMethodType[] // Methods allowed by org settings
  iat: number
  exp: number // Limited scope: 15 minutes
}

// Union type for all token payloads
export type TokenPayload =
  | UserTokenPayload
  | AppTokenPayload
  | MFAPendingTokenPayload
  | MFASetupTokenPayload

// Authentication result types for MFA support
export interface AuthenticationSuccessResult {
  type: 'success'
  user: User
  token: string
  refreshToken: string
  expiresAt: string // ISO date string when token expires
}

export interface AuthenticationMFARequiredResult {
  type: 'mfa_required'
  requiresMFA: true
  mfaToken: string
  methods: MFAMethodType[]
  expiresIn: number // seconds until mfaToken expires (default: 300 = 5 minutes)
}

export interface AuthenticationMFASetupRequiredResult {
  type: 'mfa_setup_required'
  requiresMFASetup: true
  setupToken: string
  allowedMethods: MFAMethodType[]
  message: string
  expiresIn: number // seconds until setupToken expires (default: 900 = 15 minutes)
}

// Union type for all authentication results
export type AuthenticationResult =
  | AuthenticationSuccessResult
  | AuthenticationMFARequiredResult
  | AuthenticationMFASetupRequiredResult