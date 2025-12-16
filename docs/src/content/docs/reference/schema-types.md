---
title: Schema Types Reference
description: Complete reference for Trokky schema definitions
---

Schemas define the structure of your content types in Trokky.

## Schema Structure

```typescript
interface Schema {
  name: string;              // Required: unique identifier
  title: string;             // Required: display name
  fields: Field[];           // Required: field definitions
  singleton?: boolean;       // Optional: single document type
  preview?: PreviewConfig;   // Optional: preview configuration
  orderings?: Ordering[];    // Optional: sort options
  icon?: string;             // Optional: icon identifier
  groups?: FieldGroup[];     // Optional: field grouping
}
```

## Basic Schema Example

```typescript
const postSchema: Schema = {
  name: 'post',
  title: 'Blog Post',
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'slug', type: 'slug', options: { source: 'title' } },
    { name: 'content', type: 'richtext' },
    { name: 'publishedAt', type: 'datetime' },
  ],
};
```

## Schema Properties

### name

Unique identifier for the schema. Used in API endpoints and references.

```typescript
name: 'blogPost'  // Results in /api/documents/blogPost
```

**Rules:**
- Must be unique across all schemas
- Lowercase recommended
- No spaces or special characters
- Used as collection name in storage

### title

Human-readable name displayed in Studio.

```typescript
title: 'Blog Post'
```

### fields

Array of field definitions. See [Field Types Reference](/reference/field-types/).

```typescript
fields: [
  { name: 'title', type: 'string', required: true },
  { name: 'body', type: 'richtext' },
]
```

### singleton

When `true`, only one document of this type can exist. Useful for settings, homepage content, etc.

```typescript
{
  name: 'siteSettings',
  title: 'Site Settings',
  singleton: true,
  fields: [
    { name: 'siteName', type: 'string' },
    { name: 'logo', type: 'media' },
  ],
}
```

### preview

Configure how documents appear in lists.

```typescript
preview: {
  select: {
    title: 'title',
    subtitle: 'author.name',
    media: 'featuredImage',
  },
  prepare({ title, subtitle, media }) {
    return {
      title,
      subtitle: subtitle ? `By ${subtitle}` : 'No author',
      media,
    };
  },
}
```

#### select

Map preview properties to document fields:

| Property | Description |
|----------|-------------|
| `title` | Primary display text |
| `subtitle` | Secondary text |
| `media` | Image or icon |
| `description` | Extended description |

#### prepare

Transform selected values:

```typescript
prepare({ title, author, date }) {
  return {
    title: title || 'Untitled',
    subtitle: `${author} - ${new Date(date).toLocaleDateString()}`,
  };
}
```

### orderings

Define sort options for Studio lists.

```typescript
orderings: [
  {
    title: 'Newest First',
    name: 'createdDesc',
    by: [{ field: '_createdAt', direction: 'desc' }],
  },
  {
    title: 'Title A-Z',
    name: 'titleAsc',
    by: [{ field: 'title', direction: 'asc' }],
  },
],
```

### icon

Icon identifier for Studio navigation.

```typescript
icon: 'document'  // Built-in icon
icon: 'custom:blog'  // Custom icon
```

**Built-in Icons:**
- `document`, `folder`, `user`, `cog`, `image`
- `link`, `calendar`, `star`, `tag`, `search`

### groups

Organize fields into collapsible groups.

```typescript
groups: [
  { name: 'content', title: 'Content' },
  { name: 'meta', title: 'Metadata', collapsed: true },
  { name: 'seo', title: 'SEO', collapsed: true },
],
fields: [
  { name: 'title', type: 'string', group: 'content' },
  { name: 'body', type: 'richtext', group: 'content' },
  { name: 'author', type: 'reference', group: 'meta' },
  { name: 'metaTitle', type: 'string', group: 'seo' },
],
```

## Complete Schema Example

```typescript
const blogPostSchema: Schema = {
  name: 'post',
  title: 'Blog Post',
  icon: 'document',

  groups: [
    { name: 'content', title: 'Content' },
    { name: 'metadata', title: 'Metadata', collapsed: true },
    { name: 'seo', title: 'SEO Settings', collapsed: true },
  ],

  preview: {
    select: {
      title: 'title',
      subtitle: 'author.name',
      media: 'featuredImage',
    },
    prepare({ title, subtitle, media }) {
      return {
        title: title || 'Untitled',
        subtitle: subtitle || 'No author',
        media,
      };
    },
  },

  orderings: [
    {
      title: 'Published Date (Newest)',
      name: 'publishedDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }],
    },
    {
      title: 'Title A-Z',
      name: 'titleAsc',
      by: [{ field: 'title', direction: 'asc' }],
    },
  ],

  fields: [
    // Content group
    {
      name: 'title',
      type: 'string',
      title: 'Title',
      required: true,
      group: 'content',
      validation: { min: 1, max: 200 },
    },
    {
      name: 'slug',
      type: 'slug',
      title: 'Slug',
      group: 'content',
      options: { source: 'title' },
    },
    {
      name: 'featuredImage',
      type: 'media',
      title: 'Featured Image',
      group: 'content',
    },
    {
      name: 'excerpt',
      type: 'text',
      title: 'Excerpt',
      group: 'content',
      description: 'Brief summary for listings',
    },
    {
      name: 'content',
      type: 'richtext',
      title: 'Content',
      group: 'content',
    },

    // Metadata group
    {
      name: 'author',
      type: 'reference',
      title: 'Author',
      group: 'metadata',
      options: { to: 'author' },
    },
    {
      name: 'categories',
      type: 'array',
      title: 'Categories',
      group: 'metadata',
      of: [{ type: 'reference', options: { to: 'category' } }],
    },
    {
      name: 'tags',
      type: 'array',
      title: 'Tags',
      group: 'metadata',
      of: [{ type: 'string' }],
    },
    {
      name: 'publishedAt',
      type: 'datetime',
      title: 'Published Date',
      group: 'metadata',
    },
    {
      name: 'status',
      type: 'select',
      title: 'Status',
      group: 'metadata',
      default: 'draft',
      options: {
        list: [
          { value: 'draft', title: 'Draft' },
          { value: 'review', title: 'In Review' },
          { value: 'published', title: 'Published' },
        ],
      },
    },

    // SEO group
    {
      name: 'metaTitle',
      type: 'string',
      title: 'Meta Title',
      group: 'seo',
      description: 'Override the page title for SEO',
    },
    {
      name: 'metaDescription',
      type: 'text',
      title: 'Meta Description',
      group: 'seo',
      validation: { max: 160 },
    },
    {
      name: 'ogImage',
      type: 'media',
      title: 'Social Share Image',
      group: 'seo',
    },
  ],
};
```

## TypeScript Types

```typescript
import type { Schema, Field, PreviewConfig, Ordering } from '@trokky/core';

// Type-safe schema definition
const schema: Schema = {
  name: 'post',
  title: 'Post',
  fields: [...],
};
```

## Schema Validation

Trokky validates schemas on startup:

- **Name uniqueness**: No duplicate schema names
- **Field names**: Must be valid identifiers
- **Field types**: Must be recognized types
- **Reference targets**: Must reference existing schemas
- **Required fields**: Must have `required: true` or `default`

## Next Steps

- [Field Types Reference](/reference/field-types/) - All field types
- [Defining Schemas Guide](/guides/schemas/) - Best practices
- [Configuration Reference](/reference/configuration/) - Full options
