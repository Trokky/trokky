/**
 * Password Reset Routes
 *
 * API routes for password reset functionality with email notifications.
 */

import type { HttpRequest, HttpResponse } from '../types.js'
import {
  TrokkyCore,
  SecurityValidator,
  InvalidInputError,
  createLogger,
  type PasswordResetRequest,
  type PasswordResetVerification,
  type PasswordResetToken,
} from '@trokky/core'
import { generateRandomHex, getUniversalCrypto } from '@trokky/core'

const logger = createLogger('routes', 'PasswordReset')

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate a secure password reset token
 */
function generateResetToken(): string {
  return generateRandomHex(32) // 32 bytes = 64 character hex string
}

/**
 * Hash a reset token for storage
 */
async function hashResetToken(token: string): Promise<string> {
  const crypto = getUniversalCrypto()
  const encoder = new TextEncoder()
  const data = encoder.encode(token)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * POST /auth/request-reset
 * Request a password reset email
 */
export async function requestPasswordReset(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    const body = req.body as PasswordResetRequest

    // Validate request
    if (!body.email) {
      throw new InvalidInputError('Email is required', 'email')
    }

    SecurityValidator.validateEmail(body.email)

    logger.info('Password reset requested', { email: body.email })

    // Find user by email
    const user = await core.storage.data.getUserByEmail(body.email)

    // SECURITY: Don't reveal if user exists or not
    // Always return success to prevent email enumeration
    if (!user) {
      logger.debug('Password reset requested for non-existent user', {
        email: body.email,
      })
      return {
        status: 200,
        body: {
          success: true,
          message: 'If the email exists, a reset link has been sent',
        },
      }
    }

    // Check if user is active
    if (!user.isActive) {
      logger.warn('Password reset requested for inactive user', {
        userId: user.id,
        email: body.email,
      })
      return {
        status: 200,
        body: {
          success: true,
          message: 'If the email exists, a reset link has been sent',
        },
      }
    }

    // Generate reset token
    const plainToken = generateResetToken()
    const hashedToken = await hashResetToken(plainToken)

    // Store reset token in user preferences
    const expiresAt = Date.now() + 60 * 60 * 1000 // 1 hour from now

    const resetData: PasswordResetToken = {
      token: hashedToken,
      expiresAt,
      createdAt: Date.now(),
      ipAddress: body.ipAddress,
    }

    await core.storage.data.saveUser(user.id, {
      preferences: {
        ...user.preferences,
        passwordReset: resetData,
      },
    })

    // Emit event for email notification
    await core.events.emit({
      id: `password-reset-${Date.now()}`,
      type: 'user.password_reset_requested',
      timestamp: new Date(),
      source: 'api',
      data: {
        user,
        resetToken: plainToken, // Send plain token for email link
        userId: user.id,
      },
    })

    logger.info('Password reset token generated', {
      userId: user.id,
      expiresAt: new Date(expiresAt),
    })

    return {
      status: 200,
      body: {
        success: true,
        message: 'If the email exists, a reset link has been sent',
      },
    }
  } catch (error) {
    logger.error('Failed to process password reset request', error)

    if (error instanceof InvalidInputError) {
      return {
        status: 400,
        body: {
          success: false,
          error: error.message,
        },
      }
    }

    return {
      status: 500,
      body: {
        success: false,
        error: 'Failed to process password reset request',
      },
    }
  }
}

/**
 * POST /auth/reset-password
 * Reset password using token
 */
export async function resetPassword(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    const body = req.body as PasswordResetVerification

    // Validate request
    if (!body.token) {
      throw new InvalidInputError('Reset token is required', 'token')
    }

    if (!body.newPassword) {
      throw new InvalidInputError('New password is required', 'newPassword')
    }

    // Validate password strength (minimum 8 characters)
    if (body.newPassword.length < 8) {
      throw new InvalidInputError(
        'Password must be at least 8 characters long',
        'newPassword'
      )
    }

    logger.info('Password reset attempt', { token: body.token.substring(0, 8) + '...' })

    // Hash the provided token to compare with stored hash
    const hashedToken = await hashResetToken(body.token)

    // Find user with this reset token
    const users = await core.storage.data.listUsers()
    const user = users.find((u) => {
      const resetData = u.preferences?.passwordReset as PasswordResetToken | undefined
      return (
        resetData &&
        resetData.token === hashedToken &&
        resetData.expiresAt > Date.now()
      )
    })

    if (!user) {
      logger.warn('Invalid or expired reset token used')
      return {
        status: 400,
        body: {
          success: false,
          error: 'Invalid or expired reset token',
        },
      }
    }

    // Hash the new password
    const crypto = await import('@trokky/core')
    const cryptoAdapter = crypto.detectCryptoAdapter({
      jwtSecret: 'temp', // Not used for hashing
      jwtExpiresIn: '1h',
      bcryptRounds: 10,
    })
    const passwordHash = await cryptoAdapter.hashPassword(body.newPassword)

    // Update user password and clear reset token
    await core.storage.data.saveUser(user.id, {
      passwordHash,
      preferences: {
        ...user.preferences,
        passwordReset: undefined, // Clear reset token
      },
    })

    // Emit event for password changed notification
    await core.events.emit({
      id: `password-changed-${Date.now()}`,
      type: 'user.password_changed',
      timestamp: new Date(),
      source: 'api',
      data: {
        user,
        userId: user.id,
      },
    })

    logger.info('Password reset successful', { userId: user.id })

    return {
      status: 200,
      body: {
        success: true,
        message: 'Password has been reset successfully',
      },
    }
  } catch (error) {
    logger.error('Failed to reset password', error)

    if (error instanceof InvalidInputError) {
      return {
        status: 400,
        body: {
          success: false,
          error: error.message,
        },
      }
    }

    return {
      status: 500,
      body: {
        success: false,
        error: 'Failed to reset password',
      },
    }
  }
}

/**
 * POST /auth/verify-reset-token
 * Verify if a reset token is valid (for frontend validation)
 */
export async function verifyResetToken(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    const body = req.body as { token: string }

    if (!body.token) {
      throw new InvalidInputError('Reset token is required', 'token')
    }

    // Hash the provided token
    const hashedToken = await hashResetToken(body.token)

    // Find user with this reset token
    const users = await core.storage.data.listUsers()
    const user = users.find((u) => {
      const resetData = u.preferences?.passwordReset as PasswordResetToken | undefined
      return (
        resetData &&
        resetData.token === hashedToken &&
        resetData.expiresAt > Date.now()
      )
    })

    if (!user) {
      return {
        status: 200,
        body: {
          valid: false,
          message: 'Invalid or expired reset token',
        },
      }
    }

    const resetData = user.preferences?.passwordReset as PasswordResetToken
    const expiresIn = Math.floor((resetData.expiresAt - Date.now()) / 1000 / 60) // minutes

    return {
      status: 200,
      body: {
        valid: true,
        expiresIn,
        message: 'Reset token is valid',
      },
    }
  } catch (error) {
    logger.error('Failed to verify reset token', error)

    return {
      status: 500,
      body: {
        valid: false,
        error: 'Failed to verify reset token',
      },
    }
  }
}
