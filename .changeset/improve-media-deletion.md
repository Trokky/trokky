---
"@trokky/adapter-filesystem": patch
"@trokky/adapter-filesystem-media": patch
"@trokky/trokky": patch
---

Improve media deletion reliability and performance

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
