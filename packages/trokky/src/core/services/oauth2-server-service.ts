import type { CryptoAdapter } from '../crypto/adapter.js'
import type { TrokkyLogger } from '../utils/logger.js'
import { OAuth2AuthorizationServer } from '../security/oauth2/index.js'
import type { OAuth2Scope, TokenResponse } from '../types/oauth2.js'
import { User, UpdateUserData } from '../types/index.js'

export interface OAuth2ServerServiceDependencies {
  logger: TrokkyLogger
  cryptoAdapter: CryptoAdapter
  jwtSecret: string
  getOAuth2Server: () => OAuth2AuthorizationServer | null
  getOAuth2Options: () => { accessTokenTtl?: number; refreshTokenTtl?: number } | undefined
  getUser: (id: string) => Promise<User | null>
  updateUser: (id: string, userData: UpdateUserData) => Promise<User>
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
    clientId: string
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
    const accessTokenPayload = {
      sub: user.id,
      type: 'oauth2_access',
      clientId,
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

      // Determine scopes - can only narrow, not expand
      let scopes = payload.scopes
      if (requestedScope) {
        const requestedScopes = requestedScope.split(' ').filter(Boolean) as OAuth2Scope[]
        scopes = requestedScopes.filter(s => payload.scopes.includes(s))
      }

      // Generate new tokens
      const tokens = await this.generateOAuth2Tokens(user, scopes, clientId)

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

      // Merge scopes if consent already exists
      const existingConsent = existingConsents[clientId]
      const mergedScopes = existingConsent
        ? [...new Set([...existingConsent.scopes, ...scopes])] as OAuth2Scope[]
        : scopes

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
