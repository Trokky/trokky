/**
 * Where a rate limiter keeps its counters.
 *
 * In one long-lived process a `Map` is the whole story. On an edge runtime it is
 * a security bug wearing a performance costume: every isolate keeps its own
 * counters, so the effective limit is multiplied by however many isolates happen
 * to be warm, and nobody notices because the limiter still *looks* like it works.
 *
 * The naive fix — one shared write per request — is unaffordable here, because
 * `checkRateLimit` guards media reads as well as sign-ins.
 *
 * So the unit of exchange is a **lease**, not a request. A limiter asks the store
 * for a slice of the window's quota, spends it locally at no cost, and goes back
 * only when the slice runs out. One round trip per `leaseSize` requests instead
 * of one per request.
 *
 * The error this introduces leans the safe way. An isolate that leases ten and
 * serves two before it is evicted has still spent ten of the window's budget, so
 * churn makes the limit *stricter* than configured, never looser. Being briefly
 * too strict under load is a far better failure than silently admitting ten times
 * the traffic you asked for.
 */

export interface RateLimitStore {
  /**
   * Reserve up to `want` units of the quota for `key` in the window starting at
   * `windowStart`, and report how many were actually granted — `0` when the
   * window is exhausted. Implementations must apply the increment atomically:
   * two callers reserving at once must not both receive the last unit.
   */
  reserve(request: RateLimitReservation): Promise<number>
}

export interface RateLimitReservation {
  /** The counter's identity: the operation, or whatever the key generator built. */
  key: string
  /** Start of the fixed window, in epoch milliseconds. */
  windowStart: number
  /** Window length, so a store can expire its own rows without being told twice. */
  windowMs: number
  /** How many units the caller would like. */
  want: number
  /** The most that may be granted across all callers for this key and window. */
  max: number
}

/**
 * Counters in process memory. Exact, free, and correct for a single process —
 * which is every Node deployment. It is the default for that reason.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly counts = new Map<string, { used: number; windowStart: number }>()

  public async reserve({ key, windowStart, want, max }: RateLimitReservation): Promise<number> {
    const current = this.counts.get(key)

    if (!current || current.windowStart < windowStart) {
      const granted = Math.min(want, max)
      this.counts.set(key, { used: granted, windowStart })
      return granted
    }

    const granted = Math.min(want, Math.max(0, max - current.used))
    current.used += granted
    return granted
  }

  /** Drop counters for windows that are well past. */
  public cleanup(windowMs: number, now = Date.now()): void {
    const cutoff = now - windowMs * 2
    for (const [key, value] of this.counts.entries()) {
      if (value.windowStart < cutoff) {
        this.counts.delete(key)
      }
    }
  }

  /** Units already spent for a key in the current window. Test seam. */
  public used(key: string, windowStart: number): number {
    const current = this.counts.get(key)
    return current && current.windowStart >= windowStart ? current.used : 0
  }
}
