# @trokky/core

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
