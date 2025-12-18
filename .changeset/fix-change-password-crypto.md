---
"@trokky/routes": patch
"@trokky/core": patch
---

fix: use core's crypto adapter for password change operations

Fixed a bug where the change password functionality was using a separately detected crypto adapter instead of the core's configured adapter. This caused password verification to fail with "Invalid character" error when:

- The user's password was hashed using bcrypt (NodeCryptoAdapter)
- The change password route detected WebCryptoAdapter (available in Node.js 18+)
- WebCryptoAdapter attempted to decode bcrypt hash as base64, which failed

The fix ensures consistent crypto adapter usage by calling `core.verifyPassword()` and `core.hashPassword()` instead of `detectCryptoAdapter()` directly, matching how password-reset.ts handles password operations.

Breaking change: Removed `detectCryptoAdapter` from public exports in `@trokky/core`. This function was an internal implementation detail and should not be used directly. Use `core.hashPassword()` and `core.verifyPassword()` instead.
