/**
 * Main Trokky Client
 *
 * @example
 * // Initialize client
 * const client = new TrokkyClient({ baseUrl: 'https://api.example.com' })
 *
 * // Fluent API (recommended)
 * const posts = await client.from('posts').published().limit(10).fetch()
 * const post = await client.from('posts').id('post-123').fetchOne()
 * await client.from('posts').create({ title: 'Hello' })
 * await client.from('posts').id('post-123').update({ title: 'New' })
 * await client.from('posts').id('post-123').delete()
 */

import { HttpClient, type ClientConfig, type AuthTokens } from './http.js'
import { QueryBuilder } from './query-builder.js'
import type { BaseDocument, QueryOptions, DocumentResult, CollectionResult } from '@trokky/types'

export class TrokkyClient {
  private http: HttpClient

  constructor(config: ClientConfig) {
    this.http = new HttpClient(config)
  }

  // ============ Fluent API (Recommended) ============

  /**
   * Start a fluent query builder for a collection
   *
   * @example
   * // Query documents
   * const posts = await client.from('posts').published().limit(10).fetch()
   *
   * // Get single document
   * const post = await client.from('posts').id('post-123').fetchOne()
   *
   * // Create document
   * const newPost = await client.from('posts').create({ title: 'Hello' })
   *
   * // Update document (full replace)
   * await client.from('posts').id('post-123').update({ title: 'New', content: '...' })
   *
   * // Patch document (partial update)
   * await client.from('posts').id('post-123').patch({ status: 'published' })
   *
   * // Delete document
   * await client.from('posts').id('post-123').delete()
   */
  from<T extends BaseDocument = BaseDocument>(collection: string): QueryBuilder<T> {
    return new QueryBuilder<T>(this.http, collection)
  }

  // ============ Authentication ============

  /**
   * Authenticate with username and password
   */
  async authenticate(credentials: { username: string; password: string }): Promise<AuthTokens> {
    return this.http.authenticate(credentials)
  }

  /**
   * Set API token for authentication
   */
  setApiToken(token: string): void {
    this.http.setApiToken(token)
  }

  // ============ Schema/Collections ============

  /**
   * Get all collections with their schemas
   */
  async getCollections(): Promise<any[]> {
    const result: any = await this.http.get('/collections')
    return result.collections || []
  }

  // ============ Deprecated Methods ============
  // These methods are deprecated and will be removed in a future major version.
  // Use the fluent API via client.from() instead.

  /**
   * @deprecated Use `client.from(type).id(id).fetchOne()` instead.
   * Will be removed in the next major version.
   *
   * @example
   * // Before (deprecated)
   * const post = await client.getDocument('posts', 'post-123')
   *
   * // After (recommended)
   * const post = await client.from('posts').id('post-123').fetchOne()
   */
  async getDocument<T extends BaseDocument>(
    type: string,
    id: string,
    options?: { expand?: string | string[] }
  ): Promise<DocumentResult<T>> {
    const params = new URLSearchParams()
    if (options?.expand) {
      const expandValue = Array.isArray(options.expand) ? options.expand.join(',') : options.expand
      params.set('expand', expandValue)
    }
    const query = params.toString()
    return this.http.get<DocumentResult<T>>(`/collections/${type}/${id}${query ? `?${query}` : ''}`)
  }

  /**
   * @deprecated Use `client.from(type).filter(...).limit(...).fetch()` instead.
   * Will be removed in the next major version.
   *
   * @example
   * // Before (deprecated)
   * const { documents } = await client.queryDocuments('posts', {
   *   filter: { status: 'published' },
   *   limit: 10
   * })
   *
   * // After (recommended)
   * const posts = await client.from('posts')
   *   .filter({ status: 'published' })
   *   .limit(10)
   *   .fetch()
   */
  async queryDocuments<T extends BaseDocument>(
    type: string,
    options: QueryOptions = {}
  ): Promise<CollectionResult<T>> {
    const params = new URLSearchParams()
    if (options.limit) params.set('limit', options.limit.toString())
    if (options.offset) params.set('offset', options.offset.toString())
    if (options.filter) params.set('filter', JSON.stringify(options.filter))
    if (options.sort) params.set('sort', JSON.stringify(options.sort))

    const query = params.toString()
    const result = await this.http.get<any>(
      `/collections/${type}${query ? `?${query}` : ''}`
    )

    return {
      documents: result.documents || [],
      pagination: result.pagination || { page: 1, limit: 0, total: 0, pages: 1 },
      meta: result.meta || { total: 0 },
    } as CollectionResult<T>
  }

  /**
   * @deprecated Use `client.from(type).create(data)` instead.
   * Will be removed in the next major version.
   *
   * @example
   * // Before (deprecated)
   * const post = await client.createDocument('posts', { title: 'Hello' })
   *
   * // After (recommended)
   * const post = await client.from('posts').create({ title: 'Hello' })
   */
  async createDocument<T extends BaseDocument>(type: string, data: Omit<T, '_id' | '_type' | '_createdAt' | '_updatedAt'>): Promise<DocumentResult<T>> {
    return this.http.post<DocumentResult<T>>(`/collections/${type}`, { data })
  }

  /**
   * @deprecated Use `client.from(type).id(id).update(data)` instead.
   * Will be removed in the next major version.
   *
   * @example
   * // Before (deprecated)
   * const post = await client.updateDocument('posts', 'post-123', { title: 'New' })
   *
   * // After (recommended)
   * const post = await client.from('posts').id('post-123').update({ title: 'New' })
   */
  async updateDocument<T extends BaseDocument>(type: string, id: string, data: Partial<T>): Promise<DocumentResult<T>> {
    return this.http.put<DocumentResult<T>>(`/collections/${type}/${id}`, { data })
  }

  /**
   * @deprecated Use `client.from(type).id(id).delete()` instead.
   * Will be removed in the next major version.
   *
   * @example
   * // Before (deprecated)
   * await client.deleteDocument('posts', 'post-123')
   *
   * // After (recommended)
   * await client.from('posts').id('post-123').delete()
   */
  async deleteDocument(type: string, id: string): Promise<void> {
    return this.http.delete(`/collections/${type}/${id}`)
  }

  // Media
  async uploadFile(file: File | Buffer, filename?: string): Promise<any> {
    // Construct URL using the baseUrl from HttpClient config
    // This ensures consistency with other API calls
    const baseUrl = (this.http as any).config.baseUrl
    const url = `${baseUrl}/media/upload`
    const headers: Record<string, string> = {}

    if ((this.http as any).tokens?.accessToken) {
      headers.Authorization = `Bearer ${(this.http as any).tokens.accessToken}`
    } else if ((this.http as any).config.apiToken) {
      headers.Authorization = `Bearer ${(this.http as any).config.apiToken}`
    }

    const formData = new FormData()
    if (file instanceof File) {
      formData.append('files', file)
    } else {
      // Detect MIME type from filename extension
      const getMimeType = (filename: string): string => {
        const ext = filename.toLowerCase().split('.').pop()
        const mimeTypes: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
          'pdf': 'application/pdf',
          'mp4': 'video/mp4',
          'webm': 'video/webm',
          'mp3': 'audio/mpeg',
          'wav': 'audio/wav'
        }
        return mimeTypes[ext || ''] || 'application/octet-stream'
      }

      const mimeType = filename ? getMimeType(filename) : 'application/octet-stream'
      const blob = new Blob([file], { type: mimeType })
      formData.append('files', blob, filename || 'file')
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData
    })

    if (!response.ok && response.status !== 201) {
      const errorText = await response.text()
      throw new Error(`Upload failed: ${response.statusText} - ${errorText}`)
    }

    const result: any = await response.json()
    return result.success && result.data ? result.data : result
  }

  async getMedia(id: string): Promise<any> {
    return this.http.get(`/media/${id}`)
  }

  async listMedia(): Promise<any[]> {
    const result: any = await this.http.get('/media')
    // HttpClient already extracts .data from successful responses
    return Array.isArray(result) ? result : []
  }

  async downloadMedia(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.statusText}`)
    }
    return response.arrayBuffer()
  }

  async deleteMedia(id: string): Promise<void> {
    return this.http.delete(`/media/${id}`)
  }

  // Configuration
  async getStudioConfig(): Promise<any> {
    return this.http.get('/config/studio')
  }

  // Utility
  getBaseUrl(): string {
    return (this.http as any).config?.baseUrl || ''
  }
}
