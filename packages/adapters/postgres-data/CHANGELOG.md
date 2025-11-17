# @trokky/adapter-postgres-data

## 0.1.3

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

## 0.1.2

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
