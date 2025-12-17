---
"@trokky/i18n": patch
---

fix: complete French translations for API Tokens management

- Added missing `searchPlaceholder` key
- Fixed `noTokensDesc` key name (was `noTokensDescription`)
- Fixed `tableHeaders.token` key name (was `name`)
- Added missing `status.inactive` key
- Added `never` key at root level (was nested incorrectly)
- Added modal keys: `description`, `descriptionPlaceholder`, `expiration30days`, `expiration90days`, `expiration1year`, `expirationNever`, `expirationCustom`, `cancel`, `createToken`
- Added `tokenCreated.yourToken` and `tokenCreated.close` keys
- Fixed `deleteConfirm` key name (was `confirmDelete`)