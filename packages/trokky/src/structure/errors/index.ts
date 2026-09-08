/**
 * Structure System Errors
 * Structured error handling for the structure package
 */

export class StructureError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: any,
    public cause?: Error
  ) {
    super(message)
    this.name = 'StructureError'
  }
}

export class ValidationError extends StructureError {
  constructor(message: string, context?: any, cause?: Error) {
    super(message, 'VALIDATION_ERROR', context, cause)
    this.name = 'ValidationError'
  }
}

export class PermissionError extends StructureError {
  constructor(message: string, context?: any, cause?: Error) {
    super(message, 'PERMISSION_ERROR', context, cause)
    this.name = 'PermissionError'
  }
}

export class QueryError extends StructureError {
  constructor(message: string, context?: any, cause?: Error) {
    super(message, 'QUERY_ERROR', context, cause)
    this.name = 'QueryError'
  }
}

export class NavigationError extends StructureError {
  constructor(message: string, context?: any, cause?: Error) {
    super(message, 'NAVIGATION_ERROR', context, cause)
    this.name = 'NavigationError'
  }
}

export class MergeError extends StructureError {
  constructor(message: string, context?: any, cause?: Error) {
    super(message, 'MERGE_ERROR', context, cause)
    this.name = 'MergeError'
  }
}

/**
 * Error codes for common issues
 */
export const ErrorCodes = {
  // Validation errors
  INVALID_STRUCTURE: 'INVALID_STRUCTURE',
  SCHEMA_NOT_FOUND: 'SCHEMA_NOT_FOUND',
  INVALID_QUERY: 'INVALID_QUERY',
  INVALID_PERMISSION: 'INVALID_PERMISSION',
  
  // Permission errors
  ACCESS_DENIED: 'ACCESS_DENIED',
  AUTHENTICATION_REQUIRED: 'AUTHENTICATION_REQUIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Query errors
  QUERY_TOO_COMPLEX: 'QUERY_TOO_COMPLEX',
  INVALID_OPERATOR: 'INVALID_OPERATOR',
  QUERY_TIMEOUT: 'QUERY_TIMEOUT',
  
  // Navigation errors
  INVALID_NAVIGATION_ITEM: 'INVALID_NAVIGATION_ITEM',
  NAVIGATION_BUILD_FAILED: 'NAVIGATION_BUILD_FAILED',
  
  // Merge errors
  MERGE_CONFLICT: 'MERGE_CONFLICT',
  DUPLICATE_ID: 'DUPLICATE_ID',
  INCOMPATIBLE_TYPES: 'INCOMPATIBLE_TYPES',
  
  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

/**
 * Create a structured error with proper context
 */
export function createError(
  type: 'validation' | 'permission' | 'query' | 'navigation' | 'merge' | 'structure',
  message: string,
  code?: ErrorCode,
  context?: any,
  cause?: Error
): StructureError {
  const errorCode = code || ErrorCodes.INTERNAL_ERROR
  
  switch (type) {
    case 'validation':
      return new ValidationError(message, context, cause)
    case 'permission':
      return new PermissionError(message, context, cause)
    case 'query':
      return new QueryError(message, context, cause)
    case 'navigation':
      return new NavigationError(message, context, cause)
    case 'merge':
      return new MergeError(message, context, cause)
    default:
      return new StructureError(message, errorCode, context, cause)
  }
}

/**
 * Error recovery utilities
 */
export class ErrorRecovery {
  /**
   * Safely execute a function with error recovery
   */
  static async safeExecute<T>(
    fn: () => Promise<T>,
    fallback: T,
    onError?: (error: Error) => void
  ): Promise<T> {
    try {
      return await fn()
    } catch (error) {
      if (onError) {
        onError(error as Error)
      }
      return fallback
    }
  }

  /**
   * Retry a function with exponential backoff
   */
  static async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number
      baseDelay?: number
      maxDelay?: number
      backoffFactor?: number
    } = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      baseDelay = 100,
      maxDelay = 5000,
      backoffFactor = 2
    } = options

    let lastError: Error
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === maxAttempts) {
          throw error
        }
        
        const delay = Math.min(
          baseDelay * Math.pow(backoffFactor, attempt - 1),
          maxDelay
        )
        
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw lastError!
  }
}