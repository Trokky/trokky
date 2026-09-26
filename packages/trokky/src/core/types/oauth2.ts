/**
 * OAuth2 Authorization Server Types
 *
 * Types are now centralized in @trokky/types and re-exported here for backwards compatibility.
 */

// Re-export all OAuth2 types from @trokky/types
export type {
  OAuth2GrantType,
  OAuth2ClientType,
  OAuth2Client,
  OAuth2Scope,
  DeviceAuthorizationRequest,
  DeviceAuthorizationResponse,
  DeviceCodeState,
  DeviceTokenRequest,
  AuthorizationRequest,
  AuthorizationCodeState,
  AuthorizationCodeTokenRequest,
  OAuth2RefreshTokenRequest,
  TokenResponse,
  OAuth2ErrorResponse,
  OAuth2ErrorCode,
  UserConsent,
  OAuth2AccessToken,
  OAuth2RefreshToken,
  CreateOAuth2ClientData,
  UpdateOAuth2ClientData
} from '../../types/index.js'

export { SCOPE_TO_PERMISSIONS, ALL_OAUTH2_SCOPES, BUILTIN_CLI_CLIENT, BUILTIN_MCP_CLIENT, BUILTIN_CLIENTS } from '../../types/index.js'

// Re-export RefreshTokenRequest as it was named differently in the original
export type { OAuth2RefreshTokenRequest as RefreshTokenRequest } from '../../types/index.js'
