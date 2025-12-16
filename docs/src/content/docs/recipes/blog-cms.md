---
title: Blog CMS
description: Build a complete blog CMS with Trokky
---

This recipe shows how to build a full-featured blog CMS with authors, categories, posts, and comments.

## Schema Design

### Author Schema

```typescript
const authorSchema = {
  name: 'author',
  title: 'Author',
  icon: 'user',
  preview: {
    select: { title: 'name', media: 'avatar' },
  },
  fields: [
    {
      name: 'name',
      type: 'string',
      title: 'Name',
      required: true,
    },
    {
      name: 'slug',
      type: 'slug',
      title: 'Slug',
      options: { source: 'name' },
    },
    {
      name: 'avatar',
      type: 'media',
      title: 'Avatar',
      options: { accept: ['image/*'] },
    },
    {
      name: 'email',
      type: 'string',
      title: 'Email',
      validation: { email: true },
    },
    {
      name: 'bio',
      type: 'text',
      title: 'Biography',
      rows: 4,
    },
    {
      name: 'social',
      type: 'object',
      title: 'Social Links',
      fields: [
        { name: 'twitter', type: 'string', title: 'Twitter' },
        { name: 'github', type: 'string', title: 'GitHub' },
        { name: 'linkedin', type: 'string', title: 'LinkedIn' },
        { name: 'website', type: 'string', title: 'Website' },
      ],
    },
  ],
};
```

### Category Schema

```typescript
const categorySchema = {
  name: 'category',
  title: 'Category',
  icon: 'folder',
  fields: [
    {
      name: 'name',
      type: 'string',
      title: 'Name',
      required: true,
    },
    {
      name: 'slug',
      type: 'slug',
      title: 'Slug',
      options: { source: 'name' },
    },
    {
      name: 'description',
      type: 'text',
      title: 'Description',
    },
    {
      name: 'color',
      type: 'string',
      title: 'Color',
      description: 'Hex color code (e.g., #3b82f6)',
    },
  ],
};
```

### Post Schema

```typescript
const postSchema = {
  name: 'post',
  title: 'Blog Post',
  icon: 'document',
  groups: [
    { name: 'content', title: 'Content' },
    { name: 'meta', title: 'Metadata', collapsed: true },
    { name: 'seo', title: 'SEO', collapsed: true },
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
        subtitle: subtitle ? `By ${subtitle}` : 'No author',
        media,
      };
    },
  },
  orderings: [
    {
      title: 'Published (Newest)',
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
    // Content
    {
      name: 'title',
      type: 'string',
      title: 'Title',
      required: true,
      group: 'content',
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
      description: 'Brief summary shown in listings',
      validation: { max: 300 },
    },
    {
      name: 'content',
      type: 'richtext',
      title: 'Content',
      group: 'content',
    },

    // Metadata
    {
      name: 'author',
      type: 'reference',
      title: 'Author',
      group: 'meta',
      options: { to: 'author' },
    },
    {
      name: 'categories',
      type: 'array',
      title: 'Categories',
      group: 'meta',
      of: [{ type: 'reference', options: { to: 'category' } }],
    },
    {
      name: 'tags',
      type: 'array',
      title: 'Tags',
      group: 'meta',
      of: [{ type: 'string' }],
    },
    {
      name: 'publishedAt',
      type: 'datetime',
      title: 'Publish Date',
      group: 'meta',
    },
    {
      name: 'status',
      type: 'select',
      title: 'Status',
      group: 'meta',
      default: 'draft',
      options: {
        list: [
          { value: 'draft', title: 'Draft' },
          { value: 'review', title: 'In Review' },
          { value: 'published', title: 'Published' },
        ],
      },
    },
    {
      name: 'featured',
      type: 'boolean',
      title: 'Featured Post',
      group: 'meta',
      default: false,
    },

    // SEO
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

### Blog Settings (Singleton)

```typescript
const blogSettingsSchema = {
  name: 'blogSettings',
  title: 'Blog Settings',
  singleton: true,
  icon: 'cog',
  fields: [
    {
      name: 'title',
      type: 'string',
      title: 'Blog Title',
      required: true,
    },
    {
      name: 'description',
      type: 'text',
      title: 'Blog Description',
    },
    {
      name: 'postsPerPage',
      type: 'number',
      title: 'Posts Per Page',
      default: 10,
      validation: { min: 1, max: 50 },
    },
    {
      name: 'showAuthor',
      type: 'boolean',
      title: 'Show Author on Posts',
      default: true,
    },
    {
      name: 'enableComments',
      type: 'boolean',
      title: 'Enable Comments',
      default: true,
    },
  ],
};
```

## Server Setup

```typescript
// server.ts
import express from 'express';
import { TrokkyExpress } from '@trokky/express';

const schemas = [
  authorSchema,
  categorySchema,
  postSchema,
  blogSettingsSchema,
];

const app = express();

const trokky = await TrokkyExpress.create({
  schemas,
  storage: {
    adapter: 'filesystem',
    contentDir: './content',
  },
  security: {
    adminUser: {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'demo123',
    },
  },
  studio: {
    enabled: true,
    branding: {
      title: 'My Blog CMS',
    },
    structure: [
      {
        type: 'group',
        title: 'Content',
        items: [
          { type: 'list', schemaType: 'post', title: 'Posts' },
          { type: 'list', schemaType: 'category', title: 'Categories' },
          { type: 'list', schemaType: 'author', title: 'Authors' },
        ],
      },
      { type: 'divider' },
      { type: 'singleton', schemaType: 'blogSettings', title: 'Settings' },
    ],
  },
});

trokky.mount(app);

app.listen(3000, () => {
  console.log('Blog CMS running at http://localhost:3000');
});
```

## Frontend Queries

### List Published Posts

```typescript
const posts = await client.documents.list('post', {
  filter: { status: 'published' },
  orderBy: 'publishedAt',
  order: 'desc',
  limit: 10,
  expand: ['author', 'categories'],
});
```

### Get Post by Slug

```typescript
const posts = await client.documents.list('post', {
  filter: { 'slug.current': 'my-post-slug' },
  limit: 1,
  expand: ['author', 'categories'],
});
const post = posts.data[0];
```

### Get Featured Posts

```typescript
const featured = await client.documents.list('post', {
  filter: { featured: true, status: 'published' },
  orderBy: 'publishedAt',
  order: 'desc',
  limit: 3,
});
```

### Posts by Category

```typescript
const categoryPosts = await client.documents.list('post', {
  filter: {
    status: 'published',
    categories: { _ref: 'category-id' },
  },
});
```

### Posts by Author

```typescript
const authorPosts = await client.documents.list('post', {
  filter: {
    status: 'published',
    author: { _ref: 'author-id' },
  },
});
```

## Complete Example

See the full blog example in the [Trokky repository](https://github.com/Trokky/trokky/tree/main/examples/blog).
