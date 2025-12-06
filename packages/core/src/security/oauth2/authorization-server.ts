/**
 * OAuth2 Authorization Server Service
 *
 * Implements RFC 8628 (Device Authorization Grant) and
 * OAuth 2.0 Authorization Code Grant with PKCE for Trokky CMS.
 *
 * This allows Trokky Studio to act as an SSO provider for:
 * - Trokky CLI (device flow)
 * - External web applications (authorization code flow)
 */

import { randomBytes, createHash, timingSafeEqual } from 'crypto'
import type {
  OAuth2Client,
  OAuth2Scope,
  DeviceCodeState,
  AuthorizationCodeState,
  TokenResponse,
  OAuth2ErrorCode,
  BUILTIN_CLI_CLIENT
} from '../../types/oauth2.js'
import type { User, Permission } from '../../types/user.js'
import { SCOPE_TO_PERMISSIONS, BUILTIN_CLI_CLIENT as CLI_CLIENT } from '../../types/oauth2.js'

/**
 * Configuration for the OAuth2 Authorization Server
 */
export interface OAuth2ServerConfig {
  /** Base URL of the authorization server (e.g., https://cms.example.com) */
  issuer: string
  /** JWT secret for signing tokens */
  jwtSecret: string
  /** Access token lifetime in seconds (default: 3600 = 1 hour) */
  accessTokenTtl?: number
  /** Refresh token lifetime in seconds (default: 2592000 = 30 days) */
  refreshTokenTtl?: number
  /** Device code lifetime in seconds (default: 600 = 10 minutes) */
  deviceCodeTtl?: number
  /** Authorization code lifetime in seconds (default: 600 = 10 minutes) */
  authCodeTtl?: number
  /** Minimum polling interval in seconds (default: 5) */
  pollingInterval?: number
}

/**
 * OAuth2 Authorization Server
 *
 * Handles device authorization and authorization code flows.
 */
export class OAuth2AuthorizationServer {
  private config: Required<OAuth2ServerConfig>

  // In-memory stores (should be replaced with persistent storage in production)
  private deviceCodes: Map<string, DeviceCodeState> = new Map()
  private authorizationCodes: Map<string, AuthorizationCodeState> = new Map()
  private clients: Map<string, OAuth2Client> = new Map()

  // Cleanup interval
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(config: OAuth2ServerConfig) {
    this.config = {
      issuer: config.issuer,
      jwtSecret: config.jwtSecret,
      accessTokenTtl: config.accessTokenTtl ?? 3600,
      refreshTokenTtl: config.refreshTokenTtl ?? 2592000,
      deviceCodeTtl: config.deviceCodeTtl ?? 600,
      authCodeTtl: config.authCodeTtl ?? 600,
      pollingInterval: config.pollingInterval ?? 5
    }

    // Register built-in CLI client
    this.registerBuiltInClient()

    // Start cleanup interval
    this.startCleanup()
  }

  /**
   * Register the built-in CLI client
   */
  private registerBuiltInClient(): void {
    const now = new Date().toISOString()
    this.clients.set(CLI_CLIENT.id, {
      ...CLI_CLIENT,
      createdAt: now,
      updatedAt: now
    })
  }

  /**
   * Start periodic cleanup of expired codes
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()

      // Clean expired device codes
      for (const [key, state] of this.deviceCodes) {
        if (state.expiresAt < now) {
          this.deviceCodes.delete(key)
        }
      }

      // Clean expired authorization codes
      for (const [key, state] of this.authorizationCodes) {
        if (state.expiresAt < now) {
          this.authorizationCodes.delete(key)
        }
      }
    }, 60000) // Run every minute
  }

  /**
   * Stop cleanup interval (for testing/shutdown)
   */
  public stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  // ============================================
  // Client Management
  // ============================================

  /**
   * Get a registered client by ID
   */
  public getClient(clientId: string): OAuth2Client | null {
    return this.clients.get(clientId) ?? null
  }

  /**
   * Validate client credentials (for confidential clients)
   */
  public validateClientSecret(client: OAuth2Client, secret: string): boolean {
    if (client.type !== 'confidential' || !client.secretHash) {
      return false
    }

    const secretHash = this.hashSecret(secret)
    const expectedHash = Buffer.from(client.secretHash, 'hex')
    const providedHash = Buffer.from(secretHash, 'hex')

    return timingSafeEqual(expectedHash, providedHash)
  }

  /**
   * Hash a secret for storage
   */
  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex')
  }

  // ============================================
  // Device Authorization Flow (RFC 8628)
  // ============================================

  /**
   * Generate a user-friendly code (8 characters, easy to type)
   */
  private generateUserCode(): string {
    // Use uppercase letters and numbers, avoiding ambiguous characters (0, O, I, L, 1)
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    let code = ''
    const bytes = randomBytes(8)
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i] % chars.length]
    }
    // Format as XXXX-XXXX for readability
    return `${code.slice(0, 4)}-${code.slice(4)}`
  }

  /**
   * Generate a device code (long, random string)
   */
  private generateDeviceCode(): string {
    return randomBytes(32).toString('base64url')
  }

  /**
   * Start device authorization flow
   * Returns device_code, user_code, and verification URI
   */
  public startDeviceAuthorization(
    clientId: string,
    requestedScopes: string[]
  ): { success: true; response: {
    device_code: string
    user_code: string
    verification_uri: string
    verification_uri_complete: string
    expires_in: number
    interval: number
  }} | { success: false; error: OAuth2ErrorCode; error_description: string } {
    // Validate client
    const client = this.getClient(clientId)
    if (!client) {
      return {
        success: false,
        error: 'invalid_client',
        error_description: 'Unknown client_id'
      }
    }

    if (!client.isActive) {
      return {
        success: false,
        error: 'invalid_client',
        error_description: 'Client is not active'
      }
    }

    // Check if client supports device flow
    if (!client.grantTypes.includes('urn:ietf:params:oauth:grant-type:device_code')) {
      return {
        success: false,
        error: 'unauthorized_client',
        error_description: 'Client is not authorized for device authorization grant'
      }
    }

    // Validate and filter scopes
    const scopes = this.validateScopes(requestedScopes, client.allowedScopes)
    if (scopes.length === 0 && requestedScopes.length > 0) {
      return {
        success: false,
        error: 'invalid_scope',
        error_description: 'None of the requested scopes are allowed for this client'
      }
    }

    // Generate codes
    const deviceCode = this.generateDeviceCode()
    const userCode = this.generateUserCode()
    const deviceCodeHash = this.hashSecret(deviceCode)

    // Store device code state
    const state: DeviceCodeState = {
      deviceCodeHash,
      userCode,
      clientId,
      scopes,
      expiresAt: Date.now() + (this.config.deviceCodeTtl * 1000),
      interval: this.config.pollingInterval,
      status: 'pending'
    }

    // Store by user code for lookup during verification
    this.deviceCodes.set(userCode, state)

    // Build verification URIs
    const verificationUri = `${this.config.issuer}/studio/auth/device`
    const verificationUriComplete = `${verificationUri}?code=${userCode}`

    return {
      success: true,
      response: {
        device_code: deviceCode,
        user_code: userCode,
        verification_uri: verificationUri,
        verification_uri_complete: verificationUriComplete,
        expires_in: this.config.deviceCodeTtl,
        interval: this.config.pollingInterval
      }
    }
  }

  /**
   * Get device code state by user code (for verification page)
   */
  public getDeviceCodeByUserCode(userCode: string): DeviceCodeState | null {
    // Normalize user code (remove dashes, uppercase)
    const normalizedCode = userCode.replace(/-/g, '').toUpperCase()
    const formattedCode = `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4)}`

    return this.deviceCodes.get(formattedCode) ?? null
  }

  /**
   * Authorize a device code (called when user approves in Studio)
   */
  public authorizeDeviceCode(userCode: string, userId: string): boolean {
    const state = this.getDeviceCodeByUserCode(userCode)
    if (!state) {
      return false
    }

    if (state.status !== 'pending') {
      return false
    }

    if (state.expiresAt < Date.now()) {
      state.status = 'expired'
      return false
    }

    state.status = 'authorized'
    state.userId = userId
    state.decidedAt = Date.now()

    return true
  }

  /**
   * Deny a device code (called when user denies in Studio)
   */
  public denyDeviceCode(userCode: string): boolean {
    const state = this.getDeviceCodeByUserCode(userCode)
    if (!state) {
      return false
    }

    if (state.status !== 'pending') {
      return false
    }

    state.status = 'denied'
    state.decidedAt = Date.now()

    return true
  }

  /**
   * Poll for device token (called by CLI)
   */
  public pollDeviceToken(
    deviceCode: string,
    clientId: string,
    generateToken: (userId: string, scopes: OAuth2Scope[], clientId: string) => Promise<TokenResponse>
  ): Promise<
    | { success: true; response: TokenResponse }
    | { success: false; error: OAuth2ErrorCode; error_description: string }
  > {
    return this.checkDeviceCodeAndGenerateToken(deviceCode, clientId, generateToken)
  }

  private async checkDeviceCodeAndGenerateToken(
    deviceCode: string,
    clientId: string,
    generateToken: (userId: string, scopes: OAuth2Scope[], clientId: string) => Promise<TokenResponse>
  ): Promise<
    | { success: true; response: TokenResponse }
    | { success: false; error: OAuth2ErrorCode; error_description: string }
  > {
    const deviceCodeHash = this.hashSecret(deviceCode)

    // Find the state by iterating (in production, use proper indexing)
    let foundState: DeviceCodeState | null = null
    let foundKey: string | null = null

    for (const [key, state] of this.deviceCodes) {
      if (state.deviceCodeHash === deviceCodeHash && state.clientId === clientId) {
        foundState = state
        foundKey = key
        break
      }
    }

    if (!foundState || !foundKey) {
      return {
        success: false,
        error: 'invalid_grant',
        error_description: 'Invalid device code'
      }
    }

    // Check expiration
    if (foundState.expiresAt < Date.now()) {
      this.deviceCodes.delete(foundKey)
      return {
        success: false,
        error: 'expired_token',
        error_description: 'Device code has expired'
      }
    }

    // Check status
    switch (foundState.status) {
      case 'pending':
        return {
          success: false,
          error: 'authorization_pending',
          error_description: 'The authorization request is still pending'
        }

      case 'denied':
        this.deviceCodes.delete(foundKey)
        return {
          success: false,
          error: 'access_denied',
          error_description: 'The user denied the authorization request'
        }

      case 'expired':
        this.deviceCodes.delete(foundKey)
        return {
          success: false,
          error: 'expired_token',
          error_description: 'Device code has expired'
        }

      case 'authorized':
        if (!foundState.userId) {
          return {
            success: false,
            error: 'server_error',
            error_description: 'User ID not found for authorized request'
          }
        }

        // Generate tokens
        const tokenResponse = await generateToken(
          foundState.userId,
          foundState.scopes,
          foundState.clientId
        )

        // Remove used device code
        this.deviceCodes.delete(foundKey)

        return {
          success: true,
          response: tokenResponse
        }

      default:
        return {
          success: false,
          error: 'server_error',
          error_description: 'Unknown device code status'
        }
    }
  }

  // ============================================
  // Authorization Code Flow with PKCE
  // ============================================

  /**
   * Validate authorization request parameters
   */
  public validateAuthorizationRequest(params: {
    response_type: string
    client_id: string
    redirect_uri: string
    scope?: string
    state: string
    code_challenge: string
    code_challenge_method: string
  }): { valid: true; client: OAuth2Client; scopes: OAuth2Scope[] } | { valid: false; error: OAuth2ErrorCode; error_description: string } {
    // Validate response_type
    if (params.response_type !== 'code') {
      return {
        valid: false,
        error: 'invalid_request',
        error_description: 'response_type must be "code"'
      }
    }

    // Validate client
    const client = this.getClient(params.client_id)
    if (!client || !client.isActive) {
      return {
        valid: false,
        error: 'invalid_client',
        error_description: 'Unknown or inactive client'
      }
    }

    // Check if client supports authorization code flow
    if (!client.grantTypes.includes('authorization_code')) {
      return {
        valid: false,
        error: 'unauthorized_client',
        error_description: 'Client is not authorized for authorization code grant'
      }
    }

    // Validate redirect URI
    if (!client.redirectUris.includes(params.redirect_uri)) {
      return {
        valid: false,
        error: 'invalid_request',
        error_description: 'Invalid redirect_uri'
      }
    }

    // Validate PKCE
    if (params.code_challenge_method !== 'S256') {
      return {
        valid: false,
        error: 'invalid_request',
        error_description: 'code_challenge_method must be "S256"'
      }
    }

    if (!params.code_challenge || params.code_challenge.length < 43) {
      return {
        valid: false,
        error: 'invalid_request',
        error_description: 'Invalid code_challenge'
      }
    }

    // Validate state
    if (!params.state || params.state.length < 8) {
      return {
        valid: false,
        error: 'invalid_request',
        error_description: 'state parameter is required and must be at least 8 characters'
      }
    }

    // Validate and filter scopes
    const requestedScopes = params.scope ? params.scope.split(' ') : []
    const scopes = this.validateScopes(requestedScopes, client.allowedScopes)

    return {
      valid: true,
      client,
      scopes
    }
  }

  /**
   * Generate authorization code after user approval
   */
  public generateAuthorizationCode(
    clientId: string,
    redirectUri: string,
    scopes: OAuth2Scope[],
    codeChallenge: string,
    userId: string
  ): string {
    const code = randomBytes(32).toString('base64url')
    const codeHash = this.hashSecret(code)

    const state: AuthorizationCodeState = {
      codeHash,
      clientId,
      redirectUri,
      scopes,
      codeChallenge,
      userId,
      expiresAt: Date.now() + (this.config.authCodeTtl * 1000)
    }

    this.authorizationCodes.set(codeHash, state)

    return code
  }

  /**
   * Exchange authorization code for tokens
   */
  public async exchangeAuthorizationCode(
    code: string,
    clientId: string,
    redirectUri: string,
    codeVerifier: string,
    generateToken: (userId: string, scopes: OAuth2Scope[], clientId: string) => Promise<TokenResponse>
  ): Promise<
    | { success: true; response: TokenResponse }
    | { success: false; error: OAuth2ErrorCode; error_description: string }
  > {
    const codeHash = this.hashSecret(code)
    const state = this.authorizationCodes.get(codeHash)

    if (!state) {
      return {
        success: false,
        error: 'invalid_grant',
        error_description: 'Invalid authorization code'
      }
    }

    // Remove code immediately (single use)
    this.authorizationCodes.delete(codeHash)

    // Validate expiration
    if (state.expiresAt < Date.now()) {
      return {
        success: false,
        error: 'invalid_grant',
        error_description: 'Authorization code has expired'
      }
    }

    // Validate client_id
    if (state.clientId !== clientId) {
      return {
        success: false,
        error: 'invalid_grant',
        error_description: 'client_id does not match'
      }
    }

    // Validate redirect_uri
    if (state.redirectUri !== redirectUri) {
      return {
        success: false,
        error: 'invalid_grant',
        error_description: 'redirect_uri does not match'
      }
    }

    // Verify PKCE code verifier
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url')

    if (codeChallenge !== state.codeChallenge) {
      return {
        success: false,
        error: 'invalid_grant',
        error_description: 'Invalid code_verifier'
      }
    }

    // Generate tokens
    const tokenResponse = await generateToken(
      state.userId,
      state.scopes,
      state.clientId
    )

    return {
      success: true,
      response: tokenResponse
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Validate requested scopes against allowed scopes
   */
  private validateScopes(requested: string[], allowed: OAuth2Scope[]): OAuth2Scope[] {
    const validScopes: OAuth2Scope[] = []

    for (const scope of requested) {
      if (allowed.includes(scope as OAuth2Scope)) {
        validScopes.push(scope as OAuth2Scope)
      }
    }

    // If no scopes requested, return default scopes
    if (validScopes.length === 0 && requested.length === 0) {
      // Default to openid and profile if allowed
      if (allowed.includes('openid')) validScopes.push('openid')
      if (allowed.includes('profile')) validScopes.push('profile')
    }

    return validScopes
  }

  /**
   * Convert OAuth2 scopes to Trokky permissions
   */
  public scopesToPermissions(scopes: OAuth2Scope[]): Permission[] {
    const permissions = new Set<Permission>()

    for (const scope of scopes) {
      const scopePermissions = SCOPE_TO_PERMISSIONS[scope]
      if (scopePermissions) {
        for (const perm of scopePermissions) {
          permissions.add(perm)
        }
      }
    }

    return Array.from(permissions)
  }

  /**
   * Get server configuration (for .well-known/oauth-authorization-server)
   */
  public getServerMetadata(): Record<string, unknown> {
    return {
      issuer: this.config.issuer,
      authorization_endpoint: `${this.config.issuer}/auth/authorize`,
      token_endpoint: `${this.config.issuer}/auth/token`,
      device_authorization_endpoint: `${this.config.issuer}/auth/device`,
      revocation_endpoint: `${this.config.issuer}/auth/revoke`,
      scopes_supported: [
        'openid',
        'profile',
        'content:read',
        'content:write',
        'content:delete',
        'media:read',
        'media:write',
        'offline_access'
      ],
      response_types_supported: ['code'],
      grant_types_supported: [
        'authorization_code',
        'urn:ietf:params:oauth:grant-type:device_code',
        'refresh_token'
      ],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post']
    }
  }
}
