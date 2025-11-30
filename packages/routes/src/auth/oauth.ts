/**
 * OAuth Routes
 *
 * API routes for OAuth authentication (Google login and account linking).
 */

import type { HttpRequest, HttpResponse } from '../types.js'
import {
  TrokkyCore,
  InvalidInputError,
  createLogger,
  GoogleOAuthService,
  type OAuthProvider,
} from '@trokky/core'

const logger = createLogger('routes', 'OAuth')

// =============================================================================
// TYPES
// =============================================================================

interface OAuthInitRequest {
  mode: 'login' | 'link'
}

interface OAuthCallbackRequest {
  code: string
  state: string
  codeVerifier: string
  mode: 'login' | 'link'
  deviceId?: string // For trusted device check (skips MFA if trusted)
}

// In-memory store for PKCE and state (in production, use Redis or similar)
// Map of state -> { codeVerifier, mode, userId?, expiresAt }
const oauthStateStore = new Map<
  string,
  {
    codeVerifier: string
    mode: 'login' | 'link'
    userId?: string
    expiresAt: number
  }
>()

// Clean up expired states periodically
setInterval(() => {
  const now = Date.now()
  for (const [state, data] of oauthStateStore.entries()) {
    if (data.expiresAt < now) {
      oauthStateStore.delete(state)
    }
  }
}, 60000) // Clean up every minute

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getGoogleOAuthService(core: TrokkyCore): GoogleOAuthService | null {
  const config = core.getOAuthConfig('google')
  if (!config) {
    return null
  }
  return new GoogleOAuthService({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
  })
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * Initialize Google OAuth flow
 * POST /auth/oauth/google/init
 *
 * For login: No authentication required
 * For link: Authentication required (user must be logged in)
 */
export async function initGoogleOAuth(
  core: TrokkyCore,
  request: HttpRequest
): Promise<HttpResponse> {
  try {
    const googleService = getGoogleOAuthService(core)
    if (!googleService) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'OAUTH_NOT_CONFIGURED',
            message: 'Google OAuth is not configured',
          },
        },
      }
    }

    const body = request.body as OAuthInitRequest
    const mode = body?.mode || 'login'

    // For link mode, user must be authenticated
    if (mode === 'link') {
      if (!request.user) {
        return {
          status: 401,
          headers: {},
          body: {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required to link account',
            },
          },
        }
      }
    }

    // Generate PKCE challenge
    const pkce = googleService.generatePKCE()
    const state = googleService.generateState()

    // Store state with PKCE verifier (expires in 10 minutes)
    oauthStateStore.set(state, {
      codeVerifier: pkce.codeVerifier,
      mode,
      userId: request.user?.id,
      expiresAt: Date.now() + 10 * 60 * 1000,
    })

    // Generate authorization URL (mode affects consent screen behavior)
    const authUrl = googleService.getAuthorizationUrl(state, pkce.codeChallenge, mode)

    logger.info('Initiated OAuth flow', { mode, state: state.substring(0, 8) })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        data: {
          authUrl,
          state,
          // Return codeVerifier for the Studio to store in sessionStorage
          // (needed for the callback to verify)
          codeVerifier: pkce.codeVerifier,
        },
      },
    }
  } catch (error) {
    logger.error('Failed to initialize OAuth', { error })
    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to initialize OAuth flow',
        },
      },
    }
  }
}

/**
 * Handle Google OAuth callback
 * POST /auth/oauth/google/callback
 *
 * Handles both login and link modes
 */
export async function handleGoogleOAuthCallback(
  core: TrokkyCore,
  request: HttpRequest
): Promise<HttpResponse> {
  try {
    const googleService = getGoogleOAuthService(core)
    if (!googleService) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'OAUTH_NOT_CONFIGURED',
            message: 'Google OAuth is not configured',
          },
        },
      }
    }

    const body = request.body as OAuthCallbackRequest
    const { code, state, codeVerifier, mode, deviceId } = body

    if (!code || !state || !codeVerifier) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required parameters: code, state, codeVerifier',
          },
        },
      }
    }

    // Validate state (CSRF protection)
    const storedState = oauthStateStore.get(state)
    if (!storedState || storedState.expiresAt < Date.now()) {
      oauthStateStore.delete(state)
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: 'Invalid or expired state parameter',
          },
        },
      }
    }

    // Clean up used state
    oauthStateStore.delete(state)

    // Exchange code for tokens
    const tokens = await googleService.exchangeCodeForTokens(code, codeVerifier)

    // Get user info from Google
    const googleUser = await googleService.getUserInfo(tokens.accessToken)

    // Validate user info
    googleService.validateUserInfo(googleUser)

    if (mode === 'link') {
      // Link mode: Add Google to existing user
      const userId = storedState.userId || request.user?.id
      if (!userId) {
        return {
          status: 401,
          headers: {},
          body: {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'User must be authenticated to link account',
            },
          },
        }
      }

      const provider: OAuthProvider = {
        provider: 'google',
        providerId: googleUser.sub,
        email: googleUser.email,
        linkedAt: new Date().toISOString(),
      }

      try {
        const updatedUser = await core.linkOAuthProvider(userId, provider)
        logger.info('Linked Google account', { userId, googleEmail: googleUser.email })

        return {
          status: 200,
          headers: {},
          body: {
            success: true,
            data: {
              message: 'Google account linked successfully',
              provider: {
                provider: 'google',
                email: googleUser.email,
                linkedAt: provider.linkedAt,
              },
            },
          },
        }
      } catch (error) {
        if (error instanceof InvalidInputError) {
          return {
            status: 400,
            headers: {},
            body: {
              success: false,
              error: {
                code: 'LINK_FAILED',
                message: error.message,
              },
            },
          }
        }
        throw error
      }
    } else {
      // Login mode: Authenticate with Google
      // Pass deviceId to check if device is trusted (can skip MFA)
      const authResult = await core.authenticateWithOAuth('google', googleUser.sub, { deviceId })

      if (!authResult) {
        // No user linked with this Google account
        return {
          status: 401,
          headers: {},
          body: {
            success: false,
            error: {
              code: 'NO_LINKED_ACCOUNT',
              message:
                'No account is linked to this Google account. Please log in with your username/password and link your Google account first.',
            },
          },
        }
      }

      // Handle different authentication result types
      if (authResult.type === 'mfa_required') {
        logger.info('OAuth login requires MFA verification', {
          googleEmail: googleUser.email,
          methods: authResult.methods,
        })

        return {
          status: 200,
          headers: {},
          body: {
            success: true,
            data: {
              requiresMFA: true,
              mfaToken: authResult.mfaToken,
              methods: authResult.methods,
              expiresIn: authResult.expiresIn,
            },
          },
        }
      }

      if (authResult.type === 'mfa_setup_required') {
        logger.info('OAuth login requires MFA setup', {
          googleEmail: googleUser.email,
          allowedMethods: authResult.allowedMethods,
        })

        return {
          status: 200,
          headers: {},
          body: {
            success: true,
            data: {
              requiresMFASetup: true,
              setupToken: authResult.setupToken,
              allowedMethods: authResult.allowedMethods,
              message: authResult.message,
              expiresIn: authResult.expiresIn,
            },
          },
        }
      }

      // Success - full authentication
      logger.info('User logged in with Google', {
        userId: authResult.user.id,
        googleEmail: googleUser.email,
      })

      return {
        status: 200,
        headers: {},
        body: {
          success: true,
          data: {
            token: authResult.token,
            refreshToken: authResult.refreshToken,
            user: authResult.user,
            expiresAt: authResult.expiresAt,
          },
        },
      }
    }
  } catch (error) {
    logger.error('OAuth callback failed', { error })
    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          code: 'CALLBACK_FAILED',
          message:
            error instanceof Error ? error.message : 'OAuth callback failed',
        },
      },
    }
  }
}

/**
 * Unlink Google account
 * DELETE /auth/oauth/google/unlink
 *
 * Authentication required
 */
export async function unlinkGoogleAccount(
  core: TrokkyCore,
  request: HttpRequest
): Promise<HttpResponse> {
  try {
    if (!request.user) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
      }
    }

    try {
      await core.unlinkOAuthProvider(request.user.id, 'google')
      logger.info('Unlinked Google account', { userId: request.user.id })

      return {
        status: 200,
        headers: {},
        body: {
          success: true,
          data: {
            message: 'Google account unlinked successfully',
          },
        },
      }
    } catch (error) {
      if (error instanceof InvalidInputError) {
        return {
          status: 400,
          headers: {},
          body: {
            success: false,
            error: {
              code: 'UNLINK_FAILED',
              message: error.message,
            },
          },
        }
      }
      throw error
    }
  } catch (error) {
    logger.error('Failed to unlink Google account', { error })
    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to unlink Google account',
        },
      },
    }
  }
}

/**
 * Check OAuth configuration status
 * GET /auth/oauth/status
 *
 * Returns which OAuth providers are configured
 */
export async function getOAuthStatus(
  core: TrokkyCore,
  _request: HttpRequest
): Promise<HttpResponse> {
  return {
    status: 200,
    headers: {},
    body: {
      success: true,
      data: {
        providers: {
          google: core.isOAuthConfigured('google'),
        },
      },
    },
  }
}
