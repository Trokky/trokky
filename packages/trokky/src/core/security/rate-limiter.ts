import { RateLimitError } from '../errors/index.js'
import { MemoryRateLimitStore, type RateLimitStore } from './rate-limit-store.js'

export interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
  keyGenerator?: (operation: string, context?: Record<string, unknown>) => string
  /**
   * Where counters live. Defaults to process memory, which is exact and free in
   * a single process. Supply a shared store on a runtime that spreads requests
   * across isolates, or the limit is silently multiplied by their number.
   */
  store?: RateLimitStore
  /**
   * How many units to take from the store at a time. `1` consults the store on
   * every request: exact, and the right choice for an in-process store. A larger
   * lease trades a bounded, fail-safe strictness for far fewer round trips, which
   * is what makes a shared store affordable on hot paths. See rate-limit-store.ts.
   */
  leaseSize?: number
  /**
   * Tighter limits for specific operations, keyed by operation name. An unauthenticated
   * endpoint that accepts a secret must not share the general 1000/min budget: that is a
   * guessing rate, not a request rate.
   */
  limits?: Record<string, { windowMs: number; maxRequests: number }>
}

/** One isolate's unspent share of a window's quota. */
interface Lease {
  windowStart: number
  remaining: number
}

export class RateLimiter {
  private readonly defaultConfig: RateLimitConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000
  }

  private config: RateLimitConfig
  private readonly store: RateLimitStore
  private readonly memoryStore: MemoryRateLimitStore | null
  private readonly leaseSize: number
  private readonly leases = new Map<string, Lease>()

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config }

    const store = config.store ?? new MemoryRateLimitStore()
    this.store = store
    // Kept typed so cleanup() can still prune, which only makes sense in memory.
    this.memoryStore = store instanceof MemoryRateLimitStore ? store : null
    this.leaseSize = Math.max(1, config.leaseSize ?? 1)
  }

  public async checkRateLimit(operation: string, context?: Record<string, unknown>): Promise<void> {
    const key = this.config.keyGenerator ? this.config.keyGenerator(operation, context) : operation
    const { windowMs, maxRequests } = this.config.limits?.[operation] ?? this.config

    const now = Date.now()
    const windowStart = Math.floor(now / windowMs) * windowMs

    const lease = this.leases.get(key)
    if (lease && lease.windowStart === windowStart && lease.remaining > 0) {
      lease.remaining -= 1
      return
    }

    const granted = await this.store.reserve({
      key,
      windowStart,
      windowMs,
      want: this.leaseSize,
      max: maxRequests
    })

    if (granted <= 0) {
      // A spent lease from this window must not be resurrected by a later call.
      this.leases.set(key, { windowStart, remaining: 0 })
      throw new RateLimitError(operation)
    }

    // One unit pays for this request; the rest is credit for the next ones.
    this.leases.set(key, { windowStart, remaining: granted - 1 })
  }

  /**
   * Drop bookkeeping for windows that are well past. Only meaningful for the
   * in-memory store; a shared store expires its own rows.
   */
  public cleanup(): void {
    const now = Date.now()
    const cutoff = now - this.config.windowMs * 2

    for (const [key, lease] of this.leases.entries()) {
      if (lease.windowStart < cutoff) {
        this.leases.delete(key)
      }
    }
    this.memoryStore?.cleanup(this.config.windowMs, now)
  }

  /**
   * Requests left in the current window, as far as this instance can tell.
   * With a shared store and a lease larger than one this is a local view: it
   * counts what this instance still holds, not what every instance has spent.
   */
  public getRemainingRequests(operation: string): number {
    const now = Date.now()
    const windowStart = Math.floor(now / this.config.windowMs) * this.config.windowMs

    if (this.memoryStore) {
      const used = this.memoryStore.used(operation, windowStart)
      const held = this.leases.get(operation)
      const unspent = held && held.windowStart === windowStart ? held.remaining : 0
      // `used` counts leased units, some of which are still in hand.
      return Math.max(0, this.config.maxRequests - used + unspent)
    }

    const lease = this.leases.get(operation)
    return lease && lease.windowStart === windowStart ? lease.remaining : this.config.maxRequests
  }
}

export { MemoryRateLimitStore } from './rate-limit-store.js'
export type { RateLimitStore, RateLimitReservation } from './rate-limit-store.js'
