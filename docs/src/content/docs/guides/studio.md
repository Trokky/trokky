---
title: Studio Customization
description: Customize the Trokky admin interface
---

Trokky Studio is the React-based admin interface for managing content. It can be customized to match your brand and workflow.

## Overview

Studio features include:

- Document editing with auto-generated forms
- Media library with drag-and-drop uploads
- Reference browsing and linking
- Dark mode support
- Customizable navigation and branding

## Basic Configuration

```typescript
const trokky = await TrokkyExpress.create({
  studio: {
    enabled: true,
    branding: {
      title: 'My CMS',
    },
  },
  // ...
});
```

## Branding

### Logo and Title

```typescript
studio: {
  branding: {
    title: 'Acme CMS',
    logo: '/logo.svg',           // URL or path
    logoAlt: 'Acme Logo',
    favicon: '/favicon.ico',
  },
}
```

### Colors

```typescript
studio: {
  branding: {
    colors: {
      primary: '#3b82f6',        // Primary brand color
      secondary: '#64748b',      // Secondary color
      accent: '#f59e0b',         // Accent color
    },
  },
}
```

### Custom CSS

```typescript
studio: {
  branding: {
    customCss: `
      :root {
        --studio-sidebar-bg: #1a1a2e;
        --studio-header-bg: #16213e;
      }
    `,
  },
}
```

## Navigation Structure

### Default Structure

By default, Studio generates navigation from your schemas. Customize with the `structure` option:

```typescript
studio: {
  structure: [
    {
      type: 'list',
      schemaType: 'post',
      title: 'Blog Posts',
      icon: 'document',
    },
    {
      type: 'list',
      schemaType: 'author',
      title: 'Authors',
      icon: 'user',
    },
    {
      type: 'divider',
    },
    {
      type: 'singleton',
      schemaType: 'siteSettings',
      title: 'Settings',
      icon: 'cog',
    },
  ],
}
```

### Grouping Items

```typescript
studio: {
  structure: [
    {
      type: 'group',
      title: 'Content',
      icon: 'folder',
      items: [
        { type: 'list', schemaType: 'post', title: 'Posts' },
        { type: 'list', schemaType: 'page', title: 'Pages' },
      ],
    },
    {
      type: 'group',
      title: 'Taxonomy',
      items: [
        { type: 'list', schemaType: 'category', title: 'Categories' },
        { type: 'list', schemaType: 'tag', title: 'Tags' },
      ],
    },
    {
      type: 'group',
      title: 'Settings',
      items: [
        { type: 'singleton', schemaType: 'siteSettings' },
        { type: 'singleton', schemaType: 'navigation' },
      ],
    },
  ],
}
```

### Dynamic Structure

Generate structure dynamically based on user:

```typescript
studio: {
  structure: (user) => {
    const items = [
      { type: 'list', schemaType: 'post', title: 'Posts' },
      { type: 'list', schemaType: 'page', title: 'Pages' },
    ];

    // Admin-only sections
    if (user.role === 'admin') {
      items.push({
        type: 'group',
        title: 'Administration',
        items: [
          { type: 'singleton', schemaType: 'siteSettings' },
          { type: 'link', title: 'Users', url: '/studio/users' },
        ],
      });
    }

    return items;
  },
}
```

## Document List Customization

### Filtering

```typescript
{
  type: 'list',
  schemaType: 'post',
  title: 'Published Posts',
  filter: {
    status: 'published',
  },
}
```

### Default Ordering

```typescript
{
  type: 'list',
  schemaType: 'post',
  title: 'Posts',
  defaultOrdering: {
    field: 'publishedAt',
    direction: 'desc',
  },
}
```

### Columns

```typescript
{
  type: 'list',
  schemaType: 'post',
  columns: [
    { field: 'title', title: 'Title', width: '40%' },
    { field: 'author.name', title: 'Author', width: '20%' },
    { field: 'status', title: 'Status', width: '15%' },
    { field: '_updatedAt', title: 'Updated', width: '25%' },
  ],
}
```

## Form Customization

### Field Groups

Organize fields into collapsible groups:

```typescript
// In schema definition
{
  name: 'post',
  title: 'Blog Post',
  groups: [
    { name: 'content', title: 'Content' },
    { name: 'meta', title: 'Meta', collapsed: true },
    { name: 'seo', title: 'SEO', collapsed: true },
  ],
  fields: [
    { name: 'title', type: 'string', group: 'content' },
    { name: 'content', type: 'richtext', group: 'content' },
    { name: 'author', type: 'reference', group: 'meta' },
    { name: 'publishedAt', type: 'datetime', group: 'meta' },
    { name: 'seoTitle', type: 'string', group: 'seo' },
    { name: 'seoDescription', type: 'text', group: 'seo' },
  ],
}
```

### Conditional Fields

Show/hide fields based on other values:

```typescript
{
  name: 'type',
  type: 'select',
  options: {
    list: [
      { value: 'internal', title: 'Internal Link' },
      { value: 'external', title: 'External Link' },
    ],
  },
},
{
  name: 'internalPage',
  type: 'reference',
  options: { to: 'page' },
  hidden: ({ document }) => document.type !== 'internal',
},
{
  name: 'externalUrl',
  type: 'string',
  hidden: ({ document }) => document.type !== 'external',
}
```

### Read-Only Fields

```typescript
{
  name: 'slug',
  type: 'slug',
  readOnly: ({ currentUser }) => currentUser.role !== 'admin',
}
```

## Actions

### Document Actions

Add custom actions to documents:

```typescript
studio: {
  documentActions: [
    {
      label: 'Publish',
      icon: 'publish',
      action: async (doc, { client }) => {
        await client.documents.update(doc._type, doc._id, {
          status: 'published',
          publishedAt: new Date().toISOString(),
        });
      },
      visible: (doc) => doc.status === 'draft',
    },
    {
      label: 'Unpublish',
      icon: 'unpublish',
      action: async (doc, { client }) => {
        await client.documents.update(doc._type, doc._id, {
          status: 'draft',
        });
      },
      visible: (doc) => doc.status === 'published',
    },
  ],
}
```

### Global Actions

Add actions to the Studio toolbar:

```typescript
studio: {
  globalActions: [
    {
      label: 'Deploy',
      icon: 'rocket',
      action: async ({ client }) => {
        await fetch('/api/deploy', { method: 'POST' });
      },
      roles: ['admin'],
    },
  ],
}
```

## Widgets

### Dashboard Widgets

Customize the Studio dashboard:

```typescript
studio: {
  dashboard: {
    widgets: [
      {
        type: 'recentDocuments',
        title: 'Recent Posts',
        schemaType: 'post',
        limit: 5,
      },
      {
        type: 'documentCount',
        title: 'Content Stats',
        schemaTypes: ['post', 'page', 'author'],
      },
      {
        type: 'custom',
        title: 'Quick Links',
        component: 'QuickLinksWidget',
      },
    ],
  },
}
```

## Previews

### Document Preview

Configure live preview for documents:

```typescript
studio: {
  preview: {
    enabled: true,
    url: (doc) => {
      if (doc._type === 'post') {
        return `http://localhost:3001/posts/${doc.slug}`;
      }
      return null;
    },
  },
}
```

### Preview Pane

Show preview alongside the editor:

```typescript
studio: {
  preview: {
    position: 'right',    // 'right', 'bottom', or 'popup'
    width: '50%',
    refreshOnChange: true,
  },
}
```

## Access Control

### Hide Schema Types

```typescript
studio: {
  access: {
    // Hide schemas from certain roles
    schemas: {
      siteSettings: ['admin'],           // Admin only
      post: ['admin', 'editor', 'writer'],
      page: ['admin', 'editor'],
    },
  },
}
```

### Disable Features

```typescript
studio: {
  features: {
    mediaLibrary: true,
    darkMode: true,
    search: true,
    bulkActions: ['admin', 'editor'],   // Role-restricted
  },
}
```

## Development Mode

### Hot Reload

In development, Studio supports hot reloading:

```typescript
studio: {
  dev: {
    hotReload: true,
    port: 5173,
  },
}
```

### Debug Mode

```typescript
studio: {
  debug: {
    showFieldNames: true,    // Show field names in forms
    logApiCalls: true,       // Log API requests
  },
}
```

## Production Build

### Building Studio

```bash
npm run studio:build
```

This generates optimized static files that are served by the Trokky server.

### Custom Build Path

```typescript
studio: {
  buildDir: './studio-build',
  basePath: '/admin',         // Serve at /admin instead of /studio
}
```

## Next Steps

- [Deployment](/guides/deployment/) - Deploy to production
- [Configuration Reference](/reference/configuration/) - Full configuration options
- [HTTP API](/reference/http-api/) - API documentation
