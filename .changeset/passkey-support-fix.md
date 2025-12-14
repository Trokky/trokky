---
"@trokky/core": patch
"@trokky/express": patch
"@trokky/adapter-postgres-data": patch
"@trokky/studio": patch
"@trokky/routes": patch
---

fix: passkey authentication support

- fix(express): pass passkey config from security section to TrokkyCore
- fix(core): export PasskeyConfig type for external use
- fix(express): add passkey property to SecurityConfig interface and defaults
- fix(adapter-postgres-data): add passkeys column support (schema, migrations, CRUD operations)
- fix(studio): use correct storageService.set() method in passkey login handler
- fix(routes): change passkey status debug log from info to debug level
