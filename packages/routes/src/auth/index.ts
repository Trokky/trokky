/**
 * Authentication Routes
 *
 * Export authentication-related route handlers
 */

export {
  requestPasswordReset,
  resetPassword,
  verifyResetToken,
} from './password-reset.js'

export { changePassword } from './change-password.js'
