---
"@trokky/adapter-postgres-data": patch
"@trokky/core": patch
"@trokky/types": patch
"@trokky/routes": patch
"@trokky/studio": patch
"@trokky/i18n": patch
---

## Bug Fixes

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
