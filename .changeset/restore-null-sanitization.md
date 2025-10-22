---
"@trokky/trokky": patch
---

Fix restore command to handle schema evolution and singleton documents

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
