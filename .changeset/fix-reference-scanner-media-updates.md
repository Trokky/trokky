---
"@trokky/trokky": patch
---

Fix media reference updates in backup/restore with object-based field schemas

The reference scanner was failing to update media references when restoring backups
because it couldn't properly handle object-based field schemas (where fields are
defined as `{ fieldName: { type: "media", ... } }` instead of an array).

When schemas used object-based fields, `Object.values(fields)` returned field
definitions without the field name property, causing the scanner to skip all fields
including media references like `_thumbnail`. This resulted in restored documents
having invalid media IDs from the backup instead of the new IDs from the restored
media files.

Changes:
- Convert object-based field schemas to arrays with proper `name` property
- Apply fix to both `scanValue()` and `updateValue()` methods
- Fix TypeScript spread operator type safety with media fields
- Fix Promise type signature in backup command

Results:
- Media references now update correctly (27 references vs 0 before)
- Restored documents have valid media IDs pointing to new files
- Images and media assets load properly after restoration
