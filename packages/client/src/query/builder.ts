/**
 * Fluent Query Builder
 * Provides a chainable API for building document queries with reference expansion
 */

import type { HttpClient } from '../http/client.js'
import type { CacheManager } from '../cache/manager.js'
import type { BaseDocument, CollectionResult, QueryOptions } from '../types/index.js'

export interface QueryBuilderOptions {
  /** Use cache for this query */
  useCache?: boolean
  /** Disable cache busting timestamp */
  noTimestamp?: boolean
}

export interface ExpandConfig {
  /** Field name to expand */
  field: string
  /** Whether it's an array of references */
  isArray?: boolean
  /** Nested expansions */
  expand?: string[]
}

/**
 * Fluent query builder for Trokky documents
 *
 * @example
 * ```typescript
 * const articles = await client
 *   .from('article')
 *   .published()
 *   .expand('category')
 *   .expand('author')
 *   .sort({ _createdAt: 'desc' })
 *   .limit(10)
 *   .fetch()
 * ```
 */
export class QueryBuilder<T extends BaseDocument = BaseDocument> {
  private _type: string
  private _filter: Record<string, any> = {}
  private _sort: Record<string, 'asc' | 'desc' | 1 | -1> = {}
  private _limit?: number
  private _offset?: number
  private _select?: string[]
  private _expand: ExpandConfig[] = []
  private _options: QueryBuilderOptions = { useCache: true }

  constructor(
    private http: HttpClient,
    private cache: CacheManager,
    type: string
  ) {
    this._type = type
  }

  /**
   * Filter by published status (_status === 'published')
   */
  published(): this {
    this._filter._status = 'published'
    return this
  }

  /**
   * Filter by draft status (_status === 'draft')
   */
  draft(): this {
    this._filter._status = 'draft'
    return this
  }

  /**
   * Add filter conditions
   * @param conditions Filter object or field name
   * @param value Value if first param is field name
   */
  where(conditions: Record<string, any>): this
  where(field: string, value: any): this
  where(conditionsOrField: Record<string, any> | string, value?: any): this {
    if (typeof conditionsOrField === 'string') {
      this._filter[conditionsOrField] = value
    } else {
      this._filter = { ...this._filter, ...conditionsOrField }
    }
    return this
  }

  /**
   * Add equality filter
   */
  eq(field: string, value: any): this {
    this._filter[field] = value
    return this
  }

  /**
   * Add not-equal filter
   */
  neq(field: string, value: any): this {
    this._filter[field] = { $ne: value }
    return this
  }

  /**
   * Add greater-than filter
   */
  gt(field: string, value: any): this {
    this._filter[field] = { $gt: value }
    return this
  }

  /**
   * Add greater-than-or-equal filter
   */
  gte(field: string, value: any): this {
    this._filter[field] = { $gte: value }
    return this
  }

  /**
   * Add less-than filter
   */
  lt(field: string, value: any): this {
    this._filter[field] = { $lt: value }
    return this
  }

  /**
   * Add less-than-or-equal filter
   */
  lte(field: string, value: any): this {
    this._filter[field] = { $lte: value }
    return this
  }

  /**
   * Add in-array filter
   */
  in(field: string, values: any[]): this {
    this._filter[field] = { $in: values }
    return this
  }

  /**
   * Add not-in-array filter
   */
  notIn(field: string, values: any[]): this {
    this._filter[field] = { $nin: values }
    return this
  }

  /**
   * Add text search filter
   */
  search(term: string, fields?: string[]): this {
    this._filter.$text = { $search: term }
    if (fields) {
      this._filter.$text.$searchFields = fields
    }
    return this
  }

  /**
   * Expand a reference field (resolve the reference to full document)
   * @param field Field name to expand. Use 'field[]' syntax for array references
   */
  expand(field: string): this {
    const isArray = field.endsWith('[]')
    const cleanField = isArray ? field.slice(0, -2) : field

    this._expand.push({
      field: cleanField,
      isArray
    })
    return this
  }

  /**
   * Set sort order
   * @param sortConfig Sort configuration object
   */
  sort(sortConfig: Record<string, 'asc' | 'desc' | 1 | -1>): this {
    this._sort = { ...this._sort, ...sortConfig }
    return this
  }

  /**
   * Sort by field ascending
   */
  sortAsc(field: string): this {
    this._sort[field] = 'asc'
    return this
  }

  /**
   * Sort by field descending
   */
  sortDesc(field: string): this {
    this._sort[field] = 'desc'
    return this
  }

  /**
   * Sort by creation date (newest first)
   */
  newest(): this {
    this._sort._createdAt = 'desc'
    return this
  }

  /**
   * Sort by creation date (oldest first)
   */
  oldest(): this {
    this._sort._createdAt = 'asc'
    return this
  }

  /**
   * Limit number of results
   */
  limit(count: number): this {
    this._limit = count
    return this
  }

  /**
   * Skip first N results
   */
  offset(count: number): this {
    this._offset = count
    return this
  }

  /**
   * Skip first N results (alias for offset)
   */
  skip(count: number): this {
    return this.offset(count)
  }

  /**
   * Select specific fields only
   */
  select(...fields: string[]): this {
    this._select = fields
    return this
  }

  /**
   * Disable caching for this query
   */
  noCache(): this {
    this._options.useCache = false
    return this
  }

  /**
   * Add cache-busting timestamp to prevent stale data
   */
  fresh(): this {
    this._options.noTimestamp = false
    this._options.useCache = false
    return this
  }

  /**
   * Execute the query and return results
   */
  async fetch(): Promise<T[]> {
    const result = await this.fetchWithMeta()
    return result.documents
  }

  /**
   * Execute the query and return results with metadata
   */
  async fetchWithMeta(): Promise<{ documents: T[]; total?: number; offset?: number; limit?: number; hasMore?: boolean }> {
    // Build query options
    const options: QueryOptions = {}

    if (Object.keys(this._filter).length > 0) {
      options.filter = this._filter
    }

    if (Object.keys(this._sort).length > 0) {
      options.sort = this._sort
    }

    if (this._limit !== undefined) {
      options.limit = this._limit
    }

    if (this._offset !== undefined) {
      options.offset = this._offset
    }

    if (this._select) {
      options.select = this._select
    }

    // Build cache key
    const cacheKey = this.cache.generateKey(`collections/${this._type}`, {
      ...options,
      expand: this._expand.map(e => e.field)
    })

    // Check cache
    if (this._options.useCache) {
      const cached = this.cache.get<CollectionResult<T>>(cacheKey)
      if (cached) {
        return {
          ...cached,
          documents: (cached as any).data || []
        }
      }
    }

    // Build query params
    const queryParams = new URLSearchParams()

    if (options.filter) {
      queryParams.set('filter', JSON.stringify(options.filter))
    }

    if (options.sort && Object.keys(options.sort).length > 0) {
      Object.entries(options.sort).forEach(([field, direction]) => {
        const dir = direction === -1 || direction === 'desc' ? 'desc' : 'asc'
        queryParams.append('sort', `${field}.${dir}`)
      })
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

    // Add server-side expansion if configured
    if (this._expand.length > 0) {
      const expandFields = this._expand.map(e => e.isArray ? `${e.field}[]` : e.field)
      queryParams.set('expand', expandFields.join(','))
    }

    // Add timestamp for fresh queries
    if (!this._options.noTimestamp && !this._options.useCache) {
      queryParams.set('_t', Date.now().toString())
    }

    // Execute query
    const endpoint = `/collections/${this._type}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    const result = await this.http.get<CollectionResult<T>>(endpoint)

    // Extract documents from result
    let documents: T[] = (result as any).data || []

    // Note: References are now expanded server-side via the expand query param
    // Client-side expansion is kept as fallback for older API versions
    if (this._expand.length > 0 && documents.length > 0 && !this.hasExpandedReferences(documents)) {
      documents = await this.expandReferences(documents)
    }

    // Cache result
    if (this._options.useCache) {
      this.cache.set(cacheKey, result)
    }

    return {
      ...result,
      documents
    }
  }

  /**
   * Get first result or null
   */
  async first(): Promise<T | null> {
    this._limit = 1
    const results = await this.fetch()
    return results[0] || null
  }

  /**
   * Get count of matching documents
   */
  async count(): Promise<number> {
    const queryParams = new URLSearchParams()

    if (Object.keys(this._filter).length > 0) {
      queryParams.set('filter', JSON.stringify(this._filter))
    }

    const endpoint = `/collections/${this._type}/count${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    const result = await this.http.get<{ count: number }>(endpoint)

    return result.count
  }

  /**
   * Check if any documents match the query
   */
  async exists(): Promise<boolean> {
    const count = await this.count()
    return count > 0
  }

  /**
   * Check if references have already been expanded by the server
   */
  private hasExpandedReferences(documents: T[]): boolean {
    if (documents.length === 0) return false
    const doc = documents[0]

    for (const expandConfig of this._expand) {
      const fieldValue = (doc as any)[expandConfig.field]
      if (fieldValue) {
        // If it's an array, check first item
        if (expandConfig.isArray && Array.isArray(fieldValue) && fieldValue.length > 0) {
          const firstItem = fieldValue[0]
          // If it has _id, it's been expanded (not just a reference with _ref)
          if (firstItem && typeof firstItem === 'object' && '_id' in firstItem) {
            return true
          }
        } else if (typeof fieldValue === 'object' && '_id' in fieldValue && !('_ref' in fieldValue)) {
          // Single reference that's been expanded (has _id but no _ref)
          return true
        }
      }
    }
    return false
  }

  /**
   * Expand references in documents
   */
  private async expandReferences(documents: any[]): Promise<T[]> {
    // Collect all references to fetch
    const referencesToFetch: Map<string, Set<string>> = new Map()

    for (const doc of documents) {
      for (const expandConfig of this._expand) {
        const fieldValue = (doc as any)[expandConfig.field]

        if (!fieldValue) continue

        if (expandConfig.isArray && Array.isArray(fieldValue)) {
          // Array of references
          for (const ref of fieldValue) {
            if (this.isReference(ref)) {
              const type = ref._type || this.inferTypeFromRef(ref._ref)
              if (!referencesToFetch.has(type)) {
                referencesToFetch.set(type, new Set())
              }
              referencesToFetch.get(type)!.add(ref._ref)
            }
          }
        } else if (this.isReference(fieldValue)) {
          // Single reference
          const type = fieldValue._type || this.inferTypeFromRef(fieldValue._ref)
          if (!referencesToFetch.has(type)) {
            referencesToFetch.set(type, new Set())
          }
          referencesToFetch.get(type)!.add(fieldValue._ref)
        }
      }
    }

    // Fetch all referenced documents in parallel
    const resolvedRefs: Map<string, any> = new Map()

    const fetchPromises: Promise<void>[] = []

    for (const [type, ids] of referencesToFetch) {
      for (const id of ids) {
        const promise = this.fetchReference(type, id)
          .then(doc => {
            if (doc) {
              resolvedRefs.set(`${type}:${id}`, doc)
            }
          })
          .catch(err => {
            console.warn(`Failed to resolve reference ${type}/${id}:`, err)
          })
        fetchPromises.push(promise)
      }
    }

    await Promise.all(fetchPromises)

    // Replace references with resolved documents
    return documents.map(doc => {
      const expanded = { ...doc } as any

      for (const expandConfig of this._expand) {
        const fieldValue = expanded[expandConfig.field]

        if (!fieldValue) continue

        if (expandConfig.isArray && Array.isArray(fieldValue)) {
          expanded[expandConfig.field] = fieldValue.map((ref: any) => {
            if (this.isReference(ref)) {
              const type = ref._type || this.inferTypeFromRef(ref._ref)
              const resolved = resolvedRefs.get(`${type}:${ref._ref}`)
              return resolved || ref
            }
            return ref
          })
        } else if (this.isReference(fieldValue)) {
          const type = fieldValue._type || this.inferTypeFromRef(fieldValue._ref)
          const resolved = resolvedRefs.get(`${type}:${fieldValue._ref}`)
          if (resolved) {
            expanded[expandConfig.field] = resolved
          }
        }
      }

      return expanded as T
    })
  }

  /**
   * Check if a value is a reference object
   */
  private isReference(value: any): value is { _ref: string; _type?: string } {
    return value && typeof value === 'object' && '_ref' in value
  }

  /**
   * Infer type from reference ID (e.g., 'category-abc123' -> 'category')
   */
  private inferTypeFromRef(ref: string): string {
    // Try to extract type from ref format like 'category-abc123'
    const match = ref.match(/^([a-z-]+)-/)
    return match ? match[1] : 'document'
  }

  /**
   * Fetch a single referenced document
   */
  private async fetchReference(type: string, id: string): Promise<any> {
    try {
      const result = await this.http.get<any>(`/collections/${type}/${id}`)
      return result
    } catch (error) {
      // Try without type prefix in ID
      if (id.startsWith(`${type}-`)) {
        const cleanId = id.replace(`${type}-`, '')
        try {
          return await this.http.get<any>(`/collections/${type}/${cleanId}`)
        } catch {
          return null
        }
      }
      return null
    }
  }
}

/**
 * Singleton query builder for fetching a single document by type
 */
export class SingletonBuilder<T extends BaseDocument = BaseDocument> {
  private _expand: ExpandConfig[] = []
  private _options: QueryBuilderOptions = { useCache: false }

  constructor(
    private http: HttpClient,
    private cache: CacheManager,
    private _type: string,
    private _id?: string
  ) {}

  /**
   * Expand a reference field
   */
  expand(field: string): this {
    const isArray = field.endsWith('[]')
    const cleanField = isArray ? field.slice(0, -2) : field

    this._expand.push({
      field: cleanField,
      isArray
    })
    return this
  }

  /**
   * Disable caching
   */
  noCache(): this {
    this._options.useCache = false
    return this
  }

  /**
   * Fetch fresh data with cache busting
   */
  fresh(): this {
    this._options.useCache = false
    return this
  }

  /**
   * Execute and return the singleton document
   */
  async fetch(): Promise<T | null> {
    const queryParams = new URLSearchParams()

    if (!this._options.useCache) {
      queryParams.set('_t', Date.now().toString())
    }

    // Add server-side expansion if configured
    if (this._expand.length > 0) {
      const expandFields = this._expand.map(e => e.isArray ? `${e.field}[]` : e.field)
      queryParams.set('expand', expandFields.join(','))
    }

    // For singletons, try specific ID first, then fall back to collection query
    let endpoint: string

    if (this._id) {
      endpoint = `/collections/${this._type}/${this._id}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    } else {
      // Query the collection and get first result
      queryParams.set('limit', '1')
      endpoint = `/collections/${this._type}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    }

    try {
      const result = await this.http.get<any>(endpoint)

      // Handle collection response vs single document
      let doc: T | null = null

      if (result.data && Array.isArray(result.data)) {
        doc = result.data[0] || null
      } else if (result.data) {
        doc = result.data
      } else if (result._id) {
        doc = result as T
      }

      // Check if published (for singleton pages)
      if (doc && (doc as any)._status && (doc as any)._status !== 'published') {
        return null
      }

      // Note: References are now expanded server-side via the expand query param
      // Client-side expansion is kept as fallback for older API versions
      if (doc && this._expand.length > 0 && !this.hasExpandedReferences(doc)) {
        doc = await this.expandReferences(doc)
      }

      return doc
    } catch (error) {
      console.warn(`Failed to fetch singleton ${this._type}:`, error)
      return null
    }
  }

  /**
   * Check if references have already been expanded by the server
   */
  private hasExpandedReferences(doc: T): boolean {
    for (const expandConfig of this._expand) {
      const fieldValue = (doc as any)[expandConfig.field]
      if (fieldValue) {
        // If it's an array, check first item
        if (expandConfig.isArray && Array.isArray(fieldValue) && fieldValue.length > 0) {
          const firstItem = fieldValue[0]
          // If it has _id, it's been expanded (not just a reference with _ref)
          if (firstItem && typeof firstItem === 'object' && '_id' in firstItem) {
            return true
          }
        } else if (typeof fieldValue === 'object' && '_id' in fieldValue && !('_ref' in fieldValue)) {
          // Single reference that's been expanded (has _id but no _ref)
          return true
        }
      }
    }
    return false
  }

  /**
   * Expand references in a single document
   */
  private async expandReferences(doc: T): Promise<T> {
    const expanded = { ...doc } as any

    for (const expandConfig of this._expand) {
      const fieldValue = expanded[expandConfig.field]

      if (!fieldValue) continue

      if (expandConfig.isArray && Array.isArray(fieldValue)) {
        const expandedArray = await Promise.all(
          fieldValue.map(async (ref: any) => {
            if (this.isReference(ref)) {
              const type = ref._type || this.inferTypeFromRef(ref._ref)
              return await this.fetchReference(type, ref._ref) || ref
            }
            return ref
          })
        )
        expanded[expandConfig.field] = expandedArray
      } else if (this.isReference(fieldValue)) {
        const type = fieldValue._type || this.inferTypeFromRef(fieldValue._ref)
        const resolved = await this.fetchReference(type, fieldValue._ref)
        if (resolved) {
          expanded[expandConfig.field] = resolved
        }
      }
    }

    return expanded as T
  }

  private isReference(value: any): value is { _ref: string; _type?: string } {
    return value && typeof value === 'object' && '_ref' in value
  }

  private inferTypeFromRef(ref: string): string {
    const match = ref.match(/^([a-z-]+)-/)
    return match ? match[1] : 'document'
  }

  private async fetchReference(type: string, id: string): Promise<any> {
    try {
      const result = await this.http.get<any>(`/collections/${type}/${id}`)
      return result
    } catch {
      return null
    }
  }
}
