---
"@trokky/trokky": patch
---

Warn when a singleton's stored document id differs from the id its structure names, give the storage and mail adapters a teardown path so a process can exit cleanly, and move nodemailer from 6 to 10.

The stored-id check reads the identity from both `id` and `_id`: filesystem-data returns one and postgres-data the other, so reading a single field made the check silently inert on Postgres — which is what the deployed instances run.
