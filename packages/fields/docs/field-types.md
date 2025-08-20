# Field Types Reference

Complete reference for all built-in field types in @trokky/fields.

## Text Fields

### String Field

Single-line text input with extensive validation and formatting options.

```typescript
{
  type: 'string',
  title: 'Title',
  required: true,
  validation: {
    minLength: 1,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s-]+$/
  },
  options: {
    inputType: 'text', // 'text' | 'email' | 'url' | 'tel' | 'password'
    placeholder: 'Enter title...',
    autoComplete: 'off',
    spellCheck: true,
    transform: 'capitalize', // 'lowercase' | 'uppercase' | 'capitalize'
    size: 'md' // 'sm' | 'md' | 'lg'
  }
}
```

**Validation Options:**
- `minLength` - Minimum character length
- `maxLength` - Maximum character length  
- `pattern` - RegExp pattern validation
- `email` - Email format validation
- `url` - URL format validation

**Options:**
- `inputType` - HTML input type
- `multiline` - Enable textarea mode
- `rows` - Number of rows (multiline mode)
- `placeholder` - Placeholder text
- `autoComplete` - HTML autocomplete attribute
- `spellCheck` - Enable spell checking
- `transform` - Text transformation
- `size` - Input size variant
- `list` - Dropdown options for selection

### Textarea Field

Multi-line text input for longer content.

```typescript
{
  type: 'textarea',
  title: 'Description',
  validation: {
    maxLength: 500
  },
  options: {
    rows: 4,
    placeholder: 'Enter description...',
    spellCheck: true,
    resize: 'vertical' // 'none' | 'vertical' | 'horizontal' | 'both'
  }
}
```

### Email Field

Email input with built-in validation.

```typescript
{
  type: 'email',
  title: 'Email Address',
  required: true,
  validation: {
    email: true
  },
  options: {
    placeholder: 'user@example.com',
    autoComplete: 'email'
  }
}
```

### URL Field  

URL input with validation and preview.

```typescript
{
  type: 'url',
  title: 'Website URL',
  validation: {
    url: true
  },
  options: {
    placeholder: 'https://example.com',
    showPreview: true,
    allowedProtocols: ['http', 'https']
  }
}
```

### Password Field

Password input with strength indicator and generation.

```typescript
{
  type: 'password',
  title: 'Password',
  required: true,
  validation: {
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
  },
  options: {
    showStrength: true,
    showToggle: true,
    generateButton: true,
    strengthRules: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSymbols: true
    }
  }
}
```

### Rich Text Field

Rich text editor with formatting controls.

```typescript
{
  type: 'richtext',
  title: 'Content',
  validation: {
    required: true,
    minLength: 10
  },
  options: {
    toolbar: ['bold', 'italic', 'link', 'bulletList', 'orderedList'],
    placeholder: 'Start writing...',
    maxLength: 5000,
    enableShortcodes: true,
    sanitizeOptions: {
      allowedTags: ['p', 'strong', 'em', 'a', 'ul', 'ol', 'li'],
      allowedAttributes: {
        'a': ['href', 'title']
      }
    }
  }
}
```

## Number Fields

### Number Field

Numeric input with range validation and formatting.

```typescript
{
  type: 'number',
  title: 'Price',
  validation: {
    required: true,
    min: 0,
    max: 999999.99
  },
  options: {
    step: 0.01,
    precision: 2,
    format: 'currency', // 'currency' | 'percent' | 'decimal'
    currency: 'USD',
    placeholder: '0.00',
    showStepper: true
  }
}
```

**Validation Options:**
- `min` - Minimum value
- `max` - Maximum value
- `step` - Increment step
- `integer` - Require integer values

**Options:**
- `precision` - Decimal places
- `format` - Number formatting
- `currency` - Currency code (for currency format)
- `showStepper` - Show increment/decrement buttons

### Boolean Field

Checkbox or toggle input.

```typescript
{
  type: 'boolean',
  title: 'Featured Post',
  defaultValue: false,
  options: {
    layout: 'toggle', // 'checkbox' | 'toggle' | 'radio'
    label: 'Mark as featured',
    trueLabel: 'Yes',
    falseLabel: 'No'
  }
}
```

## Date Fields

### Date Field

Date and time picker with flexible formatting.

```typescript
{
  type: 'date',
  title: 'Published Date',
  validation: {
    required: true,
    min: '2020-01-01',
    max: '2030-12-31'
  },
  options: {
    includeTime: true,
    format: 'YYYY-MM-DD HH:mm',
    timezone: 'UTC',
    placeholder: 'Select date...',
    showCalendar: true,
    showTimeZone: false
  }
}
```

**Validation Options:**
- `min` - Minimum date
- `max` - Maximum date
- `future` - Allow only future dates
- `past` - Allow only past dates

**Options:**
- `includeTime` - Include time picker
- `format` - Date format string
- `timezone` - Default timezone
- `showCalendar` - Show calendar widget
- `showTimeZone` - Show timezone selector

## Media Fields

### Media Field

Generic file upload with validation.

```typescript
{
  type: 'media',
  title: 'Attachment',
  validation: {
    required: true,
    maxSize: 10485760, // 10MB in bytes
    allowedTypes: ['image/*', 'application/pdf']
  },
  options: {
    multiple: false,
    showPreview: true,
    uploadText: 'Drop files here or click to upload',
    accept: 'image/*,application/pdf'
  }
}
```

### Image Field

Image upload with cropping and variants.

```typescript
{
  type: 'image',
  title: 'Featured Image',
  validation: {
    required: true,
    maxSize: 5242880, // 5MB
    dimensions: {
      minWidth: 300,
      maxWidth: 2000,
      aspectRatio: 16/9
    }
  },
  options: {
    showCrop: true,
    cropAspectRatio: 16/9,
    variants: ['thumbnail', 'medium', 'large'],
    showAltText: true,
    showCaption: true
  }
}
```

### Video Field

Video upload with metadata.

```typescript
{
  type: 'video',
  title: 'Video Content',
  validation: {
    maxSize: 104857600, // 100MB
    allowedFormats: ['mp4', 'webm', 'mov']
  },
  options: {
    showThumbnail: true,
    generateThumbnail: true,
    showDuration: true,
    showMetadata: true
  }
}
```

### Audio Field

Audio upload with playback controls.

```typescript
{
  type: 'audio',
  title: 'Audio Track',
  validation: {
    maxSize: 52428800, // 50MB
    allowedFormats: ['mp3', 'wav', 'ogg']
  },
  options: {
    showWaveform: true,
    showDuration: true,
    showMetadata: true
  }
}
```

## Structure Fields

### Array Field

Arrays of items with drag/drop reordering.

```typescript
{
  type: 'array',
  title: 'Gallery Images',
  validation: {
    required: true,
    minItems: 1,
    maxItems: 10
  },
  options: {
    of: {
      type: 'image',
      title: 'Image'
    },
    layout: 'grid', // 'list' | 'grid' | 'compact'
    sortable: true,
    addText: 'Add Image',
    showItemNumbers: true
  }
}
```

**Validation Options:**
- `minItems` - Minimum number of items
- `maxItems` - Maximum number of items
- `unique` - Require unique items

**Options:**
- `of` - Item field definition
- `layout` - Display layout
- `sortable` - Enable drag/drop sorting
- `addText` - Add button text
- `showItemNumbers` - Show item indices

### Object Field

Nested objects with field grouping.

```typescript
{
  type: 'object',
  title: 'SEO Settings',
  options: {
    fields: {
      title: {
        type: 'string',
        title: 'SEO Title',
        validation: { maxLength: 60 }
      },
      description: {
        type: 'textarea',
        title: 'Meta Description',
        validation: { maxLength: 160 }
      },
      keywords: {
        type: 'array',
        title: 'Keywords',
        options: {
          of: { type: 'string' }
        }
      }
    },
    layout: 'fieldset', // 'fieldset' | 'tabs' | 'accordion'
    collapsible: true,
    collapsed: true
  }
}
```

## Specialized Fields

### Slug Field

URL-safe slugs with auto-generation.

```typescript
{
  type: 'slug',
  title: 'URL Slug',
  validation: {
    required: true,
    unique: true,
    pattern: /^[a-z0-9-]+$/
  },
  options: {
    source: 'title', // Source field for auto-generation
    autoGenerate: true,
    prefix: '/blog/',
    suffix: '',
    maxLength: 50,
    separator: '-',
    lowercase: true,
    showPreview: true
  }
}
```

**Options:**
- `source` - Source field(s) for generation
- `autoGenerate` - Enable automatic generation
- `prefix` - URL prefix
- `suffix` - URL suffix
- `separator` - Word separator
- `lowercase` - Force lowercase
- `showPreview` - Show full URL preview

### Reference Field

References to other documents.

```typescript
{
  type: 'reference',
  title: 'Author',
  validation: {
    required: true
  },
  options: {
    to: 'author', // Target collection/schema
    displayField: 'name',
    searchFields: ['name', 'email'],
    showPreview: true,
    allowCreate: true,
    filter: { status: 'active' }
  }
}
```

**Options:**
- `to` - Target document type
- `displayField` - Field to show in selection
- `searchFields` - Fields to search in
- `showPreview` - Show referenced document preview
- `allowCreate` - Allow creating new documents
- `filter` - Filter criteria for available documents

## Field Categories

Fields are organized into logical categories:

```typescript
enum FieldCategory {
  TEXT = 'text',        // String, textarea, email, etc.
  NUMBER = 'number',    // Number, boolean
  DATE = 'date',        // Date, datetime
  MEDIA = 'media',      // Image, video, audio, file
  STRUCTURE = 'structure', // Array, object
  REFERENCE = 'reference', // Document references
  SPECIALIZED = 'specialized' // Slug, richtext, etc.
}
```

## Common Field Properties

All fields support these base properties:

```typescript
interface BaseFieldDefinition {
  type: string;           // Field type identifier
  title?: string;         // Display title
  description?: string;   // Help text
  required?: boolean;     // Required validation
  defaultValue?: any;     // Default value
  hidden?: boolean;       // Hide field
  readOnly?: boolean;     // Read-only mode
  validation?: object;    // Validation rules
  options?: object;       // Field-specific options
}
```

## Validation System

### Built-in Validators

Common validation rules available across field types:

- `required` - Field is required
- `minLength` / `maxLength` - String length validation
- `min` / `max` - Numeric range validation
- `pattern` - Regular expression validation
- `email` - Email format validation
- `url` - URL format validation
- `unique` - Uniqueness validation

### Custom Validation

```typescript
{
  type: 'string',
  validation: {
    custom: (value, context) => {
      if (value && value.includes('spam')) {
        return {
          isValid: false,
          message: 'Content appears to be spam'
        };
      }
      return { isValid: true };
    }
  }
}
```

## Conditional Logic

Fields can be shown/hidden based on other field values:

```typescript
{
  type: 'date',
  title: 'Published Date',
  showIf: { field: 'status', equals: 'published' },
  requiredIf: { field: 'status', equals: 'published' }
}
```

### Conditional Operators

- `equals` - Exact match
- `notEquals` - Not equal
- `in` - Value in array
- `notIn` - Value not in array
- `exists` - Field has value
- `empty` - Field is empty
- `gt` / `lt` / `gte` / `lte` - Numeric comparisons

### Complex Conditions

```typescript
{
  showIf: {
    or: [
      { field: 'userRole', equals: 'admin' },
      {
        and: [
          { field: 'userRole', equals: 'editor' },
          { field: 'department', in: ['content', 'marketing'] }
        ]
      }
    ]
  }
}
```

---

This reference covers all built-in field types. For creating custom field types, see the [Custom Fields Guide](./custom-fields.md).