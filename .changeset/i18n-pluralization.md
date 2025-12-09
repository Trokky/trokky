---
"@trokky/fields": patch
"@trokky/studio": patch
"@trokky/i18n": patch
---

Refactor pluralization to use i18next built-in support

- ArrayField: Use `itemCount` with count parameter for proper pluralization
- ArrayField preview: Add i18n support and use proper pluralization
- ReferenceField: Use `references` with count parameter for proper pluralization
- WebhookManagement: Use `eventsCount` with proper pluralization
- ContentViewControls: Fix French pluralization for selected items count
- Add `selectedOfTotal_one` and `selectedOfTotal_other` keys for French singular/plural
- Header: Widen user dropdown menu to accommodate longer translations
