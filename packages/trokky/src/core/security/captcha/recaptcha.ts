/**
 * Google reCAPTCHA v2 Service
 *
 * Implements the CaptchaProvider interface for Google reCAPTCHA v2.
 * https://developers.google.com/recaptcha/docs/display
 */

import { createLogger } from '../../utils/logger.js'
import type { CaptchaProvider, CaptchaProviderConfig, CaptchaVerificationResult } from './types.js'

const logger = createLogger('security', 'reCAPTCHA')
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify'

/**
 * reCAPTCHA-specific configuration
 */
export interface RecaptchaConfig extends CaptchaProviderConfig {
  options?: {
    theme?: 'light' | 'dark'
    size?: 'normal' | 'compact'
  }
}

/**
 * reCAPTCHA API response shape
 */
interface RecaptchaResponse {
  success: boolean
  challenge_ts?: string
  hostname?: string
  'error-codes'?: string[]
}

/**
 * Google reCAPTCHA v2 Service
 */
export class RecaptchaService implements CaptchaProvider {
  readonly name = 'recaptcha' as const
  private config: RecaptchaConfig

  constructor(config: RecaptchaConfig) {
    this.config = config
    logger.debug('RecaptchaService initialized', { siteKey: config.siteKey })
  }

  /**
   * Verify a reCAPTCHA token with Google's API
   */
  async verify(token: string, remoteIp?: string): Promise<CaptchaVerificationResult> {
    logger.debug('Verifying reCAPTCHA token')

    const formData = new URLSearchParams({
      secret: this.config.secretKey,
      response: token,
    })

    if (remoteIp) {
      formData.append('remoteip', remoteIp)
    }

    try {
      const response = await fetch(RECAPTCHA_VERIFY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      })

      if (!response.ok) {
        logger.error('reCAPTCHA verification request failed', { status: response.status })
        return {
          success: false,
          errorCodes: ['network-error'],
        }
      }

      const data = (await response.json()) as RecaptchaResponse

      const result: CaptchaVerificationResult = {
        success: data.success,
        challengeTimestamp: data.challenge_ts,
        hostname: data.hostname,
        errorCodes: data['error-codes'],
      }

      if (data.success) {
        logger.debug('reCAPTCHA verification successful', { hostname: data.hostname })
      } else {
        logger.warn('reCAPTCHA verification failed', { errorCodes: data['error-codes'] })
      }

      return result
    } catch (error) {
      logger.error('reCAPTCHA verification error', error)
      return {
        success: false,
        errorCodes: ['internal-error'],
      }
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return !!(this.config.siteKey && this.config.secretKey)
  }

  /**
   * Get the public site key
   */
  getSiteKey(): string {
    return this.config.siteKey
  }
}

/**
 * Factory function to create a RecaptchaService
 */
export function createRecaptchaService(config: RecaptchaConfig): RecaptchaService {
  return new RecaptchaService(config)
}
