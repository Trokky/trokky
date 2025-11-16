---
"@trokky/core": patch
---

Fix media field validation to accept null values

Media fields can now properly accept null when the field is removed in Studio.
Previously, removing a media field would cause a validation error because the
validator only accepted string IDs or media objects, but not null values.

This fix allows optional media fields to be properly cleared without validation errors.
