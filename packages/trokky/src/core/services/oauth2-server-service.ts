import type { CryptoAdapter } from '../crypto/adapter.js'
import type { TrokkyLogger } from '../utils/logger.js'
import { OAuth2AuthorizationServer } from '../security/oauth2/index.js'
import type { OAuth2Scope, TokenResponse } from '../types/oauth2.js'
import { User, UpdateUserData } from '../types/index.js'
import type { DataStorageAdapter } from '../types/storage-adapters.js'
import { getAuthFlowState, saveAuthFlowState } from '../security/auth-flow-store.js'

export interface OAuth2ServerServiceDependencies {
  logger: TrokkyLogger
  cryptoAdapter: CryptoAdapter
  jwtSecret: string
  getOAuth2Server: () => OAuth2AuthorizationServer | null
  getOAuth2Options: () => { accessTokenTtl?: number; refreshTokenTtl?: number } | undefined
  getUser: (id: string) => Promise<User | null>
  updateUser: (id: string, userData: UpdateUserData) => Promise<User>
  /** Where revocations are recorded, one record per grant */
  getDataStorage: () => DataStorageAdapter | null | undefined
}

/**
 * One approval a person gave an application: what the tokens it holds may do, and the
 * handle to take them back. Kept on the user record, under preferences (the one field every
 * storage adapter persists as-is), next to the consents.
 */
export interface OAuth2Grant {
  id: string
  clientId: string
  /** The client's name when the grant was made, as the person saw it */
  clientName: string
  scopes: OAuth2Scope[]
  createdAt: string
  lastUsedAt?: string
  /** Where the sign-in came from, as its token request identified itself */
  userAgent?: string
}

export const OAUTH2_GRANTS_KEY = '_oauth2Grants'

export function grantsOf(user: Pick<User, 'preferences'> | null | undefined): Record<string, OAuth2Grant> {
  const grants = (user?.preferences as Record<string, unknown> | undefined)?.[OAUTH2_GRANTS_KEY]
  return grants && typeof grants === 'object' ? grants as Record<string, OAuth2Grant> : {}
}

/**
 * A revocation, recorded under the grant's own id. The grant list sits in the user's
 * preferences, which several writers read and write back whole (consents, MFA, password
 * reset, a user edit), so a write that read the preferences before a revoke can put the grant
 * back. This record is written once and never rewritten by anything else, so a revoke stands
 * whatever races it, on every adapter and every replica.
 */
const REVOKED_GRANT_KIND = 'oauth2_grant_revoked'

/** How often a renewal records `lastUsedAt`: each write is a user write and an audit event */
const LAST_USED_EVERY_MS = 12 * 60 * 60 * 1000
/** Slack on the grant's lifetime for that throttling, so a grant in use never lapses */
const LIFETIME_SLACK_MS = 24 * 60 * 60 * 1000

/**
 * Grant writes for one user run one after another in this process: five devices finishing
 * their sign-in at once each add a grant, and none may overwrite another's.
 */
const userLocks = new Map<string, Promise<unknown>>()

function withUserLock<T>(userId: string, work: () => Promise<T>): Promise<T> {
  const previous = userLocks.get(userId) ?? Promise.resolve()
  const run = previous.catch(() => undefined).then(work)
  const tail = run.catch(() => undefined)
  userLocks.set(userId, tail)
  void tail.then(() => {
    if (userLocks.get(userId) === tail) userLocks.delete(userId)
  })
  return run
}

/**
 * OAuth2 authorization-server token issuance and consent management.
 */
export class OAuth2ServerService {
  constructor(private readonly deps: OAuth2ServerServiceDependencies) {}

  /**
   * Get the OAuth2 Authorization Server instance
   * Returns null if OAuth2 is not enabled
   */
  public getOAuth2Server(): OAuth2AuthorizationServer | null {
    return this.deps.getOAuth2Server()
  }

  /**
   * Generate OAuth2 tokens for a user
   * Used by the OAuth2 routes to create access and refresh tokens
   */
  public async generateOAuth2Tokens(
    user: User,
    scopes: OAuth2Scope[],
    clientId: string,
    grantId: string
  ): Promise<{
    accessToken: string
    refreshToken?: string
    expiresIn: number
  }> {
    const accessTokenTtl = this.deps.getOAuth2Options()?.accessTokenTtl ?? 3600
    const refreshTokenTtl = this.deps.getOAuth2Options()?.refreshTokenTtl ?? 2592000
    const includeRefreshToken = scopes.includes('offline_access')

    // Convert OAuth2 scopes to permissions for the token payload
    const permissions = this.deps.getOAuth2Server()?.scopesToPermissions(scopes) || []

    // Generate access token
    // Every token names its grant: revoking the grant ends it, access token included
    const accessTokenPayload = {
      sub: user.id,
      type: 'oauth2_access',
      clientId,
      grantId,
      scopes,
      permissions,
      username: user.username,
      email: user.email,
      role: user.role
    }

    const accessToken = await this.deps.cryptoAdapter.generateJWT(accessTokenPayload, this.deps.jwtSecret, {
      expiresIn: accessTokenTtl
    })

    let refreshToken: string | undefined
    if (includeRefreshToken) {
      const refreshTokenPayload = {
        sub: user.id,
        type: 'oauth2_refresh',
        clientId,
        grantId,
        scopes
      }

      refreshToken = await this.deps.cryptoAdapter.generateJWT(refreshTokenPayload, this.deps.jwtSecret, {
        expiresIn: refreshTokenTtl
      })
    }

    this.deps.logger.info('OAuth2 tokens generated', {
      userId: user.id,
      clientId,
      scopes,
      includeRefreshToken
    })

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTokenTtl
    }
  }

  /**
   * Refresh an OAuth2 access token using a refresh token
   * Returns new tokens if the refresh token is valid
   */
  public async refreshOAuth2Token(
    refreshToken: string,
    clientId: string,
    requestedScope?: string
  ): Promise<TokenResponse | null> {
    try {
      // Verify refresh token
      const payload = await this.deps.cryptoAdapter.verifyJWT(refreshToken, this.deps.jwtSecret) as {
        sub: string
        type: string
        clientId: string
        grantId?: string
        scopes: OAuth2Scope[]
      } | null

      if (!payload) {
        this.deps.logger.warn('Invalid refresh token')
        return null
      }

      // Validate token type and client
      if (payload.type !== 'oauth2_refresh') {
        this.deps.logger.warn('Invalid token type for refresh', { type: payload.type })
        return null
      }

      if (payload.clientId !== clientId) {
        this.deps.logger.warn('Client ID mismatch for refresh', {
          expected: payload.clientId,
          received: clientId
        })
        return null
      }

      // Get user to ensure they still exist and are active
      const user = await this.deps.getUser(payload.sub)
      if (!user || !user.isActive) {
        this.deps.logger.warn('User not found or inactive for refresh', { userId: payload.sub })
        return null
      }

      // A revoked or lapsed grant, or a token from before grants existed, renews nothing
      const grant = payload.grantId && await this.isGrantLive(user, payload.grantId)
        ? grantsOf(user)[payload.grantId]
        : undefined
      if (!grant || grant.clientId !== clientId) {
        this.deps.logger.warn('Refresh for a missing or revoked grant', { userId: payload.sub, clientId })
        return null
      }

      // Determine scopes - can only narrow, not expand, and never beyond the grant
      let scopes = payload.scopes.filter(s => grant.scopes.includes(s))
      if (requestedScope) {
        const requestedScopes = requestedScope.split(' ').filter(Boolean) as OAuth2Scope[]
        scopes = requestedScopes.filter(s => scopes.includes(s))
      }

      // Bookkeeping: a failure to record it must not sign the application out
      const lastUsed = Date.parse(grant.lastUsedAt ?? grant.createdAt)
      if (!(Date.now() - lastUsed < LAST_USED_EVERY_MS)) {
        await this.updateGrants(user.id, grants => {
          if (Object.hasOwn(grants, grant.id)) grants[grant.id] = { ...grants[grant.id], lastUsedAt: new Date().toISOString() }
        }).catch(error => this.deps.logger.warn('Could not record grant use', { error, grantId: grant.id }))
      }

      // Generate new tokens
      const tokens = await this.generateOAuth2Tokens(user, scopes, clientId, grant.id)

      this.deps.logger.info('OAuth2 token refreshed', {
        userId: user.id,
        clientId,
        scopes
      })

      return {
        access_token: tokens.accessToken,
        token_type: 'Bearer',
        expires_in: tokens.expiresIn,
        refresh_token: tokens.refreshToken,
        scope: scopes.join(' ')
      }
    } catch (error) {
      this.deps.logger.warn('OAuth2 token refresh failed', { error })
      return null
    }
  }

  // ============================================
  // Grants: what applications hold, and taking it back
  // ============================================

  /** Record a new approval, when an application first receives tokens for it */
  public async createGrant(user: User, clientId: string, scopes: OAuth2Scope[], userAgent?: string): Promise<OAuth2Grant> {
    const now = new Date().toISOString()
    const grant: OAuth2Grant = {
      id: `grant-${globalThis.crypto.randomUUID()}`,
      clientId,
      clientName: this.deps.getOAuth2Server()?.getClient(clientId)?.name ?? clientId,
      scopes,
      createdAt: now,
      lastUsedAt: now,
      ...(userAgent ? { userAgent: userAgent.slice(0, 200) } : {})
    }
    await this.updateGrants(user.id, grants => { grants[grant.id] = grant })
    this.deps.logger.info('OAuth2 grant created', { userId: user.id, clientId, grantId: grant.id })
    return grant
  }

  public async listGrants(userId: string): Promise<OAuth2Grant[]> {
    const user = await this.deps.getUser(userId)
    const live: OAuth2Grant[] = []
    for (const grant of Object.values(grantsOf(user))) {
      if (user && await this.isGrantLive(user, grant.id)) live.push(grant)
    }
    return live.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  /**
   * Whether tokens issued under a grant still work: it is the user's own, it has been used
   * within the refresh-token lifetime (after that no token of it can be valid), and it has
   * not been revoked.
   */
  public async isGrantLive(user: Pick<User, 'preferences'>, grantId: string): Promise<boolean> {
    const grants = grantsOf(user)
    if (!Object.hasOwn(grants, grantId) || this.hasLapsed(grants[grantId])) return false
    return !(await getAuthFlowState(this.deps.getDataStorage(), grantId, REVOKED_GRANT_KIND))
  }

  /**
   * Revoke one grant: every token issued under it stops working at once. The consent for its
   * client goes too, so the application has to ask again rather than be approved silently.
   */
  public async revokeGrant(userId: string, grantId: string): Promise<boolean> {
    const user = await this.deps.getUser(userId)
    if (!user || !Object.hasOwn(grantsOf(user), grantId)) return false
    await this.recordRevocation(grantId)
    const clientId = grantsOf(user)[grantId].clientId
    await this.updateGrants(userId, (grants, preferences) => {
      delete grants[grantId]
      const consents = preferences._oauth2Consents as Record<string, unknown> | undefined
      if (consents && Object.hasOwn(consents, clientId)) {
        const { [clientId]: _removed, ...remaining } = consents
        preferences._oauth2Consents = remaining
      }
    })
    this.deps.logger.info('OAuth2 grant revoked', { userId, grantId })
    return true
  }

  /**
   * RFC 7009: revoke the grant behind a token the caller holds. Possessing the token is the
   * authorisation. Unknown, invalid or already revoked tokens are not an error.
   */
  public async revokeByToken(token: string, clientId?: string): Promise<void> {
    const payload = await this.deps.cryptoAdapter.verifyJWT(token, this.deps.jwtSecret).catch(() => null) as {
      sub?: string; type?: string; clientId?: string; grantId?: string
    } | null
    if (!payload?.sub || !payload.grantId) return
    if (payload.type !== 'oauth2_access' && payload.type !== 'oauth2_refresh') return
    if (clientId && payload.clientId !== clientId) return
    await this.revokeGrant(payload.sub, payload.grantId)
  }

  private hasLapsed(grant: OAuth2Grant): boolean {
    const refreshTokenTtl = this.deps.getOAuth2Options()?.refreshTokenTtl ?? 2592000
    const lastUsed = Date.parse(grant.lastUsedAt ?? grant.createdAt)
    return !(Date.now() - lastUsed < refreshTokenTtl * 1000 + LIFETIME_SLACK_MS)
  }

  /** Outlives every token issued under the grant, and every copy of it a stale write restores */
  private async recordRevocation(grantId: string): Promise<void> {
    const refreshTokenTtl = this.deps.getOAuth2Options()?.refreshTokenTtl ?? 2592000
    await saveAuthFlowState(this.deps.getDataStorage(), {
      id: grantId,
      kind: REVOKED_GRANT_KIND,
      data: {},
      expiresAt: new Date(Date.now() + refreshTokenTtl * 1000 + 2 * LIFETIME_SLACK_MS).toISOString()
    })
  }

  /** Read-modify-write of the grants under the user's lock, dropping lapsed ones on the way */
  private updateGrants(
    userId: string,
    change: (grants: Record<string, OAuth2Grant>, preferences: Record<string, unknown>) => void
  ): Promise<void> {
    return withUserLock(userId, async () => {
      const user = await this.deps.getUser(userId)
      if (!user) return
      const preferences = { ...(user.preferences || {}) } as Record<string, unknown>
      const grants = Object.fromEntries(
        Object.entries(grantsOf(user)).filter(([, grant]) => !this.hasLapsed(grant))
      )
      change(grants, preferences)
      preferences[OAUTH2_GRANTS_KEY] = grants
      await this.deps.updateUser(userId, { preferences } as UpdateUserData)
    })
  }

  // ============================================
  // OAuth2 Consent Management
  // ============================================

  /**
   * Check if a user has an existing consent for a client with the given scopes
   * Returns the consent if all requested scopes are already consented, null otherwise
   */
  public async getUserConsent(
    userId: string,
    clientId: string,
    requestedScopes: OAuth2Scope[]
  ): Promise<{ hasConsent: boolean; consentedScopes: OAuth2Scope[] }> {
    try {
      const user = await this.deps.getUser(userId)
      if (!user) {
        this.deps.logger.debug('getUserConsent: user not found', { userId })
        return { hasConsent: false, consentedScopes: [] }
      }

      this.deps.logger.debug('getUserConsent: checking consent', {
        userId,
        clientId,
        requestedScopes,
        userPreferences: user.preferences
      })

      // Get consents from user preferences
      const consents = (user.preferences?._oauth2Consents || {}) as Record<string, {
        scopes: OAuth2Scope[]
        grantedAt: string
        expiresAt?: string
      }>

      const consent = consents[clientId]
      if (!consent) {
        this.deps.logger.debug('getUserConsent: no consent found for client', { clientId, consents })
        return { hasConsent: false, consentedScopes: [] }
      }

      // Check if consent has expired
      if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) {
        this.deps.logger.debug('getUserConsent: consent expired', { consent })
        return { hasConsent: false, consentedScopes: [] }
      }

      // Check if all requested scopes are already consented
      const consentedScopes = consent.scopes || []
      const hasAllScopes = requestedScopes.every(scope => consentedScopes.includes(scope))

      this.deps.logger.debug('getUserConsent: result', {
        hasAllScopes,
        consentedScopes,
        requestedScopes
      })

      return {
        hasConsent: hasAllScopes,
        consentedScopes
      }
    } catch (error) {
      this.deps.logger.warn('Failed to check user consent', { error, userId, clientId })
      return { hasConsent: false, consentedScopes: [] }
    }
  }

  /**
   * Save user consent for a client
   * Stores in user preferences for persistence
   */
  public async saveUserConsent(
    userId: string,
    clientId: string,
    scopes: OAuth2Scope[],
    expiresInDays?: number
  ): Promise<boolean> {
    return withUserLock(userId, () => this.writeUserConsent(userId, clientId, scopes, expiresInDays))
  }

  private async writeUserConsent(
    userId: string,
    clientId: string,
    scopes: OAuth2Scope[],
    expiresInDays?: number
  ): Promise<boolean> {
    try {
      this.deps.logger.info('saveUserConsent: starting', { userId, clientId, scopes })

      const user = await this.deps.getUser(userId)
      if (!user) {
        this.deps.logger.warn('Cannot save consent - user not found', { userId })
        return false
      }

      // Get existing consents
      const currentPreferences = user.preferences || {}
      const existingConsents = (currentPreferences._oauth2Consents || {}) as Record<string, {
        scopes: OAuth2Scope[]
        grantedAt: string
        expiresAt?: string
      }>

      this.deps.logger.debug('saveUserConsent: existing state', {
        currentPreferences,
        existingConsents
      })

      // The latest approval replaces the last one. Merging would undo a narrowing: approve
      // read+delete, later approve read only, and the next request for read+delete would
      // still match the stored consent and be approved without asking.
      const mergedScopes = [...new Set(scopes)] as OAuth2Scope[]

      // Calculate expiry (default: 365 days, or never if not specified)
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined

      // Update consents
      const updatedConsents = {
        ...existingConsents,
        [clientId]: {
          scopes: mergedScopes,
          grantedAt: new Date().toISOString(),
          expiresAt
        }
      }

      const newPreferences = {
        ...currentPreferences,
        _oauth2Consents: updatedConsents
      }

      this.deps.logger.debug('saveUserConsent: saving new preferences', { newPreferences })

      // Save to user preferences
      await this.deps.updateUser(userId, {
        preferences: newPreferences
      })

      this.deps.logger.info('User consent saved successfully', {
        userId,
        clientId,
        scopes: mergedScopes
      })

      return true
    } catch (error) {
      this.deps.logger.error('Failed to save user consent', { error, userId, clientId })
      return false
    }
  }

  /**
   * Revoke user consent for a client
   */
  public async revokeUserConsent(userId: string, clientId: string): Promise<boolean> {
    return withUserLock(userId, () => this.removeUserConsent(userId, clientId))
  }

  private async removeUserConsent(userId: string, clientId: string): Promise<boolean> {
    try {
      const user = await this.deps.getUser(userId)
      if (!user) {
        return false
      }

      const currentPreferences = user.preferences || {}
      const existingConsents = (currentPreferences._oauth2Consents || {}) as Record<string, unknown>

      if (!existingConsents[clientId]) {
        return true // Already revoked
      }

      // Remove the consent for this client
      const { [clientId]: _removed, ...remainingConsents } = existingConsents

      await this.deps.updateUser(userId, {
        preferences: {
          ...currentPreferences,
          _oauth2Consents: remainingConsents
        }
      })

      this.deps.logger.info('User consent revoked', { userId, clientId })
      return true
    } catch (error) {
      this.deps.logger.error('Failed to revoke user consent', { error, userId, clientId })
      return false
    }
  }
}
