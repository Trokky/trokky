---
title: "@trokky/client"
description: Frontend SDK for querying and managing Trokky content
---

`@trokky/client` is the frontend SDK for interacting with Trokky's API. It provides a typed interface for fetching content, uploading media, and generating TypeScript types from your schemas.

## Installation

```bash
npm install @trokky/client
```

## Quick Start

```typescript
import { createClient } from '@trokky/client';

const client = createClient({
  apiUrl: 'https://api.example.com',
});

// Fetch documents
const posts = await client.documents.list('post');

// Get single document
const post = await client.documents.get('post', 'post-123');
```

## Configuration

### Basic Configuration

```typescript
const client = createClient({
  apiUrl: 'https://api.example.com',
});
```

### With Authentication

```typescript
const client = createClient({
  apiUrl: 'https://api.example.com',
  token: 'your-jwt-token',
});

// Or set token later
client.setToken(token);
```

### Full Configuration

```typescript
const client = createClient({
  apiUrl: 'https://api.example.com',
  token: 'jwt-token',
  headers: {
    'X-Custom-Header': 'value',
  },
  timeout: 30000,
  retry: {
    count: 3,
    delay: 1000,
  },
});
```

## Document Operations

### List Documents

```typescript
const posts = await client.documents.list('post');
// { data: [...], meta: { total: 100, limit: 20, offset: 0 } }
```

### With Options

```typescript
const posts = await client.documents.list('post', {
  limit: 10,
  offset: 0,
  orderBy: 'publishedAt',
  order: 'desc',
  filter: {
    status: 'published',
  },
  expand: ['author', 'categories'],
});
```

### Get Single Document

```typescript
const post = await client.documents.get('post', 'post-123');
```

### With Reference Expansion

```typescript
const post = await client.documents.get('post', 'post-123', {
  expand: ['author', 'categories'],
});
```

### Create Document

```typescript
const newPost = await client.documents.create('post', {
  title: 'My New Post',
  content: 'Hello world',
  status: 'draft',
});
```

### Update Document

```typescript
const updated = await client.documents.update('post', 'post-123', {
  title: 'Updated Title',
});
```

### Partial Update

```typescript
const patched = await client.documents.patch('post', 'post-123', {
  status: 'published',
  publishedAt: new Date().toISOString(),
});
```

### Delete Document

```typescript
await client.documents.delete('post', 'post-123');
```

## Media Operations

### List Media

```typescript
const media = await client.media.list();

// With filters
const images = await client.media.list({
  type: 'image',
  search: 'hero',
  limit: 20,
});
```

### Get Media

```typescript
const asset = await client.media.get('media-123');
```

### Upload Media

```typescript
// From file input
const file = document.querySelector('input[type="file"]').files[0];
const asset = await client.media.upload(file);

// With metadata
const asset = await client.media.upload(file, {
  alt: 'Image description',
  title: 'Image title',
});
```

### Update Media Metadata

```typescript
await client.media.update('media-123', {
  alt: 'Updated description',
});
```

### Delete Media

```typescript
await client.media.delete('media-123');
```

## Authentication

### Login

```typescript
const { user, token } = await client.auth.login('username', 'password');
client.setToken(token);
```

### Get Current User

```typescript
const user = await client.auth.me();
```

### Logout

```typescript
await client.auth.logout();
client.setToken(null);
```

### Refresh Token

```typescript
const { token } = await client.auth.refresh();
client.setToken(token);
```

## Type Generation

Generate TypeScript types from your Trokky schemas.

### CLI Usage

```bash
# Generate types
npx trokky generate-types --output ./types/content.ts

# With API URL
npx trokky generate-types --api https://api.example.com --output ./types/content.ts
```

### Using Generated Types

```typescript
import { createClient } from '@trokky/client';
import type { Post, Author, Category } from './types/content';

const client = createClient({ apiUrl: '...' });

// Typed responses
const posts = await client.documents.list<Post>('post');
const post = await client.documents.get<Post>('post', 'post-123');

// Type-safe creation
const newPost = await client.documents.create<Post>('post', {
  title: 'My Post',  // TypeScript validates this
  content: '...',
});
```

### Generated Type Example

```typescript
// types/content.ts (auto-generated)
export interface Post {
  _id: string;
  _type: 'post';
  _createdAt: string;
  _updatedAt: string;
  title: string;
  slug: { current: string };
  author?: Author | { _ref: string };
  content?: string;
  publishedAt?: string;
  status: 'draft' | 'published';
}

export interface Author {
  _id: string;
  _type: 'author';
  _createdAt: string;
  _updatedAt: string;
  name: string;
  email?: string;
  bio?: string;
}
```

## React Integration

### Custom Hook

```typescript
import { useState, useEffect } from 'react';
import { createClient } from '@trokky/client';
import type { Post } from './types/content';

const client = createClient({ apiUrl: process.env.NEXT_PUBLIC_API_URL });

export function usePosts(options?: { limit?: number }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    client.documents.list<Post>('post', options)
      .then(res => setPosts(res.data))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [options?.limit]);

  return { posts, loading, error };
}
```

### With React Query

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client } from './client';
import type { Post } from './types/content';

export function usePosts() {
  return useQuery({
    queryKey: ['posts'],
    queryFn: () => client.documents.list<Post>('post'),
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Post>) =>
      client.documents.create<Post>('post', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}
```

## Error Handling

```typescript
import { TrokkyClientError } from '@trokky/client';

try {
  await client.documents.get('post', 'invalid-id');
} catch (error) {
  if (error instanceof TrokkyClientError) {
    console.log('Status:', error.status);
    console.log('Code:', error.code);
    console.log('Message:', error.message);

    if (error.status === 404) {
      // Document not found
    } else if (error.status === 401) {
      // Unauthorized - redirect to login
    } else if (error.status === 422) {
      // Validation error
      console.log('Validation errors:', error.details);
    }
  }
}
```

## Advanced Usage

### Custom Fetch

```typescript
const client = createClient({
  apiUrl: 'https://api.example.com',
  fetch: async (url, options) => {
    // Custom fetch implementation
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
    });
    return response;
  },
});
```

### Request Interceptors

```typescript
const client = createClient({
  apiUrl: 'https://api.example.com',
  onRequest: (config) => {
    // Modify request before sending
    config.headers['X-Request-Id'] = generateRequestId();
    return config;
  },
  onResponse: (response) => {
    // Process response
    console.log('Response received:', response.status);
    return response;
  },
});
```

### Caching

```typescript
import { createClient, createCache } from '@trokky/client';

const cache = createCache({
  ttl: 60 * 1000,  // 1 minute
  maxSize: 100,
});

const client = createClient({
  apiUrl: 'https://api.example.com',
  cache,
});
```

## Server-Side Usage

### Node.js

```typescript
import { createClient } from '@trokky/client';

const client = createClient({
  apiUrl: process.env.TROKKY_API_URL,
  token: process.env.TROKKY_API_TOKEN,
});

// Use in API routes, getServerSideProps, etc.
export async function getServerSideProps() {
  const posts = await client.documents.list('post');
  return { props: { posts: posts.data } };
}
```

### Edge Runtime

```typescript
// Works in Cloudflare Workers, Vercel Edge, etc.
import { createClient } from '@trokky/client';

export default {
  async fetch(request: Request) {
    const client = createClient({
      apiUrl: 'https://api.example.com',
    });

    const posts = await client.documents.list('post');
    return Response.json(posts);
  },
};
```

## Next Steps

- [Type Generation CLI](/reference/cli/) - Full CLI documentation
- [HTTP API Reference](/reference/http-api/) - API endpoints
- [Recipes](/recipes/) - Common usage patterns
