/**
 * `withRetry` is what stands between a transient remote failure and a silently missing
 * thumbnail, so its contract is pinned rather than assumed.
 */

import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '../../core/utils/retry.js'

/** Never actually wait; the delays are asserted from what would have been slept. */
const collectSleeps = () => {
  const slept: number[] = []
  return { slept, sleep: async (ms: number) => { slept.push(ms) } }
}

describe('withRetry', () => {
  it('returns the first result without sleeping when nothing fails', async () => {
    const { slept, sleep } = collectSleeps()
    const operation = vi.fn().mockResolvedValue('ok')

    expect(await withRetry(operation, { sleep })).toBe('ok')
    expect(operation).toHaveBeenCalledTimes(1)
    expect(slept).toEqual([])
  })

  it('retries a transient failure and returns the eventual success', async () => {
    const { sleep } = collectSleeps()
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('Network connection lost.'))
      .mockResolvedValue('recovered')

    expect(await withRetry(operation, { sleep })).toBe('recovered')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it('rethrows the last error once attempts are spent, so flakiness is absorbed but not hidden', async () => {
    const { sleep } = collectSleeps()
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockRejectedValue(new Error('final'))

    await expect(withRetry(operation, { attempts: 3, sleep })).rejects.toThrow('final')
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('backs off exponentially, capped', async () => {
    const { slept, sleep } = collectSleeps()
    const operation = vi.fn().mockRejectedValue(new Error('always'))

    // random() at 1 puts every delay at the top of its window, making the growth visible.
    await expect(withRetry(operation, {
      attempts: 5, baseDelayMs: 100, maxDelayMs: 500, sleep, random: () => 1
    })).rejects.toThrow('always')

    expect(slept).toEqual([100, 200, 400, 500])
  })

  it('spreads delays with jitter, so a batch failing together does not retry in step', async () => {
    const { slept, sleep } = collectSleeps()
    const operation = vi.fn().mockRejectedValue(new Error('always'))

    // random() at 0 is the floor of each window: half the full delay, never zero.
    await expect(withRetry(operation, {
      attempts: 3, baseDelayMs: 100, sleep, random: () => 0
    })).rejects.toThrow('always')

    expect(slept).toEqual([50, 100])
  })

  it('does not retry an error nothing can fix', async () => {
    const { slept, sleep } = collectSleeps()
    const operation = vi.fn().mockRejectedValue(new Error('unsupported format'))

    await expect(withRetry(operation, {
      sleep,
      isRetryable: error => !String(error).includes('unsupported')
    })).rejects.toThrow('unsupported format')

    expect(operation).toHaveBeenCalledTimes(1)
    expect(slept).toEqual([])
  })

  it('reports each retry before sleeping, so the wait is visible in logs', async () => {
    const { sleep } = collectSleeps()
    const onRetry = vi.fn()
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValue('ok')

    await withRetry(operation, { sleep, onRetry })

    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onRetry.mock.calls[0][0]).toMatchObject({ attempt: 1 })
  })

  it('treats attempts below one as a single attempt rather than none', async () => {
    const operation = vi.fn().mockResolvedValue('ok')
    expect(await withRetry(operation, { attempts: 0 })).toBe('ok')
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
