---
"@trokky/client": patch
---

fix(client): Fix ImageUrlBuilder proxyPath generating double /media/ in URLs

When using `proxyPath: '/media'`, the builder was generating `/media/media/{id}/file` instead of `/media/{id}/file`.

Changes:
- `proxyPath` now replaces the entire base path (no `/media/` prefix added)
- Proxy mode uses query params (`?w=800`) instead of `/variants/` path
- Direct mode (no proxyPath) continues to use `/variants/` path for named variants
