/**
 * Cache Manager
 * Simple in-memory cache with TTL support
 */

import type { CacheEntry } from '../types'

export class CacheManager {
  private cache = new Map<string, CacheEntry>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(private defaultMaxAge: number = 300000) { // 5 minutes default
    // Start cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  /**
   * Get cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if expired
    if (Date.now() - entry.timestamp > entry.maxAge) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  /**
   * Set cached data with optional TTL
   */
  set<T>(key: string, data: T, maxAge?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      maxAge: maxAge || this.defaultMaxAge
    }

    this.cache.set(key, entry)
  }

  /**
   * Delete cached data
   */
  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size
  }

  /**
   * Generate cache key for API requests
   */
  generateKey(endpoint: string, params?: any): string {
    const base = endpoint.replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
    
    if (!params) return base
    
    // Sort params for consistent keys
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&')
    
    return `${base}?${sortedParams}`
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.maxAge) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Destroy cache manager and cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }
}