---
"@trokky/trokky": patch
---

fix(cli): Add media processing section to project generator

The `trokky create` command now generates a complete `media` configuration section including:
- Sharp processor configuration
- Image variants (thumbnail, medium, large) with WebP format
- Upload limits (50MB max file size, allowed MIME types)
- Sharp dependency in package.json
