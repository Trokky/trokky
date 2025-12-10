---
"@trokky/routes": patch
"@trokky/adapter-filesystem-data": patch
---

Fix document status being reset to draft on update

- Routes: Preserve `_status` from existing document when updating unless explicitly provided in update data
- Adapter: Use `_status` from update data if provided, otherwise preserve existing status
