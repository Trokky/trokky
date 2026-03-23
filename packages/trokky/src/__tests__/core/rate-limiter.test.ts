import { describe, it, expect, beforeEach } from 'vitest'
import { RateLimiter } from '../../core/security/rate-limiter.js'
import { RateLimitError } from '../../core/errors/index.js'

describe('RateLimiter', () => {
  let limiter: RateLimiter

  describe('with default config', () => {
    beforeEach(() => {
      limiter = new RateLimiter()
    })

    it('should allow requests within the limit', async () => {
      await expect(limiter.checkRateLimit('test-op')).resolves.toBeUndefined()
    })

    it('should track remaining requests', () => {
      const remaining = limiter.getRemainingRequests('test-op')
      expect(remaining).toBeGreaterThan(0)
    })
  })

  describe('with strict config', () => {
    beforeEach(() => {
      limiter = new RateLimiter({
        windowMs: 60000,
        maxRequests: 3,
      })
    })

    it('should allow requests up to the limit', async () => {
      await limiter.checkRateLimit('login')
      await limiter.checkRateLimit('login')
      await limiter.checkRateLimit('login')
      // 3 requests should succeed
    })

    it('should throw RateLimitError when limit exceeded', async () => {
      await limiter.checkRateLimit('login')
      await limiter.checkRateLimit('login')
      await limiter.checkRateLimit('login')
      await expect(limiter.checkRateLimit('login')).rejects.toThrow(RateLimitError)
    })

    it('should track separate operations independently', async () => {
      await limiter.checkRateLimit('login')
      await limiter.checkRateLimit('login')
      await limiter.checkRateLimit('login')
      // login is exhausted, but register should still work
      await expect(limiter.checkRateLimit('register')).resolves.toBeUndefined()
    })

    it('should decrease remaining count', async () => {
      const before = limiter.getRemainingRequests('test')
      await limiter.checkRateLimit('test')
      const after = limiter.getRemainingRequests('test')
      expect(after).toBe(before - 1)
    })
  })

  describe('with context-based keys', () => {
    beforeEach(() => {
      limiter = new RateLimiter({
        maxRequests: 2,
        keyGenerator: (op, ctx) => `${op}:${ctx?.ip || 'unknown'}`,
      })
    })

    it('should rate limit per IP', async () => {
      await limiter.checkRateLimit('login', { ip: '1.2.3.4' })
      await limiter.checkRateLimit('login', { ip: '1.2.3.4' })
      // Same IP exhausted
      await expect(
        limiter.checkRateLimit('login', { ip: '1.2.3.4' })
      ).rejects.toThrow(RateLimitError)
      // Different IP should still work
      await expect(
        limiter.checkRateLimit('login', { ip: '5.6.7.8' })
      ).resolves.toBeUndefined()
    })
  })

  describe('cleanup', () => {
    it('should not throw when called', () => {
      const limiter = new RateLimiter({ maxRequests: 1 })
      expect(() => limiter.cleanup()).not.toThrow()
    })
  })
})
