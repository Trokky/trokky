import type { TrokkyLogger } from '../utils/logger.js'
import {
  createCaptchaProvider,
  type CaptchaProvider,
  type CaptchaProviderType,
  type CaptchaProtectedEndpoint,
  type CaptchaVerificationResult
} from '../security/captcha/index.js'
import { TrokkyConfig } from '../types/index.js'

export interface CaptchaServiceDependencies {
  config: TrokkyConfig
  logger: TrokkyLogger
}

/**
 * CAPTCHA provider configuration and token verification.
 */
export class CaptchaService {
  private captchaProvider: CaptchaProvider | null = null

  constructor(private readonly deps: CaptchaServiceDependencies) {}

  /**
   * Get or create the CAPTCHA provider instance
   */
  public getCaptchaProvider(): CaptchaProvider | null {
    if (this.captchaProvider) return this.captchaProvider

    const config = this.deps.config.captcha
    if (!config?.siteKey || !config?.secretKey) return null

    try {
      this.captchaProvider = createCaptchaProvider(config.provider, {
        siteKey: config.siteKey,
        secretKey: config.secretKey,
        options: config.options,
      })
      return this.captchaProvider
    } catch (error) {
      this.deps.logger.error('Failed to create CAPTCHA provider', error)
      return null
    }
  }

  /**
   * Check if CAPTCHA is configured
   */
  public isCaptchaConfigured(): boolean {
    const config = this.deps.config.captcha
    return !!(config?.siteKey && config?.secretKey && config?.provider)
  }

  /**
   * Check if CAPTCHA is required for a specific endpoint
   * @param endpoint - The endpoint to check ('login', 'passwordResetRequest', 'passwordResetVerify')
   */
  public isCaptchaRequiredFor(endpoint: CaptchaProtectedEndpoint): boolean {
    if (!this.isCaptchaConfigured()) return false
    const protectedEndpoints = this.deps.config.captcha?.protectedEndpoints
    // Default: all endpoints are protected if no specific config
    if (!protectedEndpoints) return true
    return protectedEndpoints[endpoint] ?? true
  }

  /**
   * Get CAPTCHA configuration for frontend use
   * Returns public config (site key, provider, options) - never the secret key
   */
  public getCaptchaConfig(): { provider: CaptchaProviderType; siteKey: string; options?: Record<string, unknown> } | null {
    if (!this.isCaptchaConfigured()) return null
    const config = this.deps.config.captcha!
    return {
      provider: config.provider,
      siteKey: config.siteKey,
      options: config.options,
    }
  }

  /**
   * Verify a CAPTCHA token
   * @param token - The CAPTCHA token from the frontend widget
   * @param remoteIp - Optional client IP address for verification
   */
  public async verifyCaptcha(token: string, remoteIp?: string): Promise<CaptchaVerificationResult> {
    const provider = this.getCaptchaProvider()
    if (!provider) {
      this.deps.logger.warn('CAPTCHA verification called but no provider configured')
      // Fail open if not configured - allows systems without CAPTCHA to work
      return { success: true }
    }
    return provider.verify(token, remoteIp)
  }
}
