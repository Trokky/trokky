---
title: Field Types Reference
description: Complete reference for all Trokky field types
---

This reference documents all field types available in Trokky schemas.

## Common Properties

All field types share these properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique field identifier |
| `type` | `string` | Field type |
| `title` | `string` | Display label |
| `description` | `string` | Help text |
| `required` | `boolean` | Whether field must have a value |
| `hidden` | `boolean \| function` | Hide from Studio |
| `readOnly` | `boolean \| function` | Prevent editing |
| `default` | `any` | Default value |
| `group` | `string` | Field group name |
| `validation` | `object` | Validation rules |

---

## String

Single-line text input.

```typescript
{
  name: 'title',
  type: 'string',
  title: 'Title',
  required: true,
  validation: {
    min: 1,
    max: 200,
  },
}
```

### Validation Options

| Option | Type | Description |
|--------|------|-------------|
| `min` | `number` | Minimum length |
| `max` | `number` | Maximum length |
| `pattern` | `string` | Regex pattern |
| `email` | `boolean` | Validate as email |
| `url` | `boolean` | Validate as URL |

### Examples

```typescript
// Email field
{
  name: 'email',
  type: 'string',
  validation: { email: true },
}

// URL field
{
  name: 'website',
  type: 'string',
  validation: { url: true },
}

// Pattern validation
{
  name: 'code',
  type: 'string',
  validation: { pattern: '^[A-Z]{3}-\\d{4}$' },
}
```

---

## Text

Multi-line text area.

```typescript
{
  name: 'description',
  type: 'text',
  title: 'Description',
  rows: 4,
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rows` | `number` | 3 | Visible rows |

---

## Number

Numeric input.

```typescript
{
  name: 'price',
  type: 'number',
  title: 'Price',
  validation: {
    min: 0,
    max: 10000,
    precision: 2,
  },
}
```

### Validation Options

| Option | Type | Description |
|--------|------|-------------|
| `min` | `number` | Minimum value |
| `max` | `number` | Maximum value |
| `integer` | `boolean` | Must be integer |
| `precision` | `number` | Decimal places |
| `positive` | `boolean` | Must be positive |

---

## Boolean

Toggle switch or checkbox.

```typescript
{
  name: 'featured',
  type: 'boolean',
  title: 'Featured',
  default: false,
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `layout` | `string` | `'switch'` | `'switch'` or `'checkbox'` |

---

## Date

Date picker (no time).

```typescript
{
  name: 'birthday',
  type: 'date',
  title: 'Birthday',
}
```

**Stored Format:** `YYYY-MM-DD`

---

## DateTime

Date and time picker.

```typescript
{
  name: 'publishedAt',
  type: 'datetime',
  title: 'Published At',
}
```

**Stored Format:** ISO 8601 (`2024-01-15T10:30:00.000Z`)

### Options

| Option | Type | Description |
|--------|------|-------------|
| `timezone` | `string` | Default timezone |

---

## Slug

URL-friendly identifier.

```typescript
{
  name: 'slug',
  type: 'slug',
  title: 'Slug',
  options: {
    source: 'title',
    maxLength: 96,
  },
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `source` | `string` | - | Field to generate from |
| `maxLength` | `number` | 200 | Maximum length |
| `isUnique` | `boolean` | false | Check uniqueness |

**Stored Format:**
```json
{
  "current": "my-blog-post",
  "_type": "slug"
}
```

---

## Rich Text

WYSIWYG editor for formatted content.

```typescript
{
  name: 'content',
  type: 'richtext',
  title: 'Content',
}
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `styles` | `array` | Allowed block styles |
| `lists` | `array` | Allowed list types |
| `marks` | `array` | Allowed inline marks |
| `annotations` | `array` | Custom annotations |

```typescript
{
  name: 'content',
  type: 'richtext',
  options: {
    styles: ['normal', 'h1', 'h2', 'h3', 'blockquote'],
    lists: ['bullet', 'number'],
    marks: ['bold', 'italic', 'underline', 'link'],
  },
}
```

---

## Media

Image or file upload.

```typescript
{
  name: 'featuredImage',
  type: 'media',
  title: 'Featured Image',
  options: {
    accept: ['image/*'],
    maxSize: 5 * 1024 * 1024,
  },
}
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `accept` | `string[]` | Allowed MIME types |
| `maxSize` | `number` | Max file size in bytes |
| `showVariants` | `boolean` | Show variant selector |
| `showMetadata` | `boolean` | Show metadata editor |
| `requireAlt` | `boolean` | Require alt text |

**Stored Format:**
```json
{
  "_type": "media",
  "_ref": "media-abc123",
  "alt": "Image description"
}
```

---

## Reference

Link to another document.

```typescript
{
  name: 'author',
  type: 'reference',
  title: 'Author',
  options: {
    to: 'author',
  },
}
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `to` | `string \| string[]` | Target schema(s) |
| `filter` | `object` | Filter available documents |

```typescript
// Single type reference
{
  name: 'author',
  type: 'reference',
  options: { to: 'author' },
}

// Multiple type reference
{
  name: 'related',
  type: 'reference',
  options: { to: ['post', 'page'] },
}

// Filtered reference
{
  name: 'publishedPost',
  type: 'reference',
  options: {
    to: 'post',
    filter: { status: 'published' },
  },
}
```

**Stored Format:**
```json
{
  "_type": "reference",
  "_ref": "author-abc123"
}
```

---

## Object

Nested structure with fields.

```typescript
{
  name: 'seo',
  type: 'object',
  title: 'SEO Settings',
  fields: [
    { name: 'metaTitle', type: 'string', title: 'Meta Title' },
    { name: 'metaDescription', type: 'text', title: 'Meta Description' },
    { name: 'ogImage', type: 'media', title: 'OG Image' },
  ],
}
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `collapsible` | `boolean` | Can collapse in Studio |
| `collapsed` | `boolean` | Initially collapsed |

**Stored Format:**
```json
{
  "seo": {
    "metaTitle": "Page Title",
    "metaDescription": "Description here",
    "ogImage": { "_ref": "media-xyz" }
  }
}
```

---

## Array

List of items.

```typescript
// Array of strings
{
  name: 'tags',
  type: 'array',
  title: 'Tags',
  of: [{ type: 'string' }],
}

// Array of objects
{
  name: 'links',
  type: 'array',
  title: 'Links',
  of: [
    {
      type: 'object',
      fields: [
        { name: 'label', type: 'string' },
        { name: 'url', type: 'string' },
      ],
    },
  ],
}

// Array of references
{
  name: 'relatedPosts',
  type: 'array',
  title: 'Related Posts',
  of: [{ type: 'reference', options: { to: 'post' } }],
}
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `of` | `array` | Item types |
| `sortable` | `boolean` | Enable drag-sort |
| `layout` | `string` | `'list'` or `'grid'` |

### Validation

```typescript
{
  name: 'tags',
  type: 'array',
  of: [{ type: 'string' }],
  validation: {
    min: 1,
    max: 10,
    unique: true,
  },
}
```

---

## Select

Predefined options.

```typescript
{
  name: 'status',
  type: 'select',
  title: 'Status',
  options: {
    list: [
      { value: 'draft', title: 'Draft' },
      { value: 'review', title: 'In Review' },
      { value: 'published', title: 'Published' },
    ],
  },
}
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `list` | `array` | Option items |
| `layout` | `string` | `'dropdown'` or `'radio'` |

---

## Conditional Fields

### Hidden

```typescript
{
  name: 'externalUrl',
  type: 'string',
  hidden: ({ document }) => document.linkType !== 'external',
}
```

### Read-Only

```typescript
{
  name: 'slug',
  type: 'slug',
  readOnly: ({ currentUser }) => currentUser.role !== 'admin',
}
```

---

## Custom Validation

```typescript
{
  name: 'title',
  type: 'string',
  validation: {
    custom: (value, { document }) => {
      if (document.status === 'published' && !value) {
        return 'Title is required for published documents';
      }
      return true;
    },
  },
}
```

---

## TypeScript Types

```typescript
import type { Field, StringField, ReferenceField } from '@trokky/core';

const titleField: StringField = {
  name: 'title',
  type: 'string',
  required: true,
};

const authorField: ReferenceField = {
  name: 'author',
  type: 'reference',
  options: { to: 'author' },
};
```

## Next Steps

- [Schema Types Reference](/reference/schema-types/) - Schema structure
- [Defining Schemas Guide](/guides/schemas/) - Best practices
- [Configuration Reference](/reference/configuration/) - Full options
