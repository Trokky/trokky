/**
 * Change Password Routes
 *
 * API routes for authenticated users to change their own password.
 */

import type { HttpRequest, HttpResponse } from '../types.js'
import {
  TrokkyCore,
  SecurityValidator,
  InvalidInputError,
  createLogger,
} from '../../core/index.js'

const logger = createLogger('routes', 'ChangePassword')

// =============================================================================
// REQUEST TYPES
// =============================================================================

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

/**
 * POST /auth/change-password
 * Change the authenticated user's password
 */
export async function changePassword(
  req: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  try {
    // Require authentication
    if (!req.user) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'Authentication required to change password',
          },
        },
      }
    }

    const body = req.body as ChangePasswordRequest

    // Validate request
    if (!body.currentPassword) {
      throw new InvalidInputError('Current password is required', 'currentPassword')
    }

    if (!body.newPassword) {
      throw new InvalidInputError('New password is required', 'newPassword')
    }

    // Validate new password strength
    SecurityValidator.validatePassword(body.newPassword)

    // Get current user from database
    const user = await core.getUser(req.user.id)
    if (!user) {
      return {
        status: 401,
        headers: {},
        body: {
          success: false,
          error: {
            message: 'User not found',
          },
        },
      }
    }

    // Verify current password using core's crypto adapter for consistency
    const isValid = await core.verifyPassword(body.currentPassword, user.passwordHash)

    if (!isValid) {
      logger.warn('Password change failed: incorrect current password', {
        userId: user.id,
        username: user.username,
      })
      throw new InvalidInputError('Current password is incorrect', 'currentPassword')
    }

    // Hash new password using core's crypto adapter for consistency
    const hashedPassword = await core.hashPassword(body.newPassword)

    // Update user password
    await core.updateUser(user.id, {
      passwordHash: hashedPassword,
    })

    logger.info('Password changed successfully', {
      userId: user.id,
      username: user.username,
    })

    // Trigger password changed event (non-blocking, fire and forget)
    core.events.emitEvent({
      type: 'user.password_changed',
      source: 'api',
      data: {
        user,
        changedAt: new Date(),
        userId: user.id,
      },
    }).catch((error) => {
      logger.error('Failed to emit user.password_changed event', error)
    })

    return {
      status: 200,
      headers: {},
      body: {
        success: true,
        message: 'Password changed successfully',
      },
    }
  } catch (error) {
    logger.error('Failed to change password', error)

    if (error instanceof InvalidInputError) {
      return {
        status: 400,
        headers: {},
        body: {
          success: false,
          error: {
            message: error.message,
            field: (error as any).field,
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
          message: 'Failed to change password',
        },
      },
    }
  }
}
