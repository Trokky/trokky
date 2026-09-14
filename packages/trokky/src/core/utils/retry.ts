/**
 * Retry with exponential backoff and jitter.
 *
 * This exists because remote media processing is not reliable enough to call once. Measured
 * against Cloudflare's real Images service, roughly one call in fifteen of a 6MB JPEG fails
 * with a transient error ("Network connection lost", "internal error; reference = ..."), and a
 * single failure there used to mean an image silently ended up with no thumbnail.
 *
 * Jitter is not decoration. Variants are generated in a loop, so a batch that fails together
 * would otherwise retry together, in step, and hit the same overloaded backend at the same
 * moment. Each delay is therefore spread across half its window.
 */

/** Options for {@link withRetry}. All have defaults chosen for a remote image transform. */
export interface RetryOptions {
  /** Total attempts, first one included. One means no retry at all. @default 3 */
  attempts?: number
  /** Delay before the first retry, doubling from there. @default 200 */
  baseDelayMs?: number
  /** Ceiling on any single delay, so backoff cannot run away. @default 5000 */
  maxDelayMs?: number
  /**
   * Whether an error is worth retrying. Return false for anything a second attempt cannot fix —
   * an unsupported format, a rejected size — so a permanent failure fails fast.
   * @default everything is retryable
   */
  isRetryable?: (error: unknown) => boolean
  /** Called before sleeping, so a caller can log that it is about to retry. */
  onRetry?: (details: { error: unknown; attempt: number; delayMs: number }) => void
  /** Injectable for tests, so a suite never actually waits. */
  sleep?: (ms: number) => Promise<void>
  /** Injectable for tests, so jitter can be made deterministic. @default Math.random */
  random?: () => number
}

const defaultSleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Run `operation`, retrying transient failures with exponential backoff.
 *
 * Rethrows the last error once the attempts are spent, so a caller still sees a real failure —
 * retrying is meant to absorb flakiness, never to hide it.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3)
  const baseDelayMs = options.baseDelayMs ?? 200
  const maxDelayMs = options.maxDelayMs ?? 5000
  const isRetryable = options.isRetryable ?? (() => true)
  const sleep = options.sleep ?? defaultSleep
  const random = options.random ?? Math.random

  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      // The last attempt and an error nothing will fix both mean: stop now, surface it.
      if (attempt === attempts || !isRetryable(error)) break

      const window = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1))
      // Equal jitter: half the window guaranteed, half spread, so concurrent callers separate
      // without any of them retrying immediately.
      const delayMs = Math.round(window / 2 + random() * (window / 2))

      options.onRetry?.({ error, attempt, delayMs })
      await sleep(delayMs)
    }
  }

  throw lastError
}
