/**
 * MFA (Multi-Factor Authentication) Services
 *
 * Provides TOTP and Email OTP authentication methods.
 */

export {
  TOTPService,
  createTOTPService,
  type TOTPConfig,
  type TOTPSecretResult,
  type BackupCodeVerificationResult,
} from './totp.js'

export {
  EmailOTPService,
  createEmailOTPService,
  getOTPEmailSubject,
  getOTPEmailBody,
  getOTPEmailHTML,
  type EmailOTPConfig,
  type EmailOTPResult,
  type StoredEmailOTP,
  type EmailOTPVerificationResult,
} from './email-otp.js'
