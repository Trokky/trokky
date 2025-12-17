# @trokky/studio

## 0.1.34

### Patch Changes

- 59eb132: fix: update @trokky/i18n to 0.1.6 for French API Tokens translations

## 0.1.33

### Patch Changes

- 46230db: fix: language preference showing old value and mfa.disable i18n key conflict
  - Fixed language preference page showing old language after save instead of success message
  - Fixed i18n key conflict where `mfa.disable` was used both as string (button) and object (nested keys)
  - Renamed button text key from `mfa.disable` to `mfa.disableMethod` in MFASettings component
  - Added `disableMethod` translation key to EN and FR locale files

- Updated dependencies [46230db]
  - @trokky/i18n@0.1.5

## 0.1.32

### Patch Changes

- 02d4cff: fix(studio): fix MFA i18n translations and trusted devices loading
  - Fixed French i18n structure: added `mfa.disable.all` and `mfa.disable.allDesc` keys that were missing (only existed under `mfa.disableDialog`)
  - Fixed trusted devices not loading when clicking "Manage" button
  - Added loading state while fetching trusted devices
  - Fixed response parsing to handle both API response structures

- Updated dependencies [02d4cff]
  - @trokky/i18n@0.1.4

## 0.1.31

### Patch Changes

- ae80435: feat(captcha): add language option for Turnstile and reCAPTCHA widgets

  Added `language` option to CaptchaConfig to allow setting the CAPTCHA widget language (e.g., 'fr', 'en'). This enables localization of Turnstile and reCAPTCHA widgets to match the application's locale.
  - Added `language?: string` to CaptchaConfig options in @trokky/express
  - Added `language` prop to CaptchaWidgetProps and Turnstile render options in @trokky/studio

## 0.1.30

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
  - @trokky/i18n@0.1.3

## 0.1.29

### Patch Changes

- c0c937c: Add @trokky/i18n dependency for internationalization support

## 0.1.28

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

## 0.1.27

### Patch Changes

- 9e60ba7: Fix ESM import issues by adding explicit .js extensions to relative imports

  Node.js ESM requires explicit .js extensions for relative imports. This fix ensures proper module resolution when using these packages in ESM environments.

## 0.1.26

### Patch Changes

- d0dc137: Test version bump to verify changeset workflow

## 0.4.3

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

- Updated dependencies [84a8782]
  - @trokky/fields@0.4.3
  - @trokky/i18n@0.2.2

## 0.4.0

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

### Patch Changes

- 119d983: Refactor pluralization to use i18next built-in support
  - ArrayField: Use `itemCount` with count parameter for proper pluralization
  - ArrayField preview: Add i18n support and use proper pluralization
  - ReferenceField: Use `references` with count parameter for proper pluralization
  - WebhookManagement: Use `eventsCount` with proper pluralization
  - ContentViewControls: Fix French pluralization for selected items count
  - Add `selectedOfTotal_one` and `selectedOfTotal_other` keys for French singular/plural
  - Header: Widen user dropdown menu to accommodate longer translations
  - French translations: Fix missing accents (é, è, ê, ç, à, etc.) across all locale files

- Updated dependencies [7a0441b]
- Updated dependencies [119d983]
- Updated dependencies [4351835]
  - @trokky/i18n@0.2.0
  - @trokky/fields@0.4.0

## 0.3.3

### Patch Changes

- 72dbcb4: Add support for custom SVG path icons

  Studio navigation:
  - Add `svg:path-data` format for custom SVG icons with stroke style
  - Add `svg-fill:path-data` format for custom SVG icons with fill style
  - Add `svg[viewBox]:path-data` format for custom viewBox (e.g., `svg[0 0 20 20]:M12...`)
  - Default viewBox is `0 0 24 24` to match Heroicons

  IconField:
  - Add `customIcons` option to define a reusable custom icon library
  - Custom icons appear in searchable grid in Custom SVG tab
  - Toggle to "Paste new SVG" for ad-hoc custom icons
  - Live preview with stroke/fill style toggle
  - SVG path data stored in the `svg` field of IconValue
  - Export `CustomIconDefinition` type, `setCustomIcons`, `getCustomIcons`, `clearCustomIcons`, `renderSvgPath`

  Example usage:

  ```ts
  // icons.ts - Define custom icon library
  export const myCustomIcons: Record<string, CustomIconDefinition> = {
    'gavel': {
      path: 'M12 3l1.5 1.5L9 9...',
      style: 'stroke',
      label: 'Gavel',
      category: 'legal',
      tags: ['law', 'judge'],
    },
  };

  // schema.ts - Use in IconField
  {
    type: 'icon',
    options: {
      libraries: ['fontawesome', 'heroicons', 'custom'],
      customIcons: myCustomIcons,
    }
  }
  ```

- Updated dependencies [72dbcb4]
  - @trokky/fields@0.3.3

## 0.3.2

### Patch Changes

- 973dfa8: Fix Studio navigation styling and add scalable icon utility
  - Add scalable icon utility (utils/icons.tsx) that supports multiple formats:
    - "hi:icon-name" for Heroicons
    - "fa:icon-name" for FontAwesome
    - "FaIconName" for legacy FontAwesome format
    - Plain names default to Heroicons
  - Reduce document item size in navigation to be more coherent with category headers
  - Icons from structure.ts now render correctly using the new utility
  - FontAwesome icons are automatically mapped to equivalent Heroicons
  - Collapsed sidebar now renders flat icon list instead of folder icons for groups
  - Use native browser title attribute for tooltips in collapsed mode (fixes clipping issue)

## 0.3.1

### Patch Changes

- 83bc343: Add bulk selection and delete for media files in Studio
  - Add checkboxes to media grid and list views for selecting multiple files
  - Add bulk actions toolbar with "Delete Selected" button when items are selected
  - Add keyboard shortcuts: Cmd/Ctrl+A to select all, Escape to clear, Delete/Backspace to delete selected
  - Add Shift+click for range selection
  - Add bulk delete API endpoint (POST /media/bulk-delete) with up to 100 files at once
  - Add confirmation modal for bulk delete operations

## 0.2.0

### Patch Changes

- 89184fb: Add configurable output format for richtext fields

  Richtext fields now support three output formats via the `outputFormat` option:
  - `html` (default): HTML string - backwards compatible with existing content
  - `prosemirror`: ProseMirror/TipTap JSON document structure - preserves exact editor state
  - `markdown`: Markdown string - git-friendly and portable

  Example usage:

  ```typescript
  fullMessage: {
    type: "richtext",
    title: "Content",
    options: {
      outputFormat: "prosemirror" // or "html" (default) or "markdown"
    }
  }
  ```

  This change is backwards compatible - existing richtext fields continue to use HTML format by default.

- Updated dependencies [89184fb]
  - @trokky/fields@0.2.0

## 0.1.25

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

## 0.1.24

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

## 0.1.23

### Patch Changes

- 6ade09f: Fix navigation links in embedded Studio to respect basePath

  When Studio is embedded at a path like `/studio`, internal links like "Forgot password?" now correctly navigate to `/studio/forgot-password` instead of `/forgot-password`.

  Added shared navigation utilities (`getBasePath`, `getStudioPath`, `navigateTo`) and updated:
  - LoginPage: "Forgot password?" link
  - ForgotPasswordPage: "Back to Sign In" link and button
  - ResetPasswordPage: "Sign In" and "Request New Link" buttons
  - OAuthCallbackPage: Uses shared utility instead of local helper

## 0.1.22

### Patch Changes

- 225bbee: Fix OAuth login not respecting trusted devices for MFA. When logging in with Google OAuth, the system now checks if the device is already trusted and skips MFA verification, matching the behavior of username/password login. The Studio now sends deviceId in the OAuth callback request.

## 0.1.21

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

## 0.1.20

### Patch Changes

- fix: pass deviceId during login to enable MFA trusted device feature

  The trusted device feature was not working because:
  1. LoginPage.tsx wasn't generating/sending deviceId during login
  2. api-client.ts login method didn't accept deviceId parameter
  3. routes.ts login handler wasn't passing deviceId to authenticateUser

  Now when a user logs in, their device ID is sent along with credentials,
  allowing the server to check if the device is trusted and skip MFA verification.

## 0.1.19

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

## 0.1.18

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

## 0.1.17

### Patch Changes

- Update to use @trokky/fields@0.1.16 with ReferenceField improvements

## 0.1.15

### Patch Changes

- Update @trokky/fields dependency to 0.1.8 (array media add item fix)

## 0.1.14

### Patch Changes

- ## @trokky/studio

  ### New Features
  - Added Audit Logs page with full history view, user filtering, and search
  - Added Audit Logs link in Settings dropdown menu

  ### Improvements
  - ActivityFeed now dynamically fetches collections from structure endpoint
  - ActivityFeed correctly parses nested structure format (groups with items)
  - Document sidebar shows real usernames instead of user IDs
  - Document sidebar displays contributors from audit logs
  - Document sidebar shows relationships with [type] prefix
  - DocumentHistoryPanel shows real usernames
  - AuditLogEntry displays cleaner actor names

  ## @trokky/adapter-postgres-data

  ### Bug Fixes
  - Fixed audit log methods for PostgreSQL adapter

## 0.1.12

### Patch Changes

- Updated dependencies [6d79dd1]
  - @trokky/fields@0.2.0

## 0.1.9

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

## 0.1.8

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

- d0be42c: Amélioration de l'UI/UX des champs Media et du MediaBrowser

  **MediaField (@trokky/fields):**
  - Remplacement des emojis par des icônes SVG personnalisées
  - Section métadonnées repliable par défaut
  - Labels de type média corrects (Image, Video, Audio, Document, Archive)
  - Nouveau design de l'état vide aligné avec l'état rempli
  - Titre du dialogue "Add media" au lieu de "Upload media"

  **MediaBrowserContent (@trokky/studio):**
  - Ajout de la pagination (20 éléments par page)
  - Design compact avec grille 3-6 colonnes
  - Thumbnails plus petits (80px de hauteur)
  - Barre de recherche et pagination compactes
  - Meilleure responsivité

  **MediaPage (@trokky/studio):**
  - Ajout de la pagination (24 éléments par page)
  - Contrôles Previous/Next avec compteur de pages

  **MediaBrowser Modal:**
  - Modal plus compact (max-w-4xl, max-h-80vh)
  - En-tête réduit pour plus d'espace de contenu

- 1b8483d: Ajout d'un bouton de basculement pour afficher/masquer le mot de passe sur la page de connexion

  Amélioration de l'expérience utilisateur sur la page de connexion du Studio en ajoutant une icône cliquable permettant de basculer entre l'affichage et le masquage du mot de passe. Cette fonctionnalité utilise les icônes Eye/EyeSlash de Heroicons et inclut les attributs d'accessibilité appropriés.

- c57b3cd: Fix document save to include all schema fields, preventing old incompatible data from persisting when schema types change
- Updated dependencies [fe37bf9]
- Updated dependencies [d0be42c]
  - @trokky/fields@0.1.4

## 0.1.7

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
  - @trokky/fields@0.1.3

## 0.2.0

### Minor Changes

- Add comprehensive password reset functionality with secure UI flows:
  - Add ForgotPasswordPage for requesting password reset links
  - Add ResetPasswordPage with token verification and password strength validation
  - Add password reset links to LoginPage
  - Implement dark mode support for all password reset pages
  - Add visual password strength indicators and validation feedback
  - Support token expiration warnings and invalid token handling

## 0.1.5

### Patch Changes

- Final clean build of Studio with reference field fixes
  - Removed debug console logging
  - Confirmed working reference field search and selection

## 0.1.4

### Patch Changes

- Rebuild Studio with @trokky/fields v0.1.2 fix
  - Ensures reference field document ID fix is bundled in Studio assets
  - Previous build was missing the \_id field mapping fix

## 0.1.3

### Patch Changes

- Update @trokky/fields dependency to v0.1.2 with reference field fix

## 2.1.0

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
