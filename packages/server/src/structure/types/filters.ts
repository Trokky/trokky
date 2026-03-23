/**
 * Query and Filter Types
 * MongoDB-style query operators for content filtering
 */

/**
 * MongoDB-style query filter with advanced operators
 */
export type QueryFilter = Record<string, any> & {
  // Logical operators
  $and?: QueryFilter[]
  $or?: QueryFilter[]
  $not?: QueryFilter
  $nor?: QueryFilter[]
  
  // Field operators (applied to any field)
  [field: string]: 
    | any                          // Exact match
    | { $eq?: any }               // Equal
    | { $ne?: any }               // Not equal
    | { $gt?: any }               // Greater than
    | { $gte?: any }              // Greater than or equal
    | { $lt?: any }               // Less than
    | { $lte?: any }              // Less than or equal
    | { $in?: any[] }             // In array
    | { $nin?: any[] }            // Not in array
    | { $exists?: boolean }        // Field exists
    | { $regex?: string }          // Regular expression
    | { $contains?: any }          // Contains (for arrays/strings)
    | { $startsWith?: string }     // Starts with (strings)
    | { $endsWith?: string }       // Ends with (strings)
    | { $size?: number }           // Array size
    | { $all?: any[] }            // Array contains all
    | { $elemMatch?: QueryFilter } // Array element matches
}

/**
 * Sort/ordering configuration
 */
export interface OrderClause {
  /** Field to sort by */
  field: string
  
  /** Sort direction */
  direction: 'asc' | 'desc'
  
  /** Sort priority (for multi-field sorts) */
  priority?: number
}

/**
 * Query context for advanced filtering
 */
export interface QueryContext {
  /** Current user */
  user?: any
  
  /** Additional context data */
  context?: Record<string, any>
  
  /** Request timestamp */
  timestamp?: Date
  
  /** Additional filters to apply */
  filters?: QueryFilter
  
  /** Additional ordering to apply */
  ordering?: OrderClause[]
  
  /** Pagination settings */
  pagination?: {
    limit?: number
    offset?: number
  }
}

/**
 * Resolved query result
 */
export interface ResolvedQuery {
  /** Schema type */
  schemaType: string
  
  /** Query options for client */
  options: {
    filter?: QueryFilter
    sort?: Record<string, 1 | -1>
    limit?: number
    offset?: number
    select?: string[]
  }
  
  /** Whether query was optimized */
  optimized?: boolean
  
  /** Cache configuration */
  cache?: {
    enabled: boolean
    ttl: number
    key: string
  }
  
  /** Query metadata */
  metadata?: {
    complexity: QueryComplexity
    optimized: boolean
    cached: boolean
  }
}

/**
 * Query builder options
 */
export interface QueryBuilderOptions {
  /** Enable query optimization */
  optimize?: boolean
  
  /** Enable query caching */
  cache?: boolean
  
  /** Default cache TTL */
  cacheTTL?: number
  
  /** Maximum query complexity */
  maxComplexity?: number
}

/**
 * Query operators enum for validation
 */
export const QueryOperators = {
  // Comparison
  $eq: 'equal',
  $ne: 'not equal',
  $gt: 'greater than',
  $gte: 'greater than or equal',
  $lt: 'less than',
  $lte: 'less than or equal',
  $in: 'in array',
  $nin: 'not in array',
  
  // Logical
  $and: 'logical AND',
  $or: 'logical OR',
  $not: 'logical NOT',
  $nor: 'logical NOR',
  
  // Element
  $exists: 'field exists',
  $type: 'field type',
  
  // Evaluation
  $regex: 'regular expression',
  $text: 'text search',
  
  // Array
  $all: 'array contains all',
  $elemMatch: 'array element matches',
  $size: 'array size',
  
  // String
  $contains: 'contains substring',
  $startsWith: 'starts with',
  $endsWith: 'ends with'
} as const

/**
 * Query complexity calculator
 */
export interface QueryComplexity {
  /** Total complexity score */
  score: number
  
  /** Complexity breakdown */
  breakdown: {
    operators: number
    nesting: number
    fields: number
    arrayOps: number
  }
  
  /** Performance recommendations */
  recommendations: string[]
  
  /** Operator usage counts */
  operatorCounts: Record<string, number>
  
  /** Estimated query cost */
  estimatedCost: 'low' | 'medium' | 'high' | 'very-high'
}