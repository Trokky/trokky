---
"@trokky/fields": patch
---

Fix default values not applied to nested object fields in ArrayField

When adding a new item to an array of objects, default values defined on nested fields (e.g., `videoType: { default: "youtube" }`) are now properly applied to the new item.
