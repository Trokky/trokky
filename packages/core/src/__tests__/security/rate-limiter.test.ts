import { RateLimiter } from '../../security/rate-limiter'
import { RateLimitError } from '../../errors/index'

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('should allow requests within limit', async () => {
    const rateLimiter = new RateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 5
    })

    // Should allow 5 requests
    for (let i = 0; i < 5; i++) {
      await expect(rateLimiter.checkRateLimit('test')).resolves.toBeUndefined()
    }
  })

  test('should block requests exceeding limit', async () => {
    const rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 3
    })

    // Allow 3 requests
    for (let i = 0; i < 3; i++) {
      await rateLimiter.checkRateLimit('test')
    }

    // 4th request should be blocked
    await expect(rateLimiter.checkRateLimit('test'))
      .rejects.toThrow(RateLimitError)
  })

  test('should reset count in new window', async () => {
    const rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 2
    })

    // Use up the limit
    await rateLimiter.checkRateLimit('test')
    await rateLimiter.checkRateLimit('test')

    // Should be blocked
    await expect(rateLimiter.checkRateLimit('test'))
      .rejects.toThrow(RateLimitError)

    // Advance time to new window
    jest.advanceTimersByTime(60001)

    // Should allow requests again
    await expect(rateLimiter.checkRateLimit('test')).resolves.toBeUndefined()
    await expect(rateLimiter.checkRateLimit('test')).resolves.toBeUndefined()
  })

  test('should handle different operations separately', async () => {
    const rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 2
    })

    // Use up limit for operation1
    await rateLimiter.checkRateLimit('operation1')
    await rateLimiter.checkRateLimit('operation1')

    // operation1 should be blocked
    await expect(rateLimiter.checkRateLimit('operation1'))
      .rejects.toThrow(RateLimitError)

    // operation2 should still be allowed
    await expect(rateLimiter.checkRateLimit('operation2')).resolves.toBeUndefined()
    await expect(rateLimiter.checkRateLimit('operation2')).resolves.toBeUndefined()
  })

  test('should use custom key generator', async () => {
    const rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 2,
      keyGenerator: (operation, context) => `${operation}:${context?.userId || 'anonymous'}`
    })

    // User 1 uses up their limit
    await rateLimiter.checkRateLimit('api', { userId: 'user1' })
    await rateLimiter.checkRateLimit('api', { userId: 'user1' })

    // User 1 should be blocked
    await expect(rateLimiter.checkRateLimit('api', { userId: 'user1' }))
      .rejects.toThrow(RateLimitError)

    // User 2 should still be allowed
    await expect(rateLimiter.checkRateLimit('api', { userId: 'user2' }))
      .resolves.toBeUndefined()
  })

  test('should return correct remaining requests', async () => {
    const rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 5
    })

    expect(rateLimiter.getRemainingRequests('test')).toBe(5)

    await rateLimiter.checkRateLimit('test')
    expect(rateLimiter.getRemainingRequests('test')).toBe(4)

    await rateLimiter.checkRateLimit('test')
    expect(rateLimiter.getRemainingRequests('test')).toBe(3)

    await rateLimiter.checkRateLimit('test')
    expect(rateLimiter.getRemainingRequests('test')).toBe(2)
  })

  test('should reset remaining requests in new window', async () => {
    const rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 3
    })

    await rateLimiter.checkRateLimit('test')
    expect(rateLimiter.getRemainingRequests('test')).toBe(2)

    // Advance to new window
    jest.advanceTimersByTime(60001)

    expect(rateLimiter.getRemainingRequests('test')).toBe(3)
  })

  test('should cleanup old entries', async () => {
    const rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 5
    })

    // Create some entries
    await rateLimiter.checkRateLimit('test1')
    await rateLimiter.checkRateLimit('test2')

    // Advance time significantly
    jest.advanceTimersByTime(180000) // 3 minutes

    // Create a new entry after cleanup time
    await rateLimiter.checkRateLimit('test3')

    // Cleanup should remove old entries
    rateLimiter.cleanup()

    // Old entries should be cleaned up, so limits should be reset
    expect(rateLimiter.getRemainingRequests('test1')).toBe(5)
    expect(rateLimiter.getRemainingRequests('test2')).toBe(5)
  })

  test('should handle concurrent requests correctly', async () => {
    const rateLimiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 3
    })

    // Simulate concurrent requests
    const promises = Array.from({ length: 5 }, (_, i) => 
      rateLimiter.checkRateLimit('concurrent').catch(error => error)
    )

    const results = await Promise.all(promises)

    // Should have 3 successful and 2 failed
    const successful = results.filter(result => result === undefined)
    const failed = results.filter(result => result instanceof RateLimitError)

    expect(successful).toHaveLength(3)
    expect(failed).toHaveLength(2)
  })

  test('should use default configuration', async () => {
    const rateLimiter = new RateLimiter()

    // Default should be 1000 requests per minute
    for (let i = 0; i < 1000; i++) {
      await rateLimiter.checkRateLimit('test')
    }

    // 1001st request should fail
    await expect(rateLimiter.checkRateLimit('test'))
      .rejects.toThrow(RateLimitError)
  })
})