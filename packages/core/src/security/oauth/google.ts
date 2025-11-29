/**
 * Google OAuth Service
 *
 * Implements OAuth 2.0 Authorization Code flow with PKCE for Google authentication.
 * Used for linking Google accounts to existing Trokky users and for OAuth login.
 */

import { randomBytes, createHash } from 'node:crypto'
import { createLogger } from '../../utils/logger.js'

const logger = createLogger('security', 'GoogleOAuth')

// =============================================================================
// TYPES
// =============================================================================

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export interface GoogleUserInfo {
  sub: string // Google's unique user ID
  email: string
  email_verified: boolean
  name: string
  picture?: string
  given_name?: string
  family_name?: string
}

export interface GoogleTokenResponse {
  access_token: string
  id_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

export interface PKCEChallenge {
  codeVerifier: string
  codeChallenge: string
}

// =============================================================================
// GOOGLE OAUTH SERVICE
// =============================================================================

export class GoogleOAuthService {
  private config: GoogleOAuthConfig

  constructor(config: GoogleOAuthConfig) {
    this.config = config
    logger.debug('GoogleOAuthService initialized', { clientId: config.clientId })
  }

  /**
   * Generate PKCE code verifier and challenge
   * Uses SHA256 for the challenge as recommended by OAuth 2.0 PKCE spec
   */
  generatePKCE(): PKCEChallenge {
    // Generate 32 random bytes for code verifier (43-128 chars when base64url encoded)
    const codeVerifier = randomBytes(32).toString('base64url')

    // Create SHA256 hash of verifier for challenge
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url')

    return { codeVerifier, codeChallenge }
  }

  /**
   * Generate state token for CSRF protection
   */
  generateState(): string {
    return randomBytes(32).toString('base64url')
  }

  /**
   * Build Google authorization URL with all required parameters
   */
  getAuthorizationUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent',
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    logger.debug('Generated authorization URL', { state })
    return authUrl
  }

  /**
   * Exchange authorization code for tokens using PKCE
   */
  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string
  ): Promise<{
    accessToken: string
    idToken: string
    refreshToken?: string
    expiresIn: number
  }> {
    logger.debug('Exchanging code for tokens')

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Failed to exchange code for tokens', {
        status: response.status,
        error: errorText,
      })
      throw new Error(`Failed to exchange code for tokens: ${response.status}`)
    }

    const data = (await response.json()) as GoogleTokenResponse
    logger.debug('Successfully exchanged code for tokens')

    return {
      accessToken: data.access_token,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    }
  }

  /**
   * Get user info from Google using access token
   */
  async getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    logger.debug('Fetching user info from Google')

    const response = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('Failed to get user info', {
        status: response.status,
        error: errorText,
      })
      throw new Error(`Failed to get user info: ${response.status}`)
    }

    const userInfo = (await response.json()) as GoogleUserInfo
    logger.debug('Successfully fetched user info', {
      sub: userInfo.sub,
      email: userInfo.email,
    })

    return userInfo
  }

  /**
   * Validate that the user's email is verified
   * This is important for security - we shouldn't link unverified emails
   */
  validateUserInfo(userInfo: GoogleUserInfo): void {
    if (!userInfo.email_verified) {
      logger.warn('Google account email not verified', { email: userInfo.email })
      throw new Error('Google account email must be verified')
    }

    if (!userInfo.sub) {
      throw new Error('Invalid Google user info: missing sub claim')
    }

    if (!userInfo.email) {
      throw new Error('Invalid Google user info: missing email')
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.clientId &&
      this.config.clientSecret &&
      this.config.redirectUri
    )
  }
}
