/**
 * @trokky/types - OAuth2 Authorization Server Types
 *
 * Supports Device Authorization Flow (RFC 8628) and Authorization Code Flow with PKCE.
 * Enables Trokky Studio to act as an SSO provider for CLI and external applications.
 */

import type { Permission } from './auth.js'

// ============================================================================
// OAuth2 Grant and Client Types
// ============================================================================

/**
 * OAuth2 Grant Types supported by the authorization server
 */
export type OAuth2GrantType =
  | 'authorization_code'      // Web apps with redirect (SSO)
  | 'urn:ietf:params:oauth:grant-type:device_code'  // CLI and devices (RFC 8628)
  | 'refresh_token'           // Token refresh

/**
 * OAuth2 Client Types
 * - public: No client secret (CLI, SPAs, mobile apps)
 * - confidential: Has client secret (server-side web apps)
 */
export type OAuth2ClientType = 'public' | 'confidential'

/**
 * Registered OAuth2 Client (Application)
 */
export interface OAuth2Client {
  /** Unique client identifier */
  id: string
  /** Human-readable client name */
  name: string
  /** Optional description */
  description?: string
  /** Client type (public or confidential) */
  type: OAuth2ClientType
  /** Hashed client secret (only for confidential clients) */
  secretHash?: string
  /** Allowed redirect URIs for authorization code flow */
  redirectUris: string[]
  /** Allowed scopes this client can request */
  allowedScopes: OAuth2Scope[]
  /** Allowed grant types for this client */
  grantTypes: OAuth2GrantType[]
  /** Whether client is active */
  isActive: boolean
  /** Whether this is a built-in client (e.g., CLI) */
  isBuiltIn?: boolean
  /** User ID who registered this client */
  createdBy?: string
  /** Logo URL for consent screen */
  logoUrl?: string
  /** Homepage URL for client info */
  homepageUrl?: string
  /** Privacy policy URL */
  privacyPolicyUrl?: string
  /** Terms of service URL */
  termsOfServiceUrl?: string
  createdAt: string
  updatedAt: string
}

/**
 * OAuth2 Scopes - map to Trokky permissions
 */
export type OAuth2Scope =
  | 'openid'           // OpenID Connect identity
  | 'profile'          // User profile info (name, email)
  | 'content:read'     // Read content
  | 'content:write'    // Create/update content
  | 'content:delete'   // Delete content
  | 'media:read'       // Read media
  | 'media:write'      // Upload/edit media
  | 'offline_access'   // Request refresh token

/**
 * Map OAuth2 scopes to Trokky permissions
 */
export const SCOPE_TO_PERMISSIONS: Record<OAuth2Scope, Permission[]> = {
  'openid': [],
  'profile': [],
  'content:read': ['content:read'],
  'content:write': ['content:read', 'content:write'],
  'content:delete': ['content:read', 'content:delete'],
  'media:read': ['media:read'],
  'media:write': ['media:read', 'media:upload', 'media:edit'],
  'offline_access': []
}

// ============================================================================
// Device Authorization Flow (RFC 8628)
// ============================================================================

/**
 * Device Authorization Request
 * POST /auth/device
 */
export interface DeviceAuthorizationRequest {
  /** Client identifier */
  client_id: string
  /** Space-separated list of requested scopes */
  scope?: string
}

/**
 * Device Authorization Response
 * Returned by POST /auth/device
 */
export interface DeviceAuthorizationResponse {
  /** Device verification code (shown to user) */
  device_code: string
  /** User code to enter in browser (short, easy to type) */
  user_code: string
  /** URL where user should go to authorize */
  verification_uri: string
  /** Full URL with user_code pre-filled (optional) */
  verification_uri_complete?: string
  /** Lifetime of device_code in seconds */
  expires_in: number
  /** Minimum polling interval in seconds */
  interval: number
}

/**
 * Device code state stored server-side
 */
export interface DeviceCodeState {
  /** The device code (hashed for storage) */
  deviceCodeHash: string
  /** The user code (plain text, for lookup) */
  userCode: string
  /** Client that initiated the request */
  clientId: string
  /** Requested scopes */
  scopes: OAuth2Scope[]
  /** When the code expires */
  expiresAt: number
  /** Polling interval in seconds */
  interval: number
  /** Authorization status */
  status: 'pending' | 'authorized' | 'denied' | 'expired'
  /** User ID if authorized */
  userId?: string
  /** Timestamp when user authorized/denied */
  decidedAt?: number
}

/**
 * Device Token Request
 * POST /auth/token with grant_type=urn:ietf:params:oauth:grant-type:device_code
 */
export interface DeviceTokenRequest {
  grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
  device_code: string
  client_id: string
}

// ============================================================================
// Authorization Code Flow with PKCE
// ============================================================================

/**
 * Authorization Request (GET /auth/authorize)
 */
export interface AuthorizationRequest {
  response_type: 'code'
  client_id: string
  redirect_uri: string
  scope?: string
  state: string
  /** PKCE code challenge */
  code_challenge: string
  /** PKCE code challenge method (always S256) */
  code_challenge_method: 'S256'
}

/**
 * Authorization code state stored server-side
 */
export interface AuthorizationCodeState {
  /** The authorization code (hashed for storage) */
  codeHash: string
  /** Client that initiated the request */
  clientId: string
  /** Redirect URI used in the request */
  redirectUri: string
  /** Requested scopes */
  scopes: OAuth2Scope[]
  /** PKCE code challenge */
  codeChallenge: string
  /** User ID who authorized */
  userId: string
  /** When the code expires (short-lived, ~10 minutes) */
  expiresAt: number
}

/**
 * Authorization Code Token Request
 * POST /auth/token with grant_type=authorization_code
 */
export interface AuthorizationCodeTokenRequest {
  grant_type: 'authorization_code'
  code: string
  redirect_uri: string
  client_id: string
  /** PKCE code verifier */
  code_verifier: string
}

/**
 * Refresh Token Request
 * POST /auth/token with grant_type=refresh_token
 */
export interface OAuth2RefreshTokenRequest {
  grant_type: 'refresh_token'
  refresh_token: string
  client_id: string
  scope?: string
}

// ============================================================================
// Token Responses
// ============================================================================

/**
 * Successful Token Response
 */
export interface TokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token?: string
  scope: string
}

/**
 * OAuth2 Error Response
 */
export interface OAuth2ErrorResponse {
  error: OAuth2ErrorCode
  error_description?: string
  error_uri?: string
}

/**
 * OAuth2 Error Codes
 */
export type OAuth2ErrorCode =
  // Device flow errors
  | 'authorization_pending'  // User hasn't authorized yet
  | 'slow_down'              // Client is polling too fast
  | 'access_denied'          // User denied authorization
  | 'expired_token'          // Device code expired
  // General errors
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'invalid_scope'
  | 'server_error'

// ============================================================================
// User Consent
// ============================================================================

/**
 * User consent record for a client
 */
export interface UserConsent {
  /** User ID */
  userId: string
  /** Client ID */
  clientId: string
  /** Scopes the user has consented to */
  scopes: OAuth2Scope[]
  /** When consent was granted */
  grantedAt: string
  /** When consent expires (optional) */
  expiresAt?: string
}

// ============================================================================
// Token Storage
// ============================================================================

/**
 * OAuth2 Access Token record (for revocation tracking)
 */
export interface OAuth2AccessToken {
  /** Token ID (jti claim) */
  id: string
  /** User ID */
  userId: string
  /** Client ID */
  clientId: string
  /** Granted scopes */
  scopes: OAuth2Scope[]
  /** When token expires */
  expiresAt: number
  /** Whether token has been revoked */
  revoked: boolean
  createdAt: string
}

/**
 * OAuth2 Refresh Token record
 */
export interface OAuth2RefreshToken {
  /** Token hash */
  tokenHash: string
  /** User ID */
  userId: string
  /** Client ID */
  clientId: string
  /** Granted scopes */
  scopes: OAuth2Scope[]
  /** When token expires */
  expiresAt: number
  /** Whether token has been revoked */
  revoked: boolean
  /** Access token ID this refresh token is associated with */
  accessTokenId?: string
  createdAt: string
}

// ============================================================================
// Client Management
// ============================================================================

/**
 * Data for creating a new OAuth2 client
 */
export interface CreateOAuth2ClientData {
  name: string
  description?: string
  type: OAuth2ClientType
  redirectUris: string[]
  allowedScopes?: OAuth2Scope[]
  grantTypes?: OAuth2GrantType[]
  logoUrl?: string
  homepageUrl?: string
  privacyPolicyUrl?: string
  termsOfServiceUrl?: string
}

/**
 * Data for updating an OAuth2 client
 */
export interface UpdateOAuth2ClientData {
  name?: string
  description?: string
  redirectUris?: string[]
  allowedScopes?: OAuth2Scope[]
  grantTypes?: OAuth2GrantType[]
  isActive?: boolean
  logoUrl?: string
  homepageUrl?: string
  privacyPolicyUrl?: string
  termsOfServiceUrl?: string
}

/**
 * Built-in CLI client configuration
 */
export const BUILTIN_CLI_CLIENT: Omit<OAuth2Client, 'createdAt' | 'updatedAt'> = {
  id: 'trokky-cli',
  name: 'Trokky CLI',
  description: 'Official Trokky command-line interface',
  type: 'public',
  redirectUris: [], // Device flow doesn't use redirects
  allowedScopes: [
    'openid',
    'profile',
    'content:read',
    'content:write',
    'content:delete',
    'media:read',
    'media:write',
    'offline_access'
  ],
  grantTypes: ['urn:ietf:params:oauth:grant-type:device_code', 'refresh_token'],
  isActive: true,
  isBuiltIn: true
}
