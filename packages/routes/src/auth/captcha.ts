/**
 * CAPTCHA Routes
 *
 * API routes for CAPTCHA status and validation helpers.
 */

import type { HttpRequest, HttpResponse } from '../types.js'
import {
  TrokkyCore,
  InvalidInputError,
  createLogger,
  type CaptchaProtectedEndpoint,
} from '@trokky/core'

const logger = createLogger('routes', 'Captcha')

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

/**
 * Get CAPTCHA status and configuration
 * GET /auth/captcha/status
 *
 * Public endpoint - returns CAPTCHA configuration for frontend
 */
export async function getCaptchaStatus(
  _request: HttpRequest,
  core: TrokkyCore
): Promise<HttpResponse> {
  const config = core.getCaptchaConfig()

  return {
    status: 200,
    headers: {},
    body: {
      success: true,
      data: {
        enabled: core.isCaptchaConfigured(),
        config: config
          ? {
              provider: config.provider,
              siteKey: config.siteKey,
              options: config.options,
            }
          : null,
        protectedEndpoints: {
          login: core.isCaptchaRequiredFor('login'),
          passwordResetRequest: core.isCaptchaRequiredFor('passwordResetRequest'),
          passwordResetVerify: core.isCaptchaRequiredFor('passwordResetVerify'),
        },
      },
    },
  }
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Extract client IP from request headers
 * Handles common proxy headers
 */
export function getClientIp(request: HttpRequest): string | undefined {
  // Check X-Forwarded-For header (most common proxy header)
  const forwardedFor = request.headers['x-forwarded-for']
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
    return ips.split(',')[0].trim()
  }

  // Check X-Real-IP header (nginx proxy)
  const realIp = request.headers['x-real-ip']
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp
  }

  // Check CF-Connecting-IP header (Cloudflare)
  const cfIp = request.headers['cf-connecting-ip']
  if (cfIp) {
    return Array.isArray(cfIp) ? cfIp[0] : cfIp
  }

  return undefined
}

/**
 * Validate CAPTCHA token for a protected endpoint
 *
 * This helper should be called in route handlers before processing requests
 * on protected endpoints.
 *
 * @param core - TrokkyCore instance
 * @param captchaToken - The CAPTCHA token from the request body
 * @param remoteIp - Optional client IP address
 * @param endpoint - The endpoint being protected
 * @throws InvalidInputError if CAPTCHA is required but token is missing or invalid
 */
export async function validateCaptcha(
  core: TrokkyCore,
  captchaToken: string | undefined,
  remoteIp: string | undefined,
  endpoint: CaptchaProtectedEndpoint
): Promise<void> {
  // Check if CAPTCHA is required for this endpoint
  if (!core.isCaptchaRequiredFor(endpoint)) {
    logger.debug('CAPTCHA not required for endpoint', { endpoint })
    return
  }

  // Token is required
  if (!captchaToken) {
    logger.warn('CAPTCHA token missing for protected endpoint', { endpoint })
    throw new InvalidInputError('CAPTCHA verification required', 'captchaToken')
  }

  // Verify the token
  const result = await core.verifyCaptcha(captchaToken, remoteIp)

  if (!result.success) {
    logger.warn('CAPTCHA verification failed', {
      endpoint,
      errorCodes: result.errorCodes,
    })
    throw new InvalidInputError('CAPTCHA verification failed', 'captchaToken')
  }

  logger.debug('CAPTCHA verification successful', { endpoint })
}
