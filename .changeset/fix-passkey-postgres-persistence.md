---
"@trokky/adapter-postgres-data": patch
---

Fix passkey persistence in PostgreSQL adapter

- Add `getUserByPasskeyCredentialId` method for passkey authentication lookup
- Add GIN index on `passkeys` column for efficient JSONB containment queries
- Fix migrations to include `table_schema` in column existence checks (prevents issues with multiple schemas)
- Add constructor validation for schema and table prefix to prevent SQL injection
- Add credential ID format validation (base64url) for security
