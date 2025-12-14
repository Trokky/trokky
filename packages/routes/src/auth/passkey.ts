/**
 * Passkey/WebAuthn Routes
 *
 * API routes for passwordless authentication using WebAuthn/Passkeys.
 * Supports both login (primary authentication) and registration (adding passkeys).
 */

import type { HttpRequest, HttpResponse } from '../types.js'
import {
  TrokkyCore,
  InvalidInputError,
  createLogger,
} from '@trokky/core'
import type {
  PasskeyCredential,
  PasskeyRegistrationOptions,
  PasskeyAuthenticationOptions,
  PasskeySession,
  AuthenticatorTransportType,
} from '@trokky/types'
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server'

const logger = createLogger('routes', 'Passkey')

// =============================================================================
// TYPES
// =============================================================================

interface PasskeyRegisterOptionsRequest {
  friendlyName?: string
}

interface PasskeyRegisterVerifyRequest {
  sessionId: string
  credential: RegistrationResponseJSON
  friendlyName?: string
}

interface PasskeyLoginOptionsRequest {
  username?: string
}

interface PasskeyLoginVerifyRequest {
  sessionId: string
  credential: AuthenticationResponseJSON
  deviceId?: string
}

interface PasskeyUpdateRequest {
  friendlyName: string
}

// =============================================================================
// SESSION STORE
// =============================================================================

// In-memory store for WebAuthn sessions (in production, use Redis or similar)
const passkeySessionStore = new Map<string, PasskeySession>()

// Clean up expired sessions periodically
setInterval(() => {
  const now = Date.now()
  for (const [sessionId, session] of passkeySessionStore.entries()) {
    if (session.expiresAt < now) {
      passkeySessionStore.delete(sessionId)
    }
  }
}, 60000) // Clean up every minute

// Generate a random session ID
function generateSessionId(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Convert transport types for compatibility
function convertTransports(
  transports?: AuthenticatorTransportFuture[]
): AuthenticatorTransportType[] | undefined {
  if (!transports) return undefined
  const validTransports: AuthenticatorTransportType[] = ['usb', 'ble', 'nfc', 'internal', 'hybrid']
  return transports.filter((t): t is AuthenticatorTransportType =>
    validTransports.includes(t as AuthenticatorTransportType)
  )
}

// =============================================================================
// ROUTE HANDLERS - STATUS
// =============================================================================

/**
 * Check passkey configuration status
 * GET /auth/passkey/status
 *
 * Public endpoint - returns whether passkeys are enabled
 */
export async function getPasskeyStatus(
  core: TrokkyCore,
  _request: HttpRequest
): Promise<HttpResponse> {
  const isConfigured = core.isPasskeyConfigured()

  return {
    status: 200,
    headers: {},
    body: {
      success: true,
      data: {
        enabled: isConfigured,
      },
    },
  }
}

// =============================================================================
// ROUTE HANDLERS - REGISTRATION
// =============================================================================

/**
 * Generate passkey registration options
 * POST /auth/passkey/register/options
 *
 * Authentication required - user must be logged in to add a passkey
 */
export async function getPasskeyRegistrationOptions(
  core: TrokkyCore,
  request: HttpRequest
): Promise<HttpResponse> {
  try {
    // Check if passkeys are configured
    const config = core.getPasskeyConfig()
    if (!config) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'PASSKEY_NOT_CONFIGURED',
            message: 'Passkey authentication is not configured',
          },
        },
      }
    }

    // Require authentication
    if (!request.user) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required to register a passkey',
          },
        },
      }
    }

    const body = request.body as PasskeyRegisterOptionsRequest | undefined
    const friendlyName = body?.friendlyName

    // Get user's existing passkeys to exclude
    const user = await core.getUser(request.user.id)
    if (!user) {
      return {
        status: 404,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
      }
    }

    const existingCredentials = (user.passkeys || []).map((p) => ({
      id: p.id,
      transports: p.transports as AuthenticatorTransportFuture[] | undefined,
    }))

    // Generate registration options
    // Note: simplewebauthn only accepts 'none', 'direct', 'enterprise' - not 'indirect'
    const attestationType = (config.attestation === 'indirect' ? 'none' : config.attestation) || 'none'
    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpId,
      userName: user.username,
      userDisplayName: `${user.firstName} ${user.lastName}`.trim() || user.username,
      attestationType: attestationType as 'none' | 'direct' | 'enterprise',
      excludeCredentials: existingCredentials.map((c) => ({
        id: c.id,
        transports: c.transports,
      })),
      authenticatorSelection: {
        residentKey: config.authenticatorSelection?.residentKey || 'preferred',
        userVerification: config.userVerification || 'preferred',
        authenticatorAttachment: config.authenticatorSelection?.authenticatorAttachment,
      },
      timeout: config.timeout || 60000,
    })

    // Store session
    const sessionId = generateSessionId()
    passkeySessionStore.set(sessionId, {
      challenge: options.challenge,
      userId: user.id,
      expectedOrigin: config.origin,
      expectedRPID: config.rpId,
      mode: 'register',
      friendlyName,
      expiresAt: Date.now() + (config.timeout || 60000) + 30000, // Add 30s buffer
    })

    logger.info('Generated passkey registration options', {
      userId: user.id,
      sessionId: sessionId.substring(0, 8),
    })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        data: {
          ...options,
          sessionId,
        },
      },
    }
  } catch (error) {
    logger.error('Failed to generate registration options', { error })
    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate registration options',
        },
      },
    }
  }
}

/**
 * Verify passkey registration
 * POST /auth/passkey/register/verify
 *
 * Authentication required
 */
export async function verifyPasskeyRegistration(
  core: TrokkyCore,
  request: HttpRequest
): Promise<HttpResponse> {
  try {
    // Check if passkeys are configured
    const config = core.getPasskeyConfig()
    if (!config) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'PASSKEY_NOT_CONFIGURED',
            message: 'Passkey authentication is not configured',
          },
        },
      }
    }

    // Require authentication
    if (!request.user) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required to register a passkey',
          },
        },
      }
    }

    const body = request.body as PasskeyRegisterVerifyRequest
    const { sessionId, credential, friendlyName } = body

    if (!sessionId || !credential) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required parameters: sessionId, credential',
          },
        },
      }
    }

    // Get and validate session
    const session = passkeySessionStore.get(sessionId)
    if (!session || session.expiresAt < Date.now()) {
      passkeySessionStore.delete(sessionId)
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'INVALID_SESSION',
            message: 'Invalid or expired session',
          },
        },
      }
    }

    // Validate session matches user
    if (session.userId !== request.user.id) {
      passkeySessionStore.delete(sessionId)
      return {
        status: 403,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'SESSION_MISMATCH',
            message: 'Session does not match authenticated user',
          },
        },
      }
    }

    // Clean up session
    passkeySessionStore.delete(sessionId)

    // Verify the registration
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: session.challenge,
      expectedOrigin: session.expectedOrigin,
      expectedRPID: session.expectedRPID,
    })

    if (!verification.verified || !verification.registrationInfo) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'VERIFICATION_FAILED',
            message: 'Passkey registration verification failed',
          },
        },
      }
    }

    const { registrationInfo } = verification

    // Create the credential object
    const now = new Date().toISOString()
    const passkeyCredential: PasskeyCredential = {
      id: registrationInfo.credential.id,
      publicKey: Buffer.from(registrationInfo.credential.publicKey).toString('base64url'),
      counter: registrationInfo.credential.counter,
      deviceType: registrationInfo.credentialDeviceType === 'singleDevice' ? 'singleDevice' : 'multiDevice',
      backedUp: registrationInfo.credentialBackedUp,
      transports: convertTransports(credential.response.transports),
      createdAt: now,
      friendlyName: friendlyName || session.friendlyName || 'Passkey',
      aaguid: registrationInfo.aaguid,
    }

    // Add passkey to user
    await core.addPasskeyToUser(request.user.id, passkeyCredential)

    logger.info('Passkey registered successfully', {
      userId: request.user.id,
      credentialId: passkeyCredential.id.substring(0, 8),
      deviceType: passkeyCredential.deviceType,
    })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        data: {
          credential: {
            id: passkeyCredential.id,
            deviceType: passkeyCredential.deviceType,
            backedUp: passkeyCredential.backedUp,
            transports: passkeyCredential.transports,
            createdAt: passkeyCredential.createdAt,
            friendlyName: passkeyCredential.friendlyName,
          },
        },
      },
    }
  } catch (error) {
    logger.error('Passkey registration failed', { error })

    if (error instanceof InvalidInputError) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'REGISTRATION_FAILED',
            message: error.message,
          },
        },
      }
    }

    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Passkey registration failed',
        },
      },
    }
  }
}

// =============================================================================
// ROUTE HANDLERS - AUTHENTICATION
// =============================================================================

/**
 * Generate passkey authentication options
 * POST /auth/passkey/login/options
 *
 * Public endpoint - no authentication required
 */
export async function getPasskeyAuthenticationOptions(
  core: TrokkyCore,
  request: HttpRequest
): Promise<HttpResponse> {
  try {
    // Check if passkeys are configured
    const config = core.getPasskeyConfig()
    if (!config) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'PASSKEY_NOT_CONFIGURED',
            message: 'Passkey authentication is not configured',
          },
        },
      }
    }

    const body = request.body as PasskeyLoginOptionsRequest | undefined
    const username = body?.username

    // If username provided, get user's passkeys for allowCredentials
    let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] = []

    if (username) {
      const user = await core.getUserByUsername(username)
      if (user && user.passkeys && user.passkeys.length > 0) {
        allowCredentials = user.passkeys.map((p) => ({
          id: p.id,
          transports: p.transports as AuthenticatorTransportFuture[] | undefined,
        }))
      }
    }

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID: config.rpId,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: config.userVerification || 'preferred',
      timeout: config.timeout || 60000,
    })

    // Store session
    const sessionId = generateSessionId()
    passkeySessionStore.set(sessionId, {
      challenge: options.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpId,
      mode: 'login',
      expiresAt: Date.now() + (config.timeout || 60000) + 30000, // Add 30s buffer
    })

    logger.debug('Generated passkey authentication options', {
      sessionId: sessionId.substring(0, 8),
      hasAllowCredentials: allowCredentials.length > 0,
    })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        data: {
          ...options,
          sessionId,
        },
      },
    }
  } catch (error) {
    logger.error('Failed to generate authentication options', { error })
    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate authentication options',
        },
      },
    }
  }
}

/**
 * Verify passkey authentication
 * POST /auth/passkey/login/verify
 *
 * Public endpoint - returns JWT tokens on success
 */
export async function verifyPasskeyAuthentication(
  core: TrokkyCore,
  request: HttpRequest
): Promise<HttpResponse> {
  try {
    // Check if passkeys are configured
    const config = core.getPasskeyConfig()
    if (!config) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'PASSKEY_NOT_CONFIGURED',
            message: 'Passkey authentication is not configured',
          },
        },
      }
    }

    const body = request.body as PasskeyLoginVerifyRequest
    const { sessionId, credential, deviceId } = body

    if (!sessionId || !credential) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Missing required parameters: sessionId, credential',
          },
        },
      }
    }

    // Get and validate session
    const session = passkeySessionStore.get(sessionId)
    if (!session || session.expiresAt < Date.now()) {
      passkeySessionStore.delete(sessionId)
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'INVALID_SESSION',
            message: 'Invalid or expired session',
          },
        },
      }
    }

    // Clean up session
    passkeySessionStore.delete(sessionId)

    // Find user by credential ID
    const credentialId = credential.id
    const user = await core.getUserByPasskeyCredentialId(credentialId)

    if (!user) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'CREDENTIAL_NOT_FOUND',
            message: 'No account found with this passkey',
          },
        },
      }
    }

    // Get the stored credential
    const storedCredential = user.passkeys?.find((p) => p.id === credentialId)
    if (!storedCredential) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'CREDENTIAL_NOT_FOUND',
            message: 'Passkey credential not found',
          },
        },
      }
    }

    // Verify the authentication
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: session.challenge,
      expectedOrigin: session.expectedOrigin,
      expectedRPID: session.expectedRPID,
      credential: {
        id: storedCredential.id,
        publicKey: Buffer.from(storedCredential.publicKey, 'base64url'),
        counter: storedCredential.counter,
        transports: storedCredential.transports as AuthenticatorTransportFuture[] | undefined,
      },
    })

    if (!verification.verified) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'VERIFICATION_FAILED',
            message: 'Passkey authentication verification failed',
          },
        },
      }
    }

    // Update the credential counter (prevents replay attacks)
    await core.updateUserPasskey(user.id, credentialId, {
      counter: verification.authenticationInfo.newCounter,
    })

    // Authenticate the user (handles MFA if required)
    const authResult = await core.authenticateWithPasskey(user.id, credentialId, { deviceId })

    if (!authResult) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'AUTHENTICATION_FAILED',
            message: 'Authentication failed',
          },
        },
      }
    }

    // Handle different authentication result types (same as OAuth)
    if (authResult.type === 'mfa_required') {
      logger.info('Passkey login requires MFA verification', {
        userId: user.id,
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
      logger.info('Passkey login requires MFA setup', {
        userId: user.id,
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
    logger.info('User logged in with passkey', {
      userId: authResult.user.id,
      credentialId: credentialId.substring(0, 8),
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
  } catch (error) {
    logger.error('Passkey authentication failed', { error })
    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: error instanceof Error ? error.message : 'Passkey authentication failed',
        },
      },
    }
  }
}

// =============================================================================
// ROUTE HANDLERS - MANAGEMENT
// =============================================================================

/**
 * List user's passkey credentials
 * GET /auth/passkey/credentials
 *
 * Authentication required
 */
export async function listPasskeyCredentials(
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

    const user = await core.getUser(request.user.id)
    if (!user) {
      return {
        status: 404,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User not found',
          },
        },
      }
    }

    // Return credentials without the public key
    const credentials = (user.passkeys || []).map((p) => ({
      id: p.id,
      deviceType: p.deviceType,
      backedUp: p.backedUp,
      transports: p.transports,
      createdAt: p.createdAt,
      lastUsedAt: p.lastUsedAt,
      friendlyName: p.friendlyName,
    }))

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        data: {
          credentials,
        },
      },
    }
  } catch (error) {
    logger.error('Failed to list passkey credentials', { error })
    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list passkey credentials',
        },
      },
    }
  }
}

/**
 * Update a passkey credential (friendly name)
 * PATCH /auth/passkey/credentials/:credentialId
 *
 * Authentication required
 */
export async function updatePasskeyCredential(
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

    const credentialId = request.params?.credentialId
    if (!credentialId) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Credential ID is required',
          },
        },
      }
    }

    const body = request.body as PasskeyUpdateRequest
    if (!body?.friendlyName) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'friendlyName is required',
          },
        },
      }
    }

    try {
      await core.updateUserPasskey(request.user.id, credentialId, {
        friendlyName: body.friendlyName,
      })

      logger.info('Passkey credential updated', {
        userId: request.user.id,
        credentialId: credentialId.substring(0, 8),
      })

      return {
        status: 200,
        headers: {},
        body: {
          success: true,
          data: {
            message: 'Passkey updated successfully',
          },
        },
      }
    } catch (error) {
      if (error instanceof InvalidInputError) {
        return {
          status: 404,
          headers: {},
          body: {
            success: false,
            error: {
              code: 'CREDENTIAL_NOT_FOUND',
              message: error.message,
            },
          },
        }
      }
      throw error
    }
  } catch (error) {
    logger.error('Failed to update passkey credential', { error })
    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update passkey credential',
        },
      },
    }
  }
}

/**
 * Delete a passkey credential
 * DELETE /auth/passkey/credentials/:credentialId
 *
 * Authentication required
 */
export async function deletePasskeyCredential(
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

    const credentialId = request.params?.credentialId
    if (!credentialId) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Credential ID is required',
          },
        },
      }
    }

    try {
      await core.removePasskeyFromUser(request.user.id, credentialId)

      logger.info('Passkey credential deleted', {
        userId: request.user.id,
        credentialId: credentialId.substring(0, 8),
      })

      return {
        status: 200,
        headers: {},
        body: {
          success: true,
          data: {
            message: 'Passkey deleted successfully',
          },
        },
      }
    } catch (error) {
      if (error instanceof InvalidInputError) {
        return {
          status: 404,
          headers: {},
          body: {
            success: false,
            error: {
              code: 'CREDENTIAL_NOT_FOUND',
              message: error.message,
            },
          },
        }
      }
      throw error
    }
  } catch (error) {
    logger.error('Failed to delete passkey credential', { error })
    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete passkey credential',
        },
      },
    }
  }
}
