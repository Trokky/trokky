# @trokky/trokky

## 0.1.4

### Patch Changes

- 2c04e42: Add schema evolution handling to restore command

  The restore command now handles schema evolution issues that cause validation
  failures when restoring old backups to updated schemas. This fixes issues like
  nullable fields becoming non-nullable or old media formats being incompatible
  with new schemas.

  Changes:
  - Add sanitizeDocument() function to clean documents before restoration
  - Remove null values (schemas may have changed from nullable to non-nullable)
  - Remove empty objects (may have required nested fields in new schema)
  - Remove old media format (src-based instead of asset.\_ref)

  Results:
  - 100% restoration success rate (115/115 documents vs 112/115 before)
  - Fixes mega-menu validation failures (featuredContent.image: Invalid input)
  - Fixes reseau-page validation failures (heroSubtitle: Expected string, received null)
  - Maintains all reference updates (27 references) and media restoration (43 files)

- a65a842: Fix restore command to handle schema evolution and singleton documents

  **Schema Evolution Support:**
  - Automatically remove null values from backup data during restore
  - Prevents validation errors when schemas become stricter over time
  - Handles nested objects and arrays recursively

  **Singleton Document Fixes:**
  - Fixed singleton document restoration to use POST (create) instead of PUT
  - Properly handles creating singletons that don't exist yet
  - Falls back to PUT (update) if singleton already exists (409 conflict)

  **System Fields Cleanup:**
  - Remove all system-managed fields from backup data before restore
  - Added `_createdBy`, `_updatedBy`, `_createdByType`, `_updatedByType` to removal list
  - Prevents validation errors from system fields in backup data

  **Bug Fixes:**
  - Fixes restore failures with HTTP 400 validation errors
  - Resolves "Expected string, received null" errors
  - Resolves "Cannot PUT" errors for singleton documents
  - Enables successful restoration of backups created with older schemas

  **Technical Details:**
  - Added `sanitizeDocument()` function to recursively remove null values
  - Null values in objects are omitted entirely (schema provides defaults)
  - Null values in arrays are filtered out
  - Applied before document creation/update to ensure clean data
  - Singleton documents now use create-first approach with update fallback

  This is critical for production deployments where schemas evolve over time.

## 0.1.3

### Patch Changes

- 2bc98cf: Fix media reference updates in backup/restore with object-based field schemas

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

## 0.1.2

### Patch Changes

- 2f7ef9b: Improve media deletion reliability and performance

  **CLI Improvements:**
  - Add parallel batch deletion (10 files at a time) for faster clean operations
  - Track failed deletions and display detailed error summary
  - Add verification step after deletion to detect orphaned files
  - Display batch progress during large delete operations

  **Adapter Improvements:**
  - Delete metadata files FIRST before physical files to prevent orphaned listings
  - Since listMedia() uses metadata as source of truth, this ensures failed file deletions don't appear in subsequent listings
  - Better error logging for filesystem issues during deletion

  **Benefits:**
  - 10x faster deletion for large media collections
  - More reliable cleanup - single clean run should now work in most cases
  - Better error reporting helps identify permission or I/O issues
  - Automatic retry suggestion for failed deletions

## 0.1.1

### Patch Changes

- Fix media deletion bug in filesystem adapter

  The deleteFile method was silently catching all errors during file deletion, making it impossible to detect when deletions failed. Now only ENOENT errors are ignored, while all other errors (permissions, I/O issues) are properly reported.
