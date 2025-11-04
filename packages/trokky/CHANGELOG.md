# @trokky/trokky

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
