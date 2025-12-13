# @trokky/fields

## 0.4.2

### Patch Changes

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
  - @trokky/i18n@0.2.1

## 0.4.1

### Patch Changes

- 40dc4dd: Fix default values not applied to nested object fields in ArrayField

  When adding a new item to an array of objects, default values defined on nested fields (e.g., `videoType: { default: "youtube" }`) are now properly applied to the new item.

## 0.4.0

### Minor Changes

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

## 0.3.0

### Minor Changes

- 7042126: Add universal reference field support

  Reference fields can now link to any document type when the `to` property is omitted. This enables flexible content relationships without requiring pre-defined target types.

  Features:
  - Universal references: Omit `to` to allow references to any document type
  - Type filtering: Use `includeTypes` and `excludeTypes` options to filter available types
  - Dynamic type loading: Document types are fetched from the schema registry
  - Visual indicator: "Any type" badge shows when a field is universal
  - Full backward compatibility: Existing typed references work unchanged

  Example usage:

  ```typescript
  // Universal reference (any document type)
  {
    type: 'reference',
    title: 'Featured Content'
    // to: undefined (omitted = universal)
  }

  // Filtered universal reference
  {
    type: 'reference',
    title: 'Related Content',
    options: {
      includeTypes: ['article', 'video', 'faq'],
      excludeTypes: ['draft']
    }
  }
  ```

## 0.2.1

### Patch Changes

- 9ce217d: Fix richtext output to use relative URLs instead of absolute URLs

  Images in HTML and Markdown formats now use relative paths (`/api/media/...`) instead of absolute URLs (`http://localhost:3000/api/media/...`) for portability across environments.

## 0.2.0

### Minor Changes

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

## 0.1.16

### Patch Changes

- 52552ba: ArrayField and ReferenceField UI improvements:
  - Add footer with "+ Add item" button at bottom of array (nested view)
  - Auto-scroll to newly added items
  - Fix text truncation for long reference titles
  - Hide X button on reference items when used inside ArrayField (ArrayField has its own trash button)
  - Add filter option to ReferenceField for filtering search results

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
