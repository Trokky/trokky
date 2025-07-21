/**
 * Query Builder
 * Builds and optimizes MongoDB-style queries for structure filtering
 */

import type {
  QueryFilter,
  ResolvedQuery,
  QueryContext,
  QueryComplexity,
  DocumentListItem,
  OrderClause
} from '../types'
import { QueryError, ErrorCodes, ErrorRecovery } from '../errors'
import { CacheKeyUtils } from './hash'

export interface QueryBuilderOptions {
  /** Enable query optimization */
  optimize?: boolean
  
  /** Enable query caching */
  cache?: boolean
  
  /** Cache TTL in milliseconds */
  cacheTTL?: number
  
  /** Maximum query complexity allowed */
  maxComplexity?: number
  
  /** Enable query logging */
  enableLogging?: boolean
}

export class QueryBuilder {
  private cache = new Map<string, ResolvedQuery>()
  private complexityWeights = {
    // Logical operators
    $and: 1,
    $or: 2,
    $not: 3,
    $nor: 4,
    
    // Comparison operators
    $eq: 1,
    $ne: 1,
    $gt: 1,
    $gte: 1,
    $lt: 1,
    $lte: 1,
    $in: 2,
    $nin: 2,
    
    // String operators
    $regex: 5,
    $contains: 3,
    $startsWith: 2,
    $endsWith: 2,
    
    // Array operators
    $size: 2,
    $all: 3,
    $elemMatch: 4,
    
    // Field operators
    $exists: 1
  }

  constructor(private options: QueryBuilderOptions = {}) {
    this.options = {
      optimize: true,
      cache: true,
      cacheTTL: 300000, // 5 minutes
      maxComplexity: 1000,
      enableLogging: false,
      ...options
    }
  }

  /**
   * Build query from structure item
   */
  async buildQuery(
    item: DocumentListItem,
    context?: QueryContext
  ): Promise<ResolvedQuery> {
    const cacheKey = this.generateCacheKey(item, context)
    
    // Check cache first
    if (this.options.cache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!
      if (this.options.enableLogging) {
        console.log('Query cache hit:', cacheKey)
      }
      return cached
    }

    let query: ResolvedQuery = {
      schemaType: item.schemaType,
      options: {
        filter: item.filter || {},
        sort: this.convertOrderingToSort(item.defaultOrdering || []),
        limit: item.options?.pageSize || 50,
        offset: context?.pagination?.offset || 0
      },
      metadata: {
        complexity: this.calculateComplexity(item.filter || {}),
        optimized: false,
        cached: false
      }
    }

    // Apply context filters
    if (context?.filters) {
      query.options.filter = this.mergeFilters(query.options.filter || {}, context.filters)
    }

    // Apply context ordering
    if (context?.ordering) {
      const contextSort = this.convertOrderingToSort(context.ordering)
      query.options.sort = { ...query.options.sort, ...contextSort }
    }

    // Apply context pagination
    if (context?.pagination) {
      query.options = { 
        ...query.options, 
        limit: context.pagination.limit ?? query.options.limit,
        offset: context.pagination.offset ?? query.options.offset
      }
    }

    // Optimize query if enabled
    if (this.options.optimize) {
      query = this.optimizeQuery(query)
    }

    // Validate complexity
    const complexity = this.calculateComplexity(query.options.filter || {})
    if (complexity.score > (this.options.maxComplexity || 1000)) {
      throw new QueryError(
        `Query complexity (${complexity.score}) exceeds maximum allowed (${this.options.maxComplexity})`,
        {
          complexity: complexity.score,
          maxAllowed: this.options.maxComplexity,
          recommendations: complexity.recommendations
        }
      )
    }

    query.metadata = {
      complexity,
      optimized: query.metadata?.optimized || false,
      cached: false
    }

    // Cache result
    if (this.options.cache) {
      this.cache.set(cacheKey, query)
      query.metadata.cached = true
      
      // Clear cache after TTL
      setTimeout(() => {
        this.cache.delete(cacheKey)
      }, this.options.cacheTTL)
    }

    if (this.options.enableLogging) {
      console.log('Built query:', { item: item.schemaType, query, complexity })
    }

    return query
  }

  /**
   * Calculate query complexity
   */
  calculateComplexity(filter: QueryFilter): QueryComplexity {
    let score = 0
    const recommendations: string[] = []
    const operatorCounts: Record<string, number> = {}

    const analyze = (obj: any, depth = 0): void => {
      if (depth > 5) {
        score += 50
        recommendations.push('Reduce query nesting depth')
        return
      }

      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith('$')) {
          // Operator
          const weight = this.complexityWeights[key as keyof typeof this.complexityWeights] || 1
          score += weight * (depth + 1)
          operatorCounts[key] = (operatorCounts[key] || 0) + 1
          
          if (Array.isArray(value)) {
            score += value.length * 0.5
            value.forEach(item => {
              if (typeof item === 'object') {
                analyze(item, depth + 1)
              }
            })
          } else if (typeof value === 'object' && value !== null) {
            analyze(value, depth + 1)
          }
        } else {
          // Field
          if (typeof value === 'object' && value !== null) {
            analyze(value, depth + 1)
          } else {
            score += 1
          }
        }
      }
    }

    analyze(filter)

    // Generate recommendations
    if (operatorCounts.$regex > 2) {
      recommendations.push('Consider using text search instead of multiple regex operations')
    }
    
    if (operatorCounts.$or > 3) {
      recommendations.push('Consider restructuring OR conditions or using indexes')
    }
    
    if (operatorCounts.$elemMatch > 1) {
      recommendations.push('Multiple elemMatch operations may be slow on large arrays')
    }

    if (score > 500) {
      recommendations.push('Consider adding database indexes for better performance')
    }

    if (score > 200) {
      recommendations.push('Consider breaking down complex queries into simpler ones')
    }

    return {
      score,
      breakdown: {
        operators: Object.keys(operatorCounts).length,
        nesting: Math.max(0, score / 10), // Rough estimate
        fields: Object.keys(filter).length,
        arrayOps: (operatorCounts.$in || 0) + (operatorCounts.$nin || 0) + (operatorCounts.$all || 0)
      },
      recommendations,
      operatorCounts,
      estimatedCost: this.estimateQueryCost(score)
    }
  }

  /**
   * Optimize query for better performance
   */
  optimizeQuery(query: ResolvedQuery): ResolvedQuery {
    const optimized = { ...query }
    
    // Optimize filter
    if (optimized.options.filter) {
      optimized.options.filter = this.optimizeFilter(optimized.options.filter)
    }
    
    // Mark as optimized
    if (optimized.metadata) {
      optimized.metadata = {
        ...optimized.metadata,
        optimized: true
      }
    }

    return optimized
  }

  /**
   * Convert ordering array to sort object
   */
  private convertOrderingToSort(ordering: OrderClause[]): Record<string, 1 | -1> {
    const sort: Record<string, 1 | -1> = {}
    for (const clause of ordering) {
      sort[clause.field] = clause.direction === 'asc' ? 1 : -1
    }
    return sort
  }

  /**
   * Optimize filter object
   */
  optimizeFilter(filter: QueryFilter): QueryFilter {
    if (!filter || typeof filter !== 'object') {
      return filter
    }

    const optimized = { ...filter }

    // Optimize $and conditions
    if (optimized.$and && Array.isArray(optimized.$and)) {
      optimized.$and = this.optimizeAndConditions(optimized.$and)
      
      // Flatten single $and condition
      if (optimized.$and.length === 1) {
        const singleCondition = optimized.$and[0]
        delete optimized.$and
        Object.assign(optimized, singleCondition)
      }
    }

    // Optimize $or conditions
    if (optimized.$or && Array.isArray(optimized.$or)) {
      optimized.$or = this.optimizeOrConditions(optimized.$or)
    }

    // Convert $in with single value to $eq
    const optimizedEntries = Object.entries(optimized)
    for (const [key, value] of optimizedEntries) {
      if (typeof value === 'object' && value !== null && value.$in) {
        if (Array.isArray(value.$in) && value.$in.length === 1) {
          // Create new object without mutating during iteration
          const newValue = { ...value, $eq: value.$in[0] }
          delete newValue.$in
          optimized[key] = newValue
        }
      }
    }

    // Recursively optimize nested conditions
    const recursiveEntries = Object.entries(optimized)
    for (const [key, value] of recursiveEntries) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        optimized[key] = this.optimizeFilter(value)
      }
    }

    // Remove empty objects and null values
    const cleanedOptimized: QueryFilter = {}
    for (const [key, value] of Object.entries(optimized)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          // Only include non-empty objects
          if (Object.keys(value).length > 0) {
            cleanedOptimized[key] = value
          }
        } else {
          cleanedOptimized[key] = value
        }
      }
    }

    return cleanedOptimized
  }


  /**
   * Merge multiple filters
   */
  private mergeFilters(base: QueryFilter, additional: QueryFilter): QueryFilter {
    if (!base || Object.keys(base).length === 0) {
      return additional
    }
    
    if (!additional || Object.keys(additional).length === 0) {
      return base
    }

    // If both have conditions, wrap in $and
    const hasBaseConditions = Object.keys(base).some(key => !key.startsWith('$'))
    const hasAdditionalConditions = Object.keys(additional).some(key => !key.startsWith('$'))

    if (hasBaseConditions && hasAdditionalConditions) {
      return {
        $and: [base, additional]
      }
    }

    // Merge carefully
    const merged = { ...base }
    
    for (const [key, value] of Object.entries(additional)) {
      if (key === '$and') {
        if (merged.$and) {
          merged.$and = [...merged.$and, ...value]
        } else {
          merged.$and = value
        }
      } else if (key === '$or') {
        if (merged.$or) {
          merged.$or = [...merged.$or, ...value]
        } else {
          merged.$or = value
        }
      } else {
        merged[key] = value
      }
    }

    return merged
  }

  /**
   * Optimize $and conditions
   */
  private optimizeAndConditions(conditions: QueryFilter[]): QueryFilter[] {
    // Remove empty conditions
    const filtered = conditions.filter(cond => 
      cond && typeof cond === 'object' && Object.keys(cond).length > 0
    )

    // Merge conditions with same field
    const fieldConditions: Record<string, any[]> = {}
    const otherConditions: QueryFilter[] = []

    for (const condition of filtered) {
      const fields = Object.keys(condition).filter(key => !key.startsWith('$'))
      
      if (fields.length === 1) {
        const field = fields[0]
        if (!fieldConditions[field]) {
          fieldConditions[field] = []
        }
        fieldConditions[field].push(condition[field])
      } else {
        otherConditions.push(condition)
      }
    }

    // Merge field conditions
    const merged: QueryFilter[] = []
    for (const [field, values] of Object.entries(fieldConditions)) {
      if (values.length === 1) {
        merged.push({ [field]: values[0] })
      } else {
        // Merge multiple conditions for same field
        const mergedCondition: any = {}
        for (const value of values) {
          if (typeof value === 'object' && value !== null) {
            Object.assign(mergedCondition, value)
          } else {
            mergedCondition.$eq = value
          }
        }
        merged.push({ [field]: mergedCondition })
      }
    }

    return [...merged, ...otherConditions]
  }

  /**
   * Optimize $or conditions
   */
  private optimizeOrConditions(conditions: QueryFilter[]): QueryFilter[] {
    // Remove empty conditions
    const filtered = conditions.filter(cond => 
      cond && typeof cond === 'object' && Object.keys(cond).length > 0
    )

    // Remove duplicate conditions
    const seen = new Set<string>()
    return filtered.filter(condition => {
      const key = JSON.stringify(condition)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  /**
   * Estimate query cost
   */
  private estimateQueryCost(complexity: number): 'low' | 'medium' | 'high' | 'very-high' {
    if (complexity < 50) return 'low'
    if (complexity < 200) return 'medium'
    if (complexity < 500) return 'high'
    return 'very-high'
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(item: DocumentListItem, context?: QueryContext): string {
    const contextData = context ? {
      filters: context.filters,
      ordering: context.ordering,
      pagination: context.pagination
    } : undefined

    return CacheKeyUtils.queryKey(
      item.schemaType,
      {
        filter: item.filter,
        ordering: item.defaultOrdering,
        options: item.options
      },
      contextData
    )
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  /**
   * Validate filter structure
   */
  validateFilter(filter: QueryFilter): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    const validate = (obj: any, path = ''): void => {
      if (!obj || typeof obj !== 'object') {
        return
      }

      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key

        if (key.startsWith('$')) {
          // Validate operator
          if (!(key in this.complexityWeights)) {
            errors.push(`Unknown operator: ${key} at ${currentPath}`)
          }

          // Validate operator value
          if (key === '$and' || key === '$or' || key === '$nor') {
            if (!Array.isArray(value)) {
              errors.push(`${key} must be an array at ${currentPath}`)
            } else {
              value.forEach((item, index) => {
                validate(item, `${currentPath}[${index}]`)
              })
            }
          } else if (key === '$not') {
            if (typeof value !== 'object' || value === null) {
              errors.push(`${key} must be an object at ${currentPath}`)
            } else {
              validate(value, currentPath)
            }
          } else if (key === '$in' || key === '$nin' || key === '$all') {
            if (!Array.isArray(value)) {
              errors.push(`${key} must be an array at ${currentPath}`)
            }
          } else if (key === '$regex') {
            if (typeof value !== 'string') {
              errors.push(`${key} must be a string at ${currentPath}`)
            }
          }
        } else {
          // Field name
          if (typeof value === 'object' && value !== null) {
            validate(value, currentPath)
          }
        }
      }
    }

    validate(filter)

    return {
      valid: errors.length === 0,
      errors
    }
  }
}