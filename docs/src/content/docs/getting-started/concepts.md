---
title: Core Concepts
description: Understand the key concepts and architecture of Trokky
---

Before diving deeper, it helps to understand the core concepts that make up Trokky's architecture.

## Schemas

Schemas define the structure of your content. Each schema represents a content type with fields that specify what data can be stored.

```typescript
const postSchema = {
  name: 'post',           // Unique identifier
  title: 'Blog Post',     // Display name
  fields: [
    { name: 'title', type: 'string', required: true },
    { name: 'content', type: 'richtext' },
  ],
};
```

### Schema Properties

| Property | Description |
|----------|-------------|
| `name` | Unique identifier used in API endpoints and references |
| `title` | Human-readable name shown in Studio |
| `fields` | Array of field definitions |
| `singleton` | If true, only one document of this type exists |
| `preview` | Configuration for document previews in Studio |

## Documents

Documents are instances of schemas. When you create a "Blog Post" in Studio, you're creating a document of the `post` schema.

```json
{
  "_id": "abc123",
  "_type": "post",
  "_createdAt": "2024-01-15T10:30:00Z",
  "_updatedAt": "2024-01-15T10:30:00Z",
  "title": "My First Post",
  "content": "Hello, world!"
}
```

### System Fields

Every document includes system fields (prefixed with `_`):

| Field | Description |
|-------|-------------|
| `_id` | Unique document identifier |
| `_type` | Schema name this document belongs to |
| `_createdAt` | Creation timestamp |
| `_updatedAt` | Last modification timestamp |
| `_rev` | Revision identifier for optimistic locking |

## Fields

Fields define the data structure within schemas. Trokky includes many built-in field types:

### Primitive Fields

```typescript
{ name: 'title', type: 'string' }
{ name: 'count', type: 'number' }
{ name: 'active', type: 'boolean' }
{ name: 'bio', type: 'text' }  // Multiline string
```

### Complex Fields

```typescript
// Date and time
{ name: 'publishedAt', type: 'datetime' }
{ name: 'birthday', type: 'date' }

// URL-friendly identifier
{ name: 'slug', type: 'slug', options: { source: 'title' } }

// Rich content
{ name: 'body', type: 'richtext' }
{ name: 'content', type: 'portabletext' }

// Media
{ name: 'image', type: 'media' }

// Reference to another document
{ name: 'author', type: 'reference', options: { to: 'author' } }

// Nested objects
{
  name: 'seo',
  type: 'object',
  fields: [
    { name: 'title', type: 'string' },
    { name: 'description', type: 'text' },
  ]
}

// Arrays
{
  name: 'tags',
  type: 'array',
  of: [{ type: 'string' }]
}
```

## Storage Adapters

Storage adapters handle where and how content is persisted. Trokky's adapter pattern allows you to swap storage backends without changing your application code.

### Filesystem Adapter (Default)

Stores content as JSON files:

```
content/
├── post/
│   ├── abc123.json
│   └── def456.json
└── author/
    └── ghi789.json
```

Best for: Development, Git-based workflows, simple deployments.

### S3 Adapter

Stores content in AWS S3 with metadata in DynamoDB.

Best for: Scalable production deployments on AWS.

### Cloudflare Adapter

Uses Cloudflare D1 (database) and R2 (object storage).

Best for: Edge deployments on Cloudflare Workers.

## Framework Integrations

Trokky's core is framework-agnostic. Integrations adapt Trokky to specific web frameworks:

```typescript
// Express
import { TrokkyExpress } from '@trokky/express';
const trokky = await TrokkyExpress.create({ ... });
trokky.mount(app);

// Next.js
import { TrokkyNextjs } from '@trokky/nextjs';
export const { GET, POST } = TrokkyNextjs.handlers({ ... });
```

Each integration:
- Converts framework requests to Trokky's internal format
- Handles authentication middleware
- Serves the Studio interface
- Manages static assets

## Studio

The Studio is Trokky's admin interface - a React application for managing content.

### Key Features

- **Document editing**: Forms generated from your schemas
- **Media library**: Upload and manage images/files
- **References**: Link documents together
- **Preview**: See content changes in real-time
- **Multi-user**: Role-based access control

### Customization

Studio can be customized through configuration:

```typescript
studio: {
  branding: {
    title: 'My CMS',
    logo: '/logo.svg',
  },
  structure: [
    { type: 'list', schemaType: 'post', title: 'Blog Posts' },
    { type: 'list', schemaType: 'author', title: 'Authors' },
  ],
}
```

## Client SDK

The client SDK provides a typed interface for querying content:

```typescript
import { createClient } from '@trokky/client';

const client = createClient({
  apiUrl: 'https://api.example.com',
});

// Typed queries
const posts = await client.documents.list('post');
const post = await client.documents.get('post', 'abc123');
```

### Type Generation

Generate TypeScript types from your schemas:

```bash
npx trokky generate-types --output ./types/content.ts
```

Then use in your application:

```typescript
import type { Post, Author } from './types/content';

const post: Post = await client.documents.get('post', id);
```

## Authentication

Trokky uses JWT-based authentication with role-based access control.

### Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full access to all operations |
| `editor` | Create, update, delete content |
| `writer` | Create and update own content |
| `viewer` | Read-only access |

### Authentication Flow

1. User logs in with credentials
2. Server validates and returns JWT token
3. Client includes token in subsequent requests
4. Server verifies token and checks permissions

## Next Steps

Now that you understand the core concepts:

- [Defining Schemas](/guides/schemas/) - Deep dive into schema configuration
- [Storage Adapters](/guides/storage-adapters/) - Choose the right storage for your needs
- [Authentication](/guides/authentication/) - Set up users and permissions
