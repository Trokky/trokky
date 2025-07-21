# Basic Usage Examples

This document provides practical examples of using the Trokky Client SDK in various scenarios.

## Table of Contents

1. [Basic Setup](#basic-setup)
2. [Authentication](#authentication)
3. [Document Operations](#document-operations)
4. [Media Management](#media-management)
5. [Type Generation](#type-generation)
6. [Error Handling](#error-handling)
7. [Caching](#caching)

## Basic Setup

### Simple Client

```typescript
import { TrokkyClient } from '@trokky/client'

const client = new TrokkyClient({
  baseUrl: 'https://your-api.com',
  apiVersion: 'v1'
})
```

### Production Configuration

```typescript
import { TrokkyClient } from '@trokky/client'

const client = new TrokkyClient({
  baseUrl: process.env.TROKKY_API_URL!,
  apiVersion: 'v1',
  timeout: 30000,
  retries: 3,
  enableCache: true,
  cacheMaxAge: 300000, // 5 minutes
  debug: process.env.NODE_ENV === 'development'
})
```

## Authentication

### Login with Credentials

```typescript
try {
  const tokens = await client.authenticate({
    username: 'user@example.com',
    password: 'secure-password'
  })
  
  console.log('Authenticated successfully')
  console.log('Access token expires at:', new Date(tokens.expiresAt || 0))
} catch (error) {
  console.error('Authentication failed:', error.message)
}
```

### Using Existing Tokens

```typescript
// Set tokens from storage
const savedTokens = JSON.parse(localStorage.getItem('trokky-tokens') || '{}')
if (savedTokens.accessToken) {
  client.setTokens(savedTokens)
}

// Check authentication status
if (client.isAuthenticated()) {
  console.log('User is authenticated')
} else {
  // Redirect to login
  window.location.href = '/login'
}
```

### Token Refresh

```typescript
// Manual token refresh
try {
  const newTokens = await client.refreshAuth()
  localStorage.setItem('trokky-tokens', JSON.stringify(newTokens))
} catch (error) {
  // Refresh failed, redirect to login
  localStorage.removeItem('trokky-tokens')
  window.location.href = '/login'
}

// Automatic refresh is handled by the client
// Just make requests normally and the client will refresh as needed
```

### Logout

```typescript
await client.logout()
localStorage.removeItem('trokky-tokens')
console.log('Logged out successfully')
```

## Document Operations

### Get Single Document

```typescript
import type { PostDocument } from './types/trokky'

try {
  const post = await client.getDocument<PostDocument>('post', 'post-123')
  console.log('Post title:', post.data.title)
  console.log('Post created:', post._createdAt)
} catch (error) {
  if (error.status === 404) {
    console.log('Post not found')
  } else {
    console.error('Error fetching post:', error.message)
  }
}
```

### Query Documents

```typescript
// Basic query
const posts = await client.queryDocuments<PostDocument>('post', {
  filter: { published: true },
  sort: { createdAt: -1 },
  limit: 10
})

console.log(`Found ${posts.total} posts`)
posts.data.forEach(doc => {
  console.log(`- ${doc.data.title} (${doc._createdAt})`)
})

// Advanced query with pagination
const getPostsPage = async (page: number, limit: number = 10) => {
  return await client.queryDocuments<PostDocument>('post', {
    filter: { 
      published: true,
      author: 'user-123'
    },
    sort: { createdAt: -1 },
    limit,
    offset: page * limit,
    select: ['title', 'slug', 'createdAt', 'author']
  })
}

// Load first page
const firstPage = await getPostsPage(0)
console.log(`Page 1: ${firstPage.data.length} posts`)
console.log(`Has more pages: ${firstPage.hasMore}`)
```

### Create Document

```typescript
const newPost = await client.createDocument<PostDocument>('post', {
  title: 'My New Blog Post',
  content: 'This is the content of my blog post...',
  slug: 'my-new-blog-post',
  published: false,
  author: 'user-123',
  tags: ['tech', 'javascript', 'cms']
})

console.log('Created post with ID:', newPost._id)
```

### Update Document

```typescript
// Partial update
const updated = await client.updateDocument('post', 'post-123', {
  title: 'Updated Blog Post Title',
  published: true
})

console.log('Updated post:', updated.data.title)

// Full replacement
const replaced = await client.replaceDocument('post', 'post-123', {
  title: 'Completely New Post',
  content: 'Brand new content...',
  slug: 'completely-new-post',
  published: true,
  author: 'user-123',
  tags: ['updated']
})
```

### Delete Document

```typescript
try {
  await client.deleteDocument('post', 'post-123')
  console.log('Post deleted successfully')
} catch (error) {
  if (error.status === 404) {
    console.log('Post was already deleted')
  } else {
    console.error('Error deleting post:', error.message)
  }
}
```

### Search Documents

```typescript
// Search in specific fields
const searchResults = await client.searchDocuments<PostDocument>(
  'post',
  'javascript tutorial',
  ['title', 'content', 'tags'],
  {
    filter: { published: true },
    sort: { createdAt: -1 },
    limit: 20
  }
)

console.log(`Found ${searchResults.total} posts matching "javascript tutorial"`)

// Search all fields
const allFieldsSearch = await client.searchDocuments<PostDocument>(
  'post',
  'react hooks'
)
```

### Count Documents

```typescript
// Count all posts
const totalPosts = await client.countDocuments('post')
console.log(`Total posts: ${totalPosts}`)

// Count with filter
const publishedPosts = await client.countDocuments('post', {
  published: true
})
console.log(`Published posts: ${publishedPosts}`)

// Count by author
const authorPosts = await client.countDocuments('post', {
  author: 'user-123',
  published: true
})
console.log(`Published posts by author: ${authorPosts}`)
```

### Check Document Existence

```typescript
const exists = await client.documentExists('post', 'post-123')
if (exists) {
  console.log('Post exists')
} else {
  console.log('Post does not exist')
}
```

## Media Management

### Upload File

```typescript
// From file input
const fileInput = document.getElementById('file') as HTMLInputElement
const file = fileInput.files?.[0]

if (file) {
  try {
    const media = await client.uploadFile(file)
    console.log('File uploaded:', media.url)
    console.log('Media ID:', media._id)
  } catch (error) {
    console.error('Upload failed:', error.message)
  }
}

// From URL (fetch first)
const response = await fetch('https://example.com/image.jpg')
const blob = await response.blob()
const file = new File([blob], 'image.jpg', { type: 'image/jpeg' })

const media = await client.uploadFile(file, 'downloaded-image.jpg')
```

### Get Media

```typescript
const media = await client.getMedia('media-123')
console.log('Media URL:', media.url)
console.log('File size:', media.size)
console.log('MIME type:', media.mimeType)
console.log('Metadata:', media.metadata)
```

### Delete Media

```typescript
await client.deleteMedia('media-123')
console.log('Media deleted successfully')
```

## Type Generation

### Generate Types from Schema

```typescript
import { generateTypes } from '@trokky/client/generator'

// Generate types from API
await generateTypes({
  schemaUrl: 'https://your-api.com/api/v1/schema',
  outputDir: './src/types/trokky',
  namespace: 'Trokky',
  fileExtension: 'ts',
  includeValidation: true
})

// This generates files like:
// - ./src/types/trokky/post.ts
// - ./src/types/trokky/user.ts
// - ./src/types/trokky/index.ts
```

### Use Generated Types

```typescript
// Import generated types
import type { PostDocument, UserDocument, AllDocuments } from './types/trokky'

// Type-safe document operations
const createPost = async (postData: Omit<PostDocument, '_id' | '_type' | '_createdAt' | '_updatedAt' | '_version'>) => {
  return await client.createDocument('post', postData)
}

// Generic function with type constraints
const getDocumentByType = async <T extends AllDocuments>(
  type: T['_type'],
  id: string
): Promise<T> => {
  return await client.getDocument<T>(type, id)
}
```

### Manual Type Definitions

```typescript
// Define your own types
interface BlogPost extends BaseDocument {
  _type: 'post'
  title: string
  content: string
  slug: string
  published: boolean
  author: string | UserDocument
  tags: string[]
  featuredImage?: string
  publishedAt?: string
}

// Use with client
const post = await client.getDocument<BlogPost>('post', 'post-123')
```

## Error Handling

### Comprehensive Error Handling

```typescript
import type { ApiError, ValidationError } from '@trokky/client'

const handleApiError = (error: ApiError) => {
  switch (error.status) {
    case 400:
      console.error('Bad request:', error.message)
      if (error.validation) {
        error.validation.forEach((err: ValidationError) => {
          console.error(`${err.field}: ${err.message}`)
        })
      }
      break
    
    case 401:
      console.error('Unauthorized - redirecting to login')
      window.location.href = '/login'
      break
    
    case 403:
      console.error('Forbidden - insufficient permissions')
      break
    
    case 404:
      console.error('Resource not found')
      break
    
    case 429:
      console.error('Rate limited - too many requests')
      break
    
    case 500:
      console.error('Server error:', error.message)
      break
    
    default:
      console.error('API error:', error.message)
  }
}

// Usage in async functions
const safeCreatePost = async (postData: any) => {
  try {
    return await client.createDocument('post', postData)
  } catch (error) {
    handleApiError(error)
    throw error // Re-throw if you want calling code to handle it too
  }
}
```

### Retry Logic

```typescript
// The client has built-in retry logic, but you can add your own
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      if (attempt === maxRetries) {
        throw lastError
      }
      
      // Don't retry authentication errors
      if (error.status === 401 || error.status === 403) {
        throw error
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt))
    }
  }
  
  throw lastError!
}

// Usage
const post = await withRetry(() => 
  client.getDocument('post', 'post-123')
)
```

## Caching

### Cache Configuration

```typescript
const client = new TrokkyClient({
  baseUrl: 'https://api.example.com',
  enableCache: true,
  cacheMaxAge: 300000 // 5 minutes
})
```

### Cache Control

```typescript
// Get with cache (default)
const cachedPost = await client.getDocument('post', 'post-123', true)

// Get without cache (fresh data)
const freshPost = await client.getDocument('post', 'post-123', false)

// Clear all cache
client.clearCache()

// Get cache statistics
const stats = client.getCacheStats()
console.log(`Cache size: ${stats.size} entries`)
```

### Custom Cache Strategy

```typescript
// Cache expensive queries manually
const getCachedPosts = (() => {
  let cache: any = null
  let cacheTime = 0
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

  return async () => {
    const now = Date.now()
    
    if (cache && (now - cacheTime) < CACHE_DURATION) {
      return cache
    }
    
    cache = await client.queryDocuments('post', {
      filter: { published: true },
      sort: { createdAt: -1 }
    })
    cacheTime = now
    
    return cache
  }
})()

// Usage
const posts = await getCachedPosts()
```

## Advanced Patterns

### Repository Pattern

```typescript
class PostRepository {
  constructor(private client: TrokkyClient) {}

  async findAll(options?: QueryOptions) {
    return this.client.queryDocuments<PostDocument>('post', options)
  }

  async findById(id: string) {
    return this.client.getDocument<PostDocument>('post', id)
  }

  async findBySlug(slug: string) {
    const result = await this.client.queryDocuments<PostDocument>('post', {
      filter: { slug },
      limit: 1
    })
    return result.data[0] || null
  }

  async create(data: Omit<PostDocument, '_id' | '_type' | '_createdAt' | '_updatedAt' | '_version'>) {
    return this.client.createDocument<PostDocument>('post', data)
  }

  async update(id: string, data: Partial<PostDocument>) {
    return this.client.updateDocument<PostDocument>('post', id, data)
  }

  async delete(id: string) {
    return this.client.deleteDocument('post', id)
  }
}

// Usage
const postRepo = new PostRepository(client)
const posts = await postRepo.findAll({ filter: { published: true } })
```

### Service Layer

```typescript
class BlogService {
  constructor(
    private client: TrokkyClient,
    private postRepo: PostRepository
  ) {}

  async getPublishedPosts(page: number = 0, limit: number = 10) {
    return this.postRepo.findAll({
      filter: { published: true },
      sort: { publishedAt: -1 },
      offset: page * limit,
      limit
    })
  }

  async getPostBySlug(slug: string) {
    const post = await this.postRepo.findBySlug(slug)
    
    if (!post) {
      throw new Error(`Post with slug "${slug}" not found`)
    }
    
    if (!post.data.published) {
      throw new Error(`Post "${slug}" is not published`)
    }
    
    return post
  }

  async publishPost(id: string) {
    return this.postRepo.update(id, {
      published: true,
      publishedAt: new Date().toISOString()
    })
  }
}

// Usage
const blogService = new BlogService(client, postRepo)
const post = await blogService.getPostBySlug('my-blog-post')
```

This concludes the basic usage examples. For more advanced use cases, check out the framework-specific examples in the repository.