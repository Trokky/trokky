---
"@trokky/adapter-postgres-data": patch
---

fix: implement webhook persistence methods in PostgreSQL adapter

The PostgreSQL adapter had the webhooks table schema but was missing the actual
CRUD methods to store/retrieve webhooks. This caused webhooks to only persist
in memory and be lost on server restart.

Added:
- `getWebhook(id)` - Retrieve a webhook by ID
- `saveWebhook(id, webhookData)` - Create or update a webhook
- `listWebhooks(options)` - List webhooks with filtering and pagination
- `deleteWebhook(id)` - Remove a webhook
