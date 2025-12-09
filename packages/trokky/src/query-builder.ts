/**
 * Fluent Query Builder for TrokkyClient
 *
 * Provides a chainable API for querying and mutating documents.
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
 * // Update document
 * const updated = await client.from('posts').id('post-123').update({ title: 'New' })
 *
 * // Delete document
 * await client.from('posts').id('post-123').delete()
 */

import { HttpClient } from './http.js'
import type { BaseDocument, CollectionResult, DocumentResult } from '@trokky/types'

/**
 * Filter conditions for querying documents
 */
export type FilterConditions = Record<string, unknown>

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc'

/**
 * Sort configuration
 */
export type SortConfig = Record<string, SortDirection>

/**
 * Query builder options accumulated during chain
 */
interface QueryState {
  collection: string
  documentId?: string
  filters: FilterConditions
  limitValue?: number
  offsetValue?: number
  sortConfig?: SortConfig
  expandRefs: string[]
}

/**
 * Fluent query builder for Trokky documents
 */
export class QueryBuilder<T extends BaseDocument = BaseDocument> {
  private http: HttpClient
  private state: QueryState

  constructor(http: HttpClient, collection: string) {
    this.http = http
    this.state = {
      collection,
      filters: {},
      expandRefs: []
    }
  }

  /**
   * Target a specific document by ID
   * Required for fetchOne(), update(), patch(), and delete()
   */
  id(documentId: string): this {
    this.state.documentId = documentId
    return this
  }

  /**
   * Filter by published status (_status: 'published')
   * Shorthand for .filter({ _status: 'published' })
   */
  published(): this {
    this.state.filters._status = 'published'
    return this
  }

  /**
   * Filter by draft status (_status: 'draft')
   * Shorthand for .filter({ _status: 'draft' })
   */
  draft(): this {
    this.state.filters._status = 'draft'
    return this
  }

  /**
   * Add filter conditions
   * Can be chained multiple times - conditions are merged
   *
   * @example
   * client.from('posts').filter({ category: 'news' }).filter({ featured: true })
   */
  filter(conditions: FilterConditions): this {
    this.state.filters = { ...this.state.filters, ...conditions }
    return this
  }

  /**
   * Limit the number of results
   */
  limit(n: number): this {
    this.state.limitValue = n
    return this
  }

  /**
   * Skip the first n results (pagination offset)
   */
  offset(n: number): this {
    this.state.offsetValue = n
    return this
  }

  /**
   * Sort results by field
   *
   * @example
   * client.from('posts').order('_createdAt', 'desc')
   * client.from('posts').order({ _createdAt: 'desc', title: 'asc' })
   */
  order(field: string, direction?: SortDirection): this
  order(config: SortConfig): this
  order(fieldOrConfig: string | SortConfig, direction: SortDirection = 'asc'): this {
    if (typeof fieldOrConfig === 'string') {
      this.state.sortConfig = { ...this.state.sortConfig, [fieldOrConfig]: direction }
    } else {
      this.state.sortConfig = { ...this.state.sortConfig, ...fieldOrConfig }
    }
    return this
  }

  /**
   * Expand reference fields to include full documents
   *
   * @example
   * client.from('posts').expand('author', 'category').fetch()
   */
  expand(...refs: string[]): this {
    this.state.expandRefs.push(...refs)
    return this
  }

  // ============ Query Methods (Read) ============

  /**
   * Execute query and return array of documents
   */
  async fetch(): Promise<T[]> {
    const params = this.buildQueryParams()
    const query = params.toString()
    const path = `/collections/${this.state.collection}${query ? `?${query}` : ''}`

    const result = await this.http.get<any>(path)
    return result.documents || []
  }

  /**
   * Execute query and return single document or null
   * If id() was called, fetches that specific document
   * Otherwise, returns first result from query
   */
  async fetchOne(): Promise<T | null> {
    if (this.state.documentId) {
      // Fetch specific document by ID
      const params = new URLSearchParams()
      if (this.state.expandRefs.length > 0) {
        params.set('expand', this.state.expandRefs.join(','))
      }
      const query = params.toString()
      const path = `/collections/${this.state.collection}/${this.state.documentId}${query ? `?${query}` : ''}`

      try {
        return await this.http.get<T>(path)
      } catch (error: unknown) {
        // Return null for not found
        if (error instanceof Error && error.message.includes('404')) {
          return null
        }
        throw error
      }
    }

    // Fetch first result from query
    const originalLimit = this.state.limitValue
    this.state.limitValue = 1
    const results = await this.fetch()
    this.state.limitValue = originalLimit
    return results[0] || null
  }

  /**
   * Count documents matching the query
   */
  async count(): Promise<number> {
    const params = this.buildQueryParams()
    params.set('count', 'true')
    const query = params.toString()
    const path = `/collections/${this.state.collection}${query ? `?${query}` : ''}`

    const result = await this.http.get<any>(path)
    return result.meta?.total ?? result.pagination?.total ?? 0
  }

  // ============ Mutation Methods (Write) ============

  /**
   * Create a new document in the collection
   *
   * @example
   * const post = await client.from('posts').create({ title: 'Hello World' })
   */
  async create(data: Omit<T, '_id' | '_collection' | '_createdAt' | '_updatedAt'>): Promise<T> {
    const path = `/collections/${this.state.collection}`
    return this.http.post<T>(path, { data })
  }

  /**
   * Update a document (full replace)
   * Requires id() to be called first
   *
   * @example
   * const updated = await client.from('posts').id('post-123').update({ title: 'New Title', content: '...' })
   */
  async update(data: Partial<T>): Promise<T> {
    if (!this.state.documentId) {
      throw new Error('update() requires id() to be called first')
    }
    const path = `/collections/${this.state.collection}/${this.state.documentId}`
    return this.http.put<T>(path, { data })
  }

  /**
   * Patch a document (partial update, merges with existing)
   * Requires id() to be called first
   *
   * @example
   * const patched = await client.from('posts').id('post-123').patch({ status: 'published' })
   */
  async patch(data: Partial<T>): Promise<T> {
    if (!this.state.documentId) {
      throw new Error('patch() requires id() to be called first')
    }

    // Fetch existing document and merge
    const existing = await this.fetchOne()
    if (!existing) {
      throw new Error(`Document not found: ${this.state.documentId}`)
    }

    // Deep merge the data
    const merged = this.deepMerge(existing, data as Record<string, unknown>)

    const path = `/collections/${this.state.collection}/${this.state.documentId}`
    return this.http.put<T>(path, { data: merged })
  }

  /**
   * Delete a document
   * Requires id() to be called first
   *
   * @example
   * await client.from('posts').id('post-123').delete()
   */
  async delete(): Promise<void> {
    if (!this.state.documentId) {
      throw new Error('delete() requires id() to be called first')
    }
    const path = `/collections/${this.state.collection}/${this.state.documentId}`
    await this.http.delete(path)
  }

  // ============ Private Helpers ============

  private buildQueryParams(): URLSearchParams {
    const params = new URLSearchParams()

    if (Object.keys(this.state.filters).length > 0) {
      params.set('filter', JSON.stringify(this.state.filters))
    }

    if (this.state.limitValue !== undefined) {
      params.set('limit', this.state.limitValue.toString())
    }

    if (this.state.offsetValue !== undefined) {
      params.set('offset', this.state.offsetValue.toString())
    }

    if (this.state.sortConfig) {
      params.set('sort', JSON.stringify(this.state.sortConfig))
    }

    if (this.state.expandRefs.length > 0) {
      params.set('expand', this.state.expandRefs.join(','))
    }

    return params
  }

  private deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
    const result = { ...target }

    for (const key of Object.keys(source)) {
      const sourceValue = source[key]
      const targetValue = target[key]

      if (
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        )
      } else {
        result[key] = sourceValue
      }
    }

    return result
  }
}
