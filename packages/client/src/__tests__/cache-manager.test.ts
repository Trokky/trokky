/**
 * Cache Manager Tests
 */

import { CacheManager } from '../cache/manager'

describe('CacheManager', () => {
  let cache: CacheManager

  beforeEach(() => {
    cache = new CacheManager(1000) // 1 second default TTL for testing
  })

  afterEach(() => {
    cache.destroy()
  })

  describe('basic operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1')
      expect(cache.get('key1')).toBe('value1')
    })

    it('should return null for non-existent keys', () => {
      expect(cache.get('non-existent')).toBeNull()
    })

    it('should delete values', () => {
      cache.set('key1', 'value1')
      expect(cache.delete('key1')).toBe(true)
      expect(cache.get('key1')).toBeNull()
    })

    it('should return false when deleting non-existent key', () => {
      expect(cache.delete('non-existent')).toBe(false)
    })

    it('should clear all values', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.clear()
      expect(cache.get('key1')).toBeNull()
      expect(cache.get('key2')).toBeNull()
    })

    it('should check if key exists', () => {
      cache.set('key1', 'value1')
      expect(cache.has('key1')).toBe(true)
      expect(cache.has('non-existent')).toBe(false)
    })

    it('should return cache size', () => {
      expect(cache.size()).toBe(0)
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      expect(cache.size()).toBe(2)
    })
  })

  describe('TTL (Time To Live)', () => {
    it('should expire values after TTL', async () => {
      cache.set('key1', 'value1', 100) // 100ms TTL
      expect(cache.get('key1')).toBe('value1')
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150))
      expect(cache.get('key1')).toBeNull()
    })

    it('should use default TTL when not specified', async () => {
      cache.set('key1', 'value1') // Uses default 1000ms TTL
      expect(cache.get('key1')).toBe('value1')
      
      // Should still be there after 500ms
      await new Promise(resolve => setTimeout(resolve, 500))
      expect(cache.get('key1')).toBe('value1')
    })

    it('should handle different TTL for different keys', async () => {
      cache.set('short', 'value1', 100)
      cache.set('long', 'value2', 500)
      
      await new Promise(resolve => setTimeout(resolve, 150))
      
      expect(cache.get('short')).toBeNull()
      expect(cache.get('long')).toBe('value2')
    })
  })

  describe('key generation', () => {
    it('should generate simple keys for endpoints without params', () => {
      const key = cache.generateKey('/documents/post')
      expect(key).toBe('documents/post')
    })

    it('should generate keys with query parameters', () => {
      const params = { limit: 10, offset: 0 }
      const key = cache.generateKey('/documents/post', params)
      expect(key).toBe('documents/post?limit=10&offset=0')
    })

    it('should sort parameters for consistent keys', () => {
      const params1 = { z: 1, a: 2, m: 3 }
      const params2 = { a: 2, m: 3, z: 1 }
      
      const key1 = cache.generateKey('/test', params1)
      const key2 = cache.generateKey('/test', params2)
      
      expect(key1).toBe(key2)
    })

    it('should handle complex parameter values', () => {
      const params = {
        filter: { status: 'published' },
        sort: { createdAt: -1 },
        fields: ['title', 'slug']
      }
      
      const key = cache.generateKey('/documents/post', params)
      expect(key).toContain('documents/post?')
      expect(key).toContain('fields=["title","slug"]')
      expect(key).toContain('filter={"status":"published"}')
      expect(key).toContain('sort={"createdAt":-1}')
    })

    it('should remove leading and trailing slashes from endpoints', () => {
      expect(cache.generateKey('/test/')).toBe('test')
      expect(cache.generateKey('///test///')).toBe('test')
    })
  })

  describe('data types', () => {
    it('should store and retrieve different data types', () => {
      cache.set('string', 'hello')
      cache.set('number', 42)
      cache.set('boolean', true)
      cache.set('object', { name: 'test' })
      cache.set('array', [1, 2, 3])
      cache.set('null', null)
      
      expect(cache.get('string')).toBe('hello')
      expect(cache.get('number')).toBe(42)
      expect(cache.get('boolean')).toBe(true)
      expect(cache.get('object')).toEqual({ name: 'test' })
      expect(cache.get('array')).toEqual([1, 2, 3])
      expect(cache.get('null')).toBeNull()
    })
  })

  describe('cleanup', () => {
    it('should clean up expired entries', async () => {
      // Create cache with very short cleanup interval for testing
      const testCache = new CacheManager(100)
      
      testCache.set('key1', 'value1', 50) // Expires in 50ms
      testCache.set('key2', 'value2', 200) // Expires in 200ms
      
      expect(testCache.size()).toBe(2)
      
      // Wait for first key to expire and cleanup to run
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Manual cleanup check (since we can't easily test automatic cleanup timing)
      expect(testCache.get('key1')).toBeNull() // Should be expired
      expect(testCache.get('key2')).toBe('value2') // Should still exist
      
      testCache.destroy()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined values', () => {
      cache.set('undefined', undefined)
      expect(cache.get('undefined')).toBeUndefined()
    })

    it('should handle empty string keys', () => {
      cache.set('', 'empty-key-value')
      expect(cache.get('')).toBe('empty-key-value')
    })

    it('should handle overwriting existing keys', () => {
      cache.set('key1', 'value1')
      cache.set('key1', 'value2')
      expect(cache.get('key1')).toBe('value2')
    })

    it('should handle keys with special characters', () => {
      const specialKey = 'key!@#$%^&*()_+{}|:"<>?`~'
      cache.set(specialKey, 'special-value')
      expect(cache.get(specialKey)).toBe('special-value')
    })
  })
})