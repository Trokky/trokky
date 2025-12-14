/**
 * @trokky/types - Passkey/WebAuthn Types
 *
 * Types for passwordless authentication using WebAuthn/Passkeys.
 * Enables biometric and security key authentication in Trokky Studio.
 */

// ============================================================================
// Passkey Credential Types
// ============================================================================

/**
 * Authenticator transport types (how the authenticator communicates)
 */
export type AuthenticatorTransportType = 'usb' | 'ble' | 'nfc' | 'internal' | 'hybrid'

/**
 * Stored passkey credential (server-side)
 */
export interface PasskeyCredential {
  /** Base64URL-encoded credential ID */
  id: string
  /** Base64URL-encoded public key */
  publicKey: string
  /** Signature counter for replay attack prevention */
  counter: number
  /** Device type - single device or synced across devices */
  deviceType: 'singleDevice' | 'multiDevice'
  /** Whether credential is backed up (e.g., iCloud Keychain, Google Password Manager) */
  backedUp: boolean
  /** How the authenticator communicates */
  transports?: AuthenticatorTransportType[]
  /** ISO date when credential was registered */
  createdAt: string
  /** ISO date when credential was last used */
  lastUsedAt?: string
  /** User-friendly name (e.g., "MacBook Pro Touch ID") */
  friendlyName?: string
  /** Authenticator AAGUID for device identification */
  aaguid?: string
}

// ============================================================================
// Passkey Configuration Types
// ============================================================================

/**
 * Authenticator selection criteria for registration
 */
export interface PasskeyAuthenticatorSelection {
  /** Prefer platform (built-in) or cross-platform (roaming) authenticator */
  authenticatorAttachment?: 'platform' | 'cross-platform'
  /** Whether to create a discoverable credential (resident key) */
  residentKey?: 'required' | 'preferred' | 'discouraged'
  /** Legacy: require resident key */
  requireResidentKey?: boolean
  /** User verification requirement */
  userVerification?: 'required' | 'preferred' | 'discouraged'
}

/**
 * Passkey configuration for the security config
 */
export interface PasskeyConfig {
  /** Whether passkey authentication is enabled */
  enabled: boolean
  /** Relying Party ID (domain name, e.g., "example.com") */
  rpId: string
  /** Human-readable Relying Party name */
  rpName: string
  /** Allowed origin(s) for WebAuthn requests */
  origin: string | string[]
  /** Attestation conveyance preference */
  attestation?: 'none' | 'indirect' | 'direct' | 'enterprise'
  /** User verification requirement for authentication */
  userVerification?: 'required' | 'preferred' | 'discouraged'
  /** Challenge timeout in milliseconds (default: 60000) */
  timeout?: number
  /** Authenticator selection criteria for registration */
  authenticatorSelection?: PasskeyAuthenticatorSelection
}

// ============================================================================
// Passkey Registration Types
// ============================================================================

/**
 * Credential descriptor for exclude/allow lists
 */
export interface PasskeyCredentialDescriptor {
  /** Base64URL-encoded credential ID */
  id: string
  /** Always 'public-key' for WebAuthn */
  type: 'public-key'
  /** Authenticator transports */
  transports?: AuthenticatorTransportType[]
}

/**
 * Options returned from /auth/passkey/register/options
 */
export interface PasskeyRegistrationOptions {
  /** Base64URL-encoded challenge */
  challenge: string
  /** Server session ID for verification */
  sessionId: string
  /** Relying Party ID */
  rpId: string
  /** Relying Party name */
  rpName: string
  /** Base64URL-encoded user ID */
  userId: string
  /** Username for credential */
  userName: string
  /** Display name for credential */
  userDisplayName: string
  /** Credentials to exclude (already registered) */
  excludeCredentials: PasskeyCredentialDescriptor[]
  /** Authenticator selection criteria */
  authenticatorSelection: PasskeyAuthenticatorSelection
  /** Attestation conveyance preference */
  attestation: 'none' | 'indirect' | 'direct' | 'enterprise'
  /** Timeout in milliseconds */
  timeout: number
}

/**
 * Request body for /auth/passkey/register/options
 */
export interface PasskeyRegistrationOptionsRequest {
  /** Optional friendly name for the passkey */
  friendlyName?: string
}

/**
 * Request body for /auth/passkey/register/verify
 */
export interface PasskeyRegistrationVerifyRequest {
  /** Session ID from registration options */
  sessionId: string
  /** WebAuthn credential response from browser */
  credential: {
    id: string
    rawId: string
    type: 'public-key'
    response: {
      clientDataJSON: string
      attestationObject: string
      transports?: AuthenticatorTransportType[]
    }
    clientExtensionResults?: Record<string, unknown>
    authenticatorAttachment?: 'platform' | 'cross-platform'
  }
  /** Optional friendly name for the passkey */
  friendlyName?: string
}

// ============================================================================
// Passkey Authentication Types
// ============================================================================

/**
 * Options returned from /auth/passkey/login/options
 */
export interface PasskeyAuthenticationOptions {
  /** Base64URL-encoded challenge */
  challenge: string
  /** Server session ID for verification */
  sessionId: string
  /** Relying Party ID */
  rpId: string
  /** Allowed credentials (empty for discoverable credentials) */
  allowCredentials: PasskeyCredentialDescriptor[]
  /** User verification requirement */
  userVerification: 'required' | 'preferred' | 'discouraged'
  /** Timeout in milliseconds */
  timeout: number
}

/**
 * Request body for /auth/passkey/login/options
 */
export interface PasskeyAuthenticationOptionsRequest {
  /** Optional username for targeted authentication */
  username?: string
}

/**
 * Request body for /auth/passkey/login/verify
 */
export interface PasskeyAuthenticationVerifyRequest {
  /** Session ID from authentication options */
  sessionId: string
  /** WebAuthn assertion response from browser */
  credential: {
    id: string
    rawId: string
    type: 'public-key'
    response: {
      clientDataJSON: string
      authenticatorData: string
      signature: string
      userHandle?: string
    }
    clientExtensionResults?: Record<string, unknown>
    authenticatorAttachment?: 'platform' | 'cross-platform'
  }
  /** Device ID for trusted device check */
  deviceId?: string
}

// ============================================================================
// Passkey Management Types
// ============================================================================

/**
 * Request body for updating a passkey credential
 */
export interface PasskeyUpdateRequest {
  /** New friendly name */
  friendlyName: string
}

/**
 * Response for listing passkey credentials
 */
export interface PasskeyCredentialListResponse {
  /** List of credentials (without publicKey) */
  credentials: Omit<PasskeyCredential, 'publicKey'>[]
}

// ============================================================================
// Passkey Session Types (Internal)
// ============================================================================

/**
 * Server-side session for passkey operations
 */
export interface PasskeySession {
  /** Challenge for this session */
  challenge: string
  /** User ID (for registration) */
  userId?: string
  /** Expected origin for verification */
  expectedOrigin: string | string[]
  /** Expected RP ID for verification */
  expectedRPID: string
  /** Session mode */
  mode: 'register' | 'login'
  /** Friendly name (for registration) */
  friendlyName?: string
  /** Session expiration timestamp */
  expiresAt: number
}
