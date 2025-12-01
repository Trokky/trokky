---
"@trokky/core": patch
---

Fix NodeCryptoAdapter loading in ESM environments

- Use top-level `import { createRequire } from 'module'` for ESM compatibility
- Properly load NodeCryptoAdapter (bcrypt + jsonwebtoken) when `adapterType: 'node'` is specified
- Fixes password verification failures when existing passwords were hashed with bcrypt
