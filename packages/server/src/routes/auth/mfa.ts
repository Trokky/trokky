/**
 * MFA (Multi-Factor Authentication) Routes
 *
 * API routes for MFA setup, verification, and management.
 */

import type { HttpRequest, HttpResponse } from '../types.js'
import {
  TrokkyCore,
  InvalidInputError,
  createLogger,
  type MFAMethodType,
} from '../../core/index.js'

const logger = createLogger('routes', 'MFA')

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get user ID from either the setup token header or authenticated user.
 * Used for MFA setup routes that need to work during the login flow.
 */
async function getUserIdFromSetupTokenOrAuth(
  req: HttpRequest,
  core: TrokkyCore
): Promise<{ userId: string; fromSetupToken: boolean } | null> {
  // First check for setup token in header
  const setupTokenHeader = req.headers['x-mfa-setup-token']
  const setupToken = Array.isArray(setupTokenHeader) ? setupTokenHeader[0] : setupTokenHeader
  if (setupToken) {
    const payload = await core.verifyMFAToken(setupToken)
    if (payload && payload.type === 'mfa_setup' && payload.userId) {
      return { userId: payload.userId, fromSetupToken: true }
    }
    return null // Invalid setup token
  }

  // Fall back to authenticated user
  if (req.user?.id) {
    return { userId: req.user.id, fromSetupToken: false }
  }

  return null
}

// =============================================================================
// REQUEST TYPES
// =============================================================================

export interface MFAVerifyRequest {
  mfaToken: string
  code: string
  method: MFAMethodType
  trustDevice?: boolean
  deviceId?: string
  deviceName?: string
  rememberMe?: boolean
}

export interface MFASetupInitRequest {
  method: MFAMethodType
}

export interface MFAVerifySetupRequest {
  code: string
}

export interface MFADisableRequest {
  method: MFAMethodType
  password: string
}

export interface MFABackupVerifyRequest {
  mfaToken: string
  code: string
  trustDevice?: boolean
  deviceId?: string
  deviceName?: string
  rememberMe?: boolean
}

export interface TrustedDeviceRevokeRequest {
  deviceId: string
}

export interface AdminMFAResetRequest {
  userId: string
  reason?: string
}

// =============================================================================
// ROUTE HANDLERS - MFA VERIFICATION
// =============================================================================

/**
 * POST /auth/mfa/verify
 * Verify MFA code after login (using mfaToken)
 */
export async function verifyMFA(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    const body = req.body as MFAVerifyRequest

    if (!body.mfaToken) {
      throw new InvalidInputError('MFA token is required', 'mfaToken')
    }

    if (!body.code) {
      throw new InvalidInputError('Verification code is required', 'code')
    }

    if (!body.method) {
      throw new InvalidInputError('MFA method is required', 'method')
    }

    // Verify the MFA token first to get user info
    const tokenPayload = await core.verifyMFAToken(body.mfaToken)
    if (!tokenPayload || tokenPayload.type !== 'mfa_pending') {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Invalid or expired MFA token',
          },
        },
      }
    }

    // Verify the MFA code
    const isValid = await core.verifyMFACode(
      tokenPayload.userId,
      body.code,
      body.method
    )

    if (!isValid) {
      logger.warn('MFA verification failed', {
        userId: tokenPayload.userId,
        method: body.method,
      })
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Invalid verification code',
          },
        },
      }
    }

    // Complete MFA authentication and issue full tokens
    const result = await core.completeMFAAuthentication(body.mfaToken, {
      rememberMe: body.rememberMe,
      trustDevice: body.trustDevice,
      deviceId: body.deviceId,
      deviceName: body.deviceName,
    })

    if (!result) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Failed to complete authentication',
          },
        },
      }
    }

    logger.info('MFA verification successful', {
      userId: tokenPayload.userId,
      method: body.method,
      deviceTrusted: body.trustDevice,
    })

    // Return without password hash
    const { passwordHash, ...safeUser } = result.user

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        token: result.token,
        refreshToken: result.refreshToken,
        user: safeUser,
      },
    }
  } catch (error) {
    logger.error('MFA verification error', error)

    if (error instanceof InvalidInputError) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
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
          message: 'Failed to verify MFA code',
        },
      },
    }
  }
}

/**
 * POST /auth/mfa/verify-backup
 * Verify using backup code
 */
export async function verifyMFABackup(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    const body = req.body as MFABackupVerifyRequest

    if (!body.mfaToken) {
      throw new InvalidInputError('MFA token is required', 'mfaToken')
    }

    if (!body.code) {
      throw new InvalidInputError('Backup code is required', 'code')
    }

    // Verify the MFA token first
    const tokenPayload = await core.verifyMFAToken(body.mfaToken)
    if (!tokenPayload || tokenPayload.type !== 'mfa_pending') {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Invalid or expired MFA token',
          },
        },
      }
    }

    // Verify backup code
    const result = await core.verifyBackupCode(tokenPayload.userId, body.code)

    if (!result.valid) {
      logger.warn('Backup code verification failed', {
        userId: tokenPayload.userId,
      })
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Invalid backup code',
          },
        },
      }
    }

    // Complete authentication
    const authResult = await core.completeMFAAuthentication(body.mfaToken, {
      rememberMe: body.rememberMe,
      trustDevice: body.trustDevice,
      deviceId: body.deviceId,
      deviceName: body.deviceName,
    })

    if (!authResult) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Failed to complete authentication',
          },
        },
      }
    }

    logger.info('Backup code verification successful', {
      userId: tokenPayload.userId,
      remainingCodes: result.remainingCodes.length,
    })

    const { passwordHash, ...safeUser } = authResult.user

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        token: authResult.token,
        refreshToken: authResult.refreshToken,
        user: safeUser,
        warning:
          result.remainingCodes.length < 3
            ? `Only ${result.remainingCodes.length} backup codes remaining. Consider regenerating.`
            : undefined,
      },
    }
  } catch (error) {
    logger.error('Backup code verification error', error)

    if (error instanceof InvalidInputError) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
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
          message: 'Failed to verify backup code',
        },
      },
    }
  }
}

// =============================================================================
// ROUTE HANDLERS - MFA SETUP (TOTP)
// =============================================================================

/**
 * POST /auth/mfa/setup/totp
 * Initialize TOTP setup (get QR code)
 * Accepts either normal auth or X-MFA-Setup-Token header for login flow
 */
export async function initTOTPSetup(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    // Get user ID from setup token or authenticated user
    const userInfo = await getUserIdFromSetupTokenOrAuth(req, core)
    if (!userInfo) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Authentication required (provide auth token or X-MFA-Setup-Token header)',
          },
        },
      }
    }

    const result = await core.initializeTOTPSetup(userInfo.userId)

    if (!result) {
      return {
        status: 500,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Failed to initialize TOTP setup',
          },
        },
      }
    }

    logger.info('TOTP setup initialized', { userId: userInfo.userId, fromSetupToken: userInfo.fromSetupToken })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        data: {
          qrCode: result.qrCodeDataUrl,
          manualEntryKey: result.manualEntryKey,
          uri: result.uri,
        },
      },
    }
  } catch (error) {
    logger.error('TOTP setup initialization error', error)

    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          message: 'Failed to initialize TOTP setup',
        },
      },
    }
  }
}

/**
 * POST /auth/mfa/setup/totp/verify
 * Verify TOTP code and enable
 * Accepts either normal auth or X-MFA-Setup-Token header for login flow
 */
export async function verifyTOTPSetup(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    // Get user ID from setup token or authenticated user
    const userInfo = await getUserIdFromSetupTokenOrAuth(req, core)
    if (!userInfo) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Authentication required (provide auth token or X-MFA-Setup-Token header)',
          },
        },
      }
    }

    const body = req.body as MFAVerifySetupRequest

    if (!body.code) {
      throw new InvalidInputError('Verification code is required', 'code')
    }

    const result = await core.verifyAndEnableTOTP(userInfo.userId, body.code)

    if (!result.enabled) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Invalid verification code',
          },
        },
      }
    }

    logger.info('TOTP enabled', { userId: userInfo.userId, fromSetupToken: userInfo.fromSetupToken })

    // If this was from a setup token (during login flow), issue full auth tokens
    if (userInfo.fromSetupToken) {
      const setupTokenHeader = req.headers['x-mfa-setup-token']
      const setupToken = Array.isArray(setupTokenHeader) ? setupTokenHeader[0] : setupTokenHeader
      const authResult = await core.completeMFASetupAndLogin(setupToken!)

      if (authResult) {
        const { passwordHash, ...safeUser } = authResult.user
        return {
          status: 200,
          headers: {},
          body: {
            success: true,
            message: 'TOTP authentication enabled',
            backupCodes: result.backupCodes,
            token: authResult.token,
            refreshToken: authResult.refreshToken,
            user: safeUser,
            expiresAt: authResult.expiresAt,
          },
        }
      }
    }

    // Normal flow (user already authenticated)
    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        message: 'TOTP authentication enabled',
        backupCodes: result.backupCodes,
      },
    }
  } catch (error) {
    logger.error('TOTP verification error', error)

    if (error instanceof InvalidInputError) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
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
          message: 'Failed to verify TOTP setup',
        },
      },
    }
  }
}

// =============================================================================
// ROUTE HANDLERS - MFA SETUP (EMAIL OTP)
// =============================================================================

/**
 * POST /auth/mfa/setup/email
 * Initialize Email OTP setup (sends verification code)
 * Accepts either normal auth or X-MFA-Setup-Token header for login flow
 */
export async function initEmailOTPSetup(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    // Get user ID from setup token or authenticated user
    const userInfo = await getUserIdFromSetupTokenOrAuth(req, core)
    if (!userInfo) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Authentication required (provide auth token or X-MFA-Setup-Token header)',
          },
        },
      }
    }

    const result = await core.initializeEmailOTPSetup(userInfo.userId)

    if (!result) {
      return {
        status: 500,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Failed to initialize Email OTP setup',
          },
        },
      }
    }

    logger.info('Email OTP setup initialized', { userId: userInfo.userId, fromSetupToken: userInfo.fromSetupToken })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        message: 'Verification code sent to your email',
        expiresIn: result.expiresIn,
      },
    }
  } catch (error) {
    logger.error('Email OTP setup initialization error', error)

    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          message: 'Failed to initialize Email OTP setup',
        },
      },
    }
  }
}

/**
 * POST /auth/mfa/setup/email/verify
 * Verify Email OTP code and enable
 * Accepts either normal auth or X-MFA-Setup-Token header for login flow
 */
export async function verifyEmailOTPSetup(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    // Get user ID from setup token or authenticated user
    const userInfo = await getUserIdFromSetupTokenOrAuth(req, core)
    if (!userInfo) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Authentication required (provide auth token or X-MFA-Setup-Token header)',
          },
        },
      }
    }

    const body = req.body as MFAVerifySetupRequest

    if (!body.code) {
      throw new InvalidInputError('Verification code is required', 'code')
    }

    const result = await core.verifyAndEnableEmailOTP(userInfo.userId, body.code)

    if (!result.enabled) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Failed to enable Email OTP',
          },
        },
      }
    }

    logger.info('Email OTP enabled', { userId: userInfo.userId, fromSetupToken: userInfo.fromSetupToken })

    // If this was from a setup token (during login flow), issue full auth tokens
    if (userInfo.fromSetupToken) {
      const setupTokenHeader = req.headers['x-mfa-setup-token']
      const setupToken = Array.isArray(setupTokenHeader) ? setupTokenHeader[0] : setupTokenHeader
      const authResult = await core.completeMFASetupAndLogin(setupToken!)

      if (authResult) {
        const { passwordHash, ...safeUser } = authResult.user
        return {
          status: 200,
          headers: {},
          body: {
            success: true,
            message: 'Email OTP authentication enabled',
            backupCodes: result.backupCodes,
            token: authResult.token,
            refreshToken: authResult.refreshToken,
            user: safeUser,
            expiresAt: authResult.expiresAt,
          },
        }
      }
    }

    // Normal flow (user already authenticated)
    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        message: 'Email OTP authentication enabled',
        // Only return backup codes if they were newly generated
        backupCodes: result.backupCodes,
      },
    }
  } catch (error) {
    logger.error('Email OTP verification error', error)

    if (error instanceof InvalidInputError) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
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
          message: 'Failed to verify Email OTP setup',
        },
      },
    }
  }
}

// =============================================================================
// ROUTE HANDLERS - MFA MANAGEMENT
// =============================================================================

/**
 * POST /auth/mfa/disable
 * Disable an MFA method
 */
export async function disableMFA(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    if (!req.user) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Authentication required',
          },
        },
      }
    }

    const body = req.body as MFADisableRequest

    if (!body.method) {
      throw new InvalidInputError('MFA method is required', 'method')
    }

    if (!body.password) {
      throw new InvalidInputError('Password is required to disable MFA', 'password')
    }

    // disableMFAMethod handles password verification and org policy validation internally
    await core.disableMFAMethod(req.user.id, body.method, body.password)

    logger.info('MFA method disabled', {
      userId: req.user.id,
      method: body.method,
    })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        message: `${body.method.toUpperCase()} authentication disabled`,
      },
    }
  } catch (error) {
    logger.error('MFA disable error', error)

    if (error instanceof InvalidInputError) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
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
          message: 'Failed to disable MFA',
        },
      },
    }
  }
}

/**
 * POST /auth/mfa/disable-all
 * Disable all MFA for user (removes all methods and backup codes)
 */
export async function disableAllMFA(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    if (!req.user) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Authentication required',
          },
        },
      }
    }

    const body = req.body as { password?: string }

    if (!body.password) {
      throw new InvalidInputError('Password is required to disable MFA', 'password')
    }

    await core.disableAllMFA(req.user.id, body.password)

    logger.info('All MFA disabled', { userId: req.user.id })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        message: 'All MFA has been disabled',
      },
    }
  } catch (error) {
    logger.error('Disable all MFA error', error)

    if (error instanceof InvalidInputError) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
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
          message: 'Failed to disable MFA',
        },
      },
    }
  }
}

/**
 * POST /auth/mfa/backup-codes/regenerate
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    if (!req.user) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Authentication required',
          },
        },
      }
    }

    const body = req.body as { password: string }

    if (!body.password) {
      throw new InvalidInputError('Password is required', 'password')
    }

    // Engine method handles password verification internally
    const backupCodes = await core.regenerateBackupCodes(req.user.id, body.password)

    if (!backupCodes || backupCodes.length === 0) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Failed to regenerate backup codes. Ensure MFA is enabled.',
          },
        },
      }
    }

    logger.info('Backup codes regenerated', { userId: req.user.id })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        backupCodes,
        message: 'Backup codes regenerated. Previous codes are now invalid.',
      },
    }
  } catch (error) {
    logger.error('Backup code regeneration error', error)

    if (error instanceof InvalidInputError) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
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
          message: 'Failed to regenerate backup codes',
        },
      },
    }
  }
}

/**
 * GET /auth/mfa/status
 * Get user's MFA status
 */
export async function getMFAStatus(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    if (!req.user) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Authentication required',
          },
        },
      }
    }

    const status = await core.getMFAStatus(req.user.id)

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        data: status,
      },
    }
  } catch (error) {
    logger.error('MFA status error', error)

    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          message: 'Failed to get MFA status',
        },
      },
    }
  }
}

// =============================================================================
// ROUTE HANDLERS - TRUSTED DEVICES
// =============================================================================

/**
 * GET /auth/mfa/trusted-devices
 * List user's trusted devices
 */
export async function getTrustedDevices(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    if (!req.user) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Authentication required',
          },
        },
      }
    }

    const devices = await core.getTrustedDevices(req.user.id)

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        data: {
          devices,
        },
      },
    }
  } catch (error) {
    logger.error('Get trusted devices error', error)

    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          message: 'Failed to get trusted devices',
        },
      },
    }
  }
}

/**
 * DELETE /auth/mfa/trusted-devices/:deviceId
 * Revoke a trusted device
 */
export async function revokeTrustedDevice(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    if (!req.user) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Authentication required',
          },
        },
      }
    }

    const deviceId = req.params.deviceId

    if (!deviceId) {
      throw new InvalidInputError('Device ID is required', 'deviceId')
    }

    // Method throws if user not found
    await core.revokeTrustedDevice(req.user.id, deviceId)

    logger.info('Trusted device revoked', {
      userId: req.user.id,
      deviceId,
    })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        message: 'Device trust revoked',
      },
    }
  } catch (error) {
    logger.error('Revoke trusted device error', error)

    if (error instanceof InvalidInputError) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
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
          message: 'Failed to revoke device trust',
        },
      },
    }
  }
}

/**
 * DELETE /auth/mfa/trusted-devices
 * Revoke all trusted devices
 */
export async function revokeAllTrustedDevices(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    if (!req.user) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Authentication required',
          },
        },
      }
    }

    await core.revokeAllTrustedDevices(req.user.id)

    logger.info('All trusted devices revoked', { userId: req.user.id })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        message: 'All device trusts revoked',
      },
    }
  } catch (error) {
    logger.error('Revoke all trusted devices error', error)

    return {
      status: 500,
      headers: {},
      body: {
        success: false,
        error: {
          message: 'Failed to revoke all device trusts',
        },
      },
    }
  }
}

// =============================================================================
// ROUTE HANDLERS - ADMIN MFA MANAGEMENT
// =============================================================================

/**
 * POST /admin/users/:userId/mfa/reset
 * Admin: Reset a user's MFA configuration
 */
export async function adminResetUserMFA(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    if (!req.user) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Authentication required',
          },
        },
      }
    }

    // Check admin permission
    if (req.user.role !== 'admin') {
      return {
        status: 403,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Admin permission required',
          },
        },
      }
    }

    const userId = req.params.userId
    const body = req.body as { reason?: string }

    if (!userId) {
      throw new InvalidInputError('User ID is required', 'userId')
    }

    // Prevent admin from resetting their own MFA via this endpoint
    if (userId === req.user.id) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Cannot reset your own MFA via admin endpoint. Use the regular MFA settings.',
          },
        },
      }
    }

    // Engine method takes (adminUserId, targetUserId)
    await core.adminResetUserMFA(req.user.id, userId)

    logger.info('Admin reset user MFA', {
      targetUserId: userId,
      adminId: req.user.id,
      reason: body.reason,
    })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        message: 'User MFA configuration has been reset',
      },
    }
  } catch (error) {
    logger.error('Admin MFA reset error', error)

    if (error instanceof InvalidInputError) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
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
          message: 'Failed to reset user MFA',
        },
      },
    }
  }
}

/**
 * POST /auth/mfa/send-code
 * Send MFA code via email (for email OTP method during login)
 */
export async function sendMFACode(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    const body = req.body as { mfaToken: string }

    if (!body.mfaToken) {
      throw new InvalidInputError('MFA token is required', 'mfaToken')
    }

    // Verify the MFA token
    const tokenPayload = await core.verifyMFAToken(body.mfaToken)
    if (!tokenPayload || tokenPayload.type !== 'mfa_pending') {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Invalid or expired MFA token',
          },
        },
      }
    }

    // Send OTP email
    const result = await core.sendMFAEmailOTP(tokenPayload.userId)

    if (!result) {
      return {
        status: 500,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Failed to send verification code',
          },
        },
      }
    }

    logger.info('MFA email code sent', { userId: tokenPayload.userId })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        message: 'Verification code sent to your email',
        expiresIn: result.expiresIn,
      },
    }
  } catch (error) {
    logger.error('Send MFA code error', error)

    if (error instanceof InvalidInputError) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
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
          message: 'Failed to send verification code',
        },
      },
    }
  }
}
