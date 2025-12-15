# @trokky/types

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

## 0.1.2

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

## 0.1.1

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
