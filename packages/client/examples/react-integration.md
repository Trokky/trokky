# React Integration Examples

Complete examples for using Trokky Client SDK with React applications.

## Table of Contents

1. [Setup and Configuration](#setup-and-configuration)
2. [Custom Hooks](#custom-hooks)
3. [Context Provider](#context-provider)
4. [Component Examples](#component-examples)
5. [Form Handling](#form-handling)
6. [Error Boundaries](#error-boundaries)
7. [TypeScript Integration](#typescript-integration)

## Setup and Configuration

### Basic Client Setup

```typescript
// src/lib/trokky.ts
import { TrokkyClient } from '@trokky/client'

export const trokkyClient = new TrokkyClient({
  baseUrl: process.env.REACT_APP_TROKKY_API_URL || 'http://localhost:3000',
  apiVersion: 'v1',
  enableCache: true,
  cacheMaxAge: 300000, // 5 minutes
  debug: process.env.NODE_ENV === 'development'
})

// Initialize with stored tokens
const storedTokens = localStorage.getItem('trokky-tokens')
if (storedTokens) {
  try {
    const tokens = JSON.parse(storedTokens)
    trokkyClient.setTokens(tokens)
  } catch (error) {
    console.error('Failed to parse stored tokens:', error)
    localStorage.removeItem('trokky-tokens')
  }
}
```

### Environment Variables

```bash
# .env
REACT_APP_TROKKY_API_URL=https://your-api.com
REACT_APP_TROKKY_API_VERSION=v1
```

## Custom Hooks

### useAuth Hook

```typescript
// src/hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react'
import { trokkyClient } from '../lib/trokky'
import type { AuthTokens } from '@trokky/client'

interface AuthState {
  isAuthenticated: boolean
  tokens: AuthTokens | null
  loading: boolean
  error: string | null
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: trokkyClient.isAuthenticated(),
    tokens: trokkyClient.getTokens(),
    loading: false,
    error: null
  })

  const login = useCallback(async (username: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const tokens = await trokkyClient.authenticate({ username, password })
      localStorage.setItem('trokky-tokens', JSON.stringify(tokens))
      
      setState({
        isAuthenticated: true,
        tokens,
        loading: false,
        error: null
      })
      
      return tokens
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Authentication failed'
      }))
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }))
    
    try {
      await trokkyClient.logout()
      localStorage.removeItem('trokky-tokens')
      
      setState({
        isAuthenticated: false,
        tokens: null,
        loading: false,
        error: null
      })
    } catch (error: any) {
      console.error('Logout error:', error)
      // Clear local state even if API call fails
      localStorage.removeItem('trokky-tokens')
      setState({
        isAuthenticated: false,
        tokens: null,
        loading: false,
        error: null
      })
    }
  }, [])

  const refreshTokens = useCallback(async () => {
    try {
      const tokens = await trokkyClient.refreshAuth()
      localStorage.setItem('trokky-tokens', JSON.stringify(tokens))
      
      setState(prev => ({
        ...prev,
        tokens,
        isAuthenticated: true
      }))
      
      return tokens
    } catch (error) {
      logout()
      throw error
    }
  }, [logout])

  // Check token expiration
  useEffect(() => {
    const checkTokenExpiration = () => {
      const tokens = trokkyClient.getTokens()
      if (tokens?.expiresAt) {
        const expiresAt = new Date(tokens.expiresAt).getTime()
        const now = Date.now()
        const fiveMinutes = 5 * 60 * 1000
        
        // Refresh if token expires in less than 5 minutes
        if (expiresAt - now < fiveMinutes) {
          refreshTokens().catch(() => {
            // Refresh failed, will be handled by logout in refreshTokens
          })
        }
      }
    }

    if (state.isAuthenticated) {
      checkTokenExpiration()
      const interval = setInterval(checkTokenExpiration, 60000) // Check every minute
      return () => clearInterval(interval)
    }
  }, [state.isAuthenticated, refreshTokens])

  return {
    ...state,
    login,
    logout,
    refreshTokens
  }
}
```

### useDocuments Hook

```typescript
// src/hooks/useDocuments.ts
import { useState, useEffect, useCallback } from 'react'
import { trokkyClient } from '../lib/trokky'
import type { QueryOptions, DocumentResult, CollectionResult } from '@trokky/client'

interface UseDocumentsOptions<T> extends QueryOptions {
  type: string
  enabled?: boolean
  refetchOnMount?: boolean
}

interface UseDocumentsResult<T> {
  data: DocumentResult<T>[]
  total: number
  loading: boolean
  error: string | null
  hasMore: boolean
  refetch: () => Promise<void>
  loadMore: () => Promise<void>
}

export const useDocuments = <T = any>(
  options: UseDocumentsOptions<T>
): UseDocumentsResult<T> => {
  const { type, enabled = true, refetchOnMount = true, ...queryOptions } = options
  
  const [state, setState] = useState<{
    data: DocumentResult<T>[]
    total: number
    loading: boolean
    error: string | null
    hasMore: boolean
  }>({
    data: [],
    total: 0,
    loading: false,
    error: null,
    hasMore: false
  })

  const fetchDocuments = useCallback(async (reset: boolean = true) => {
    if (!enabled) return

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result: CollectionResult<T> = await trokkyClient.queryDocuments(type, queryOptions)
      
      setState(prev => ({
        data: reset ? result.data : [...prev.data, ...result.data],
        total: result.total,
        loading: false,
        error: null,
        hasMore: result.hasMore
      }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to fetch documents'
      }))
    }
  }, [type, enabled, JSON.stringify(queryOptions)])

  const loadMore = useCallback(async () => {
    if (state.loading || !state.hasMore) return

    const currentOffset = queryOptions.offset || 0
    const limit = queryOptions.limit || 10
    
    setState(prev => ({ ...prev, loading: true }))

    try {
      const result: CollectionResult<T> = await trokkyClient.queryDocuments(type, {
        ...queryOptions,
        offset: currentOffset + state.data.length
      })
      
      setState(prev => ({
        ...prev,
        data: [...prev.data, ...result.data],
        loading: false,
        hasMore: result.hasMore
      }))
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to load more documents'
      }))
    }
  }, [type, queryOptions, state.data.length, state.loading, state.hasMore])

  useEffect(() => {
    if (refetchOnMount) {
      fetchDocuments()
    }
  }, [fetchDocuments, refetchOnMount])

  return {
    ...state,
    refetch: () => fetchDocuments(true),
    loadMore
  }
}
```

### useDocument Hook

```typescript
// src/hooks/useDocument.ts
import { useState, useEffect, useCallback } from 'react'
import { trokkyClient } from '../lib/trokky'
import type { DocumentResult } from '@trokky/client'

interface UseDocumentOptions {
  type: string
  id: string
  enabled?: boolean
}

interface UseDocumentResult<T> {
  data: DocumentResult<T> | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  update: (data: Partial<T>) => Promise<DocumentResult<T>>
  delete: () => Promise<void>
}

export const useDocument = <T = any>(
  options: UseDocumentOptions
): UseDocumentResult<T> => {
  const { type, id, enabled = true } = options
  
  const [state, setState] = useState<{
    data: DocumentResult<T> | null
    loading: boolean
    error: string | null
  }>({
    data: null,
    loading: false,
    error: null
  })

  const fetchDocument = useCallback(async () => {
    if (!enabled || !id) return

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await trokkyClient.getDocument<T>(type, id)
      setState({
        data: result,
        loading: false,
        error: null
      })
    } catch (error: any) {
      setState({
        data: null,
        loading: false,
        error: error.message || 'Failed to fetch document'
      })
    }
  }, [type, id, enabled])

  const updateDocument = useCallback(async (data: Partial<T>) => {
    const result = await trokkyClient.updateDocument<T>(type, id, data)
    setState(prev => ({
      ...prev,
      data: result
    }))
    return result
  }, [type, id])

  const deleteDocument = useCallback(async () => {
    await trokkyClient.deleteDocument(type, id)
    setState({
      data: null,
      loading: false,
      error: null
    })
  }, [type, id])

  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  return {
    ...state,
    refetch: fetchDocument,
    update: updateDocument,
    delete: deleteDocument
  }
}
```

## Context Provider

### Trokky Context

```typescript
// src/contexts/TrokkyContext.tsx
import React, { createContext, useContext, ReactNode } from 'react'
import { TrokkyClient } from '@trokky/client'
import { trokkyClient } from '../lib/trokky'

interface TrokkyContextValue {
  client: TrokkyClient
}

const TrokkyContext = createContext<TrokkyContextValue | undefined>(undefined)

interface TrokkyProviderProps {
  children: ReactNode
  client?: TrokkyClient
}

export const TrokkyProvider: React.FC<TrokkyProviderProps> = ({
  children,
  client = trokkyClient
}) => {
  return (
    <TrokkyContext.Provider value={{ client }}>
      {children}
    </TrokkyContext.Provider>
  )
}

export const useTrokky = () => {
  const context = useContext(TrokkyContext)
  if (!context) {
    throw new Error('useTrokky must be used within a TrokkyProvider')
  }
  return context
}
```

### App Setup

```typescript
// src/App.tsx
import React from 'react'
import { TrokkyProvider } from './contexts/TrokkyContext'
import { Router } from './Router'

function App() {
  return (
    <TrokkyProvider>
      <Router />
    </TrokkyProvider>
  )
}

export default App
```

## Component Examples

### Blog Post List

```typescript
// src/components/BlogPostList.tsx
import React from 'react'
import { useDocuments } from '../hooks/useDocuments'
import type { PostDocument } from '../types/trokky'
import { BlogPostCard } from './BlogPostCard'
import { LoadingSpinner } from './LoadingSpinner'
import { ErrorMessage } from './ErrorMessage'

interface BlogPostListProps {
  published?: boolean
  authorId?: string
  limit?: number
}

export const BlogPostList: React.FC<BlogPostListProps> = ({
  published = true,
  authorId,
  limit = 10
}) => {
  const { data, loading, error, hasMore, loadMore } = useDocuments<PostDocument>({
    type: 'post',
    filter: {
      ...(published !== undefined && { published }),
      ...(authorId && { author: authorId })
    },
    sort: { createdAt: -1 },
    limit
  })

  if (loading && data.length === 0) {
    return <LoadingSpinner />
  }

  if (error) {
    return <ErrorMessage message={error} />
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {data.map(doc => (
          <BlogPostCard key={doc._id} post={doc.data} />
        ))}
      </div>
      
      {data.length === 0 && (
        <p className="text-center text-gray-500">No posts found.</p>
      )}
      
      {hasMore && (
        <div className="text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}
```

### Blog Post Card

```typescript
// src/components/BlogPostCard.tsx
import React from 'react'
import { Link } from 'react-router-dom'
import type { PostDocument } from '../types/trokky'

interface BlogPostCardProps {
  post: PostDocument
}

export const BlogPostCard: React.FC<BlogPostCardProps> = ({ post }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <article className="bg-white rounded-lg shadow-md overflow-hidden">
      {post.featuredImage && (
        <img
          src={post.featuredImage}
          alt={post.title}
          className="w-full h-48 object-cover"
        />
      )}
      
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">
          <Link
            to={`/posts/${post.slug}`}
            className="text-gray-900 hover:text-blue-600"
          >
            {post.title}
          </Link>
        </h2>
        
        {post.excerpt && (
          <p className="text-gray-600 mb-4">{post.excerpt}</p>
        )}
        
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{formatDate(post._createdAt)}</span>
          
          {post.tags && post.tags.length > 0 && (
            <div className="flex space-x-2">
              {post.tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-gray-100 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
```

### Blog Post Detail

```typescript
// src/components/BlogPostDetail.tsx
import React from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useDocument } from '../hooks/useDocument'
import type { PostDocument } from '../types/trokky'
import { LoadingSpinner } from './LoadingSpinner'
import { ErrorMessage } from './ErrorMessage'

export const BlogPostDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  
  // First fetch by slug to get the ID
  const { data: posts, loading: searchLoading, error: searchError } = useDocuments<PostDocument>({
    type: 'post',
    filter: { slug, published: true },
    limit: 1
  })

  const post = posts?.[0]
  
  if (searchLoading) {
    return <LoadingSpinner />
  }

  if (searchError) {
    return <ErrorMessage message={searchError} />
  }

  if (!post) {
    return <Navigate to="/404" replace />
  }

  return (
    <article className="max-w-4xl mx-auto px-4 py-8">
      {post.data.featuredImage && (
        <img
          src={post.data.featuredImage}
          alt={post.data.title}
          className="w-full h-64 object-cover rounded-lg mb-8"
        />
      )}
      
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {post.data.title}
        </h1>
        
        <div className="flex items-center justify-between text-gray-600">
          <time>{new Date(post._createdAt).toLocaleDateString()}</time>
          
          {post.data.tags && (
            <div className="flex space-x-2">
              {post.data.tags.map(tag => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>
      
      <div className="prose max-w-none">
        {post.data.content}
      </div>
    </article>
  )
}
```

## Form Handling

### Create Post Form

```typescript
// src/components/CreatePostForm.tsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { trokkyClient } from '../lib/trokky'
import type { PostDocument } from '../types/trokky'

interface CreatePostFormData {
  title: string
  content: string
  slug: string
  published: boolean
  tags: string[]
  excerpt?: string
}

export const CreatePostForm: React.FC = () => {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<CreatePostFormData>({
    title: '',
    content: '',
    slug: '',
    published: false,
    tags: []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim()
  }

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: generateSlug(title)
    }))
  }

  const handleTagsChange = (tagsString: string) => {
    const tags = tagsString
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)
    
    setFormData(prev => ({ ...prev, tags }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const postData: Omit<PostDocument, '_id' | '_type' | '_createdAt' | '_updatedAt' | '_version'> = {
        ...formData,
        author: 'current-user-id' // Get from auth context
      }

      const result = await trokkyClient.createDocument('post', postData)
      navigate(`/posts/${result.data.slug}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create post')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Create New Post</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            type="text"
            id="title"
            value={formData.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
            Slug
          </label>
          <input
            type="text"
            id="slug"
            value={formData.slug}
            onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="excerpt" className="block text-sm font-medium text-gray-700">
            Excerpt
          </label>
          <textarea
            id="excerpt"
            value={formData.excerpt || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700">
            Content
          </label>
          <textarea
            id="content"
            value={formData.content}
            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
            rows={10}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700">
            Tags (comma-separated)
          </label>
          <input
            type="text"
            id="tags"
            value={formData.tags.join(', ')}
            onChange={(e) => handleTagsChange(e.target.value)}
            placeholder="react, typescript, cms"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="published"
            checked={formData.published}
            onChange={(e) => setFormData(prev => ({ ...prev, published: e.target.checked }))}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="published" className="ml-2 block text-sm text-gray-900">
            Publish immediately
          </label>
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Post'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

## Error Boundaries

### Trokky Error Boundary

```typescript
// src/components/TrokkyErrorBoundary.tsx
import React, { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: (error: Error) => ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class TrokkyErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Trokky Error:', error, errorInfo)
    
    // Report error to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // reportError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!)
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  Something went wrong
                </h3>
              </div>
            </div>
            
            <div className="text-sm text-gray-500 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </div>
            
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

## TypeScript Integration

### Type Generation Setup

```bash
# Generate types from your Trokky schema
npx @trokky/client generate-types \
  --schema-url https://your-api.com/api/v1/schema \
  --output-dir src/types/trokky \
  --namespace Trokky
```

### Generated Types Usage

```typescript
// src/types/trokky/index.ts (generated)
export interface PostDocument extends BaseDocument {
  _type: 'post'
  title: string
  content: string
  slug: string
  published: boolean
  author: string | UserDocument
  tags: string[]
  featuredImage?: string
  excerpt?: string
}

export interface UserDocument extends BaseDocument {
  _type: 'user'
  name: string
  email: string
  avatar?: string
}

export type DocumentTypes = 'post' | 'user'
export type AllDocuments = PostDocument | UserDocument
```

### Type-Safe Hooks

```typescript
// src/hooks/useTypedDocuments.ts
import { useDocuments } from './useDocuments'
import type { PostDocument, UserDocument, DocumentTypes } from '../types/trokky'

// Type-safe document hooks
export const usePosts = (options?: Omit<Parameters<typeof useDocuments>[0], 'type'>) => {
  return useDocuments<PostDocument>({ type: 'post', ...options })
}

export const useUsers = (options?: Omit<Parameters<typeof useDocuments>[0], 'type'>) => {
  return useDocuments<UserDocument>({ type: 'user', ...options })
}

// Generic typed hook
export const useTypedDocuments = <T extends DocumentTypes>(
  type: T,
  options?: Omit<Parameters<typeof useDocuments>[0], 'type'>
) => {
  type DocumentType = T extends 'post' ? PostDocument : 
                     T extends 'user' ? UserDocument : 
                     never

  return useDocuments<DocumentType>({ type, ...options })
}
```

This completes the React integration examples. The patterns shown here provide a solid foundation for building React applications with the Trokky Client SDK.