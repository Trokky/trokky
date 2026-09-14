/**
 * The limiter's contract, and the lease arithmetic that makes a shared store
 * affordable. The D1 store is exercised against a real D1 via Miniflare, so the
 * atomicity claim is tested rather than asserted.
 */
import { describe, it, expect } from 'vitest'
import { Miniflare } from 'miniflare'
import type { D1Database } from '@cloudflare/workers-types'
import { RateLimiter } from '../../core/security/rate-limiter.js'
import { MemoryRateLimitStore } from '../../core/security/rate-limit-store.js'
import { D1RateLimitStore } from '../../adapters/cloudflare-d1/rate-limit-store.js'

const IDLE_WORKER = 'export default { fetch: () => new Response(null, { status: 204 }) }'

async function d1(): Promise<{ store: D1RateLimitStore; dispose: () => Promise<void> }> {
  const mf = new Miniflare({
    modules: true,
    script: IDLE_WORKER,
    d1Databases: { DB: `rl-${Math.random().toString(36).slice(2)}` },
  })
  const database = (await mf.getD1Database('DB')) as unknown as D1Database
  return { store: new D1RateLimitStore({ database }), dispose: () => mf.dispose() }
}

describe('RateLimiter', () => {
  it('allows up to the limit and refuses the next request', async () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3 })
    for (let i = 0; i < 3; i++) await limiter.checkRateLimit('op')
    await expect(limiter.checkRateLimit('op')).rejects.toThrow()
  })

  it('counts each operation separately', async () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1 })
    await limiter.checkRateLimit('a')
    await limiter.checkRateLimit('b')
    await expect(limiter.checkRateLimit('a')).rejects.toThrow()
  })

  it('uses the key generator when one is supplied', async () => {
    const limiter = new RateLimiter({
      windowMs: 60_000,
      maxRequests: 1,
      keyGenerator: (op, ctx) => `${op}:${(ctx as { ip?: string })?.ip ?? 'anon'}`,
    })
    await limiter.checkRateLimit('login', { ip: '1.1.1.1' })
    await limiter.checkRateLimit('login', { ip: '2.2.2.2' })
    await expect(limiter.checkRateLimit('login', { ip: '1.1.1.1' })).rejects.toThrow()
  })

  it('stays refused for the rest of the window once the quota is gone', async () => {
    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 1, leaseSize: 4 })
    await limiter.checkRateLimit('op')
    await expect(limiter.checkRateLimit('op')).rejects.toThrow()
    await expect(limiter.checkRateLimit('op')).rejects.toThrow()
  })
})

describe('lease arithmetic', () => {
  it('takes one lease instead of one reservation per request', async () => {
    const inner = new MemoryRateLimitStore()
    let reservations = 0
    const counting = {
      reserve: (r: Parameters<MemoryRateLimitStore['reserve']>[0]) => {
        reservations++
        return inner.reserve(r)
      },
    }

    const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 100, store: counting, leaseSize: 10 })
    for (let i = 0; i < 10; i++) await limiter.checkRateLimit('op')

    expect(reservations).toBe(1)
  })

  it('never exceeds the configured maximum, whatever the lease size', async () => {
    const store = new MemoryRateLimitStore()
    const a = new RateLimiter({ windowMs: 60_000, maxRequests: 10, store, leaseSize: 4 })
    const b = new RateLimiter({ windowMs: 60_000, maxRequests: 10, store, leaseSize: 4 })

    let served = 0
    for (let i = 0; i < 40; i++) {
      for (const limiter of [a, b]) {
        try {
          await limiter.checkRateLimit('shared')
          served++
        } catch {
          /* refused */
        }
      }
    }
    // Two instances sharing one store must not serve more than the quota
    // between them — that multiplication is the bug the store exists to fix.
    expect(served).toBeLessThanOrEqual(10)
  })

  it('errs strict rather than loose when a lease is abandoned', async () => {
    const store = new MemoryRateLimitStore()
    // Three instances each take a lease of 4 from a quota of 12 and serve one
    // request, mimicking short-lived isolates. The unspent credit is lost.
    for (let i = 0; i < 3; i++) {
      await new RateLimiter({ windowMs: 60_000, maxRequests: 12, store, leaseSize: 4 }).checkRateLimit('op')
    }
    const late = new RateLimiter({ windowMs: 60_000, maxRequests: 12, store, leaseSize: 4 })
    await expect(late.checkRateLimit('op')).rejects.toThrow()
  })
})

describe('D1RateLimitStore', () => {
  it('grants the quota once and then nothing', async () => {
    const { store, dispose } = await d1()
    try {
      const windowStart = Math.floor(Date.now() / 60_000) * 60_000
      const r = (want: number) => store.reserve({ key: 'op', windowStart, windowMs: 60_000, want, max: 5 })

      expect(await r(3)).toBe(3)
      expect(await r(3)).toBe(2) // only two left
      expect(await r(3)).toBe(0)
    } finally {
      await dispose()
    }
  })

  it('starts a fresh quota in the next window', async () => {
    const { store, dispose } = await d1()
    try {
      const first = Math.floor(Date.now() / 60_000) * 60_000
      expect(await store.reserve({ key: 'op', windowStart: first, windowMs: 60_000, want: 5, max: 5 })).toBe(5)
      expect(await store.reserve({ key: 'op', windowStart: first, windowMs: 60_000, want: 1, max: 5 })).toBe(0)
      expect(
        await store.reserve({ key: 'op', windowStart: first + 60_000, windowMs: 60_000, want: 5, max: 5 })
      ).toBe(5)
    } finally {
      await dispose()
    }
  })

  it('hands out the last unit exactly once under concurrent reservations', async () => {
    const { store, dispose } = await d1()
    try {
      const windowStart = Math.floor(Date.now() / 60_000) * 60_000
      const attempts = Array.from({ length: 20 }, () =>
        store.reserve({ key: 'race', windowStart, windowMs: 60_000, want: 1, max: 5 })
      )
      const granted = (await Promise.all(attempts)).reduce((sum, n) => sum + n, 0)
      expect(granted).toBe(5)
    } finally {
      await dispose()
    }
  })

  it('keeps separate counters per key', async () => {
    const { store, dispose } = await d1()
    try {
      const windowStart = Math.floor(Date.now() / 60_000) * 60_000
      expect(await store.reserve({ key: 'a', windowStart, windowMs: 60_000, want: 2, max: 2 })).toBe(2)
      expect(await store.reserve({ key: 'b', windowStart, windowMs: 60_000, want: 2, max: 2 })).toBe(2)
      expect(await store.reserve({ key: 'a', windowStart, windowMs: 60_000, want: 1, max: 2 })).toBe(0)
    } finally {
      await dispose()
    }
  })

  it('drives a limiter end to end', async () => {
    const { store, dispose } = await d1()
    try {
      const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 3, store, leaseSize: 1 })
      await limiter.checkRateLimit('login')
      await limiter.checkRateLimit('login')
      await limiter.checkRateLimit('login')
      await expect(limiter.checkRateLimit('login')).rejects.toThrow()
    } finally {
      await dispose()
    }
  })
})
