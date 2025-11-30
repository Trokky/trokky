# @trokky/express

## 0.1.14

### Patch Changes

- Add CAPTCHA support with Cloudflare Turnstile and Google reCAPTCHA v2

  **@trokky/core:**
  - Add CAPTCHA provider abstraction with `CaptchaProvider` interface
  - Add `TurnstileService` for Cloudflare Turnstile server-side verification
  - Add `RecaptchaService` for Google reCAPTCHA v2 server-side verification
  - Add CAPTCHA configuration types and factory function
  - Integrate CAPTCHA verification into TrokkyCore engine

  **@trokky/express:**
  - Add `CaptchaConfig` interface to TrokkyConfig
  - Pass CAPTCHA configuration to core engine

  **@trokky/routes:**
  - Add `/auth/captcha/status` endpoint for frontend CAPTCHA configuration
  - Add CAPTCHA validation helpers for protected endpoints
  - Integrate CAPTCHA verification into login and password reset flows

  **@trokky/studio:**
  - Add `CaptchaWidget` component supporting Turnstile and reCAPTCHA v2
  - Add `useCaptcha` hook for CAPTCHA state management
  - Integrate CAPTCHA into LoginPage, ForgotPasswordPage, and ResetPasswordPage
  - Hide organization title when logo is provided on login page
  - Increase logo size on login page

  Configuration: Set `TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY` or `RECAPTCHA_SITE_KEY`/`RECAPTCHA_SECRET_KEY` env vars

- Updated dependencies
  - @trokky/core@0.1.14
  - @trokky/routes@0.1.14

## 0.1.9

### Patch Changes

- ad91672: Add Google OAuth support for Studio authentication (frontend implementation)
  - Add GoogleLoginButton component for initiating OAuth flow
  - Add OAuthCallbackPage to handle OAuth redirects from Google
  - Add OAuthProvidersList component to display and manage connected accounts
  - Update LoginPage with "Sign in with Google" option
  - Update UserPreferencesPage with Connected Accounts section
  - Add /oauth/callback route for handling OAuth redirects
  - Add Preferences link to user dropdown menu
  - Add OAuthConfig interface and oauth support to Express integration

- Updated dependencies [e2e16ad]
  - @trokky/core@0.1.9
  - @trokky/routes@0.1.9
  - @trokky/adapter-filesystem-data@0.1.1

## 0.1.3

### Patch Changes

- 9a7f248: Replace direct console statements with proper logger system

  All console.log, console.warn, and console.error statements have been replaced with the unified logger system for better log control and consistency.

  Changes:
  - @trokky/core: Added loggers to media processors (sharp, cloudflare-transform-store, workers-images)
  - @trokky/routes: Replaced console statements in slug validation and auth endpoints with logger calls
  - @trokky/express: Added loggers to adapter and media-rewrite-middleware
  - @trokky/adapter-postgres-data: Changed connection pool logs from info to debug level

  Benefits:
  - Consistent logging format across all packages
  - Logs can be controlled via log levels (debug, info, warn, error)
  - Reduced log noise in production environments

- Updated dependencies [9a7f248]
  - @trokky/core@0.1.4
  - @trokky/routes@0.1.5

## 0.1.2

### Patch Changes

- Republish with media variants fix (v0.1.1 was published without the fix)

  Ensures global studio config includes media.variants even when studio.enabled=false

## 0.1.1

### Patch Changes

- Fix studio config to include media variants when studio.enabled is false

  **Bug Fix:**
  - Global studio config now properly includes media.variants configuration even when studio UI is disabled
  - This enables standalone Studio services and CLI restore commands to access variant configuration
  - Fixes "Media Variant Mismatch" errors during backup restoration

  **Technical Details:**
  - The `TrokkyExpress.create()` method now sets `(global as any).__TROKKY_STUDIO_CONFIG__.media.variants` from the media config
  - This ensures the `/api/config/studio` endpoint returns variants regardless of studio.enabled setting
  - Critical for deployments using separate Studio services (e.g., https://studio.example.com)

## 0.2.0

### Minor Changes

- Initial beta release

  Core functionality:
  - Complete CMS engine with business logic, schemas, validation, and storage coordination
  - Framework-agnostic HTTP handlers and route definitions
  - React-based admin Studio interface
  - Frontend SDK with TypeScript type generation
  - Express.js server integration with auto-mounting
  - File-based storage adapters with Git-friendly workflows
  - Field system with TypeScript-first definitions and Zod validation
  - Professional configuration system with organized sections
  - JWT-based authentication with role-based access control
  - Media processing with Sharp integration
