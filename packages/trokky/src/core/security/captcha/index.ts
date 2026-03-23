/**
 * CAPTCHA Services
 *
 * Provides CAPTCHA verification with multiple provider support.
 * Currently supports Cloudflare Turnstile, with extensible architecture
 * for hCaptcha and reCAPTCHA.
 */

// Export types
export type {
  CaptchaProvider,
  CaptchaProviderConfig,
  CaptchaProviderType,
  CaptchaProtectedEndpoint,
  CaptchaVerificationResult,
} from './types.js'

// Export Turnstile service
export {
  TurnstileService,
  createTurnstileService,
  type TurnstileConfig,
} from './turnstile.js'

// Export reCAPTCHA service
export {
  RecaptchaService,
  createRecaptchaService,
  type RecaptchaConfig,
} from './recaptcha.js'

// Re-import for factory function
import type { CaptchaProvider, CaptchaProviderConfig, CaptchaProviderType } from './types.js'
import { TurnstileService } from './turnstile.js'
import { RecaptchaService } from './recaptcha.js'

/**
 * Factory function to create a CAPTCHA provider
 *
 * @param provider - The provider type ('turnstile', 'hcaptcha', 'recaptcha')
 * @param config - Provider configuration including keys
 * @returns A configured CaptchaProvider instance
 * @throws Error if provider is not implemented
 */
export function createCaptchaProvider(
  provider: CaptchaProviderType,
  config: CaptchaProviderConfig
): CaptchaProvider {
  switch (provider) {
    case 'turnstile':
      return new TurnstileService(config)

    case 'hcaptcha':
      throw new Error('hCaptcha provider not yet implemented. Coming soon!')

    case 'recaptcha':
      return new RecaptchaService(config)

    default:
      throw new Error(`Unknown CAPTCHA provider: ${provider}`)
  }
}
