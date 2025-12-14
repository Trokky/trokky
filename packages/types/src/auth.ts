/**
 * @trokky/types - Authentication and Authorization Types
 *
 * Core authentication types used across the Trokky ecosystem.
 * These types define users, roles, permissions, tokens, and auth contexts.
 */

import type { PasskeyCredential } from './passkey.js'

// ============================================================================
// OAuth Provider Types
// ============================================================================

/**
 * Supported OAuth provider types
 */
export type OAuthProviderType = 'google' | 'github' | 'microsoft'

/**
 * OAuth provider configuration for linked accounts
 */
export interface OAuthProvider {
  /** OAuth provider type */
  provider: OAuthProviderType
  /** Provider's unique user ID (e.g., Google's 'sub' claim) */
  providerId: string
  /** Email from OAuth provider */
  email: string
  /** ISO date when account was linked */
  linkedAt: string
  /** Last time used for login */
  lastUsedAt?: string
}

// ============================================================================
// Multi-Factor Authentication Types
// ============================================================================

/**
 * Supported MFA method types
 */
export type MFAMethodType = 'totp' | 'email'

/**
 * MFA method configuration
 */
export interface MFAMethod {
  /** Type of MFA method */
  type: MFAMethodType
  /** Whether this method is enabled */
  enabled: boolean
  /** Whether this method has been verified */
  verified: boolean
  /** TOTP specific - encrypted secret for authenticator apps */
  secret?: string
  /** Timestamp when this method was verified/enabled */
  verifiedAt?: string
}

/**
 * Trusted device configuration for MFA bypass
 */
export interface TrustedDevice {
  /** Unique device identifier (fingerprint hash) */
  id: string
  /** Human-readable name, e.g., "Chrome on MacOS" */
  name: string
  /** ISO date when device was trusted */
  trustedAt: string
  /** ISO date when trust expires */
  expiresAt: string
  /** Last time MFA was skipped due to trust */
  lastUsedAt?: string
  /** IP address when device was trusted */
  ipAddress?: string
  /** User agent string for identification */
  userAgent?: string
}

/**
 * MFA configuration for a user
 */
export interface MFAConfig {
  /** Whether MFA is active for this user */
  enabled: boolean
  /** Configured MFA methods */
  methods: MFAMethod[]
  /** Hashed one-time backup codes */
  backupCodes?: string[]
  /** When backup codes were last generated */
  backupCodesGeneratedAt?: string
  /** Devices that can skip MFA */
  trustedDevices?: TrustedDevice[]
  /** When org MFA requirement was applied to this user */
  enforcedAt?: string
}

// ============================================================================
// User Roles and Permissions
// ============================================================================

/**
 * System user roles
 */
export type UserRole = 'admin' | 'editor' | 'author' | 'viewer' | 'api'

/**
 * Granular permissions with resource-based scoping
 */
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
  | 'webhooks:test'
  // Dynamic schema permissions (runtime pattern matching)
  | string // Allows dynamic permissions like "articles:read", "products:write", etc.

/**
 * User preferences for UI and localization
 */
export interface UserPreferences {
  /** UI theme preference */
  theme?: 'light' | 'dark'
  /** Preferred language */
  language?: string
  /** Preferred timezone */
  timezone?: string
  /** Additional custom preferences */
  [key: string]: unknown
}

// ============================================================================
// User Types
// ============================================================================

/**
 * System user entity
 */
export interface User {
  /** Unique user ID */
  id: string
  /** Username for login */
  username: string
  /** Email address */
  email: string
  /** Hashed password */
  passwordHash: string
  /** First name */
  firstName: string
  /** Last name */
  lastName: string
  /** User role */
  role: UserRole
  /** Granted permissions */
  permissions: Permission[]
  /** Whether the user is active */
  isActive: boolean
  /** Profile image URL */
  profileImage?: string
  /** User preferences */
  preferences?: UserPreferences
  /** Linked OAuth accounts */
  oauthProviders?: OAuthProvider[]
  /** Multi-factor authentication configuration */
  mfa?: MFAConfig
  /** Registered passkey credentials for passwordless authentication */
  passkeys?: PasskeyCredential[]
  /** Last login timestamp */
  lastLoginAt?: string
  /** Account creation timestamp */
  createdAt: string
  /** Last update timestamp */
  updatedAt: string
}

/**
 * Data required to create a new user
 */
export interface CreateUserData {
  username: string
  email: string
  /** Plain text password (will be hashed) */
  password: string
  firstName: string
  lastName: string
  role: UserRole
  permissions?: Permission[]
  isActive?: boolean
  profileImage?: string
  preferences?: UserPreferences
}

/**
 * Data for updating a user
 */
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

/**
 * Options for listing users
 */
export interface UserListOptions {
  role?: UserRole
  isActive?: boolean
  limit?: number
  offset?: number
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  username: string
  password: string
}

/**
 * User session information
 */
export interface UserSession {
  userId: string
  username: string
  role: UserRole
  permissions: Permission[]
  loginAt: string
  expiresAt?: string
}

// ============================================================================
// App Token Types
// ============================================================================

/**
 * Application token for API access
 */
export interface AppToken {
  /** Unique token ID */
  id: string
  /** Human-readable token name */
  name: string
  /** Optional description */
  description?: string
  /** Hashed version of the actual token */
  tokenHash: string
  /** Permissions granted to this token */
  permissions: Permission[]
  /** User ID who created the token */
  createdBy: string
  /** Whether the token is active */
  isActive: boolean
  /** Last time the token was used */
  lastUsedAt?: string
  /** Number of times the token has been used */
  usageCount?: number
  /** Optional expiration date */
  expiresAt?: string
  /** Creation timestamp */
  createdAt: string
  /** Last update timestamp */
  updatedAt: string
}

/**
 * Data required to create an app token
 */
export interface CreateAppTokenData {
  name: string
  description?: string
  permissions: Permission[]
  /** Optional expiration date */
  expiresAt?: string
}

/**
 * Data for updating an app token
 */
export interface UpdateAppTokenData {
  name?: string
  description?: string
  permissions?: Permission[]
  isActive?: boolean
  expiresAt?: string
}

/**
 * Options for listing app tokens
 */
export interface AppTokenListOptions {
  createdBy?: string
  isActive?: boolean
  limit?: number
  offset?: number
}

// ============================================================================
// Authentication Context Types
// ============================================================================

/**
 * Authenticated user (without sensitive data like passwordHash)
 */
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

/**
 * Authenticated app token (without sensitive data)
 */
export interface AuthenticatedAppToken {
  id: string
  name: string
  permissions: Permission[]
  createdBy: string
  isActive: boolean
}

/**
 * Authentication context - represents the authenticated entity
 */
export type AuthContext =
  | { type: 'user'; user: AuthenticatedUser }
  | { type: 'app_token'; token: AuthenticatedAppToken }
  | { type: 'anonymous' }

// ============================================================================
// JWT Token Payload Types
// ============================================================================

/**
 * JWT payload for user tokens
 */
export interface UserTokenPayload {
  type: 'user'
  userId: string
  username: string
  role: UserRole
  permissions: Permission[]
  iat: number
  exp: number
}

/**
 * JWT payload for app tokens
 */
export interface AppTokenPayload {
  type: 'app_token'
  tokenId: string
  name: string
  permissions: Permission[]
  createdBy: string
  iat: number
  exp?: number
}

/**
 * JWT payload for MFA pending state
 */
export interface MFAPendingTokenPayload {
  type: 'mfa_pending'
  userId: string
  username: string
  /** Available MFA methods for this user */
  mfaMethods: MFAMethodType[]
  iat: number
  /** Short-lived: 5 minutes */
  exp: number
}

/**
 * JWT payload for MFA setup state
 */
export interface MFASetupTokenPayload {
  type: 'mfa_setup'
  userId: string
  username: string
  /** Methods allowed by org settings */
  allowedMethods: MFAMethodType[]
  iat: number
  /** Limited scope: 15 minutes */
  exp: number
}

/**
 * Union type for all token payloads
 */
export type TokenPayload =
  | UserTokenPayload
  | AppTokenPayload
  | MFAPendingTokenPayload
  | MFASetupTokenPayload

// ============================================================================
// Authentication Result Types
// ============================================================================

/**
 * Successful authentication result
 */
export interface AuthenticationSuccessResult {
  type: 'success'
  user: User
  token: string
  refreshToken: string
  /** ISO date string when token expires */
  expiresAt: string
}

/**
 * MFA required authentication result
 */
export interface AuthenticationMFARequiredResult {
  type: 'mfa_required'
  requiresMFA: true
  mfaToken: string
  methods: MFAMethodType[]
  /** Seconds until mfaToken expires (default: 300 = 5 minutes) */
  expiresIn: number
}

/**
 * MFA setup required authentication result
 */
export interface AuthenticationMFASetupRequiredResult {
  type: 'mfa_setup_required'
  requiresMFASetup: true
  setupToken: string
  allowedMethods: MFAMethodType[]
  message: string
  /** Seconds until setupToken expires (default: 900 = 15 minutes) */
  expiresIn: number
}

/**
 * Union type for all authentication results
 */
export type AuthenticationResult =
  | AuthenticationSuccessResult
  | AuthenticationMFARequiredResult
  | AuthenticationMFASetupRequiredResult
