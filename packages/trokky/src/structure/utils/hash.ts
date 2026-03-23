/**
 * Efficient Hashing Utilities
 * Fast cache key generation without JSON.stringify
 */

/**
 * Fast hash function for cache keys
 * Uses FNV-1a algorithm for good distribution and speed
 */
export class FastHasher {
  private static readonly FNV_OFFSET_BASIS = 2166136261
  private static readonly FNV_PRIME = 16777619

  /**
   * Generate a fast hash for any value
   */
  static hash(value: any): string {
    const str = this.stringify(value)
    let hash = this.FNV_OFFSET_BASIS
    
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i)
      hash = Math.imul(hash, this.FNV_PRIME)
    }
    
    return (hash >>> 0).toString(36)
  }

  /**
   * Fast object stringification for hashing
   * More efficient than JSON.stringify for cache keys
   */
  private static stringify(obj: any): string {
    if (obj === null) return 'null'
    if (obj === undefined) return 'undefined'
    
    const type = typeof obj
    if (type === 'string') return `"${obj}"`
    if (type === 'number' || type === 'boolean') return String(obj)
    if (type === 'function') return obj.toString()
    
    if (Array.isArray(obj)) {
      return `[${obj.map(item => this.stringify(item)).join(',')}]`
    }
    
    if (type === 'object') {
      const keys = Object.keys(obj).sort() // Sort for consistency
      const pairs = keys.map(key => `"${key}":${this.stringify(obj[key])}`)
      return `{${pairs.join(',')}}`
    }
    
    return String(obj)
  }

  /**
   * Generate a structured cache key with namespace
   */
  static cacheKey(namespace: string, ...parts: any[]): string {
    const hashParts = parts.map(part => this.hash(part)).join('-')
    return `${namespace}:${hashParts}`
  }
}

/**
 * Stable hash for consistent ordering
 * Ensures same input always produces same hash
 */
export class StableHasher {
  /**
   * Create a stable hash that's consistent across runs
   */
  static hash(value: any): string {
    return FastHasher.hash(this.normalize(value))
  }

  /**
   * Normalize value for consistent hashing
   */
  private static normalize(obj: any): any {
    if (obj === null || obj === undefined) return obj
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.normalize(item))
    }
    
    if (typeof obj === 'object' && obj.constructor === Object) {
      const result: any = {}
      const keys = Object.keys(obj).sort()
      for (const key of keys) {
        result[key] = this.normalize(obj[key])
      }
      return result
    }
    
    return obj
  }
}

/**
 * Cache key utilities for specific use cases
 */
export class CacheKeyUtils {
  /**
   * Generate query cache key
   */
  static queryKey(schemaType: string, filter: any, context?: any): string {
    return FastHasher.cacheKey('query', schemaType, filter, context)
  }

  /**
   * Generate navigation cache key
   */
  static navigationKey(structureTitle: string, userId?: string): string {
    return FastHasher.cacheKey('nav', structureTitle, userId || 'anonymous')
  }

  /**
   * Generate permission cache key
   */
  static permissionKey(action: string, itemId: string, userId?: string): string {
    return FastHasher.cacheKey('perm', action, itemId, userId || 'anonymous')
  }

  /**
   * Generate validation cache key
   */
  static validationKey(structureHash: string): string {
    return FastHasher.cacheKey('valid', structureHash)
  }
}