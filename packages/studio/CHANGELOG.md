# @trokky/studio

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
