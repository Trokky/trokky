---
"@trokky/express": patch
---

Add cryptoOptions to security config for password hashing adapter selection

This allows projects to force a specific crypto adapter type via `security.cryptoOptions.adapterType`:
- `'node'` - Use bcrypt (for backward compatibility with existing passwords)
- `'webcrypto'` - Use PBKDF2 with Web Crypto API (for edge runtimes)
- `'auto'` - Auto-detect best adapter (default)

This is critical for projects migrating to config-driven server that have existing passwords hashed with bcrypt.
