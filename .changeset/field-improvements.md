---
"@trokky/fields": minor
---

Add InfoField and improve field wrapper behavior

**New Features:**
- Add InfoField for displaying informational messages in Studio with markdown support, variants (info/warning/tip/success/error), and collapsible functionality
- Add `hideLabel` property to BaseFieldDefinition to allow fields to hide the Studio's automatic label wrapper

**Improvements:**
- Update FieldWrapper to display field descriptions on a new line below the label for better readability
- Refactor ObjectField to use FieldWrapper for nested fields, ensuring consistency with hideLabel, error styling, and validation states
- Fix ArrayField drag-and-drop to only trigger from grip handle, preventing conflicts with interactive elements like sliders and inputs
