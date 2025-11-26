---
"@trokky/trokky": patch
---

Fix reference mapping during backup restore

**Bug Fixes:**
- Fix ID extraction in restore to use `_id` property (API returns `_id` not `id`)
- Fix arrays of direct references not being updated (e.g., `of: { type: "reference" }`)
- Fix `video` field type references not being mapped (only `media` and `image` were handled)

**Improvements:**
- Centralize media asset types in `MEDIA_ASSET_TYPES` constant for easier extensibility
- Support additional media-like types: `audio`, `file` (in addition to `media`, `image`, `video`)
