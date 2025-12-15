---
title: "@trokky/studio"
description: React-based admin interface for content management
---

`@trokky/studio` is the React-based admin interface for Trokky. It provides a complete content management UI with document editing, media library, and customization options.

## Installation

```bash
npm install @trokky/studio
```

## Usage with Express

Studio is automatically served when enabled in configuration:

```typescript
import { TrokkyExpress } from '@trokky/express';

const trokky = await TrokkyExpress.create({
  schemas,
  storage: { /* ... */ },
  studio: {
    enabled: true,
  },
});

trokky.mount(app);
// Studio available at /studio
```

## Features

### Document Management

- Auto-generated forms from schemas
- Rich text editing
- Media field integration
- Reference browsing
- Draft/publish workflow
- Revision history

### Media Library

- Drag-and-drop uploads
- Image preview and variants
- Metadata editing
- Search and filtering
- Bulk operations

### Navigation

- Customizable sidebar
- Document type grouping
- Quick search
- Breadcrumb navigation

### User Experience

- Dark mode support
- Responsive design
- Keyboard shortcuts
- Auto-save
- Optimistic updates

## Configuration

### Basic Configuration

```typescript
studio: {
  enabled: true,
  basePath: '/studio',      // URL path (default: /studio)
}
```

### Branding

```typescript
studio: {
  branding: {
    title: 'My CMS',
    logo: '/logo.svg',
    favicon: '/favicon.ico',
    colors: {
      primary: '#3b82f6',
    },
  },
}
```

### Navigation Structure

```typescript
studio: {
  structure: [
    {
      type: 'group',
      title: 'Content',
      items: [
        { type: 'list', schemaType: 'post', title: 'Posts' },
        { type: 'list', schemaType: 'page', title: 'Pages' },
      ],
    },
    { type: 'divider' },
    {
      type: 'singleton',
      schemaType: 'siteSettings',
      title: 'Settings',
    },
  ],
}
```

### Feature Toggles

```typescript
studio: {
  features: {
    mediaLibrary: true,
    darkMode: true,
    search: true,
    revisionHistory: true,
  },
}
```

## Structure Items

### List

Display documents of a schema type:

```typescript
{
  type: 'list',
  schemaType: 'post',
  title: 'Blog Posts',
  icon: 'document',
  filter: { status: 'published' },
  defaultOrdering: { field: '_createdAt', direction: 'desc' },
}
```

### Singleton

Single document type (settings, etc.):

```typescript
{
  type: 'singleton',
  schemaType: 'siteSettings',
  title: 'Site Settings',
  icon: 'cog',
}
```

### Group

Collapsible group of items:

```typescript
{
  type: 'group',
  title: 'Blog',
  icon: 'folder',
  items: [
    { type: 'list', schemaType: 'post' },
    { type: 'list', schemaType: 'category' },
  ],
}
```

### Divider

Visual separator:

```typescript
{
  type: 'divider',
}
```

### Link

External or custom link:

```typescript
{
  type: 'link',
  title: 'View Site',
  url: 'https://example.com',
  icon: 'external',
}
```

## Development Mode

### Running Studio Dev Server

For development with hot reload:

```bash
# In your project
npm run studio:dev
```

This starts Vite dev server on port 5173.

### API Proxy Configuration

Configure CORS for development:

```typescript
server: {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
}
```

## Building for Production

```bash
npm run studio:build
```

Outputs optimized static files to `studio-build/` directory.

## Customization

### Custom CSS

```typescript
studio: {
  branding: {
    customCss: `
      .studio-sidebar {
        background: linear-gradient(180deg, #1a1a2e, #16213e);
      }
      .studio-header {
        border-bottom: 2px solid #3b82f6;
      }
    `,
  },
}
```

### Document Actions

Add custom actions to documents:

```typescript
studio: {
  documentActions: [
    {
      label: 'Publish',
      icon: 'check',
      action: async (doc, { client }) => {
        await client.documents.update(doc._type, doc._id, {
          status: 'published',
          publishedAt: new Date().toISOString(),
        });
      },
      visible: (doc) => doc.status === 'draft',
    },
  ],
}
```

### Widgets

Dashboard widgets:

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
        schemaTypes: ['post', 'page'],
      },
    ],
  },
}
```

## Form Customization

### Field Groups

Organize fields in the editor:

```typescript
// In schema definition
{
  name: 'post',
  groups: [
    { name: 'content', title: 'Content' },
    { name: 'meta', title: 'Metadata', collapsed: true },
  ],
  fields: [
    { name: 'title', type: 'string', group: 'content' },
    { name: 'publishedAt', type: 'datetime', group: 'meta' },
  ],
}
```

### Conditional Fields

Show/hide fields dynamically:

```typescript
{
  name: 'externalUrl',
  type: 'string',
  hidden: ({ document }) => document.linkType !== 'external',
}
```

### Custom Descriptions

```typescript
{
  name: 'slug',
  type: 'slug',
  description: 'URL-friendly identifier. Auto-generated from title.',
}
```

## Preview Configuration

### Document Preview

```typescript
studio: {
  preview: {
    enabled: true,
    url: (doc) => `https://preview.example.com/${doc._type}/${doc.slug}`,
  },
}
```

### Preview Pane

Show live preview alongside editor:

```typescript
studio: {
  preview: {
    position: 'right',
    width: '50%',
    refreshOnChange: true,
  },
}
```

## Access Control

### Schema Visibility

```typescript
studio: {
  access: {
    schemas: {
      siteSettings: ['admin'],
      post: ['admin', 'editor', 'writer'],
    },
  },
}
```

### Feature Access

```typescript
studio: {
  features: {
    bulkActions: ['admin', 'editor'],
    revisionHistory: ['admin'],
  },
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save document |
| `Cmd/Ctrl + K` | Open search |
| `Cmd/Ctrl + /` | Toggle sidebar |
| `Escape` | Close modal/panel |

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Debugging

Enable debug mode:

```typescript
studio: {
  debug: {
    showFieldNames: true,
    logApiCalls: true,
  },
}
```

Browser console commands:

```javascript
// Set log level
window.TrokkyLogger.setLevel('debug');

// Get current config
window.TROKKY_CONFIG;
```

## Next Steps

- [Studio Customization Guide](/guides/studio/) - Detailed customization
- [@trokky/client](/packages/client/) - Frontend SDK
- [Configuration Reference](/reference/configuration/) - All options
