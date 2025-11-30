/**
 * CAPTCHA Hook - Manages CAPTCHA state and configuration for forms
 */

import { useState, useEffect, useCallback } from 'react'
import { apiClient } from '../services/api-client'

export type CaptchaProvider = 'turnstile' | 'hcaptcha' | 'recaptcha'
export type CaptchaProtectedEndpoint = 'login' | 'passwordResetRequest' | 'passwordResetVerify'

interface CaptchaConfig {
  provider: CaptchaProvider
  siteKey: string
  options?: {
    theme?: 'light' | 'dark' | 'auto'
    size?: 'normal' | 'compact' | 'invisible'
  }
}

interface CaptchaState {
  /** Whether CAPTCHA config is still loading */
  isLoading: boolean
  /** The CAPTCHA configuration from the server */
  config: CaptchaConfig | null
  /** Whether CAPTCHA is required for this endpoint */
  isRequired: boolean
  /** The current CAPTCHA token (null if not verified) */
  token: string | null
  /** Error message if any */
  error: string | null
}

interface UseCaptchaOptions {
  /** Which endpoint to check protection for */
  endpoint: CaptchaProtectedEndpoint
}

interface UseCaptchaReturn extends CaptchaState {
  /** Callback to set the token when CAPTCHA is verified */
  onVerify: (token: string) => void
  /** Callback when CAPTCHA encounters an error */
  onError: (error: string) => void
  /** Callback when CAPTCHA token expires */
  onExpire: () => void
  /** Reset the CAPTCHA state (clear token and error) */
  reset: () => void
}

/**
 * Hook to manage CAPTCHA state for a protected endpoint
 *
 * @example
 * ```tsx
 * const captcha = useCaptcha({ endpoint: 'login' })
 *
 * // In form submission
 * if (captcha.isRequired && !captcha.token) {
 *   setError('Please complete the CAPTCHA')
 *   return
 * }
 *
 * // Pass token to API
 * await apiClient.login(username, password, rememberMe, deviceId, captcha.token)
 *
 * // In JSX
 * {captcha.isRequired && captcha.config && (
 *   <CaptchaWidget
 *     provider={captcha.config.provider}
 *     siteKey={captcha.config.siteKey}
 *     options={captcha.config.options}
 *     onVerify={captcha.onVerify}
 *     onError={captcha.onError}
 *     onExpire={captcha.onExpire}
 *   />
 * )}
 * ```
 */
export function useCaptcha({ endpoint }: UseCaptchaOptions): UseCaptchaReturn {
  const [state, setState] = useState<CaptchaState>({
    isLoading: true,
    config: null,
    isRequired: false,
    token: null,
    error: null,
  })

  // Fetch CAPTCHA status on mount
  useEffect(() => {
    const fetchCaptchaStatus = async () => {
      try {
        const response = await apiClient.get<{
          enabled: boolean
          config: CaptchaConfig | null
          protectedEndpoints: Record<CaptchaProtectedEndpoint, boolean>
        }>('/auth/captcha/status')

        if (response.success && response.data) {
          const { enabled, config, protectedEndpoints } = response.data
          setState((prev) => ({
            ...prev,
            isLoading: false,
            config: enabled && config ? config : null,
            isRequired: enabled && protectedEndpoints[endpoint],
          }))
        } else {
          // CAPTCHA not configured or error - don't require it
          setState((prev) => ({
            ...prev,
            isLoading: false,
            isRequired: false,
          }))
        }
      } catch (error) {
        // On error, don't require CAPTCHA (fail open)
        console.warn('Failed to fetch CAPTCHA status:', error)
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isRequired: false,
        }))
      }
    }

    fetchCaptchaStatus()
  }, [endpoint])

  // Callback when CAPTCHA is verified
  const onVerify = useCallback((token: string) => {
    setState((prev) => ({
      ...prev,
      token,
      error: null,
    }))
  }, [])

  // Callback when CAPTCHA encounters an error
  const onError = useCallback((error: string) => {
    setState((prev) => ({
      ...prev,
      token: null,
      error,
    }))
  }, [])

  // Callback when CAPTCHA token expires
  const onExpire = useCallback(() => {
    setState((prev) => ({
      ...prev,
      token: null,
    }))
  }, [])

  // Reset CAPTCHA state
  const reset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      token: null,
      error: null,
    }))
  }, [])

  return {
    ...state,
    onVerify,
    onError,
    onExpire,
    reset,
  }
}
