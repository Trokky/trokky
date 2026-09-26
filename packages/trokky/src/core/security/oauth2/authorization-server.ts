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
  OAuth2GrantType,
  DeviceCodeState,
  AuthorizationCodeState,
  TokenResponse,
  OAuth2ErrorCode,
  BUILTIN_CLI_CLIENT
} from '../../types/oauth2.js'
import type { User, Permission } from '../../types/user.js'
import { SCOPE_TO_PERMISSIONS, ALL_OAUTH2_SCOPES, BUILTIN_CLI_CLIENT as CLI_CLIENT } from '../../types/oauth2.js'
import type { AuthFlowState } from '../../types/storage-adapters.js'
import {
  saveAuthFlowState,
  getAuthFlowState,
  consumeAuthFlowState
} from '../auth-flow-store.js'

/**
 * Where device and authorization codes live between the requests of a flow.
 *
 * Not process memory: on Workers every request may land on another isolate, and behind a
 * load balancer on another replica, so a device approved on one would poll as unknown on the
 * next. The engine passes the data adapter's auth-flow store; without one this falls back to
 * the store's in-process map, which is only correct on a single process.
 */
export interface OAuth2FlowStore {
  save(state: AuthFlowState): Promise<void>
  get(id: string, kind: AuthFlowState['kind']): Promise<AuthFlowState | null>
  consume(id: string, kind: AuthFlowState['kind']): Promise<AuthFlowState | null>
}

const inProcessFlowStore: OAuth2FlowStore = {
  save: state => saveAuthFlowState(null, state),
  get: (id, kind) => getAuthFlowState(null, id, kind),
  consume: (id, kind) => consumeAuthFlowState(null, id, kind)
}

type DeviceRecord = Omit<DeviceCodeState, 'expiresAt'>

// Record ids. A device code is found by its hash when the device polls, and by its short
// user code when a person approves it, so it is stored under the first and indexed by the
// second.
const deviceId = (deviceCodeHash: string): string => `dev-${deviceCodeHash}`
const userCodeId = (userCode: string): string => `usr-${normalizeUserCode(userCode)}`
const authCodeId = (codeHash: string): string => `code-${codeHash}`

function normalizeUserCode(userCode: string): string {
  return userCode.replace(/-/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/**
 * Configuration for registering an OAuth2 client
 */
export interface OAuth2ClientConfig {
  /** Unique client identifier */
  id: string
  /** Human-readable client name */
  name: string
  /** Client description (optional) */
  description?: string
  /** Client type: 'public' for SPAs/native apps, 'confidential' for server-side apps */
  type?: 'public' | 'confidential'
  /** Client secret (required for confidential clients) */
  secret?: string
  /** Allowed redirect URIs */
  redirectUris: string[]
  /** Allowed scopes (default: all scopes) */
  allowedScopes?: string[]
  /** Allowed grant types (default: authorization_code, refresh_token) */
  grantTypes?: string[]
  /**
   * First-party application: its tokens act as the signed-in user with the user's own role
   * and permissions, whatever scopes they carry. Still barred from account and security
   * routes. Default false.
   */
  trusted?: boolean
}

/**
 * Configuration for the OAuth2 Authorization Server
 */
export interface OAuth2ServerConfig {
  /** Base URL of the authorization server (e.g., https://cms.example.com) */
  issuer: string
  /** Device-flow approval page (RFC 8628 verification_uri). Default: `${issuer}/studio/auth/device`. */
  verificationUri?: string
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
  /** External OAuth2 clients to register */
  clients?: OAuth2ClientConfig[]
  /** Persistent storage for device and authorization codes. Default: in-process only. */
  flowStore?: OAuth2FlowStore
}

/**
 * OAuth2 Authorization Server
 *
 * Handles device authorization and authorization code flows.
 */
export class OAuth2AuthorizationServer {
  private config: Required<Omit<OAuth2ServerConfig, 'clients' | 'flowStore'>>
  private externalClients: OAuth2ClientConfig[]
  private store: OAuth2FlowStore
  private clients: Map<string, OAuth2Client> = new Map()

  constructor(config: OAuth2ServerConfig) {
    this.config = {
      issuer: config.issuer,
      jwtSecret: config.jwtSecret,
      accessTokenTtl: config.accessTokenTtl ?? 3600,
      refreshTokenTtl: config.refreshTokenTtl ?? 2592000,
      deviceCodeTtl: config.deviceCodeTtl ?? 600,
      verificationUri: config.verificationUri ?? `${config.issuer}/studio/auth/device`,
      authCodeTtl: config.authCodeTtl ?? 600,
      pollingInterval: config.pollingInterval ?? 5
    }
    this.externalClients = config.clients || []
    this.store = config.flowStore ?? inProcessFlowStore

    // Register built-in CLI client
    this.registerBuiltInClient()

    // Register external clients from config
    this.registerExternalClients()
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
   * Register external OAuth2 clients from config
   */
  private registerExternalClients(): void {
    const now = new Date().toISOString()
    for (const clientConfig of this.externalClients) {
      const client: OAuth2Client = {
        id: clientConfig.id,
        name: clientConfig.name,
        description: clientConfig.description,
        type: clientConfig.type || 'public',
        secretHash: clientConfig.secret ? this.hashSecret(clientConfig.secret) : undefined,
        redirectUris: clientConfig.redirectUris,
        allowedScopes: (clientConfig.allowedScopes || [...ALL_OAUTH2_SCOPES]) as OAuth2Scope[],
        grantTypes: (clientConfig.grantTypes || ['authorization_code', 'refresh_token']) as OAuth2GrantType[],
        // Never the CLI: a config entry may override the built-in client (a site narrowing its
        // scopes does), but making every CLI login act as the full user must not be one line away
        trusted: clientConfig.trusted === true && clientConfig.id !== CLI_CLIENT.id,
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
      this.clients.set(client.id, client)
    }
  }

  /**
   * Start periodic cleanup of expired codes
   */
  /**
   * Kept for callers that stop the server on shutdown. Codes now expire in the flow store,
   * which sweeps on request, so there is no timer to stop.
   */
  public stopCleanup(): void {}

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
  public async startDeviceAuthorization(
    clientId: string,
    requestedScopes: string[]
  ): Promise<{ success: true; response: {
    device_code: string
    user_code: string
    verification_uri: string
    verification_uri_complete: string
    expires_in: number
    interval: number
  }} | { success: false; error: OAuth2ErrorCode; error_description: string }> {
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
    const expiresAt = new Date(Date.now() + this.config.deviceCodeTtl * 1000).toISOString()

    const record: DeviceRecord = {
      deviceCodeHash,
      userCode,
      clientId,
      scopes,
      interval: this.config.pollingInterval,
      status: 'pending'
    }
    await this.store.save({ id: deviceId(deviceCodeHash), kind: 'oauth2_device', data: { ...record }, expiresAt })
    await this.store.save({ id: userCodeId(userCode), kind: 'oauth2_device', data: { deviceCodeHash }, expiresAt })

    // Build verification URIs
    // Studio serves the approval page under its own mount; the default assumes /studio.
    const verificationUri = this.config.verificationUri
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

  /** The device record behind a user code, with its expiry, or null. */
  private async findByUserCode(userCode: string): Promise<{ record: DeviceRecord; expiresAt: string } | null> {
    if (normalizeUserCode(userCode).length !== 8) return null
    const index = await this.store.get(userCodeId(userCode), 'oauth2_device')
    const deviceCodeHash = index?.data.deviceCodeHash
    if (typeof deviceCodeHash !== 'string') return null
    const stored = await this.store.get(deviceId(deviceCodeHash), 'oauth2_device')
    if (!stored) return null
    return { record: stored.data as unknown as DeviceRecord, expiresAt: stored.expiresAt }
  }

  /**
   * Get device code state by user code (for verification page)
   */
  public async getDeviceCodeByUserCode(userCode: string): Promise<DeviceCodeState | null> {
    const found = await this.findByUserCode(userCode)
    if (!found) return null
    return { ...found.record, expiresAt: new Date(found.expiresAt).getTime() }
  }

  /**
   * Authorize a device code (called when user approves in Studio).
   *
   * `approvedScopes` is what the person left ticked on the consent screen. It can only
   * narrow the request: anything not requested is ignored, and approving nothing is refused.
   */
  public async authorizeDeviceCode(userCode: string, userId: string, approvedScopes?: string[]): Promise<boolean> {
    return this.decide(userCode, record => {
      const scopes = approvedScopes
        ? record.scopes.filter(scope => approvedScopes.includes(scope))
        : record.scopes
      // Approving nothing is not an approval; the code stays pending
      if (scopes.length === 0) return null
      return { ...record, scopes, status: 'authorized', userId, decidedAt: Date.now() }
    })
  }

  /**
   * Deny a device code (called when user denies in Studio)
   */
  public async denyDeviceCode(userCode: string): Promise<boolean> {
    return this.decide(userCode, record => ({ ...record, status: 'denied', decidedAt: Date.now() }))
  }

  /**
   * Record one decision on a pending code.
   *
   * Taking the user-code index is the lock: of two decisions racing (two clicks, an approve
   * and a deny), exactly one gets it, and the other is refused rather than both reporting
   * success while the last write wins. The index goes back afterwards so the approval page
   * can still show that this code was already handled.
   */
  private async decide(userCode: string, apply: (record: DeviceRecord) => DeviceRecord | null): Promise<boolean> {
    if (normalizeUserCode(userCode).length !== 8) return false
    const index = await this.store.consume(userCodeId(userCode), 'oauth2_device')
    const deviceCodeHash = index?.data.deviceCodeHash
    if (typeof deviceCodeHash !== 'string') return false

    const stored = await this.store.get(deviceId(deviceCodeHash), 'oauth2_device')
    if (!stored) return false

    let decided = false
    const record = stored.data as unknown as DeviceRecord
    if (record.status === 'pending') {
      const next = apply(record)
      if (next) {
        await this.store.save({ id: deviceId(deviceCodeHash), kind: 'oauth2_device', data: { ...next }, expiresAt: stored.expiresAt })
        decided = true
      }
    }

    await this.store.save({ id: userCodeId(userCode), kind: 'oauth2_device', data: { deviceCodeHash }, expiresAt: stored.expiresAt })
    return decided
  }

  /**
   * Poll for device token (called by CLI)
   */
  public async pollDeviceToken(
    deviceCode: string,
    clientId: string,
    generateToken: (userId: string, scopes: OAuth2Scope[], clientId: string) => Promise<TokenResponse>
  ): Promise<
    | { success: true; response: TokenResponse }
    | { success: false; error: OAuth2ErrorCode; error_description: string }
  > {
    const id = deviceId(this.hashSecret(deviceCode))
    const stored = await this.store.get(id, 'oauth2_device')

    // The store drops expired codes, so an unknown code and an expired one look alike here.
    // Report expiry: a client that polls past its code's lifetime is told to start over.
    if (!stored) {
      return { success: false, error: 'expired_token', error_description: 'Device code is unknown or has expired' }
    }
    const record = stored.data as unknown as DeviceRecord
    if (record.clientId !== clientId) {
      return { success: false, error: 'invalid_grant', error_description: 'Invalid device code' }
    }

    switch (record.status) {
      case 'pending':
        return {
          success: false,
          error: 'authorization_pending',
          error_description: 'The authorization request is still pending'
        }

      case 'denied':
        await this.store.consume(id, 'oauth2_device')
        return {
          success: false,
          error: 'access_denied',
          error_description: 'The user denied the authorization request'
        }

      case 'authorized': {
        // Taking the record is what makes the code single use: two concurrent polls cannot
        // both receive tokens, because only one of them gets it back.
        const taken = await this.store.consume(id, 'oauth2_device')
        const approved = taken?.data as unknown as DeviceRecord | undefined
        if (!approved || approved.status !== 'authorized' || !approved.userId) {
          return { success: false, error: 'invalid_grant', error_description: 'Device code was already used' }
        }
        return {
          success: true,
          response: await generateToken(approved.userId, approved.scopes, approved.clientId)
        }
      }

      default:
        await this.store.consume(id, 'oauth2_device')
        return { success: false, error: 'expired_token', error_description: 'Device code has expired' }
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
  public async generateAuthorizationCode(
    clientId: string,
    redirectUri: string,
    scopes: OAuth2Scope[],
    codeChallenge: string,
    userId: string
  ): Promise<string> {
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

    await this.store.save({
      id: authCodeId(codeHash),
      kind: 'oauth2_code',
      data: { ...state },
      expiresAt: new Date(state.expiresAt).toISOString()
    })

    return code
  }

  /**
   * Check an approval posted from the consent screen before issuing a code for it.
   *
   * The approval arrives as a fresh request, so everything the authorization request was
   * checked for is checked again: the client, its grant, the redirect URI, the PKCE
   * challenge, and scopes the client may have. The person may have unticked scopes, but the
   * result must still be within what the client is allowed.
   */
  public validateApproval(params: {
    client_id: string
    redirect_uri: string
    scopes: unknown
    code_challenge: string
    /** A denial only redirects back: it needs a real client and redirect, not valid scopes */
    denial?: boolean
  }): { valid: true; scopes: OAuth2Scope[] } | { valid: false; error_description: string } {
    const client = this.getClient(params.client_id)
    if (!client || !client.isActive || !client.grantTypes.includes('authorization_code')) {
      return { valid: false, error_description: 'Unknown or inactive client' }
    }
    if (!client.redirectUris.includes(params.redirect_uri)) {
      return { valid: false, error_description: 'Invalid redirect_uri' }
    }
    if (params.denial) {
      return { valid: true, scopes: [] }
    }
    if (typeof params.code_challenge !== 'string' || params.code_challenge.length < 43) {
      return { valid: false, error_description: 'Invalid code_challenge' }
    }
    if (!Array.isArray(params.scopes) || !params.scopes.every(scope => typeof scope === 'string')) {
      return { valid: false, error_description: 'scopes must be a list' }
    }
    const scopes = this.validateScopes(params.scopes as string[], client.allowedScopes)
    if (scopes.length === 0 || scopes.length !== params.scopes.length) {
      return { valid: false, error_description: 'scopes must be a non-empty subset of what the client may request' }
    }
    return { valid: true, scopes }
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
    // Taken, not read: a code is single use even when two exchanges race
    const taken = await this.store.consume(authCodeId(this.hashSecret(code)), 'oauth2_code')
    const state = taken?.data as unknown as AuthorizationCodeState | undefined

    if (!state) {
      return {
        success: false,
        error: 'invalid_grant',
        error_description: 'Invalid authorization code'
      }
    }

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
      scopes_supported: [...ALL_OAUTH2_SCOPES],
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
