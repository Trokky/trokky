---
"@trokky/trokky": patch
---

Persist `lastLoginAt` on the Postgres adapter.

`updateUserRow`, shared by `saveUser` and `saveUserIf`, enumerated the columns it COALESCEs and omitted `last_login_at`, so every login wrote the value and Postgres discarded it. The filesystem adapter persisted it, so the two backends disagreed. The column already exists in the table definition, so no migration is needed for existing databases.
