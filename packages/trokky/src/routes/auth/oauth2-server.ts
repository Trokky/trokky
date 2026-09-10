/**
 * OAuth2 Authorization Server Routes
 *
 * Implements endpoints for:
 * - Device Authorization Flow (RFC 8628) - for CLI
 * - Authorization Code Flow with PKCE - for external apps (SSO)
 *
 * These routes enable Trokky Studio to act as an OAuth2 provider.
 */

import type { HttpRequest, HttpResponse } from '../types.js'
import { TrokkyCore, createLogger } from '../../core/index.js'
import type {
  OAuth2Scope,
  DeviceAuthorizationRequest,
  DeviceTokenRequest,
  AuthorizationCodeTokenRequest,
  RefreshTokenRequest,
  TokenResponse
} from '../../core/index.js'

const logger = createLogger('routes', 'OAuth2Server')

// ============================================================================
// TYPES
// ============================================================================

interface TokenRequestBody {
  grant_type: string
  device_code?: string
  code?: string
  redirect_uri?: string
  code_verifier?: string
  refresh_token?: string
  client_id: string
  client_secret?: string
  scope?: string
}

interface DeviceVerifyRequest {
  user_code: string
  action: 'authorize' | 'deny'
}

// ============================================================================
// DEVICE AUTHORIZATION FLOW
// ============================================================================

/**
 * Start Device Authorization Flow
 * POST /auth/device
 *
 * Called by CLI to get device code and user code.
 * No authentication required.
 */
export async function startDeviceAuthorization(
  core: TrokkyCore,
  request: HttpRequest
): Promise<HttpResponse> {
  try {
    const oauth2Server = core.getOAuth2Server()
    if (!oauth2Server) {
      return {
        status: 501,
        headers: {},
        body: {
          error: 'server_error',
          error_description: 'OAuth2 authorization server is not enabled'
        }
      }
    }

    const body = request.body as DeviceAuthorizationRequest
    const clientId = body?.client_id
    const scope = body?.scope || ''

    if (!clientId) {
      return {
        status: 400,
        headers: {},
        body: {
          error: 'invalid_request',
          error_description: 'client_id is required'
        }
      }
    }

    const scopes = scope ? scope.split(' ').filter(Boolean) : []
    const result = oauth2Server.startDeviceAuthorization(clientId, scopes)

    if (!result.success) {
      const errorResult = result as { success: false; error: string; error_description: string }
      return {
        status: 400,
        headers: {},
        body: {
          error: errorResult.error,
          error_description: errorResult.error_description
        }
      }
    }

    logger.info('Started device authorization', { clientId })

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: result.response
    }
  } catch (error) {
    logger.error('Device authorization failed', { error })
    return {
      status: 500,
      headers: {},
      body: {
        error: 'server_error',
        error_description: 'Internal server error'
      }
    }
  }
}

/**
 * Get Device Code Info (for verification page)
 * GET /auth/device/verify?code=XXXX-XXXX
 *
 * Called by Studio to get info about a device code.
 * Authentication required.
 */
export async function getDeviceCodeInfo(
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
            message: 'Authentication required'
          }
        }
      }
    }

    const oauth2Server = core.getOAuth2Server()
    if (!oauth2Server) {
      return {
        status: 501,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'NOT_ENABLED',
            message: 'OAuth2 authorization server is not enabled'
          }
        }
      }
    }

    const userCode = request.query?.code as string
    if (!userCode) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'code query parameter is required'
          }
        }
      }
    }

    const state = oauth2Server.getDeviceCodeByUserCode(userCode)
    if (!state) {
      return {
        status: 404,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Invalid or expired user code'
          }
        }
      }
    }

    if (state.status !== 'pending') {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'ALREADY_PROCESSED',
            message: `This code has already been ${state.status}`
          }
        }
      }
    }

    // Get client info
    const client = oauth2Server.getClient(state.clientId)

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        data: {
          clientId: state.clientId,
          clientName: client?.name || state.clientId,
          clientDescription: client?.description,
          scopes: state.scopes,
          expiresIn: Math.max(0, Math.floor((state.expiresAt - Date.now()) / 1000))
        }
      }
    }
  } catch (error) {
    logger.error('Failed to get device code info', { error })
    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      }
    }
  }
}

/**
 * Authorize or Deny Device Code
 * POST /auth/device/verify
 *
 * Called by Studio when user approves or denies the device authorization.
 * Authentication required.
 */
export async function verifyDeviceCode(
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
            message: 'Authentication required'
          }
        }
      }
    }

    const oauth2Server = core.getOAuth2Server()
    if (!oauth2Server) {
      return {
        status: 501,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'NOT_ENABLED',
            message: 'OAuth2 authorization server is not enabled'
          }
        }
      }
    }

    const body = request.body as DeviceVerifyRequest
    const { user_code, action } = body

    if (!user_code || !action) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'user_code and action are required'
          }
        }
      }
    }

    if (action !== 'authorize' && action !== 'deny') {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'action must be "authorize" or "deny"'
          }
        }
      }
    }

    let success: boolean
    if (action === 'authorize') {
      success = oauth2Server.authorizeDeviceCode(user_code, request.user.id)
      if (success) {
        logger.info('Device code authorized', {
          userCode: user_code,
          userId: request.user.id
        })
      }
    } else {
      success = oauth2Server.denyDeviceCode(user_code)
      if (success) {
        logger.info('Device code denied', {
          userCode: user_code,
          userId: request.user.id
        })
      }
    }

    if (!success) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'VERIFICATION_FAILED',
            message: 'Failed to process device code. It may be invalid, expired, or already processed.'
          }
        }
      }
    }

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        data: {
          message: action === 'authorize'
            ? 'Device authorized successfully. You can close this window.'
            : 'Device authorization denied.'
        }
      }
    }
  } catch (error) {
    logger.error('Device verification failed', { error })
    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error'
        }
      }
    }
  }
}

// ============================================================================
// TOKEN ENDPOINT (Unified for all grant types)
// ============================================================================

/**
 * Token Endpoint
 * POST /auth/token
 *
 * Handles all token requests:
 * - Device code exchange (grant_type=urn:ietf:params:oauth:grant-type:device_code)
 * - Authorization code exchange (grant_type=authorization_code)
 * - Token refresh (grant_type=refresh_token)
 */
export async function handleTokenRequest(
  core: TrokkyCore,
  request: HttpRequest
): Promise<HttpResponse> {
  try {
    const oauth2Server = core.getOAuth2Server()
    if (!oauth2Server) {
      return {
        status: 501,
        headers: {},
        body: {
          error: 'server_error',
          error_description: 'OAuth2 authorization server is not enabled'
        }
      }
    }

    const body = request.body as TokenRequestBody
    const { grant_type, client_id } = body

    if (!grant_type) {
      return {
        status: 400,
        headers: {},
        body: {
          error: 'invalid_request',
          error_description: 'grant_type is required'
        }
      }
    }

    if (!client_id) {
      return {
        status: 400,
        headers: {},
        body: {
          error: 'invalid_request',
          error_description: 'client_id is required'
        }
      }
    }

    // Validate client
    const client = oauth2Server.getClient(client_id)
    if (!client || !client.isActive) {
      return {
        status: 401,
        headers: {},
        body: {
          error: 'invalid_client',
          error_description: 'Unknown or inactive client'
        }
      }
    }

    // For confidential clients, validate client_secret
    if (client.type === 'confidential') {
      const clientSecret = body.client_secret
      if (!clientSecret || !oauth2Server.validateClientSecret(client, clientSecret)) {
        return {
          status: 401,
          headers: {},
          body: {
            error: 'invalid_client',
            error_description: 'Invalid client credentials'
          }
        }
      }
    }

    // Token generator function - uses core's auth service
    const generateToken = async (
      userId: string,
      scopes: OAuth2Scope[],
      clientId: string
    ): Promise<TokenResponse> => {
      const user = await core.getUser(userId)
      if (!user) {
        throw new Error('User not found')
      }

      // Generate tokens using core's auth service
      const tokens = await core.generateOAuth2Tokens(user, scopes, clientId)

      return {
        access_token: tokens.accessToken,
        token_type: 'Bearer',
        expires_in: tokens.expiresIn,
        refresh_token: scopes.includes('offline_access') ? tokens.refreshToken : undefined,
        scope: scopes.join(' ')
      }
    }

    // Handle different grant types
    switch (grant_type) {
      case 'urn:ietf:params:oauth:grant-type:device_code': {
        const { device_code } = body
        if (!device_code) {
          return {
            status: 400,
            headers: {},
            body: {
              error: 'invalid_request',
              error_description: 'device_code is required'
            }
          }
        }

        const result = await oauth2Server.pollDeviceToken(
          device_code,
          client_id,
          generateToken
        )

        if (!result.success) {
          const errorResult = result as { success: false; error: string; error_description: string }
          // Use appropriate HTTP status for different errors
          const status = errorResult.error === 'authorization_pending' ? 400 : 400
          return {
            status,
            headers: {},
            body: {
              error: errorResult.error,
              error_description: errorResult.error_description
            }
          }
        }

        logger.info('Device token issued', { clientId: client_id })
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: result.response
        }
      }

      case 'authorization_code': {
        const { code, redirect_uri, code_verifier } = body
        if (!code || !redirect_uri || !code_verifier) {
          return {
            status: 400,
            headers: {},
            body: {
              error: 'invalid_request',
              error_description: 'code, redirect_uri, and code_verifier are required'
            }
          }
        }

        const result = await oauth2Server.exchangeAuthorizationCode(
          code,
          client_id,
          redirect_uri,
          code_verifier,
          generateToken
        )

        if (!result.success) {
          const errorResult = result as { success: false; error: string; error_description: string }
          return {
            status: 400,
            headers: {},
            body: {
              error: errorResult.error,
              error_description: errorResult.error_description
            }
          }
        }

        logger.info('Authorization code exchanged', { clientId: client_id })
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: result.response
        }
      }

      case 'refresh_token': {
        const { refresh_token, scope } = body
        if (!refresh_token) {
          return {
            status: 400,
            headers: {},
            body: {
              error: 'invalid_request',
              error_description: 'refresh_token is required'
            }
          }
        }

        // Verify refresh token and generate new tokens
        const refreshResult = await core.refreshOAuth2Token(refresh_token, client_id, scope)
        if (!refreshResult) {
          return {
            status: 400,
            headers: {},
            body: {
              error: 'invalid_grant',
              error_description: 'Invalid or expired refresh token'
            }
          }
        }

        logger.info('Token refreshed', { clientId: client_id })
        return {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: refreshResult
        }
      }

      default:
        return {
          status: 400,
          headers: {},
          body: {
            error: 'unsupported_grant_type',
            error_description: `Grant type "${grant_type}" is not supported`
          }
        }
    }
  } catch (error) {
    logger.error('Token request failed', { error })
    return {
      status: 500,
      headers: {},
      body: {
        error: 'server_error',
        error_description: 'Internal server error'
      }
    }
  }
}

// ============================================================================
// AUTHORIZATION ENDPOINT (for Authorization Code Flow)
// ============================================================================

/**
 * Validate Authorization Request
 * GET /auth/authorize
 *
 * This validates the request and returns info for the consent page.
 * Also checks if user has already consented to these scopes (for auto-approve).
 * The actual redirect/code generation happens after user approval via POST.
 */
export async function validateAuthorizationRequest(
  core: TrokkyCore,
  request: HttpRequest
): Promise<HttpResponse> {
  try {
    const oauth2Server = core.getOAuth2Server()
    if (!oauth2Server) {
      // Redirect with error if possible
      const redirectUri = request.query?.redirect_uri as string
      if (redirectUri) {
        const errorUrl = new URL(redirectUri)
        errorUrl.searchParams.set('error', 'server_error')
        errorUrl.searchParams.set('error_description', 'OAuth2 server not enabled')
        return {
          status: 302,
          headers: { Location: errorUrl.toString() },
          body: null
        }
      }
      return {
        status: 501,
        headers: {},
        body: {
          error: 'server_error',
          error_description: 'OAuth2 authorization server is not enabled'
        }
      }
    }

    // Extract query parameters
    const params = {
      response_type: request.query?.response_type as string || '',
      client_id: request.query?.client_id as string || '',
      redirect_uri: request.query?.redirect_uri as string || '',
      scope: request.query?.scope as string,
      state: request.query?.state as string || '',
      code_challenge: request.query?.code_challenge as string || '',
      code_challenge_method: request.query?.code_challenge_method as string || ''
    }

    const validation = oauth2Server.validateAuthorizationRequest(params)

    if (!validation.valid) {
      const errorResult = validation as { valid: false; error: string; error_description: string }
      // If we have a valid redirect_uri, redirect with error
      // Otherwise, show error directly
      const client = oauth2Server.getClient(params.client_id)
      if (client && client.redirectUris.includes(params.redirect_uri)) {
        const errorUrl = new URL(params.redirect_uri)
        errorUrl.searchParams.set('error', errorResult.error)
        errorUrl.searchParams.set('error_description', errorResult.error_description)
        if (params.state) {
          errorUrl.searchParams.set('state', params.state)
        }
        return {
          status: 302,
          headers: { Location: errorUrl.toString() },
          body: null
        }
      }

      return {
        status: 400,
        headers: {},
        body: {
          error: errorResult.error,
          error_description: errorResult.error_description
        }
      }
    }

    // Check if user has already consented to these scopes
    let hasExistingConsent = false
    if (request.user) {
      const consentResult = await core.getUserConsent(
        request.user.id,
        validation.client.id,
        validation.scopes
      )
      hasExistingConsent = consentResult.hasConsent

      if (hasExistingConsent) {
        logger.debug('User has existing consent for client', {
          userId: request.user.id,
          clientId: validation.client.id,
          scopes: validation.scopes
        })
      }
    }

    // Return authorization request info for the consent page
    // The actual consent page is rendered by Studio
    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        data: {
          client: {
            id: validation.client.id,
            name: validation.client.name,
            description: validation.client.description,
            logoUrl: validation.client.logoUrl,
            homepageUrl: validation.client.homepageUrl,
            privacyPolicyUrl: validation.client.privacyPolicyUrl,
            termsOfServiceUrl: validation.client.termsOfServiceUrl
          },
          scopes: validation.scopes,
          redirectUri: params.redirect_uri,
          state: params.state,
          codeChallenge: params.code_challenge,
          // Include consent status for auto-approve in Studio
          hasExistingConsent
        }
      }
    }
  } catch (error) {
    logger.error('Authorization request validation failed', { error })
    return {
      status: 500,
      headers: {},
      body: {
        error: 'server_error',
        error_description: 'Internal server error'
      }
    }
  }
}

/**
 * Handle Authorization Approval/Denial
 * POST /auth/authorize
 *
 * Called when user approves or denies the authorization request.
 * Authentication required.
 */
export async function handleAuthorizationDecision(
  core: TrokkyCore,
  request: HttpRequest
): Promise<HttpResponse> {
  try {
    if (!request.user) {
      return {
        status: 401,
        headers: {},
        body: {
          error: 'unauthorized',
          error_description: 'Authentication required'
        }
      }
    }

    const oauth2Server = core.getOAuth2Server()
    if (!oauth2Server) {
      return {
        status: 501,
        headers: {},
        body: {
          error: 'server_error',
          error_description: 'OAuth2 authorization server is not enabled'
        }
      }
    }

    const body = request.body as {
      action: 'approve' | 'deny'
      client_id: string
      redirect_uri: string
      scopes: string[]
      state: string
      code_challenge: string
    }

    const { action, client_id, redirect_uri, scopes, state, code_challenge } = body

    if (!action || !client_id || !redirect_uri || !state || !code_challenge) {
      return {
        status: 400,
        headers: {},
        body: {
          error: 'invalid_request',
          error_description: 'Missing required parameters'
        }
      }
    }

    const redirectUrl = new URL(redirect_uri)

    if (action === 'deny') {
      redirectUrl.searchParams.set('error', 'access_denied')
      redirectUrl.searchParams.set('error_description', 'User denied the authorization request')
      redirectUrl.searchParams.set('state', state)

      logger.info('Authorization denied', {
        clientId: client_id,
        userId: request.user.id
      })

      return {
        status: 200,
        headers: {},
        body: {
          success: true,
          data: {
            redirectUrl: redirectUrl.toString()
          }
        }
      }
    }

    // Save user consent for future auto-approval
    const scopesToSave = (scopes || []) as OAuth2Scope[]
    await core.saveUserConsent(request.user.id, client_id, scopesToSave)

    // Generate authorization code
    const code = oauth2Server.generateAuthorizationCode(
      client_id,
      redirect_uri,
      scopesToSave,
      code_challenge,
      request.user.id
    )

    redirectUrl.searchParams.set('code', code)
    redirectUrl.searchParams.set('state', state)

    logger.info('Authorization code issued', {
      clientId: client_id,
      userId: request.user.id,
      consentSaved: true
    })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        data: {
          redirectUrl: redirectUrl.toString()
        }
      }
    }
  } catch (error) {
    logger.error('Authorization decision failed', { error })
    return {
      status: 500,
      headers: {},
      body: {
        error: 'server_error',
        error_description: 'Internal server error'
      }
    }
  }
}

// ============================================================================
// SERVER METADATA
// ============================================================================

/**
 * OAuth2 Server Metadata
 * GET /.well-known/oauth-authorization-server
 *
 * Returns server metadata for auto-discovery.
 */
export async function getServerMetadata(
  core: TrokkyCore,
  _request: HttpRequest
): Promise<HttpResponse> {
  const oauth2Server = core.getOAuth2Server()
  if (!oauth2Server) {
    return {
      status: 501,
      headers: {},
      body: {
        error: 'server_error',
        error_description: 'OAuth2 authorization server is not enabled'
      }
    }
  }

  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: oauth2Server.getServerMetadata()
  }
}
