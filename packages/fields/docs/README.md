# @trokky/fields

A universal, extensible field system for Trokky v2 CMS. This package provides a rich collection of built-in field types and a plugin architecture for creating custom fields.

## Overview

The @trokky/fields package is the heart of Trokky's content modeling system. It provides:

- **18+ Built-in Field Types** - From simple strings to complex rich text and media fields
- **Plugin Architecture** - Extensible system for custom field types
- **Universal Compatibility** - Works in browser, Node.js, and edge environments
- **TypeScript Native** - Full type safety and IntelliSense support
- **Studio Integration** - React components ready for Trokky Studio

## Quick Start

### Installation

```bash
npm install @trokky/fields @trokky/core
```

### Basic Usage

```typescript
import { FieldRenderer, fieldRegistry } from '@trokky/fields';

// Use in React component
function MyForm() {
  return (
    <FieldRenderer
      fieldId="title"
      value={titleValue}
      onChange={setTitleValue}
      definition={{
        type: 'string',
        title: 'Article Title',
        required: true,
        validation: {
          maxLength: 100
        }
      }}
    />
  );
}
```

### Schema Definition

```typescript
// Define a content schema using field types
const blogPostSchema = {
  name: 'blogPost',
  title: 'Blog Post',
  type: 'document',
  fields: {
    title: {
      type: 'string',
      title: 'Title',
      required: true,
      validation: { maxLength: 100 }
    },
    content: {
      type: 'richtext',
      title: 'Content',
      required: true
    },
    publishedAt: {
      type: 'date',
      title: 'Published Date',
      options: { 
        includeTime: true 
      }
    },
    featured: {
      type: 'boolean',
      title: 'Featured Post',
      defaultValue: false
    }
  }
};
```

## Built-in Field Types

### Text Fields
- **string** - Single-line text input with validation options
- **textarea** - Multi-line text input
- **email** - Email input with validation
- **url** - URL input with validation  
- **password** - Password input with strength indicator
- **richtext** - Rich text editor with formatting controls

### Number Fields
- **number** - Numeric input with range validation
- **boolean** - Checkbox/toggle input

### Date Fields  
- **date** - Date picker with optional time

### Media Fields
- **media** - Generic file upload
- **image** - Image upload with variants
- **video** - Video upload with metadata
- **audio** - Audio upload with metadata
- **document** - Document file upload

### Structure Fields
- **array** - Arrays of items with drag/drop reordering
- **object** - Nested objects with field grouping

### Specialized Fields
- **slug** - URL-safe slugs with auto-generation
- **reference** - References to other documents

## Key Features

### Field Validation

Built-in validation for all field types:

```typescript
{
  type: 'string',
  validation: {
    required: true,
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9-]+$/
  }
}
```

### Conditional Logic

Fields can show/hide based on other field values:

```typescript
{
  type: 'date',
  title: 'Published Date',
  showIf: { field: 'status', equals: 'published' }
}
```

### Field Options

Extensive customization options for each field type:

```typescript
{
  type: 'string',
  options: {
    inputType: 'email',
    placeholder: 'Enter your email',
    autoComplete: 'email',
    transform: 'lowercase'
  }
}
```

### Studio Integration

Seamless integration with Trokky Studio:

```typescript
// Studio context provides API access, auth, and utilities
const fieldComponent = ({ studioContext }) => {
  const { apiClient, auth, utils } = studioContext;
  
  // Make API calls
  const documents = await apiClient.getDocuments('author');
  
  // Check permissions
  const canEdit = auth.hasPermission('content', 'edit');
  
  // Show notifications
  utils.showToast('Field updated successfully');
};
```

## Documentation

- **[Field Types Reference](./field-types.md)** - Complete reference for all built-in field types
- **[Custom Fields Guide](./custom-fields.md)** - How to create custom field types
- **[Validation System](./validation.md)** - Field validation and error handling
- **[Examples](./examples/)** - Practical usage examples

## Architecture

### Field Plugin System

Every field type is implemented as a plugin:

```typescript
interface FieldPlugin {
  type: string;
  displayName: string;
  description: string;
  category: FieldCategory;
  component: React.ComponentType;
  validate: (value: any, definition: any) => ValidationResult;
  getDefaultValue: (definition: any) => any;
  // ... more methods
}
```

### Field Registry

Central registry for field type management:

```typescript
import { fieldRegistry } from '@trokky/fields';

// Get all registered field types
const allFields = fieldRegistry.getAll();

// Get fields by category
const textFields = fieldRegistry.getByCategory('text');

// Register custom field
fieldRegistry.register(myCustomField);
```

### Universal Field Renderer

Single component handles all field types:

```typescript
<FieldRenderer
  fieldId="myField"
  value={value}
  onChange={onChange}
  definition={fieldDefinition}
  mode="edit" // or "preview"
/>
```

## TypeScript Support

Full TypeScript support with proper field-specific typing:

```typescript
import type { 
  StringFieldDefinition,
  NumberFieldDefinition,
  FieldPlugin 
} from '@trokky/fields';

// Field definitions are strongly typed
const titleField: StringFieldDefinition = {
  type: 'string',
  title: 'Title',
  validation: {
    required: true,
    maxLength: 100
  }
};
```

## Contributing

### Adding a New Field Type

1. Create field definition interface
2. Implement React component
3. Add validation logic
4. Create preview component
5. Register in the field registry
6. Add tests and documentation

See the [Custom Fields Guide](./custom-fields.md) for detailed instructions.

### Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Run tests
npm test

# Type checking
npm run type-check
```

## License

MIT - see [LICENSE](../../LICENSE) file for details.

## Related Packages

- **[@trokky/core](../core)** - Core CMS engine
- **[@trokky/studio](../studio)** - Admin interface
- **[@trokky/client](../client)** - Frontend SDK
- **[@trokky/routes](../routes)** - API routes

---

Built with ❤️ by the Trokky team