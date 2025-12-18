---
"@trokky/core": patch
"@trokky/routes": patch
"@trokky/adapter-filesystem-media": patch
"@trokky/adapter-filesystem": patch
"@trokky/studio": patch
"@trokky/i18n": patch
---

Fix media listing to show newly uploaded files and accurate pagination

BREAKING CHANGE: `MediaStorageAdapter.listMedia()` now returns `MediaListResult` (`{ items, total }`) instead of `MediaFile[]`

Changes:
- Add default sorting by date descending (newest first) so new uploads appear at the top
- Change `listMedia` return type to `MediaListResult` for accurate pagination
- Update API response `meta` to include `total` count (total files in storage) alongside `count` (items in current page)
- Fix `hasMore` calculation to use actual total count instead of page size comparison
- Studio: Fetch all media files for proper client-side filtering and pagination
- Studio: Fix StatsWidget to use `meta.total` for accurate media count
- Studio: Add sort options (date, name, size) to Media Library
- Studio: Add items per page selector (28, 56, 84, 112) to Media Library with validation
- Studio: Increase default items per page from 24 to 56 (multiples of 7 for clean grid rows)
- i18n: Add translations for sort options, pagination, and common.title

Migration Guide:
If you have implemented a custom MediaStorageAdapter, update your listMedia method:

```typescript
// Before
async listMedia(options?: MediaListOptions): Promise<MediaFile[]> {
  const files = await getFiles()
  return files
}

// After
async listMedia(options?: MediaListOptions): Promise<MediaListResult> {
  const files = await getFiles()
  return { items: files, total: files.length }
}
```
