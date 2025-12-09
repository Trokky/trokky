# @trokky/express

## 2.0.1

### Patch Changes

- 685a359: Fix features config (autoThumbnail, autoSlug) not being passed to TrokkyCore

## 2.0.0

### Minor Changes

- 7a0441b: Add internationalization (i18n) support to Trokky
  - Create new `@trokky/i18n` package with react-i18next integration
  - Add English and French translations for Studio, fields, auth, and error messages
  - Integrate i18n provider into Studio application
  - Add language preference selector in User Preferences page
  - Support automatic browser language detection with localStorage persistence
  - Add i18n configuration support to `trokky.config.ts`

  Configuration example:

  ```typescript
  // trokky.config.ts
  export default {
    // ... other config
    i18n: {
      defaultLocale: 'en',
      supportedLocales: ['en', 'fr'],
      fallbackLocale: 'en',
      detectBrowserLanguage: true,
      debug: false,
    },
  }
  ```

  Key features:
  - `TrokkyI18nProvider` component for wrapping applications
  - `useT` hook for accessing translations with namespace support
  - `useLocale` hook for managing language preferences
  - `useErrorTranslation` hook for translating error codes
  - `useFieldTranslation` hook for field-related translations
  - Translation files organized by namespace: common, studio, fields, auth, errors
  - Configuration propagates from `trokky.config.ts` through Express to Studio

### Patch Changes

- Updated dependencies [4351835]
  - @trokky/core@2.0.0
  - @trokky/adapter-filesystem-data@2.0.0
  - @trokky/adapter-filesystem-media@2.0.0

## 1.0.0

### Patch Changes

- Updated dependencies [3bbba91]
  - @trokky/core@1.0.0
  - @trokky/routes@1.0.0
  - @trokky/adapter-filesystem-data@1.0.0
  - @trokky/adapter-filesystem-media@1.0.0

## 0.1.20

### Patch Changes

- 6eb3867: feat(auth): add OAuth2 Authorization Server for CLI login and SSO
  - Added OAuth2 Authorization Server to @trokky/core:
    - Device Authorization Flow (RFC 8628) for CLI authentication
    - Authorization Code Flow with PKCE for external web app SSO
    - Token generation and refresh support
    - Built-in Trokky CLI client registration
  - Added OAuth2 route handlers to @trokky/routes:
    - POST /auth/device - Start device authorization
    - GET/POST /auth/device/verify - Device code verification
    - POST /auth/token - Token endpoint (device code, auth code, refresh)
    - GET/POST /auth/authorize - Authorization endpoint for SSO
  - Added `trokky login` command to @trokky/trokky:
    - Browser-based authentication using device flow
    - Automatic token storage in config file
    - Supports refresh tokens for long-lived sessions
    - Auto-opens browser for authorization
  - Added DeviceAuthPage to @trokky/studio:
    - Device authorization UI for CLI login flow
    - Shows requested scopes and client info
    - Authorize/Deny buttons with close window option
  - Updated @trokky/express integration:
    - Added oauth2 config support to TrokkyConfig
    - Pass oauth2 config to TrokkyCore initialization
  - Updated `trokky create` command:
    - Include OAuth2 server config in generated projects
    - Add OAUTH2_ISSUER to .env.example
  - Cleaned up scripts directory:
    - Removed obsolete scripts
    - Updated install-git-hooks.js with documentation

- Updated dependencies [6eb3867]
  - @trokky/core@0.1.20
  - @trokky/routes@0.1.20

## 0.1.19

### Patch Changes

- d76efd4: fix(express): use BuiltInTemplateRenderer as default when no templateRenderer provided
  - Auto-create BuiltInTemplateRenderer with sensible defaults when mail config doesn't specify a custom templateRenderer
  - Move @trokky/core and @trokky/mail to peerDependencies to fix npm link issues with shared singletons (adapter registry)
  - The default template renderer uses:
    - brandName from studio.branding.title or "Trokky"
    - supportEmail from mail.defaultFrom
    - baseUrl from STUDIO_URL env var or localhost

## 0.1.16

### Patch Changes

- a114676: Add cryptoOptions to security config for password hashing adapter selection

  This allows projects to force a specific crypto adapter type via `security.cryptoOptions.adapterType`:
  - `'node'` - Use bcrypt (for backward compatibility with existing passwords)
  - `'webcrypto'` - Use PBKDF2 with Web Crypto API (for edge runtimes)
  - `'auto'` - Auto-detect best adapter (default)

  This is critical for projects migrating to config-driven server that have existing passwords hashed with bcrypt.

## 0.1.15

### Patch Changes

- ecbc406: Add config-driven server architecture with `startServer()` function for simplified server initialization. Extends `TrokkyConfig` with mail, hooks, routes, lifecycle, and features options. Adds `postgres-data` to StorageConfig, `mediaUrlGenerator` to MediaConfig, and `apiUrl` to StudioConfig.
- Updated dependencies [225bbee]
  - @trokky/core@0.1.15
  - @trokky/routes@0.1.15

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
