---
"@trokky/core": patch
"@trokky/routes": patch
---

OAuth: Skip consent screen for login mode, only show account picker

- Login mode now uses `prompt=select_account` - shows account picker but skips consent if already granted
- Link mode still uses `prompt=consent` to ensure refresh token is obtained
