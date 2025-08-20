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
- `reference` - Document references

## License

MIT - see [LICENSE](../../LICENSE) for details.

## Related Packages

- [@trokky/core](../core) - Core CMS engine
- [@trokky/studio](../studio) - Admin interface
- [@trokky/client](../client) - Frontend SDK