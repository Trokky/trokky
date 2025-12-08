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

Expand reference fields to include full document data instead of just reference IDs. This is done server-side for optimal performance.

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

#### Query Builder with Expansion

```typescript
import { createQueryBuilder } from '@trokky/client'

const query = createQueryBuilder<PostDocument>(client)

// Query with reference expansion
const posts = await query
  .collection('post')
  .filter({ published: true })
  .expand('author')           // Single reference field
  .expand('categories', true) // Array reference field (pass true)
  .sort('createdAt', 'desc')
  .limit(10)
  .fetch()
```

#### Singleton with Expansion

```typescript
// Fetch singleton with expanded references
const homepage = await query
  .singleton<HomepageDocument>('homepage')
  .expand('featuredPosts', true)  // Array of references
  .expand('heroImage')            // Single reference
  .fetch()
```

#### Expand Parameter Formats

| Format | Description |
|--------|-------------|
| `author` | Expand single reference field |
| `categories[]` | Expand array reference field |
| `author,tags[]` | Expand multiple fields |
| `*` | Expand all reference fields |

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