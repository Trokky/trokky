# @trokky/client

**TypeScript-native client SDK for Trokky CMS with automatic type generation**

The official client library for interacting with Trokky CMS APIs. Features comprehensive TypeScript support, automatic type generation from schemas, smart caching, and framework-agnostic design.

## Features

- 🔥 **TypeScript Native** - Full type safety with automatic type generation from schemas
- 🚀 **Framework Agnostic** - Works with React, Vue, Svelte, Node.js, and serverless
- 🔐 **Authentication Built-in** - JWT token management with automatic refresh
- ⚡ **Smart Caching** - TTL-based caching with intelligent invalidation
- 🛡️ **Error Handling** - Comprehensive error handling with retry logic
- 📁 **Media Management** - File upload support with progress tracking
- 🔍 **Advanced Querying** - Filtering, sorting, pagination, and search
- 🧪 **Well Tested** - 88 comprehensive tests covering all functionality

## Installation

```bash
npm install @trokky/client
```

## Quick Start

### Basic Setup

```typescript
import { TrokkyClient } from '@trokky/client'

const client = new TrokkyClient({
  baseUrl: 'https://your-trokky-api.com',
  apiVersion: 'v1'
})

// Authenticate
await client.authenticate({
  username: 'user@example.com',
  password: 'your-password'
})

// Use the client
const posts = await client.queryDocuments('post', {
  filter: { published: true },
  sort: { createdAt: -1 },
  limit: 10
})
```

### TypeScript Type Generation

Generate TypeScript types from your Trokky schemas using the CLI or programmatically.

#### CLI Usage

```bash
# From local compiled schemas (recommended for development)
npx trokky-client generate-types --schema-path ../cms/dist/schemas -o ./src/types/cms

# From remote API (requires running CMS server)
npx trokky-client generate-types \
  --schema-url http://localhost:3000/api/collections \
  --auth-token YOUR_API_TOKEN \
  -o ./src/types/cms
```

**CLI Options:**
| Option | Description |
|--------|-------------|
| `-p, --schema-path <path>` | Local path to compiled schemas directory |
| `-u, --schema-url <url>` | API URL to fetch schemas from |
| `-o, --output-dir <dir>` | Output directory (default: `./src/types/trokky`) |
| `-t, --auth-token <token>` | API token for authentication |
| `-n, --namespace <name>` | TypeScript namespace (default: `Trokky`) |
| `-e, --extension <ext>` | File extension: `ts` or `d.ts` (default: `ts`) |
| `--no-validation` | Skip validation schema generation |

> **Note:** The `--schema-path` option requires compiled JS files. Run `npm run build` in your CMS project first.

#### Programmatic Usage

```typescript
import { generateTypes, generateTypesFromPath } from '@trokky/client/generator'

// From local schemas
await generateTypesFromPath({
  schemaPath: '../cms/dist/schemas',
  outputDir: './src/types/cms',
  namespace: 'Trokky',
  includeValidation: true
})

// From remote API
await generateTypes({
  schemaUrl: 'https://your-api.com/api/collections',
  outputDir: './src/types/trokky',
  authToken: 'your-token',
  includeValidation: true
})
```

This generates TypeScript interfaces like:

```typescript
// Generated types
export interface PostDocument extends BaseDocument {
  _type: 'post'
  title: string
  content: string
  slug: string
  published?: boolean
  author?: string | UserDocument
  tags?: string[]
}
```

### Framework Examples

#### React Hook

```typescript
import { useState, useEffect } from 'react'
import { TrokkyClient } from '@trokky/client'
import type { PostDocument } from './types/trokky'

const usePosts = (client: TrokkyClient) => {
  const [posts, setPosts] = useState<PostDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const result = await client.queryDocuments<PostDocument>('post', {
          filter: { published: true },
          sort: { createdAt: -1 }
        })
        setPosts(result.data.map(doc => doc.data))
      } catch (error) {
        console.error('Failed to fetch posts:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [client])

  return { posts, loading }
}
```

#### Vue Composable

```typescript
import { ref, onMounted } from 'vue'
import { TrokkyClient } from '@trokky/client'
import type { PostDocument } from './types/trokky'

export const usePosts = (client: TrokkyClient) => {
  const posts = ref<PostDocument[]>([])
  const loading = ref(true)

  const fetchPosts = async () => {
    try {
      const result = await client.queryDocuments<PostDocument>('post', {
        filter: { published: true },
        sort: { createdAt: -1 }
      })
      posts.value = result.data.map(doc => doc.data)
    } catch (error) {
      console.error('Failed to fetch posts:', error)
    } finally {
      loading.value = false
    }
  }

  onMounted(fetchPosts)

  return { posts, loading, refetch: fetchPosts }
}
```

#### Svelte Store

```typescript
import { writable } from 'svelte/store'
import { TrokkyClient } from '@trokky/client'
import type { PostDocument } from './types/trokky'

const createPostStore = (client: TrokkyClient) => {
  const { subscribe, set, update } = writable<PostDocument[]>([])

  return {
    subscribe,
    async load() {
      const result = await client.queryDocuments<PostDocument>('post', {
        filter: { published: true },
        sort: { createdAt: -1 }
      })
      set(result.data.map(doc => doc.data))
    },
    async create(post: Omit<PostDocument, '_id' | '_type' | '_createdAt' | '_updatedAt' | '_version'>) {
      const newPost = await client.createDocument('post', post)
      update(posts => [newPost.data, ...posts])
      return newPost
    }
  }
}

export const posts = createPostStore(client)
```

## API Reference

### TrokkyClient

The main client class for interacting with Trokky APIs.

#### Constructor

```typescript
new TrokkyClient(config: ClientConfig)
```

```typescript
interface ClientConfig {
  baseUrl: string
  apiVersion?: string
  token?: string
  refreshToken?: string
  timeout?: number
  retries?: number
  enableCache?: boolean
  cacheMaxAge?: number
  debug?: boolean
}
```

#### Authentication Methods

```typescript
// Authenticate with credentials
await client.authenticate({ username: 'user@example.com', password: 'password' })

// Check authentication status
client.isAuthenticated() // boolean

// Get current tokens
client.getTokens() // AuthTokens | null

// Set tokens manually
client.setTokens({ accessToken: 'token', refreshToken: 'refresh' })

// Logout
await client.logout()
```

#### Document Methods

```typescript
// Get document by ID
const post = await client.getDocument<PostDocument>('post', 'post-id')

// Get document with reference expansion
const post = await client.getDocument<PostDocument>('post', 'post-id', {
  expand: 'author,categories[]'
})

// Query documents
const posts = await client.queryDocuments<PostDocument>('post', {
  filter: { published: true },
  sort: { createdAt: -1 },
  limit: 10,
  offset: 0
})

// Create document
const newPost = await client.createDocument('post', {
  title: 'New Post',
  content: 'Post content...',
  published: false
})

// Update document
const updated = await client.updateDocument('post', 'post-id', {
  title: 'Updated Title'
})

// Replace document
const replaced = await client.replaceDocument('post', 'post-id', {
  title: 'New Title',
  content: 'New content...',
  published: true
})

// Delete document
await client.deleteDocument('post', 'post-id')

// Search documents
const results = await client.searchDocuments('post', 'search term', ['title', 'content'])

// Count documents
const count = await client.countDocuments('post', { published: true })

// Check if document exists
const exists = await client.documentExists('post', 'post-id')
```

#### Media Methods

```typescript
// Upload file
const media = await client.uploadFile(file, 'filename.jpg')

// Get media
const media = await client.getMedia('media-id')

// Delete media
await client.deleteMedia('media-id')
```

#### Utility Methods

```typescript
// Test API connection
await client.ping()

// Get API health status
await client.health()

// Clear cache
client.clearCache()

// Get cache stats
client.getCacheStats()

// Cleanup resources
client.destroy()
```

### Query Options

```typescript
interface QueryOptions {
  filter?: Record<string, any>
  sort?: Record<string, 1 | -1>
  limit?: number
  offset?: number
  select?: string[]
}

// Examples
const options: QueryOptions = {
  filter: {
    published: true,
    author: 'user-id',
    tags: { $in: ['tech', 'programming'] }
  },
  sort: { createdAt: -1, title: 1 },
  limit: 20,
  offset: 0,
  select: ['title', 'slug', 'author']
}
```

### Type Generation

Generate TypeScript types from your Trokky schemas:

```typescript
import { generateTypes, generateTypesFromSchema } from '@trokky/client/generator'

// Generate from URL
await generateTypes({
  schemaUrl: 'https://api.example.com/schema',
  outputDir: './src/types',
  namespace: 'Trokky',
  fileExtension: 'ts', // or 'd.ts'
  includeValidation: true
})

// Generate from schema object
await generateTypesFromSchema(schema, {
  outputDir: './src/types',
  namespace: 'MyApp'
})
```

## Advanced Usage

### Reference Expansion

Expand reference fields to include full document data instead of just reference IDs. References are resolved and the full document replaces the reference object.

#### Before Expansion (Reference)

```json
{
  "_id": "homepage",
  "documentation": {
    "featuredDocument": {
      "_ref": "doc-legal-legalText-abc123",
      "_type": "document"
    }
  }
}
```

#### After Expansion (Resolved Document)

```json
{
  "_id": "homepage",
  "documentation": {
    "featuredDocument": {
      "_id": "doc-legal-legalText-abc123",
      "_collection": "document",
      "title": "Terms of Service",
      "slug": "terms-of-service",
      "content": "...",
      "_status": "published"
    }
  }
}
```

#### Basic Expansion

```typescript
// Direct API - expand specific fields
const post = await client.getDocument<PostDocument>('post', 'post-id', {
  expand: 'author,categories[]'  // Use [] suffix for array references
})

// Expand all reference fields
const post = await client.getDocument<PostDocument>('post', 'post-id', {
  expand: '*'
})
```

#### Fluent Query Builder

```typescript
// Query collection with reference expansion
const posts = await client
  .from('post')
  .published()
  .expand('author')           // Single reference field
  .expand('categories[]')     // Array reference field (use [] suffix)
  .sort({ _createdAt: 'desc' })
  .limit(10)
  .fetch()
```

#### Singleton with Expansion

```typescript
// Fetch singleton with expanded references
const homepage = await client
  .singleton('homepage')
  .expand('hero.backgroundImage')           // Nested single reference
  .expand('documentation.featuredDocument') // Nested single reference
  .expand('sections.relatedArticles[]')     // Nested array reference
  .fetch()
```

#### Nested Field Paths

The `expand()` method supports dot notation for nested fields:

```typescript
// Top-level field
.expand('author')

// Nested field (one level deep)
.expand('content.featuredImage')

// Deeply nested field
.expand('sections.hero.backgroundImage')

// Multiple nested expansions
const homepage = await client
  .singleton('homepage')
  .expand('hero.backgroundImage')
  .expand('documentation.featuredDocument')
  .expand('footer.socialLinks[]')
  .fetch()

// Access the expanded data directly
console.log(homepage.documentation.featuredDocument.title)
// Output: "Terms of Service"
```

#### Expand Parameter Formats

| Format | Description |
|--------|-------------|
| `author` | Expand single reference field |
| `categories[]` | Expand array reference field |
| `content.author` | Expand nested single reference |
| `sections.items[]` | Expand nested array reference |
| `a.b.c` | Expand deeply nested reference |
| `author,tags[]` | Expand multiple fields |
| `*` | Expand all reference fields |

### Frontend Integration Examples

#### Next.js App Router

```typescript
// app/lib/trokky.ts
import { TrokkyClient } from '@trokky/client'

export const trokky = new TrokkyClient({
  baseUrl: process.env.TROKKY_API_URL || 'http://localhost:3000/api'
})

// app/lib/queries.ts
export async function getHomepage() {
  return trokky
    .singleton('homepage')
    .expand('documentation.featuredDocument')
    .expand('hero.backgroundImage')
    .fetch()
}

export async function getPosts() {
  return trokky
    .from('post')
    .published()
    .expand('author')
    .expand('category')
    .newest()
    .limit(10)
    .fetch()
}

// app/page.tsx
import { getHomepage } from './lib/queries'

export default async function HomePage() {
  const homepage = await getHomepage()

  return (
    <div>
      <h1>{homepage.hero.title}</h1>

      {/* Access expanded nested reference directly */}
      {homepage.documentation.featuredDocument && (
        <div className="featured">
          <h2>{homepage.documentation.featuredDocument.title}</h2>
          <p>{homepage.documentation.featuredDocument.description}</p>
        </div>
      )}
    </div>
  )
}
```

#### React with React Query

```typescript
// hooks/useTrokky.ts
import { useQuery } from '@tanstack/react-query'
import { TrokkyClient } from '@trokky/client'

const client = new TrokkyClient({
  baseUrl: 'http://localhost:3000/api'
})

export function useHomepage() {
  return useQuery({
    queryKey: ['homepage'],
    queryFn: () =>
      client
        .singleton('homepage')
        .expand('documentation.featuredDocument')
        .expand('hero.backgroundImage')
        .fetch()
  })
}

export function usePosts() {
  return useQuery({
    queryKey: ['posts'],
    queryFn: () =>
      client
        .from('post')
        .published()
        .expand('author')
        .newest()
        .limit(10)
        .fetch()
  })
}

// components/HomePage.tsx
import { useHomepage } from '../hooks/useTrokky'

export function HomePage() {
  const { data: homepage, isLoading, error } = useHomepage()

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error loading page</div>
  if (!homepage) return null

  const featuredDoc = homepage.documentation?.featuredDocument

  return (
    <main>
      <h1>{homepage.hero?.title}</h1>

      {featuredDoc && (
        <article>
          <h2>{featuredDoc.title}</h2>
          <p>{featuredDoc.excerpt}</p>
          <a href={`/docs/${featuredDoc.slug}`}>Read more</a>
        </article>
      )}
    </main>
  )
}
```

#### Vue 3 Composition API

```typescript
// composables/useTrokky.ts
import { ref, onMounted } from 'vue'
import { TrokkyClient } from '@trokky/client'

const client = new TrokkyClient({
  baseUrl: 'http://localhost:3000/api'
})

export function useHomepage() {
  const homepage = ref(null)
  const loading = ref(true)
  const error = ref(null)

  onMounted(async () => {
    try {
      homepage.value = await client
        .singleton('homepage')
        .expand('documentation.featuredDocument')
        .expand('hero.backgroundImage')
        .fetch()
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  })

  return { homepage, loading, error }
}

// components/HomePage.vue
<script setup lang="ts">
import { useHomepage } from '../composables/useTrokky'

const { homepage, loading, error } = useHomepage()
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <main v-else-if="homepage">
    <h1>{{ homepage.hero?.title }}</h1>

    <article v-if="homepage.documentation?.featuredDocument">
      <h2>{{ homepage.documentation.featuredDocument.title }}</h2>
      <p>{{ homepage.documentation.featuredDocument.excerpt }}</p>
    </article>
  </main>
</template>
```

#### TypeScript Types with Expansion

When using TypeScript, you can define types that reflect expanded references:

```typescript
// types/cms.ts
import type { BaseDocument } from '@trokky/client'

interface DocumentReference {
  _ref: string
  _type: string
}

interface LegalDocument extends BaseDocument {
  title: string
  slug: string
  content: string
  category: string
}

// Before expansion: reference object
interface HomepageRaw extends BaseDocument {
  documentation: {
    featuredDocument: DocumentReference
  }
}

// After expansion: full document
interface HomepageExpanded extends BaseDocument {
  documentation: {
    featuredDocument: LegalDocument
  }
}

// Usage with explicit expanded type
const homepage = await client
  .singleton<HomepageExpanded>('homepage')
  .expand('documentation.featuredDocument')
  .fetch()

// TypeScript knows featuredDocument has title, slug, etc.
console.log(homepage.documentation.featuredDocument.title)
```

### Custom HTTP Client

Access the underlying HTTP client for advanced usage:

```typescript
const client = new TrokkyClient({ baseUrl: 'https://api.example.com' })

// Direct HTTP requests
const response = await client.http.get('/custom-endpoint')
const result = await client.http.post('/custom-endpoint', { data: 'value' })
```

### Cache Management

```typescript
// Configure caching
const client = new TrokkyClient({
  baseUrl: 'https://api.example.com',
  enableCache: true,
  cacheMaxAge: 300000 // 5 minutes
})

// Cache-specific operations
client.clearCache()
const stats = client.getCacheStats()

// Disable cache for specific requests
const freshData = await client.queryDocuments('post', {}, false) // useCache = false
```

### Error Handling

```typescript
import type { ApiError } from '@trokky/client'

try {
  await client.getDocument('post', 'invalid-id')
} catch (error) {
  if (error.status === 404) {
    console.log('Document not found')
  } else if (error.status === 401) {
    console.log('Authentication required')
    await client.authenticate(credentials)
  } else {
    console.error('API Error:', error.message)
    if (error.validation) {
      console.log('Validation errors:', error.validation)
    }
  }
}
```

## Configuration

### Environment Variables

```bash
# API Configuration
TROKKY_API_URL=https://your-api.com
TROKKY_API_VERSION=v1

# Authentication
TROKKY_TOKEN=your-jwt-token
TROKKY_REFRESH_TOKEN=your-refresh-token

# Performance
TROKKY_CACHE_ENABLED=true
TROKKY_CACHE_MAX_AGE=300000
TROKKY_REQUEST_TIMEOUT=30000
TROKKY_REQUEST_RETRIES=3
```

### Client Configuration

```typescript
const client = new TrokkyClient({
  baseUrl: process.env.TROKKY_API_URL || 'http://localhost:3000',
  apiVersion: process.env.TROKKY_API_VERSION || 'v1',
  token: process.env.TROKKY_TOKEN,
  refreshToken: process.env.TROKKY_REFRESH_TOKEN,
  timeout: parseInt(process.env.TROKKY_REQUEST_TIMEOUT || '30000'),
  retries: parseInt(process.env.TROKKY_REQUEST_RETRIES || '3'),
  enableCache: process.env.TROKKY_CACHE_ENABLED === 'true',
  cacheMaxAge: parseInt(process.env.TROKKY_CACHE_MAX_AGE || '300000'),
  debug: process.env.NODE_ENV === 'development'
})
```

## Examples

Check out complete examples in the [examples directory](./examples):

- [React Blog](./examples/react-blog) - Complete blog application with React
- [Vue Portfolio](./examples/vue-portfolio) - Portfolio site with Vue 3
- [Svelte News](./examples/svelte-news) - News site with SvelteKit
- [Node.js API](./examples/node-api) - Server-side usage with Express
- [Next.js App](./examples/nextjs-app) - Full-stack Next.js application

## TypeScript Support

This package includes full TypeScript definitions and supports:

- Strict type checking
- Generic document types
- Auto-completion in IDEs
- Type-safe query building
- Generated types from schemas

## License

MIT