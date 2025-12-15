/**
 * System user types for CMS authentication and authorization
 * These are internal system entities, separate from user-defined content schemas
 *
 * Types are now centralized in @trokky/types and re-exported here for backwards compatibility.
 */

// Re-export all auth types from @trokky/types
export type {
  // OAuth
  OAuthProviderType,
  OAuthProvider,
  // MFA
  MFAMethodType,
  MFAMethod,
  TrustedDevice,
  MFAConfig,
  // Roles and Permissions
  UserRole,
  Permission,
  UserPreferences,
  // User types
  User,
  CreateUserData,
  UpdateUserData,
  UserListOptions,
  LoginCredentials,
  UserSession,
  // App Token types
  AppToken,
  CreateAppTokenData,
  UpdateAppTokenData,
  AppTokenListOptions,
  // Auth context
  AuthenticatedUser,
  AuthenticatedAppToken,
  AuthContext,
  // JWT payloads
  UserTokenPayload,
  AppTokenPayload,
  MFAPendingTokenPayload,
  MFASetupTokenPayload,
  TokenPayload,
  // Auth results
  AuthenticationSuccessResult,
  AuthenticationMFARequiredResult,
  AuthenticationMFASetupRequiredResult,
  AuthenticationResult
} from '@trokky/types'

import type { UserRole, Permission } from '@trokky/types'

// Default permissions for each role (this is runtime data, not just types)
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'content:read', 'content:write', 'content:delete', 'content:publish',
    'media:read', 'media:upload', 'media:edit', 'media:delete',
    'users:read', 'users:write', 'users:delete', 'users:invite',
    'settings:read', 'settings:write',
    'studio:access',
    'tokens:read', 'tokens:write', 'tokens:delete',
    'webhooks:read', 'webhooks:write', 'webhooks:delete', 'webhooks:test'
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
  writer: [
    // Writer can create and edit content, but cannot publish or delete
    // Content must be reviewed and published by an editor or admin
    'content:read', 'content:write',
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