# @trokky/core

## 0.1.28

### Patch Changes

- f693c33: fix: use core's crypto adapter for password change operations

  Fixed a bug where the change password functionality was using a separately detected crypto adapter instead of the core's configured adapter. This caused password verification to fail with "Invalid character" error when:
  - The user's password was hashed using bcrypt (NodeCryptoAdapter)
  - The change password route detected WebCryptoAdapter (available in Node.js 18+)
  - WebCryptoAdapter attempted to decode bcrypt hash as base64, which failed

  The fix ensures consistent crypto adapter usage by calling `core.verifyPassword()` and `core.hashPassword()` instead of `detectCryptoAdapter()` directly, matching how password-reset.ts handles password operations.

  Breaking change: Removed `detectCryptoAdapter` from public exports in `@trokky/core`. This function was an internal implementation detail and should not be used directly. Use `core.hashPassword()` and `core.verifyPassword()` instead.

## 0.1.26

### Patch Changes

- 7882b85: ## Bug Fixes

  ### Fix permissions being reset on user update (Postgres adapter)

  The PostgresDataAdapter.saveUser method was using `JSON.stringify(updateData.permissions || [])` which always produced a non-null value, even when permissions were not provided in the update. This caused COALESCE to overwrite existing permissions with an empty array whenever any user field was updated.

  The fix now uses `updateData.permissions !== undefined ? JSON.stringify(updateData.permissions) : null` to only pass permissions when explicitly provided, preserving existing permissions when not specified in the update.

  ### Fix adapter registry for npm link scenarios

  Fixed adapter registry to not overwrite globalThis when multiple copies of @trokky/core exist (e.g., when using npm link). This ensures adapters registered from linked packages are not lost when the main project's @trokky/core loads.

  ## New Features

  ### Add 'writer' role for editorial workflows

  Added a new `writer` role for users who can create and edit content but cannot publish or delete. This enables common editorial workflows where writers draft content and editors review and publish.

  Role permissions:
  - `writer`: content:read, content:write, media:read, media:upload, studio:access (NO publish, NO delete)

  UI changes:
  - Writer role now appears in Studio user management dropdown
  - Added English translation: "Writer - Create and edit content, cannot publish"
  - Added French translation: "Redacteur - Creer et modifier du contenu, sans publication"
  - Writer role badge displays in purple color

  ### Enforce content:publish permission

  The `content:publish` permission is now properly enforced throughout the system:
  - Routes: Document updates that change status to/from 'published' require publish permission
  - Studio DocumentEditor: Status dropdown hidden for users without publish permission (shows read-only badge instead)
  - Studio ContentPage: "Change Status" bulk action hidden for users without publish permission
  - usePermissions hook: Added 'publish' action support and `canPublish` helper

  ### Allow users to delete their own documents

  Users can now delete documents they created, even without the general `content:delete` permission:
  - Routes: Delete endpoint checks document ownership (`_createdBy` field) if user lacks delete permission
  - usePermissions hook: Added `canDeleteDocument(schemaName, document)` helper to check delete capability
  - Studio DocumentSidebar: Delete button only shown if user has delete permission OR owns the document
  - Studio ListView/GridView/TableView: Delete action hidden in dropdown for documents user cannot delete
  - Clear error message when attempting to delete someone else's document: "You can only delete documents you created"

  ### Fix status translations (Draft/Published)

  Document status labels now use translations instead of hardcoded English strings:
  - DocumentHeader: Status dropdown/badge now uses `t('documentEditor.draft')` and `t('documentEditor.published')`
  - ContentPage: Status column in list view now uses translated labels
  - French translations: "Brouillon" (Draft), "Publie" (Published)

- Updated dependencies [7882b85]
  - @trokky/types@0.1.3

## 0.1.25

### Patch Changes

- 42013df: feat: add passkey/WebAuthn passwordless authentication support
  - Added PasskeyCredential type and PasskeyConfig configuration in @trokky/types
  - Implemented passkey service methods in TrokkyCore (registration, authentication, credential management)
  - Created passkey API routes for registration, authentication, and credential management
  - Added PasskeyLoginButton component for passwordless login on the login page
  - Added PasskeyRegistration component for registering new passkeys
  - Added PasskeyManager component for managing existing passkeys in user preferences
  - Updated LoginPage to show passkey login option when enabled
  - Updated UserPreferencesPage with passkey management section
  - Added passkey configuration to demo example

- 94d6f8b: fix: passkey authentication support
  - fix(express): pass passkey config from security section to TrokkyCore
  - fix(core): export PasskeyConfig type for external use
  - fix(express): add passkey property to SecurityConfig interface and defaults
  - fix(adapter-postgres-data): add passkeys column support (schema, migrations, CRUD operations)
  - fix(studio): use correct storageService.set() method in passkey login handler
  - fix(routes): change passkey status debug log from info to debug level

- Updated dependencies [42013df]
  - @trokky/types@0.1.2

## 2.0.5

### Patch Changes

- 84a8782: Fix internal dependency version constraints

  Replace wildcard (\*) dependencies with proper semver constraints to prevent version mismatch issues when installing packages. This ensures that packages requiring features from specific versions (like expandDocumentReferences in @trokky/core@2.0.0) will correctly resolve to compatible versions.
  - @trokky/core: ^2.0.0
  - @trokky/types: ^0.1.0
  - @trokky/routes: ^2.0.0
  - @trokky/mail: ^0.1.0
  - @trokky/i18n: ^0.2.0
  - @trokky/fields: ^0.4.0
  - @trokky/studio: ^0.4.0
  - @trokky/adapter-filesystem-data: ^2.0.0
  - @trokky/adapter-filesystem-media: ^2.0.0

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

- Updated dependencies [3f58a2a]
- Updated dependencies [fd7f1d8]
  - @trokky/types@0.1.1

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

## 2.0.0

### Patch Changes

- 4351835: Complete i18n migration for remaining field components and modals
  - Migrated all remaining field components to i18n:
    - BooleanField, ColorField, DateField, EmailField
    - GeoCoordinateField, IconField, InfoField, PasswordField
    - PortableTextField, RichTextField, SlugField
    - TextareaField, URLField
  - Migrated ArrayModal and ObjectModal with modal-specific translations
  - Added auto-field translation support in FieldWrapper (i18n: prefix)
  - Updated schema registry to use i18n keys for auto-injected fields
  - Added Featured Image and slug translations for auto-injected fields
  - Migrated GoogleLoginButton with OAuth translations

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

## 0.1.22

### Patch Changes

- 304a841: Fix auto-thumbnail singleton check to use `schema.singleton === true` instead of `schema.type === 'singleton'`

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

## 0.1.18

### Patch Changes

- 9775366: Fix API token performance by using SHA256 instead of bcrypt
  - API tokens now use SHA256 hashing instead of bcrypt for both creation and validation
  - This dramatically improves API request performance (~100ms -> ~1ms per token check)
  - Bcrypt is slow by design (for passwords), but API tokens are long random strings that don't need bcrypt's protections
  - Uses constant-time comparison (timingSafeEqual) to prevent timing attacks

  BREAKING: Existing API tokens created with bcrypt hashes will need to be regenerated after this update.

## 0.1.17

### Patch Changes

- 40dbf92: Fix NodeCryptoAdapter loading in ESM environments
  - Use top-level `import { createRequire } from 'module'` for ESM compatibility
  - Properly load NodeCryptoAdapter (bcrypt + jsonwebtoken) when `adapterType: 'node'` is specified
  - Fixes password verification failures when existing passwords were hashed with bcrypt

## 0.1.15

### Patch Changes

- 225bbee: Fix OAuth login not respecting trusted devices for MFA. When logging in with Google OAuth, the system now checks if the device is already trusted and skips MFA verification, matching the behavior of username/password login. The Studio now sends deviceId in the OAuth callback request.

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

## 0.1.11

### Patch Changes

- 4b2256b: OAuth: Skip consent screen for login mode, only show account picker
  - Login mode now uses `prompt=select_account` - shows account picker but skips consent if already granted
  - Link mode still uses `prompt=consent` to ensure refresh token is obtained

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

## 0.1.5

### Patch Changes

- 0ad0659: Fix media field validation to accept null values

  Media fields can now properly accept null when the field is removed in Studio.
  Previously, removing a media field would cause a validation error because the
  validator only accepted string IDs or media objects, but not null values.

  This fix allows optional media fields to be properly cleared without validation errors.

## 0.1.4

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

## 0.1.3

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

## 0.1.2

### Patch Changes

- Remove overly restrictive slug validation regex

  The slug validator was using a rigid regex pattern that rejected valid slugs with
  forward slashes, even when the schema had `allowSlashes: true` configured. This
  caused backup/restore failures and prevented users from using hierarchical slugs
  like "blog/posts/my-article".

  Changes:
  - Removed regex validation that ignored schema-level slug options
  - Now only validates basic constraints (non-empty, length limits)
  - Respects schema configuration for allowSlashes, preserveCase, allowedChars
  - Fixes backup/restore compatibility with hierarchical slugs

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
