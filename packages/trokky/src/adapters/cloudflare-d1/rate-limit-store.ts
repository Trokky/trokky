/**
 * Rate limit counters in D1.
 *
 * Deliberately D1 and not Durable Objects or KV. A Trokky install on Workers
 * already has a D1 binding — it is the data store — so counters here add no new
 * binding, no new resource to provision and nothing extra for a one-click deploy
 * to create. KV is the wrong shape entirely: its reads are cached and its writes
 * take up to a minute to propagate, so a limiter built on it would admit a burst
 * it believes it has already refused.
 *
 * Affordability comes from the lease in `core/security/rate-limit-store.ts`, not
 * from the storage: one statement per lease, not per request.
 */

import type { D1Database } from '@cloudflare/workers-types'
import type { RateLimitReservation, RateLimitStore } from '../../core/security/rate-limit-store.js'

/** How often, at most, to delete counters from windows long past. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000

export interface D1RateLimitStoreConfig {
  database: D1Database
  /** Must match the adapter's, so both see the same table. @default 'trokky_' */
  tablePrefix?: string
}

export class D1RateLimitStore implements RateLimitStore {
  private readonly db: D1Database
  private readonly table: string
  private ready: Promise<void> | null = null
  private lastSweep = 0

  constructor(config: D1RateLimitStoreConfig) {
    this.db = config.database
    this.table = `${config.tablePrefix ?? 'trokky_'}rate_limits`
  }

  private async ensureTable(): Promise<void> {
    if (!this.ready) {
      this.ready = (async () => {
        await this.db
          .prepare(
            `CREATE TABLE IF NOT EXISTS ${this.table} (
               key TEXT PRIMARY KEY,
               window_start INTEGER NOT NULL,
               used INTEGER NOT NULL,
               last_granted INTEGER NOT NULL
             )`
          )
          .run()
      })().catch(error => {
        this.ready = null
        throw error
      })
    }
    await this.ready
  }

  /**
   * One statement, so two isolates reserving at once cannot both be handed the
   * last unit. In SQLite's `DO UPDATE`, a `table.column` reference is the row as
   * it was before this statement, which is what makes the arithmetic sound.
   *
   * `last_granted` exists because `RETURNING` reports the row's final state and
   * we need the delta. Computing it in the same statement and reading it back is
   * how the caller learns what it actually got.
   */
  public async reserve({ key, windowStart, want, max }: RateLimitReservation): Promise<number> {
    await this.ensureTable()

    const initial = Math.max(0, Math.min(want, max))

    const row = await this.db
      .prepare(
        `INSERT INTO ${this.table} (key, window_start, used, last_granted)
         VALUES (?1, ?2, ?3, ?3)
         ON CONFLICT(key) DO UPDATE SET
           last_granted = CASE
             WHEN ${this.table}.window_start < ?2 THEN ?3
             ELSE MAX(0, MIN(?4, ?5 - ${this.table}.used))
           END,
           used = CASE
             WHEN ${this.table}.window_start < ?2 THEN ?3
             ELSE ${this.table}.used + MAX(0, MIN(?4, ?5 - ${this.table}.used))
           END,
           window_start = ?2
         RETURNING last_granted AS granted`
      )
      .bind(key, windowStart, initial, want, max)
      .first<{ granted: number }>()

    void this.maybeSweep(windowStart)
    return Number(row?.granted ?? 0)
  }

  /**
   * Opportunistic garbage collection. There is no background timer on an edge
   * runtime, so old rows are cleared during a request that was going to touch
   * this table anyway, and at most once every few minutes per isolate. Nothing
   * depends on it: a stale row is overwritten by the next window's reservation.
   */
  private async maybeSweep(windowStart: number): Promise<void> {
    const now = Date.now()
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return
    this.lastSweep = now
    try {
      await this.db
        .prepare(`DELETE FROM ${this.table} WHERE window_start < ?`)
        .bind(windowStart - SWEEP_INTERVAL_MS)
        .run()
    } catch {
      // Best effort by design; a failed sweep must never fail a request.
    }
  }
}
