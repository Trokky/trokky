# @trokky/fields

Universal field system for Trokky v2 CMS with 18+ built-in field types and extensible plugin architecture.

## Quick Start

```bash
npm install @trokky/fields @trokky/core
```

```typescript
import { FieldRenderer } from '@trokky/fields';

<FieldRenderer
  fieldId="title"
  value={value}
  onChange={setValue}
  definition={{
    type: 'string',
    title: 'Title',
    required: true
  }}
/>
```

## Features

- ✅ **18+ Built-in Field Types** - String, number, date, media, arrays, objects, and more
- ✅ **Plugin Architecture** - Create custom field types
- ✅ **TypeScript Native** - Full type safety and IntelliSense
- ✅ **Universal Compatibility** - Browser, Node.js, edge environments
- ✅ **Studio Integration** - React components for Trokky Studio
- ✅ **Validation System** - Built-in and custom validation
- ✅ **Conditional Logic** - Show/hide fields based on other values

## Documentation

📖 **[Complete Documentation](./docs/README.md)**

- **[Field Types Reference](./docs/field-types.md)** - All built-in field types
- **[Custom Fields Guide](./docs/custom-fields.md)** - Create custom field types  
- **[Examples](./docs/examples/)** - Practical usage examples

## Built-in Field Types

### Text Fields
- `string` - Single-line text with validation
- `textarea` - Multi-line text input
- `email` - Email with validation
- `url` - URL with validation
- `password` - Password with strength indicator
- `richtext` - Rich text editor

### Other Types
- `number` - Numeric input with formatting
- `boolean` - Checkbox/toggle
- `date` - Date/time picker
- `media`, `image`, `video`, `audio` - File uploads
- `array` - Lists with drag/drop
- `object` - Nested field groups
- `slug` - URL-safe slugs
- `reference` - Document references (typed or universal)

## Reference Field

The reference field supports both **typed references** (specific document types) and **universal references** (any document type).

### Typed Reference (Traditional)

Reference to specific document type(s):

```typescript
// Single type
{
  type: 'reference',
  title: 'Author',
  to: 'author'
}

// Multiple types
{
  type: 'reference',
  title: 'Related Content',
  to: ['article', 'video', 'faq']
}
```

### Universal Reference

Reference to any document type by omitting the `to` property:

```typescript
// Any document type
{
  type: 'reference',
  title: 'Featured Item',
  description: 'Feature any content type on this page'
  // to: undefined (omitted = universal)
}
```

### Filtered Universal Reference

Use `includeTypes` or `excludeTypes` to filter which types are available:

```typescript
// Whitelist specific types
{
  type: 'reference',
  title: 'Related Content',
  options: {
    includeTypes: ['article', 'video', 'faq', 'case-study']
  }
}

// Blacklist specific types
{
  type: 'reference',
  title: 'Any Content',
  options: {
    excludeTypes: ['draft', 'system-config', 'media']
  }
}

// Combine with other options
{
  type: 'reference',
  title: 'Related Resources',
  validation: {
    multiple: true,
    maxReferences: 5
  },
  options: {
    includeTypes: ['article', 'video'],
    groupByType: true,
    filter: "_status == 'published'"
  }
}
```

### Reference Options

| Option | Type | Description |
|--------|------|-------------|
| `includeTypes` | `string[]` | Whitelist: only allow these document types |
| `excludeTypes` | `string[]` | Blacklist: exclude these document types |
| `filter` | `string` | Filter query (e.g., `"_status == 'published'"`) |
| `groupByType` | `boolean` | Group results by document type in dropdown |
| `showPreview` | `boolean` | Show preview of referenced document |
| `allowCreate` | `boolean` | Allow creating new documents from picker |
| `displayField` | `string` | Field to display as title (default: `title`) |

### When to Use Each Type

| Use Case | Recommendation |
|----------|----------------|
| Author field on blog post | Typed: `to: 'author'` |
| Related articles | Typed: `to: 'article'` |
| Featured content (any type) | Universal: omit `to` |
| Related resources (mixed) | Filtered: `includeTypes: ['article', 'video', 'faq']` |
| Flexible page builder | Universal with `excludeTypes: ['system-config']` |

## License

MIT - see [LICENSE](../../LICENSE) for details.

## Related Packages

- [@trokky/core](../core) - Core CMS engine
- [@trokky/studio](../studio) - Admin interface
- [@trokky/client](../client) - Frontend SDK