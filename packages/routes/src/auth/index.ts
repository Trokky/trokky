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

export {
  initGoogleOAuth,
  handleGoogleOAuthCallback,
  unlinkGoogleAccount,
  getOAuthStatus,
} from './oauth.js'

export {
  // MFA verification
  verifyMFA,
  verifyMFABackup,
  sendMFACode,
  // MFA setup - TOTP
  initTOTPSetup,
  verifyTOTPSetup,
  // MFA setup - Email OTP
  initEmailOTPSetup,
  verifyEmailOTPSetup,
  // MFA management
  disableMFA,
  regenerateBackupCodes,
  getMFAStatus,
  // Trusted devices
  getTrustedDevices,
  revokeTrustedDevice,
  revokeAllTrustedDevices,
  // Admin
  adminResetUserMFA,
  // Disable all MFA
  disableAllMFA,
} from './mfa.js'

export {
  getCaptchaStatus,
  validateCaptcha,
  getClientIp,
} from './captcha.js'
