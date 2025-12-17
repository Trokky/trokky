# @trokky/i18n

## 0.1.5

### Patch Changes

- 46230db: fix: language preference showing old value and mfa.disable i18n key conflict
  - Fixed language preference page showing old language after save instead of success message
  - Fixed i18n key conflict where `mfa.disable` was used both as string (button) and object (nested keys)
  - Renamed button text key from `mfa.disable` to `mfa.disableMethod` in MFASettings component
  - Added `disableMethod` translation key to EN and FR locale files

## 0.1.4

### Patch Changes

- 02d4cff: fix(studio): fix MFA i18n translations and trusted devices loading
  - Fixed French i18n structure: added `mfa.disable.all` and `mfa.disable.allDesc` keys that were missing (only existed under `mfa.disableDialog`)
  - Fixed trusted devices not loading when clicking "Manage" button
  - Added loading state while fetching trusted devices
  - Fixed response parsing to handle both API response structures

## 0.1.3

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

## 0.1.2

### Patch Changes

- a48cd17: Add missing passkey translations for preferences page
  - Add `preferences.passkeys` translation (EN/FR)
  - Add `preferences.passkeysDescription` translation (EN/FR)

## 0.1.1

### Patch Changes

- b013212: Add i18n translations for passkey authentication feature
  - Add English translations for passkey manager, registration, and login
  - Add French translations for passkey manager, registration, and login
  - Includes translations for error messages, UI labels, and descriptions

## 0.2.2

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

## 0.2.1

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

## 0.2.0

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

- 119d983: Refactor pluralization to use i18next built-in support
  - ArrayField: Use `itemCount` with count parameter for proper pluralization
  - ArrayField preview: Add i18n support and use proper pluralization
  - ReferenceField: Use `references` with count parameter for proper pluralization
  - WebhookManagement: Use `eventsCount` with proper pluralization
  - ContentViewControls: Fix French pluralization for selected items count
  - Add `selectedOfTotal_one` and `selectedOfTotal_other` keys for French singular/plural
  - Header: Widen user dropdown menu to accommodate longer translations
  - French translations: Fix missing accents (é, è, ê, ç, à, etc.) across all locale files

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
