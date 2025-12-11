# @trokky/routes

## 2.0.4

### Patch Changes

- 3f58a2a: Consolidate HTTP, OAuth2, Mail, and i18n types into @trokky/types
  - Added http.ts with HttpMethod, HttpRequest, HttpResponse, ApiResponse, FrameworkAdapter types
  - Added api-requests.ts with all document, media, user, auth, and webhook request types
  - Added oauth2.ts with full OAuth2 authorization server types (RFC 8628 Device Flow, PKCE)
  - Added mail.ts with MailAdapter, MailMessage, MailResult, and provider config types
  - Added i18n.ts with SupportedLocale, I18nConfig, LanguagePreference types
  - Updated @trokky/core to re-export OAuth2 types from @trokky/types
  - Updated @trokky/routes to re-export HTTP and API request types from @trokky/types
  - Updated @trokky/mail to re-export mail types from @trokky/types
  - Updated @trokky/i18n to re-export i18n types from @trokky/types
  - Added subpath exports for /http, /api-requests, /oauth2, /mail, /i18n

- fd7f1d8: refactor(types): Consolidate shared types into @trokky/types

  Centralizes type definitions to eliminate duplication across packages.

  Slug Types:
  - Add `slug.ts` with consolidated slug types (SlugifyOptions, SlugFieldConfig, SlugFieldValue, SlugFieldOptions)
  - Add subpath export `@trokky/types/slug` for direct imports
  - Update @trokky/routes and @trokky/fields to import from @trokky/types

  Field System Types:
  - Add `field-system.ts` with 14 core field system types:
    - ConditionalOperator, ConditionalConfig (conditional visibility)
    - ValidationResult, BaseValidation, ValidationState (validation)
    - FieldCategory, BaseFieldOptions, BaseFieldDefinition, BaseFieldValue (field definitions)
    - DocumentContext (document context)
    - FieldPluginSource, BaseFieldPlugin, BaseRegisteredFieldPlugin (plugin types without React deps)
  - Add subpath export `@trokky/types/field-system` for direct imports
  - Update @trokky/fields to import and re-export from @trokky/types

  Other Changes:
  - Add @trokky/types as dependency to @trokky/routes
  - Fix broken test scripts in mail packages (removed non-functional jest commands)
  - Remove outdated package filters from root package.json test/lint scripts

  This refactoring improves type consistency across the Trokky ecosystem by maintaining a single source of truth for shared types.

- Updated dependencies [3f58a2a]
- Updated dependencies [fd7f1d8]
  - @trokky/types@0.1.1
  - @trokky/core@2.0.4

## 2.0.3

### Patch Changes

- ba72ff7: fix(routes): Add server-side slug auto-generation for REST API and CLI

  Fixes #66 - Slug fields are now auto-generated server-side when creating or updating documents via REST API or CLI.

  Changes:
  - Add `slug-processor.ts` with server-side slug generation utilities
  - Integrate slug processing into `createDocument` and `updateDocument` handlers
  - Support `source` option at both field level and in `options` object
  - Implement optimized unique slug generation (single query instead of N+1)
  - Add comprehensive test coverage (43 tests)
  - Export `SchemaFieldDefinition` type from @trokky/core
  - Add `allowSlashes` property to `FieldDefinition` interface

  The slug auto-generation now works consistently across:
  - Studio UI (client-side, existing)
  - REST API (server-side, new)
  - Trokky CLI (server-side, new)

- Updated dependencies [ba72ff7]
  - @trokky/core@2.0.3

## 2.0.2

### Patch Changes

- 094c150: Fix document status being reset to draft on update
  - Routes: Preserve `_status` from existing document when updating unless explicitly provided in update data
  - Adapter: Use `_status` from update data if provided, otherwise preserve existing status

## 1.0.1

### Patch Changes

- 83bc343: Add bulk selection and delete for media files in Studio
  - Add checkboxes to media grid and list views for selecting multiple files
  - Add bulk actions toolbar with "Delete Selected" button when items are selected
  - Add keyboard shortcuts: Cmd/Ctrl+A to select all, Escape to clear, Delete/Backspace to delete selected
  - Add Shift+click for range selection
  - Add bulk delete API endpoint (POST /media/bulk-delete) with up to 100 files at once
  - Add confirmation modal for bulk delete operations

## 1.0.0

### Minor Changes

- 3bbba91: feat: add server-side reference expansion support

  Added server-side reference expansion via the `expand` query parameter. Documents with reference fields can now return fully expanded referenced documents instead of just reference metadata.

  **API Changes:**
  - GET `/api/collections/:collection/:id?expand=field1,field2[]` - expand specific fields
  - GET `/api/collections/:collection?expand=*` - expand all reference fields
  - Use `[]` suffix for array reference fields (e.g., `categories[]`)

  **@trokky/core:**
  - New `expandDocumentReferences()` utility for expanding references in documents
  - New `parseExpandParam()` for parsing expand query parameter
  - Exports `ReferenceValue`, `ExpandOptions`, `DocumentFetcher` types

  **@trokky/routes:**
  - Document GET and list endpoints now support `expand` query parameter

  **@trokky/client:**
  - `QueryBuilder.expand()` method now uses server-side expansion
  - `SingletonBuilder.expand()` method now uses server-side expansion
  - Falls back to client-side expansion for backward compatibility

  **trokky CLI:**
  - `trokky docs get` now supports `--expand` option

### Patch Changes

- Updated dependencies [3bbba91]
  - @trokky/core@1.0.0

## 0.1.21

### Patch Changes

- d08c54d: Add OAuth2 consent persistence and developer tools

  OAuth2 Consent Persistence:
  - Add `getUserConsent`, `saveUserConsent`, and `revokeUserConsent` methods to engine
  - Store consents in user preferences (works with all storage adapters)
  - Update authorization route to check for existing consent and authenticate optionally
  - Update AuthorizePage to auto-approve seamlessly when consent exists
  - Skip consent screen for returning users (similar to Google OAuth behavior)

  Developer Tools (trokky dev):
  - Add hidden `trokky dev` CLI commands for core developers (requires TROKKY_DEV_MODE=1)
  - `trokky dev link` - Link local Trokky packages to a project
  - `trokky dev unlink` - Restore published package versions
  - `trokky dev rebuild` - Rebuild Trokky packages
  - `trokky dev status` - Check which packages are linked

- Updated dependencies [d08c54d]
  - @trokky/core@0.1.21

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

## 0.1.15

### Patch Changes

- 225bbee: Fix OAuth login not respecting trusted devices for MFA. When logging in with Google OAuth, the system now checks if the device is already trusted and skips MFA verification, matching the behavior of username/password login. The Studio now sends deviceId in the OAuth callback request.
- Updated dependencies [225bbee]
  - @trokky/core@0.1.15

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

## 0.1.13

### Patch Changes

- fix: pass deviceId during login to enable MFA trusted device feature

  The trusted device feature was not working because:
  1. LoginPage.tsx wasn't generating/sending deviceId during login
  2. api-client.ts login method didn't accept deviceId parameter
  3. routes.ts login handler wasn't passing deviceId to authenticateUser

  Now when a user logs in, their device ID is sent along with credentials,
  allowing the server to check if the device is trusted and skip MFA verification.

## 0.1.12

### Patch Changes

- ## MFA Enforcement and Setup Improvements

  ### @trokky/core
  - Added `completeMFASetupAndLogin()` method to complete MFA setup during login flow and issue auth tokens
  - Updated `checkMFARequired()` to support role-based MFA enforcement via `mfaEnforcedRoles` setting
  - Updated `authenticateWithOAuth()` to check MFA requirements and return appropriate auth result types
  - Added `expiresAt` field to `AuthenticationSuccessResult`
  - Added `mfaEnforcedRoles` and `mfaAllowedMethods` to `SettingsConfig` interface

  ### @trokky/routes
  - MFA setup routes now accept `X-MFA-Setup-Token` header for authentication during login flow
  - Updated `initTOTPSetup`, `verifyTOTPSetup`, `initEmailOTPSetup`, `verifyEmailOTPSetup` to work with setup tokens
  - OAuth callback now properly handles MFA required and MFA setup required responses
  - Verify routes issue full auth tokens after successful MFA setup when using setup token

  ### @trokky/studio
  - Added inline MFA setup wizard on login page when MFA setup is required
  - Added backup codes display step before completing login after MFA setup
  - Added MFA indicator badge (purple shield icon) on Users page for users with MFA enabled
  - Added Reset MFA button for admins to reset other users' MFA configuration
  - Updated `apiClient.post()` to accept custom headers parameter
  - Added `MFAConfig` interface to User type

  ### @trokky/mail
  - Added MFA OTP email notification support
  - Added `mfaOtp` toggle to notification config
  - Added event listener for `user.mfa_otp_requested` events

  ### @trokky/adapter-postgres-data
  - Added support for saving/loading MFA enforcement settings (`mfaEnforcedRoles`, `mfaAllowedMethods`) in config JSONB

- Updated dependencies
  - @trokky/core@0.1.12

## 0.1.11

### Patch Changes

- 4b2256b: OAuth: Skip consent screen for login mode, only show account picker
  - Login mode now uses `prompt=select_account` - shows account picker but skips consent if already granted
  - Link mode still uses `prompt=consent` to ensure refresh token is obtained

- Updated dependencies [4b2256b]
  - @trokky/core@0.1.11

## 0.1.10

### Patch Changes

- 8113d6f: Security: Redact sensitive filesystem paths from media metadata responses
  - Added `sanitizeMediaResponse()` to strip internal paths from API responses
  - Removes `path`, `storagePath`, `absolutePath`, `relativePath`, `filePath` from metadata
  - Keeps safe fields like `extension`, `originalFilename`, `width`, `height`
  - Applied to all media endpoints: getMedia, listMedia, uploadMedia, updateMedia

## 0.1.9

### Patch Changes

- e2e16ad: Add Google OAuth support for Studio authentication (backend implementation)
  - Add OAuthProvider type and oauthProviders field to User model
  - Create GoogleOAuthService with PKCE support for secure OAuth flow
  - Add OAuth methods to TrokkyCore: linkOAuthProvider, unlinkOAuthProvider, authenticateWithOAuth, getUserByOAuthProvider
  - Add OAuth configuration to TrokkyConfig
  - Create OAuth route handlers: /auth/oauth/google/init, /auth/oauth/google/callback, /auth/oauth/google/unlink, /auth/oauth/status
  - Add getUserByOAuthProvider to postgres adapter with GIN index for efficient lookups
  - Add migration for oauth_providers column in users table
  - Add getUserByOAuthProvider to filesystem-data adapter with oauthProviders field support
  - Add getUserByOAuthProvider to legacy filesystem adapter

- Updated dependencies [e2e16ad]
  - @trokky/core@0.1.9

## 0.1.8

### Patch Changes

- 6f2ef2f: Comprehensive sorting, filtering, and duplicate improvements across the stack

  **Studio improvements:**
  - Add smart field detection for title column sorting (checks if documents use 'name' or 'title' field)
  - Apply same smart detection to both dropdown sort button and column header clicks
  - Fix sort dropdown to close when clicking outside the dropdown area
  - Improve UX consistency across different schema types (e.g., some schemas uses 'name', articles use 'title')
  - Change duplicate behavior to navigate to create form with pre-filled data instead of creating directly
  - Remove duplicate from bulk actions (now only available per-document)
  - Append "(Copy)" to name/title field for duplicated documents
  - Remove system fields (\_id, \_createdAt, etc.) and slug to allow auto-generation
  - Set duplicated documents to draft status by default
  - Users can now review and modify duplicated data before saving

  **Routes improvements:**
  - Handle filter bracket notation from query params (Studio sends filter[field]=value)
  - Convert prefix notation for sorting ("-field" for desc, "field" for asc)
  - Get total count from database before search filtering (correct pagination)
  - Use database count instead of filtered result length for accurate totals

  **Core validation improvements:**
  - Allow "-field" format for descending sort in addition to "field.desc"
  - Update validation error messages to reflect new format support

  **Postgres-data adapter improvements:**
  - Handle system fields (\_status, \_createdAt, \_updatedAt, etc.) in filters
  - Change sort delimiter from ":" to "." for consistency
  - Add better sorting support for system fields (\_status, \_id, etc.)
  - Add SQL injection validation for field names
  - Add debug logging for filter and sort operations
  - Map system fields to proper database columns

- Updated dependencies [6f2ef2f]
  - @trokky/core@0.1.8

## 0.1.7

### Patch Changes

- c6b4eff: Correction complète du système de session "Rester connecté"

  Correction majeure du mécanisme "Stay signed in" qui ne fonctionnait pas correctement :

  **Problèmes résolus :**
  1. Les paramètres de durée de vie des tokens dans trokky.config.ts étaient ignorés - le core utilisait des valeurs codées en dur
  2. Le renouvellement des tokens ne préservait pas l'état "rememberMe" - les sessions longues étaient réduites à 2h après le premier renouvellement
  3. La configuration de session Studio n'était pas exposée correctement via l'API
  4. Les noms de propriétés ne correspondaient pas entre le config backend et les attentes du frontend
  5. La case à cocher "Stay signed in" n'était pas cliquable directement - seulement via le label

  **Améliorations apportées :**
  - Le core respecte maintenant les TTL configurés (accessTokenTtl, refreshTokenTtl, rememberMeTtl)
  - Le flag rememberMe est stocké dans le payload JWT et préservé lors du renouvellement
  - La configuration de session est correctement exposée à Studio via /api/config/studio
  - Ajout du type tokens dans TrokkyConfig pour validation TypeScript
  - La case à cocher est maintenant cliquable directement (pas seulement via le label)

  **Comportement attendu :**
  - Sans "Stay signed in": Session de 4h (configurable via accessTokenTtl)
  - Avec "Stay signed in": Session de 30 jours (configurable via rememberMeTtl)
  - Les renouvellements automatiques préservent la durée de session choisie initialement

- Updated dependencies [c6b4eff]
  - @trokky/core@0.1.7

## 0.1.6

### Patch Changes

- 3f59d99: # Studio Branding Enhancements

  Enhanced Studio branding system with configurable organization name, colors, and logo. Added support for storing branding configuration in backend database and displaying it across authentication pages and throughout the entire authenticated Studio interface.

  ## @trokky/core - PATCH bump
  - **Added** `organizationName`, `primaryColor`, `secondaryColor`, `logo` fields to `SettingsConfig` interface
  - **Location**: `packages/core/src/types/storage-adapters.ts`

  ## @trokky/routes - PATCH bump
  - **Changed** `/api/config/studio` endpoint to be public (no authentication required)
  - **Added** branding merge logic from database settings
  - **Added** support for saving branding fields via `/api/config/settings`
  - **Enhanced** `/api/config/structure` endpoint to enrich documentList items with schema titles
  - **Added** `enrichStructureWithSchemaInfo()` method to add `schemaTitle` field to documentList items
  - **Fixed** `/api/auth/change-password` endpoint - now properly authenticates and populates `request.user`
  - **Enhanced** `validateAuthentication()` method to decode JWT token and populate `request.user` from session data
    - Uses `core.verifyAnyToken()` to validate and decode token in single operation
    - Populates `request.user` with `{id, username, role}` from session
    - Makes all protected routes have consistent access to authenticated user data
    - Backward compatible - purely additive enhancement
  - **Location**: `packages/routes/src/routes.ts`

  ## @trokky/adapter-postgres-data - PATCH bump
  - **Implemented** `getSettings()` method to retrieve settings including branding from database
  - **Implemented** `saveSettings()` method to persist branding configuration
  - **Fixed** table name handling using `this.tableName()` helper
  - **Location**: `packages/adapters/postgres-data/src/postgres-data-adapter.ts`

  ## @trokky/fields - PATCH bump
  - **Fixed** TipTap duplicate extension warnings by disabling `gapcursor` and `codeBlock` in StarterKit configuration
  - **Removed** excessive console.log statements from MediaField component for cleaner console output
  - **Location**: `packages/fields/src/definitions/RichTextField/component.tsx`, `packages/fields/src/definitions/MediaField/component.tsx`

  ## @trokky/studio - PATCH bump
  - **Removed** excessive debug console.log statements from PermissionsDebugPanel for cleaner console output
  - **Added** shared branding utilities
  - **Enhanced** LoginPage, ForgotPasswordPage, SettingsPage, App, StudioContext, Header, MainSidebar
  - **Added** useStudioBranding hook
  - **Enhanced** useDocumentTitle
  - Comprehensive branding and navigation improvements

  ## Breaking Changes

  None. All changes are backward compatible.

- Updated dependencies [3f59d99]
  - @trokky/core@0.1.6

## 0.1.5

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

## 0.1.4

### Patch Changes

- Fix critical security vulnerabilities in password reset and mail system

  **Security Fixes:**
  1. **Removed plain text passwords from event system** - Passwords are no longer logged in events, preventing exposure in logs and event storage
  2. **Constant-time token comparison** - Password reset tokens now use constant-time comparison to prevent timing attacks
  3. **Unified password validation** - Reset flow now enforces same strong password requirements as change password
  4. **Rate limiting on password reset** - Added rate limiting to prevent abuse, spam, and enumeration attacks

  **New Features:**
  - `TrokkyCore.onUserCreatedWithPassword()` - Secure callback for sending temporary passwords without logging
  - `TrokkyCore.checkRateLimit()` - Public method for routes to use rate limiter

  **Breaking Changes:**
  - `MailNotificationService` now requires `core` parameter in config for secure callback registration

  **Migration Guide:**

  Update your MailNotificationService initialization:

  ```typescript
  // Before:
  new MailNotificationService(eventBus, {
    mailService,
    baseUrl: 'https://example.com',
    // ...
  })

  // After:
  new MailNotificationService(core.events, {
    mailService,
    baseUrl: 'https://example.com',
    core, // Required for secure callback registration
    // ...
  })
  ```

- Updated dependencies
  - @trokky/core@0.1.3

## 0.1.3

### Patch Changes

- Add search parameter support to listDocuments endpoint
  - Added search query parameter to GET /collections/:collection endpoint
  - Implements client-side text filtering across common fields (name, title, description, etc.)
  - Enables reference field search functionality in Studio

## 0.1.2

### Patch Changes

- Remove restrictive slug validation in checkSlugUniqueness endpoint

  The slug uniqueness check was using a rigid regex that rejected valid slugs,
  causing backup/restore failures. Now only validates non-empty slugs, allowing
  the schema field definition to handle format validation.

## 0.1.1

### Patch Changes

- Add backup and restore endpoints with pre-flight checks and singleton support

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
