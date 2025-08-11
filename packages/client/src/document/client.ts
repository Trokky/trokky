/**
 * Document Client
 * High-level API for document operations
 */

import type { 
  QueryOptions, 
  DocumentResult, 
  CollectionResult,
  BaseDocument 
} from '../types'
import type { HttpClient } from '../http/client'
import type { CacheManager } from '../cache/manager'

export class DocumentClient {
  constructor(
    private http: HttpClient,
    private cache: CacheManager
  ) {}

  /**
   * Get document by ID
   */
  async getById<T extends BaseDocument>(
    type: string, 
    id: string, 
    useCache = true
  ): Promise<DocumentResult<T>> {
    const cacheKey = this.cache.generateKey(`documents/${type}/${id}`)
    
    if (useCache) {
      const cached = this.cache.get<DocumentResult<T>>(cacheKey)
      if (cached) return cached
    }

    const result = await this.http.get<DocumentResult<T>>(`/documents/${type}/${id}`)
    
    if (useCache) {
      this.cache.set(cacheKey, result)
    }
    
    return result
  }

  /**
   * Query documents
   */
  async query<T extends BaseDocument>(
    type: string, 
    options: QueryOptions = {},
    useCache = true
  ): Promise<CollectionResult<T>> {
    const cacheKey = this.cache.generateKey(`documents/${type}`, options)
    
    if (useCache) {
      const cached = this.cache.get<CollectionResult<T>>(cacheKey)
      if (cached) return cached
    }

    const queryParams = new URLSearchParams()
    
    if (options.filter) {
      queryParams.set('filter', JSON.stringify(options.filter))
    }
    if (options.sort) {
      // Convert sort object to server expected format
      if (typeof options.sort === 'object') {
        Object.entries(options.sort).forEach(([field, direction]) => {
          const dir = direction === -1 || direction === 'desc' ? 'desc' : 'asc'
          queryParams.append('sort', `${field}.${dir}`)
        })
      } else {
        // If it's already a string, use as-is
        queryParams.set('sort', options.sort.toString())
      }
    }
    if (options.limit) {
      queryParams.set('limit', options.limit.toString())
    }
    if (options.offset) {
      queryParams.set('offset', options.offset.toString())
    }
    if (options.select) {
      queryParams.set('select', options.select.join(','))
    }

    const endpoint = `/documents/${type}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    const result = await this.http.get<CollectionResult<T>>(endpoint)
    
    if (useCache) {
      this.cache.set(cacheKey, result)
    }
    
    return result
  }

  /**
   * Create new document
   */
  async create<T extends BaseDocument>(
    type: string, 
    data: Omit<T, '_id' | '_type' | '_createdAt' | '_updatedAt' | '_version'>
  ): Promise<DocumentResult<T>> {
    const payload = {
      ...data,
      _type: type
    }

    const result = await this.http.post<DocumentResult<T>>(`/documents/${type}`, payload)
    
    // Invalidate type cache
    this.invalidateTypeCache(type)
    
    return result
  }

  /**
   * Update document
   */
  async update<T extends BaseDocument>(
    type: string, 
    id: string, 
    data: Partial<Omit<T, '_id' | '_type' | '_createdAt' | '_updatedAt' | '_version'>>
  ): Promise<DocumentResult<T>> {
    const result = await this.http.patch<DocumentResult<T>>(`/documents/${type}/${id}`, data)
    
    // Update cache
    const cacheKey = this.cache.generateKey(`documents/${type}/${id}`)
    this.cache.set(cacheKey, result)
    
    // Invalidate type cache
    this.invalidateTypeCache(type)
    
    return result
  }

  /**
   * Replace document
   */
  async replace<T extends BaseDocument>(
    type: string, 
    id: string, 
    data: Omit<T, '_id' | '_type' | '_createdAt' | '_updatedAt' | '_version'>
  ): Promise<DocumentResult<T>> {
    const payload = {
      ...data,
      _type: type
    }

    const result = await this.http.put<DocumentResult<T>>(`/documents/${type}/${id}`, payload)
    
    // Update cache
    const cacheKey = this.cache.generateKey(`documents/${type}/${id}`)
    this.cache.set(cacheKey, result)
    
    // Invalidate type cache
    this.invalidateTypeCache(type)
    
    return result
  }

  /**
   * Delete document
   */
  async delete(type: string, id: string): Promise<void> {
    await this.http.delete(`/documents/${type}/${id}`)
    
    // Remove from cache
    const cacheKey = this.cache.generateKey(`documents/${type}/${id}`)
    this.cache.delete(cacheKey)
    
    // Invalidate type cache
    this.invalidateTypeCache(type)
  }

  /**
   * Get all documents of a type (paginated)
   */
  async getAll<T extends BaseDocument>(
    type: string, 
    limit = 100,
    useCache = true
  ): Promise<CollectionResult<T>> {
    return this.query<T>(type, { limit }, useCache)
  }

  /**
   * Search documents
   */
  async search<T extends BaseDocument>(
    type: string, 
    searchTerm: string,
    fields?: string[],
    options: Omit<QueryOptions, 'filter'> = {}
  ): Promise<CollectionResult<T>> {
    const filter: Record<string, any> = {
      $text: { $search: searchTerm }
    }

    if (fields && fields.length > 0) {
      filter.$text.$searchFields = fields
    }

    return this.query<T>(type, { ...options, filter }, false) // Don't cache search results
  }

  /**
   * Count documents
   */
  async count(type: string, filter?: Record<string, any>): Promise<number> {
    const queryParams = new URLSearchParams()
    if (filter) {
      queryParams.set('filter', JSON.stringify(filter))
    }

    const endpoint = `/documents/${type}/count${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    const result = await this.http.get<{ count: number }>(endpoint)
    
    return result.count
  }

  /**
   * Check if document exists
   */
  async exists(type: string, id: string): Promise<boolean> {
    try {
      await this.http.get(`/documents/${type}/${id}/exists`)
      return true
    } catch (error: any) {
      if (error.status === 404) return false
      throw error
    }
  }

  /**
   * Invalidate cache for a document type
   */
  private invalidateTypeCache(type: string): void {
    // In a more sophisticated implementation, we'd track cache keys by type
    // For now, we'll clear all cache entries that start with the type
    const keysToDelete: string[] = []
    
    // This is a simplified approach - in production you'd want better cache key management
    this.cache.clear() // For now, just clear all cache
  }
}