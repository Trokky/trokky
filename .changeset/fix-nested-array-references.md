---
"@trokky/trokky": patch
---

Fix nested media reference updates in array-of-objects fields

The reference scanner now properly handles media references nested inside array items
that are objects (e.g., testimonials with photos, gallery items). Previously, when
scanning arrays like `testimonialCards: [{ name, photo }]`, the scanner would fail to
detect and update the `photo` media references inside each array item.

Changes:
- Update scanValue() to pass object fields when array items are object types
- Update updateValue() to correctly handle nested object fields in arrays
- Ensures proper field resolution for deeply nested media/reference fields

Results:
- Testimonial photos now update correctly (27 → 30 references updated)
- All nested media in array-of-objects fields are properly scanned
- Fixes "Failed to load media asset" errors for nested media references
