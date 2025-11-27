# @trokky/fields

## 0.1.8

### Patch Changes

- Fix array field "Add item" not working for media type items - properly handle empty media state in MediaField component

## 0.1.7

### Patch Changes

- Allow slashes in slug fields by default
  - Changed `allowSlashes` default from `false` to `true`
  - Updated UI component to accept `/` in keyboard input, paste, and change handlers
  - Enables hierarchical paths like `a-propos/histoire` without explicit configuration

## 0.1.4

### Patch Changes

- fe37bf9: Add IconField component for visual icon selection
  - Support for FontAwesome and Heroicons libraries
  - Grid view with search and filtering by style/category
  - Pagination for large icon sets
  - Schema options to restrict to single library or allow multiple
  - Preview component for displaying selected icons

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

## 0.1.2

### Patch Changes

- Fix reference field search and selection - use \_id instead of id for document IDs
  - Fixed search filtering to correctly map document.\_id to result.id
  - Fixed selection handling to properly identify selected references
  - Added backward compatibility by using doc.\_id || doc.id fallback pattern

## 0.1.0

### Minor Changes

- Initial beta release

  Core functionality:
  - Field system with TypeScript-first definitions and Zod validation
  - React components for all field types
  - Preview components for read-only display
  - Field registry for plugin management
