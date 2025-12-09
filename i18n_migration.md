# i18n Migration Tracker

This document tracks the progress of internationalizing (i18n) the Trokky CMS codebase.

## Overview

- **i18n Library**: i18next + react-i18next
- **Hook**: `useT` from `@trokky/i18n`
- **Supported Locales**: English (en), French (fr)
- **Namespaces**: `studio`, `fields`, `common`, `auth`, `errors`

---

## Fields Package (`@trokky/fields`)

### Field Components

- [x] ArrayField - Full i18n migration
- [x] MediaField - Full i18n migration
- [x] NumberField - Full i18n migration
- [x] ObjectField - Full i18n migration
- [x] ReferenceField - Full i18n migration
- [x] StringField - Full i18n migration
- [x] BooleanField - Full i18n migration
- [x] ColorField - Full i18n migration
- [x] DateField - Full i18n migration
- [x] EmailField - Full i18n migration
- [x] GeoCoordinateField - Full i18n migration
- [x] IconField - Full i18n migration
- [x] InfoField - Full i18n migration
- [x] PasswordField - Full i18n migration
- [x] PortableTextField - Full i18n migration
- [x] RichTextField - Full i18n migration
- [x] SlugField - Full i18n migration
- [x] TextareaField - Full i18n migration
- [x] URLField - Full i18n migration

### Field Modals & Helpers

- [x] ArrayModal - Full i18n migration
- [x] ObjectModal - Full i18n migration
- [x] FieldWrapper - Full i18n migration (auto-field translation support)

---

## Studio Package (`@trokky/studio`)

### Pages

- [x] DashboardPage
- [x] LoginPage
- [x] UsersPage
- [x] ContentPage
- [x] MediaPage
- [x] SettingsPage
- [x] AuditLogsPage
- [x] UserPreferencesPage
- [x] NotFoundPage
- [x] ForgotPasswordPage
- [x] ResetPasswordPage
- [x] OAuthCallbackPage
- [x] DeviceAuthPage
- [x] AuthorizePage
- [ ] FieldsDemo (demo page, low priority)

### Layout Components

- [x] MainSidebar
- [x] Header
- [x] StudioLayout
- [x] ContextSidebar

### Document Components

- [x] DocumentEditor
- [ ] DocumentEditorContext (no UI strings - just TypeScript types)
- [x] DocumentForm
- [x] DocumentHeader
- [x] DocumentSidebar
- [x] DocumentHistoryPanel
- [ ] DocumentStates (configuration file - no UI strings)
- [x] ChangesDiff
- [x] AuditLogEntry

### Content Components

- [x] ContentViewControls
- [x] ChangeStatusModal
- [x] Pagination
- [x] views/GridView
- [x] views/KanbanView
- [x] views/ListView
- [x] views/TableView

### Media Components

- [x] MediaBrowser
- [x] MediaBrowserContent

### User/Auth Components

- [x] UserManagement
- [x] AppTokenManagement
- [x] WebhookManagement
- [x] ChangePasswordModal
- [x] GoogleLoginButton - Full i18n migration
- [x] OAuthProvidersList
- [x] MFAVerification
- [x] MFASettings
- [x] CaptchaWidget
- [x] PermissionGuard (no UI strings)
- [x] SessionTimeoutWarning

### Dashboard Components

- [x] StatsWidget
- [x] DashboardContextSidebar (no UI strings - wrapper component)
- [x] ActivityFeed

### Context Sidebar Components

- [x] WidgetRenderer
- [x] widgets/RecentDocumentsWidget
- [x] ContentContext
- [x] StructureContextSidebar

### UI Components

- [x] Button (no UI strings)
- [x] ConfirmDialog
- [x] ErrorBoundary (with TranslatedErrorBoundary wrapper)
- [x] Input (no UI strings - label/error/helperText are props)
- [x] LoadingSpinner (no UI strings - message is prop)
- [x] Modal (no UI strings - title is prop)
- [x] Toast
- [x] Checkbox (no UI strings)

### Other Components

- [x] SimpleSearchModal
- [x] PermissionsDebugPanel

---

## Pluralization Refactor

Currently using conditional approach:
```typescript
{count !== 1 ? t('items') : t('item')}
```

Should refactor to use i18next built-in pluralization:
```typescript
t('itemCount', { count })
```

With locale keys:
```json
{
  "itemCount": "{{count}} item",
  "itemCount_plural": "{{count}} items"
}
```

### Components to Refactor for Proper Pluralization

- [ ] ArrayField - item/items count
- [ ] ObjectField - field/fields count
- [ ] ReferenceField - reference count, available count
- [ ] MediaField - file count (if applicable)
- [ ] StatsWidget - document/media/user counts
- [ ] Pagination - item counts
- [ ] Any component showing counts

---

## Locale Files to Update

### English (`en`)
- [x] `locales/en/studio.json` - Studio UI strings
- [x] `locales/en/fields.json` - Field component strings
- [ ] `locales/en/common.json` - Common/shared strings
- [ ] `locales/en/auth.json` - Authentication strings
- [ ] `locales/en/errors.json` - Error messages

### French (`fr`)
- [x] `locales/fr/studio.json` - Studio UI strings
- [x] `locales/fr/fields.json` - Field component strings
- [ ] `locales/fr/common.json` - Common/shared strings
- [ ] `locales/fr/auth.json` - Authentication strings
- [ ] `locales/fr/errors.json` - Error messages

---

## Notes

- Always run `npm run build` after changes to verify no TypeScript errors
- Run `npm run build:single` in Studio package for single-bundle build
- Test both English and French locales in the browser
- Use browser console `window.TrokkyLogger.setLevel('debug')` to debug i18n issues

---

## Progress Summary

- **Fields Package**: 19/19 components migrated (COMPLETE)
- **Studio Pages**: 14/15 pages migrated (only FieldsDemo remaining)
- **Studio Components**: 46/~47 components migrated
  - Layout: MainSidebar, Header, StudioLayout, ContextSidebar
  - Document: DocumentEditor, DocumentForm, DocumentHeader, DocumentSidebar, DocumentHistoryPanel, ChangesDiff, AuditLogEntry
  - Content: ContentViewControls, ChangeStatusModal, Pagination, GridView, KanbanView, ListView, TableView
  - Media: MediaBrowser, MediaBrowserContent
  - User/Auth: UserManagement, AppTokenManagement, WebhookManagement, ChangePasswordModal, OAuthProvidersList, MFAVerification, MFASettings, CaptchaWidget, SessionTimeoutWarning, PermissionGuard (no UI strings)
  - Dashboard: StatsWidget, ActivityFeed, DashboardContextSidebar (no UI strings)
  - Context Sidebar: WidgetRenderer, RecentDocumentsWidget, ContentContext, StructureContextSidebar
  - UI: ConfirmDialog, ErrorBoundary, Toast, Button/Input/LoadingSpinner/Modal/Checkbox (no UI strings)
  - Other: SimpleSearchModal, PermissionsDebugPanel
- **Pluralization**: Not yet refactored

Last Updated: 2025-12-08
