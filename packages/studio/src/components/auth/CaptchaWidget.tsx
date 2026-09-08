/**
 * CAPTCHA Widget Component
 *
 * Renders a CAPTCHA widget based on the provider (Turnstile, hCaptcha, reCAPTCHA).
 * Supports Cloudflare Turnstile and Google reCAPTCHA v2.
 */

import { useEffect, useRef, useState } from 'react'
import { useT } from 'trokky/i18n'

export type CaptchaProvider = 'turnstile' | 'hcaptcha' | 'recaptcha'

export interface CaptchaWidgetProps {
  /** The CAPTCHA provider to use */
  provider: CaptchaProvider
  /** Public site key for the provider */
  siteKey: string
  /** Provider-specific options */
  options?: {
    theme?: 'light' | 'dark' | 'auto'
    size?: 'normal' | 'compact' | 'invisible'
    language?: string
  }
  /** Callback when CAPTCHA is verified successfully */
  onVerify: (token: string) => void
  /** Callback when CAPTCHA encounters an error */
  onError?: (error: string) => void
  /** Callback when CAPTCHA token expires */
  onExpire?: () => void
  /** Additional CSS class */
  className?: string
}

// Extend Window interface for CAPTCHA providers
declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: (error: string) => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'compact' | 'invisible'
          language?: string
        }
      ) => string
      remove: (widgetId: string) => void
      reset: (widgetId: string) => void
    }
    grecaptcha?: {
      ready: (callback: () => void) => void
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: () => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark'
          size?: 'normal' | 'compact'
        }
      ) => number
      reset: (widgetId?: number) => void
    }
  }
}

// Script URLs for each provider
const SCRIPT_URLS: Record<string, string> = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/api.js',
  recaptcha: 'https://www.google.com/recaptcha/api.js',
}

// Script selector patterns for checking if already loaded
const SCRIPT_SELECTORS: Record<string, string> = {
  turnstile: 'script[src*="challenges.cloudflare.com/turnstile"]',
  recaptcha: 'script[src*="google.com/recaptcha/api.js"]',
}

/**
 * CAPTCHA Widget Component
 *
 * Dynamically loads the CAPTCHA provider script and renders the widget.
 */
export function CaptchaWidget({
  provider,
  siteKey,
  options = {},
  onVerify,
  onError,
  onExpire,
  className = '',
}: CaptchaWidgetProps) {
  const { t } = useT('studio')
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | number | null>(null)
  const callbacksRef = useRef({ onVerify, onError, onExpire })
  const [isScriptLoaded, setIsScriptLoaded] = useState(false)
  const [scriptError, setScriptError] = useState<string | null>(null)

  // Keep callbacks ref up to date without triggering re-renders
  useEffect(() => {
    callbacksRef.current = { onVerify, onError, onExpire }
  }, [onVerify, onError, onExpire])

  // Load provider script (only once)
  useEffect(() => {
    // Check if provider is supported
    if (provider === 'hcaptcha') {
      setScriptError(t('captcha.errors.hcaptchaNotSupported'))
      return
    }

    const scriptUrl = SCRIPT_URLS[provider]
    const scriptSelector = SCRIPT_SELECTORS[provider]

    if (!scriptUrl) {
      setScriptError(t('captcha.errors.providerNotSupported', { provider }))
      return
    }

    // Check if provider API is already available
    if (provider === 'turnstile' && window.turnstile) {
      setIsScriptLoaded(true)
      return
    }
    if (provider === 'recaptcha' && window.grecaptcha) {
      setIsScriptLoaded(true)
      return
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(scriptSelector)
    if (existingScript) {
      // Wait for existing script to load
      const handleLoad = () => {
        if (provider === 'recaptcha' && window.grecaptcha) {
          window.grecaptcha.ready(() => setIsScriptLoaded(true))
        } else {
          setIsScriptLoaded(true)
        }
      }
      const handleError = () => setScriptError(t('captcha.errors.scriptLoadFailed'))
      existingScript.addEventListener('load', handleLoad)
      existingScript.addEventListener('error', handleError)
      return () => {
        existingScript.removeEventListener('load', handleLoad)
        existingScript.removeEventListener('error', handleError)
      }
    }

    // Load the script
    const script = document.createElement('script')
    script.src = scriptUrl
    script.async = true

    script.onload = () => {
      if (provider === 'recaptcha' && window.grecaptcha) {
        // reCAPTCHA needs to be ready before we can use it
        window.grecaptcha.ready(() => setIsScriptLoaded(true))
      } else {
        setIsScriptLoaded(true)
      }
    }

    script.onerror = () => {
      setScriptError(t('captcha.errors.scriptLoadFailed'))
    }

    document.head.appendChild(script)
  }, [provider])

  // Render Turnstile widget
  useEffect(() => {
    if (!isScriptLoaded || !containerRef.current || provider !== 'turnstile') {
      return
    }

    if (!window.turnstile) {
      setScriptError(t('captcha.errors.notAvailable', { provider: 'Turnstile' }))
      return
    }

    // Skip if already rendered
    if (widgetIdRef.current !== null) {
      return
    }

    // Small delay to ensure DOM is ready and avoid StrictMode double-render issues
    const timeoutId = setTimeout(() => {
      if (!containerRef.current || widgetIdRef.current !== null) return

      try {
        widgetIdRef.current = window.turnstile!.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => callbacksRef.current.onVerify(token),
          'error-callback': (error: string) => callbacksRef.current.onError?.(error),
          'expired-callback': () => callbacksRef.current.onExpire?.(),
          theme: options.theme || 'auto',
          size: options.size || 'normal',
          language: options.language,
        })
      } catch (error) {
        console.error('Failed to render Turnstile widget:', error)
        setScriptError(t('captcha.errors.renderFailed'))
      }
    }, 100)

    // Cleanup on unmount
    return () => {
      clearTimeout(timeoutId)
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current as string)
        } catch (e) {
          // Widget might already be removed
        }
        widgetIdRef.current = null
      }
    }
  }, [isScriptLoaded, provider, siteKey, options.theme, options.size])

  // Render reCAPTCHA widget
  useEffect(() => {
    if (!isScriptLoaded || !containerRef.current || provider !== 'recaptcha') {
      return
    }

    if (!window.grecaptcha) {
      setScriptError(t('captcha.errors.notAvailable', { provider: 'reCAPTCHA' }))
      return
    }

    // Skip if already rendered
    if (widgetIdRef.current !== null) {
      return
    }

    // Small delay to ensure DOM is ready and avoid StrictMode double-render issues
    const timeoutId = setTimeout(() => {
      if (!containerRef.current || widgetIdRef.current !== null) return

      try {
        // reCAPTCHA v2 doesn't support 'auto' theme, default to 'light'
        const theme = options.theme === 'auto' ? 'light' : (options.theme as 'light' | 'dark') || 'light'
        // reCAPTCHA v2 doesn't support 'invisible' in checkbox mode
        const size = options.size === 'invisible' ? 'normal' : (options.size as 'normal' | 'compact') || 'normal'

        widgetIdRef.current = window.grecaptcha!.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => callbacksRef.current.onVerify(token),
          'error-callback': () => callbacksRef.current.onError?.('reCAPTCHA error'),
          'expired-callback': () => callbacksRef.current.onExpire?.(),
          theme,
          size,
        })
      } catch (error) {
        console.error('Failed to render reCAPTCHA widget:', error)
        setScriptError(t('captcha.errors.renderFailed'))
      }
    }, 100)

    // Cleanup on unmount - reCAPTCHA doesn't have a remove method, just reset
    return () => {
      clearTimeout(timeoutId)
      if (widgetIdRef.current !== null && window.grecaptcha) {
        try {
          window.grecaptcha.reset(widgetIdRef.current as number)
        } catch (e) {
          // Widget might already be removed
        }
        widgetIdRef.current = null
      }
    }
  }, [isScriptLoaded, provider, siteKey, options.theme, options.size])

  // Show error if script failed to load
  if (scriptError) {
    return (
      <div className={`captcha-widget captcha-error ${className}`}>
        <p className="text-sm text-red-600">{scriptError}</p>
      </div>
    )
  }

  // Show loading state
  if (!isScriptLoaded) {
    return (
      <div className={`captcha-widget captcha-loading ${className}`}>
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          <span className="ml-2 text-sm text-gray-500">{t('captcha.loading')}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`captcha-widget ${className}`}
      data-provider={provider}
    />
  )
}
