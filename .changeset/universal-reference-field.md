---
"@trokky/fields": minor
---

Add universal reference field support

Reference fields can now link to any document type when the `to` property is omitted. This enables flexible content relationships without requiring pre-defined target types.

Features:
- Universal references: Omit `to` to allow references to any document type
- Type filtering: Use `includeTypes` and `excludeTypes` options to filter available types
- Dynamic type loading: Document types are fetched from the schema registry
- Visual indicator: "Any type" badge shows when a field is universal
- Full backward compatibility: Existing typed references work unchanged

Example usage:
```typescript
// Universal reference (any document type)
{
  type: 'reference',
  title: 'Featured Content'
  // to: undefined (omitted = universal)
}

// Filtered universal reference
{
  type: 'reference',
  title: 'Related Content',
  options: {
    includeTypes: ['article', 'video', 'faq'],
    excludeTypes: ['draft']
  }
}
```
