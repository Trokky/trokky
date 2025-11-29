---
"@trokky/routes": patch
---

Security: Redact sensitive filesystem paths from media metadata responses

- Added `sanitizeMediaResponse()` to strip internal paths from API responses
- Removes `path`, `storagePath`, `absolutePath`, `relativePath`, `filePath` from metadata
- Keeps safe fields like `extension`, `originalFilename`, `width`, `height`
- Applied to all media endpoints: getMedia, listMedia, uploadMedia, updateMedia
