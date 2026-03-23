/**
 * Cloudflare Turnstile CAPTCHA Service
 *
 * Implements the CaptchaProvider interface for Cloudflare Turnstile.
 * https://developers.cloudflare.com/turnstile/
 */

import { createLogger } from '../../utils/logger.js'
import type { CaptchaProvider, CaptchaProviderConfig, CaptchaVerificationResult } from './types.js'

const logger = createLogger('security', 'Turnstile')
const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Turnstile-specific configuration
 */
export interface TurnstileConfig extends CaptchaProviderConfig {
  options?: {
    theme?: 'light' | 'dark' | 'auto'
    size?: 'normal' | 'compact' | 'invisible'
  }
}

/**
 * Turnstile API response shape
 */
interface TurnstileResponse {
  success: boolean
  challenge_ts?: string
  hostname?: string
  'error-codes'?: string[]
  action?: string
  cdata?: string
}

/**
 * Cloudflare Turnstile Service
 */
export class TurnstileService implements CaptchaProvider {
  readonly name = 'turnstile' as const
  private config: TurnstileConfig

  constructor(config: TurnstileConfig) {
    this.config = config
    logger.debug('TurnstileService initialized', { siteKey: config.siteKey })
  }

  /**
   * Verify a Turnstile token with Cloudflare's API
   */
  async verify(token: string, remoteIp?: string): Promise<CaptchaVerificationResult> {
    logger.debug('Verifying Turnstile token')

    const formData = new URLSearchParams({
      secret: this.config.secretKey,
      response: token,
    })

    if (remoteIp) {
      formData.append('remoteip', remoteIp)
    }

    try {
      const response = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      })

      if (!response.ok) {
        logger.error('Turnstile verification request failed', { status: response.status })
        return {
          success: false,
          errorCodes: ['network-error'],
        }
      }

      const data = (await response.json()) as TurnstileResponse

      const result: CaptchaVerificationResult = {
        success: data.success,
        challengeTimestamp: data.challenge_ts,
        hostname: data.hostname,
        errorCodes: data['error-codes'],
        action: data.action,
      }

      if (data.success) {
        logger.debug('Turnstile verification successful', { hostname: data.hostname })
      } else {
        logger.warn('Turnstile verification failed', { errorCodes: data['error-codes'] })
      }

      return result
    } catch (error) {
      logger.error('Turnstile verification error', error)
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
 * Factory function to create a TurnstileService
 */
export function createTurnstileService(config: TurnstileConfig): TurnstileService {
  return new TurnstileService(config)
}
