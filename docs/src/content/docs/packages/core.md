---
title: "@trokky/core"
description: The core CMS engine with schemas, validation, and business logic
---

`@trokky/core` is the foundation of Trokky, providing the CMS engine with schema management, validation, storage coordination, and business logic.

## Installation

```bash
npm install @trokky/core
```

## Basic Usage

```typescript
import { TrokkyCore, Schema } from '@trokky/core';
import { FilesystemAdapter } from '@trokky/adapter-filesystem';

const schemas: Schema[] = [
  {
    name: 'post',
    title: 'Blog Post',
    fields: [
      { name: 'title', type: 'string', required: true },
      { name: 'content', type: 'richtext' },
    ],
  },
];

const storage = new FilesystemAdapter({ contentDir: './content' });

const core = new TrokkyCore({
  schemas,
  storage,
});
```

## API Reference

### TrokkyCore

The main class that coordinates all CMS operations.

#### Constructor

```typescript
new TrokkyCore(options: TrokkyCoreOptions)
```

**Options:**

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `schemas` | `Schema[]` | Yes | Content type definitions |
| `storage` | `StorageAdapter` | Yes | Storage adapter instance |
| `media` | `MediaOptions` | No | Media handling configuration |
| `validation` | `ValidationOptions` | No | Validation settings |

#### Methods

##### `getSchemas()`

Returns all registered schemas.

```typescript
const schemas = core.getSchemas();
// [{ name: 'post', title: 'Blog Post', ... }]
```

##### `getSchema(name: string)`

Returns a specific schema by name.

```typescript
const postSchema = core.getSchema('post');
```

##### `documents`

Document operations interface.

```typescript
// Create
const doc = await core.documents.create('post', {
  title: 'My Post',
  content: 'Hello world',
});

// Read
const doc = await core.documents.get('post', 'doc-id');

// Update
const updated = await core.documents.update('post', 'doc-id', {
  title: 'Updated Title',
});

// Delete
await core.documents.delete('post', 'doc-id');

// List
const posts = await core.documents.list('post', {
  limit: 10,
  offset: 0,
  orderBy: 'createdAt',
  order: 'desc',
});
```

##### `media`

Media operations interface.

```typescript
// Upload
const asset = await core.media.upload(buffer, {
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
});

// Get
const asset = await core.media.get('media-id');

// Delete
await core.media.delete('media-id');

// List
const assets = await core.media.list({ type: 'image' });
```

##### `users`

User management interface.

```typescript
// Create user
const user = await core.users.create({
  username: 'editor@example.com',
  password: 'password',
  role: 'editor',
});

// Authenticate
const { user, token } = await core.users.authenticate(
  'editor@example.com',
  'password'
);

// Update
await core.users.update('user-id', { role: 'admin' });
```

### Schema Definition

```typescript
interface Schema {
  name: string;           // Unique identifier
  title: string;          // Display name
  fields: Field[];        // Field definitions
  singleton?: boolean;    // Single document type
  preview?: PreviewConfig;
  orderings?: Ordering[];
  icon?: string;
}
```

### Field Definition

```typescript
interface Field {
  name: string;           // Field identifier
  type: FieldType;        // Field type
  title?: string;         // Display label
  description?: string;   // Help text
  required?: boolean;     // Required field
  hidden?: boolean;       // Hide in Studio
  readOnly?: boolean;     // Prevent editing
  default?: any;          // Default value
  validation?: object;    // Validation rules
  options?: object;       // Type-specific options
}
```

### Validation

Built-in validation rules:

```typescript
// String validation
{
  type: 'string',
  validation: {
    min: 1,              // Minimum length
    max: 200,            // Maximum length
    pattern: '^[A-Z]',   // Regex pattern
    email: true,         // Email format
    url: true,           // URL format
  },
}

// Number validation
{
  type: 'number',
  validation: {
    min: 0,
    max: 100,
    integer: true,
    precision: 2,
  },
}

// Array validation
{
  type: 'array',
  validation: {
    min: 1,              // Minimum items
    max: 10,             // Maximum items
    unique: true,        // Unique items
  },
}
```

### Events

Subscribe to CMS events:

```typescript
core.on('document:created', (doc) => {
  console.log('Document created:', doc._id);
});

core.on('document:updated', (doc, previousDoc) => {
  console.log('Document updated:', doc._id);
});

core.on('document:deleted', (doc) => {
  console.log('Document deleted:', doc._id);
});

core.on('media:uploaded', (asset) => {
  console.log('Media uploaded:', asset._id);
});
```

### Hooks

Add custom logic to document operations:

```typescript
const core = new TrokkyCore({
  schemas,
  storage,
  hooks: {
    // Before save hook
    beforeSave: async (doc, schema) => {
      if (schema.name === 'post') {
        doc.updatedAt = new Date().toISOString();
      }
      return doc;
    },

    // After save hook
    afterSave: async (doc, schema) => {
      if (schema.name === 'post' && doc.status === 'published') {
        await notifySubscribers(doc);
      }
    },

    // Before delete hook
    beforeDelete: async (doc, schema) => {
      // Prevent deletion of important docs
      if (doc.protected) {
        throw new Error('Cannot delete protected document');
      }
    },
  },
});
```

## TypeScript Types

### Core Types

```typescript
import type {
  Schema,
  Field,
  Document,
  MediaAsset,
  User,
  ListOptions,
  TrokkyCoreOptions,
} from '@trokky/core';
```

### Document Type

```typescript
interface Document {
  _id: string;
  _type: string;
  _createdAt: string;
  _updatedAt: string;
  _rev?: string;
  [key: string]: any;
}
```

### Media Asset Type

```typescript
interface MediaAsset {
  _id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  alt?: string;
  variants?: Record<string, string>;
  url: string;
  createdAt: string;
}
```

## Configuration

### Media Configuration

```typescript
const core = new TrokkyCore({
  schemas,
  storage,
  media: {
    processor: 'sharp',
    variants: [
      { name: 'thumb', width: 200, height: 200, fit: 'cover' },
      { name: 'medium', width: 800 },
    ],
    allowedTypes: ['image/*', 'application/pdf'],
    maxFileSize: 10 * 1024 * 1024,
  },
});
```

### Validation Configuration

```typescript
const core = new TrokkyCore({
  schemas,
  storage,
  validation: {
    strict: true,           // Reject unknown fields
    coerce: false,          // Don't auto-convert types
    sanitize: true,         // Sanitize HTML content
  },
});
```

## Error Handling

```typescript
import { TrokkyError, ValidationError, NotFoundError } from '@trokky/core';

try {
  await core.documents.create('post', invalidData);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation failed:', error.errors);
  } else if (error instanceof NotFoundError) {
    console.log('Schema not found');
  } else if (error instanceof TrokkyError) {
    console.log('Trokky error:', error.message);
  }
}
```

## Next Steps

- [@trokky/routes](/packages/routes/) - HTTP handler layer
- [@trokky/express](/packages/express/) - Express integration
- [Schema Reference](/reference/schema-types/) - Complete schema documentation
