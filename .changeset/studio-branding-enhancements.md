# Studio Branding Enhancements

## Summary
Enhanced Studio branding system with configurable organization name, colors, and logo. Added support for storing branding configuration in backend database and displaying it across authentication pages and throughout the entire authenticated Studio interface.

## Packages Affected

### @trokky/core - MINOR bump (new features)
- **Added** `organizationName`, `primaryColor`, `secondaryColor`, `logo` fields to `SettingsConfig` interface
- **Location**: `packages/core/src/types/storage-adapters.ts`

### @trokky/routes - PATCH bump (bug fixes/improvements)
- **Changed** `/api/config/studio` endpoint to be public (no authentication required)
- **Added** branding merge logic from database settings
- **Added** support for saving branding fields via `/api/config/settings`
- **Enhanced** `/api/config/structure` endpoint to enrich documentList items with schema titles
- **Added** `enrichStructureWithSchemaInfo()` method to add `schemaTitle` field to documentList items
- **Location**: `packages/routes/src/routes.ts`

### @trokky/adapter-postgres-data - PATCH bump (bug fixes/improvements)
- **Implemented** `getSettings()` method to retrieve settings including branding from database
- **Implemented** `saveSettings()` method to persist branding configuration
- **Fixed** table name handling using `this.tableName()` helper
- **Location**: `packages/adapters/postgres-data/src/postgres-data-adapter.ts`

### @trokky/studio - MINOR bump (new features)
- **Added** shared branding utilities (`packages/studio/src/utils/branding.ts`):
  - `hexToRgb()` - Convert hex colors to RGB format
  - `applyBrandColors()` - Apply brand colors to CSS variables
  - `fetchBranding()` - Fetch branding from API
  - `BrandingConfig` interface
- **Enhanced** `LoginPage.tsx`:
  - Refactored to use shared branding utilities
  - Title now uses primary brand color
  - Fetches and applies branding before authentication
- **Enhanced** `ForgotPasswordPage.tsx`:
  - Added branding support using shared utilities
  - Titles use primary brand color
  - Fetches and applies branding from API
- **Enhanced** `SettingsPage.tsx`:
  - Added UI fields for organization name, primary color, secondary color, logo
  - Color pickers for brand colors
  - Logo preview
  - Save branding to backend
- **Enhanced** `App.tsx`:
  - Load branding globally on app startup
  - Apply CSS custom properties for dynamic theming
  - Listen for settings updates to refresh branding in real-time
  - Pass branding to StudioContextProvider
  - Update document title immediately when branding loads (fixes inconsistent title on login page)
- **Enhanced** `StudioContext.tsx`:
  - Accept branding prop and distribute through context
  - Make branding available to all Studio components
- **Enhanced** `Header.tsx`:
  - Use branding from StudioContext
  - Display organization name instead of default "Trokky Studio"
  - Show custom logo when configured
  - Create menu now displays schema titles (e.g., "Service") instead of structure titles (e.g., "Liste des Services")
- **Added** `useStudioBranding.ts` hook:
  - Convenience hook for accessing branding from StudioContext
- **Enhanced** `useDocumentTitle.ts`:
  - Simplified to use branding.title directly from API (already merged with correct priority on backend)
  - Removed redundant authentication checks and fallback logic
  - Consistent document title across login and authenticated states

## Breaking Changes
None. All changes are backward compatible with fallback to default branding.

## Migration Guide
No migration required. Existing installations will continue to work with default branding. To configure branding:

1. Navigate to Studio Settings
2. Configure Organization Name, Primary Color, Secondary Color, and Logo URL
3. Save changes
4. Branding will be applied throughout the entire Studio interface (login, forgot password, header, and all pages)

## Testing Done
- ✅ Settings save successfully to PostgreSQL database
- ✅ Branding loads on login page before authentication
- ✅ Colors apply correctly via CSS custom properties
- ✅ Forgot password page uses brand colors
- ✅ Settings page displays color pickers and logo preview
- ✅ Header displays organization name and custom logo
- ✅ Branding distributed throughout app via StudioContext
- ✅ Real-time branding updates when settings change
- ✅ All UI elements using primary/secondary Tailwind classes reflect brand colors
- ✅ Create menu displays schema titles (e.g., "Service", "some schemas") instead of structure titles
- ✅ Create menu only shows documentList items (collections), not singletons
- ✅ Structure API enriches documentList items with `schemaTitle` field
- ✅ Tested with npm link in a production site-trokky project

## Database Changes
- Uses existing `settings` table
- Branding stored in JSONB `config` column:
  ```json
  {
    "organizationName": "string",
    "primaryColor": "#hex",
    "secondaryColor": "#hex",
    "logo": "url"
  }
  ```

## API Changes
- `/api/config/studio` - Now public (no auth required) to support branding on login page
- `/api/config/settings` PUT - Now accepts branding fields in settings payload

## Files Changed
- `packages/core/src/types/storage-adapters.ts`
- `packages/routes/src/routes.ts`
- `packages/adapters/postgres-data/src/postgres-data-adapter.ts`
- `packages/studio/src/utils/branding.ts` (new file)
- `packages/studio/src/pages/LoginPage.tsx`
- `packages/studio/src/pages/ForgotPasswordPage.tsx`
- `packages/studio/src/pages/SettingsPage.tsx`
- `packages/studio/src/app/App.tsx`
- `packages/studio/src/contexts/StudioContext.tsx`
- `packages/studio/src/components/layout/Header.tsx`
- `packages/studio/src/hooks/useStudioBranding.ts` (new file)

## Version Bump Summary
```
@trokky/core: 0.1.x -> 0.2.0 (MINOR - new fields in SettingsConfig)
@trokky/routes: 0.1.x -> 0.1.y (PATCH - endpoint improvements)
@trokky/adapter-postgres-data: 0.1.x -> 0.1.y (PATCH - implementation fixes)
@trokky/studio: 0.2.0 -> 0.3.0 (MINOR - new branding features)
```

## Implementation Details

### Architecture
The branding system uses a layered approach:
1. **App.tsx** - Loads branding once on startup, applies CSS custom properties globally
2. **StudioContext** - Distributes branding to all components via React Context
3. **CSS Variables** - Dynamic theming via `--color-primary-*` and `--color-secondary-*`
4. **Components** - Access branding via context or use Tailwind classes that reference CSS variables

### Key Features
- Single source of truth for branding loaded at app level
- Real-time updates when settings change via custom events
- All Tailwind classes using `primary-*` or `secondary-*` automatically reflect configured colors
- Fallback to default "Trokky Studio" branding if API fails or values are empty
- Backward compatible - existing installations work without configuration

## Notes
- All helper functions consolidated in shared utility to avoid code duplication
- Branding fetched from API using public endpoint
- CSS custom properties used for dynamic theming
- Fallback to default "Trokky Studio" branding if API fails
