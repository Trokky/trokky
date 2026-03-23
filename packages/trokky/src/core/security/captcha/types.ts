/**
 * CAPTCHA Provider Types
 *
 * Defines the interface for CAPTCHA providers (Turnstile, hCaptcha, reCAPTCHA).
 */

/**
 * Result of CAPTCHA verification
 */
export interface CaptchaVerificationResult {
  /** Whether the CAPTCHA was successfully verified */
  success: boolean
  /** ISO timestamp of when the challenge was solved */
  challengeTimestamp?: string
  /** Hostname where the challenge was served */
  hostname?: string
  /** Error codes if verification failed */
  errorCodes?: string[]
  /** Action name (reCAPTCHA v3) */
  action?: string
  /** Bot score from 0.0 to 1.0 (reCAPTCHA v3) */
  score?: number
}

/**
 * Configuration for a CAPTCHA provider
 */
export interface CaptchaProviderConfig {
  /** Public site key for frontend widget */
  siteKey: string
  /** Secret key for backend verification */
  secretKey: string
  /** Provider-specific options */
  options?: Record<string, unknown>
}

/**
 * Supported CAPTCHA provider types
 */
export type CaptchaProviderType = 'turnstile' | 'hcaptcha' | 'recaptcha'

/**
 * Protected endpoint types
 */
export type CaptchaProtectedEndpoint = 'login' | 'passwordResetRequest' | 'passwordResetVerify'

/**
 * CAPTCHA Provider Interface
 *
 * All CAPTCHA providers must implement this interface.
 */
export interface CaptchaProvider {
  /** Provider name identifier */
  readonly name: CaptchaProviderType

  /**
   * Verify a CAPTCHA token
   * @param token - The token from the frontend widget
   * @param remoteIp - Optional client IP address for verification
   * @returns Verification result
   */
  verify(token: string, remoteIp?: string): Promise<CaptchaVerificationResult>

  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean

  /**
   * Get the public site key for frontend use
   */
  getSiteKey(): string
}
