---
title: Defining Schemas
description: Create content structures with Trokky schemas
---

Schemas are the foundation of your content model in Trokky. They define what content types exist and what data each type can hold.

## Basic Schema Structure

```typescript
import { Schema } from '@trokky/core';

const schema: Schema = {
  name: 'article',        // Required: unique identifier
  title: 'Article',       // Required: display name
  fields: [               // Required: array of fields
    { name: 'title', type: 'string', required: true },
  ],
};
```

## Schema Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Unique identifier (lowercase, no spaces) |
| `title` | `string` | Yes | Human-readable name for Studio |
| `fields` | `Field[]` | Yes | Array of field definitions |
| `singleton` | `boolean` | No | Only one document can exist |
| `preview` | `object` | No | Configure document previews |
| `orderings` | `array` | No | Custom sort options in Studio |
| `icon` | `string` | No | Icon identifier for Studio |

## Field Types

### String

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

### Text

Multi-line text area.

```typescript
{
  name: 'description',
  type: 'text',
  title: 'Description',
  rows: 4,  // Number of visible rows
}
```

### Number

Numeric input with optional constraints.

```typescript
{
  name: 'price',
  type: 'number',
  title: 'Price',
  validation: {
    min: 0,
    max: 10000,
    precision: 2,  // Decimal places
  },
}
```

### Boolean

Toggle or checkbox.

```typescript
{
  name: 'featured',
  type: 'boolean',
  title: 'Featured',
  default: false,
}
```

### Date and DateTime

```typescript
// Date only
{
  name: 'birthday',
  type: 'date',
  title: 'Birthday',
}

// Date and time
{
  name: 'publishedAt',
  type: 'datetime',
  title: 'Published At',
}
```

### Slug

URL-friendly identifier, auto-generated from source field.

```typescript
{
  name: 'slug',
  type: 'slug',
  title: 'Slug',
  options: {
    source: 'title',    // Field to generate from
    maxLength: 96,      // Maximum characters
  },
}
```

### Rich Text

WYSIWYG editor for formatted content.

```typescript
{
  name: 'content',
  type: 'richtext',
  title: 'Content',
}
```

### Media

Image or file upload.

```typescript
{
  name: 'image',
  type: 'media',
  title: 'Featured Image',
  options: {
    accept: ['image/*'],           // Allowed MIME types
    maxSize: 5 * 1024 * 1024,      // 5MB limit
  },
}
```

### Reference

Link to another document.

```typescript
{
  name: 'author',
  type: 'reference',
  title: 'Author',
  options: {
    to: 'author',        // Target schema name
  },
}

// Multiple possible targets
{
  name: 'related',
  type: 'reference',
  options: {
    to: ['post', 'page'],  // Can reference either type
  },
}
```

### Object

Nested structure with its own fields.

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

### Array

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

### Select

Predefined options (dropdown or radio).

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

## Field Properties

All fields support these common properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique field identifier |
| `type` | `string` | Field type |
| `title` | `string` | Display label |
| `description` | `string` | Help text shown below field |
| `required` | `boolean` | Whether field must have a value |
| `hidden` | `boolean` | Hide from Studio |
| `readOnly` | `boolean` | Prevent editing |
| `default` | `any` | Default value for new documents |
| `validation` | `object` | Validation rules |

## Validation

Add validation rules to ensure data integrity:

```typescript
{
  name: 'email',
  type: 'string',
  validation: {
    email: true,  // Must be valid email
  },
}

{
  name: 'url',
  type: 'string',
  validation: {
    url: true,  // Must be valid URL
  },
}

{
  name: 'title',
  type: 'string',
  validation: {
    min: 5,      // Minimum length
    max: 100,    // Maximum length
    pattern: '^[A-Z]',  // Regex pattern
  },
}
```

## Singleton Schemas

For content that should only have one instance (site settings, homepage, etc.):

```typescript
{
  name: 'siteSettings',
  title: 'Site Settings',
  singleton: true,  // Only one document allowed
  fields: [
    { name: 'siteName', type: 'string' },
    { name: 'logo', type: 'media' },
    { name: 'footer', type: 'text' },
  ],
}
```

## Preview Configuration

Customize how documents appear in lists:

```typescript
{
  name: 'post',
  title: 'Post',
  preview: {
    select: {
      title: 'title',
      subtitle: 'author.name',
      media: 'featuredImage',
    },
    prepare({ title, subtitle, media }) {
      return {
        title,
        subtitle: `By ${subtitle}`,
        media,
      };
    },
  },
  fields: [/* ... */],
}
```

## Complete Example

Here's a complete blog schema set:

```typescript
import { Schema } from '@trokky/core';

export const schemas: Schema[] = [
  // Author
  {
    name: 'author',
    title: 'Author',
    preview: {
      select: { title: 'name', media: 'avatar' },
    },
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'slug', type: 'slug', options: { source: 'name' } },
      { name: 'email', type: 'string', validation: { email: true } },
      { name: 'avatar', type: 'media' },
      { name: 'bio', type: 'text' },
      {
        name: 'social',
        type: 'object',
        fields: [
          { name: 'twitter', type: 'string' },
          { name: 'github', type: 'string' },
          { name: 'linkedin', type: 'string' },
        ],
      },
    ],
  },

  // Category
  {
    name: 'category',
    title: 'Category',
    fields: [
      { name: 'name', type: 'string', required: true },
      { name: 'slug', type: 'slug', options: { source: 'name' } },
      { name: 'description', type: 'text' },
    ],
  },

  // Post
  {
    name: 'post',
    title: 'Blog Post',
    preview: {
      select: {
        title: 'title',
        subtitle: 'author.name',
        media: 'featuredImage',
      },
    },
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'slug', type: 'slug', options: { source: 'title' } },
      { name: 'author', type: 'reference', options: { to: 'author' } },
      { name: 'categories', type: 'array', of: [{ type: 'reference', options: { to: 'category' } }] },
      { name: 'featuredImage', type: 'media' },
      { name: 'excerpt', type: 'text' },
      { name: 'content', type: 'richtext' },
      { name: 'publishedAt', type: 'datetime' },
      {
        name: 'status',
        type: 'select',
        options: {
          list: [
            { value: 'draft', title: 'Draft' },
            { value: 'published', title: 'Published' },
          ],
        },
        default: 'draft',
      },
      {
        name: 'seo',
        type: 'object',
        fields: [
          { name: 'metaTitle', type: 'string' },
          { name: 'metaDescription', type: 'text' },
        ],
      },
    ],
  },

  // Site Settings (singleton)
  {
    name: 'siteSettings',
    title: 'Site Settings',
    singleton: true,
    fields: [
      { name: 'siteName', type: 'string', required: true },
      { name: 'tagline', type: 'string' },
      { name: 'logo', type: 'media' },
      { name: 'postsPerPage', type: 'number', default: 10 },
    ],
  },
];
```

## Next Steps

- [Field Types Reference](/reference/field-types/) - Complete field type documentation
- [Storage Adapters](/guides/storage-adapters/) - Configure where content is stored
- [Studio Customization](/guides/studio/) - Customize the editing experience
