import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TrokkyCore } from '../../core/core/engine.js'
import type { TrokkyConfig } from '../../core/types/index.js'
import { WebCryptoAdapter } from '../../core/crypto/webcrypto-adapter.js'

const config: TrokkyConfig = {
  storage: { adapter: 'mock', options: {} },
  schemas: [],
}

/**
 * Minimal adapters: only the members TrokkyCore's constructor validation touches,
 * plus an optional close() so each test can choose whether the adapter has one.
 */
function createMockDataAdapter(close?: () => Promise<void>) {
  return {
    getDocument: vi.fn(async () => null),
    saveDocument: vi.fn(async () => ({})),
    listDocuments: vi.fn(async () => []),
    deleteDocument: vi.fn(async () => undefined),
    getUser: vi.fn(async () => null),
    saveUser: vi.fn(async () => ({})),
    listUsers: vi.fn(async () => []),
    deleteUser: vi.fn(async () => undefined),
    getUserByUsername: vi.fn(async () => null),
    getUserByEmail: vi.fn(async () => null),
    getAppToken: vi.fn(async () => null),
    saveAppToken: vi.fn(async () => ({})),
    listAppTokens: vi.fn(async () => []),
    deleteAppToken: vi.fn(async () => undefined),
    getAppTokenByHash: vi.fn(async () => null),
    getSettings: vi.fn(async () => null),
    healthCheck: vi.fn(async () => true),
    ...(close ? { close: vi.fn(close) } : {}),
  }
}

function createMockMediaAdapter(close?: () => Promise<void>) {
  return {
    uploadFile: vi.fn(),
    getFile: vi.fn(),
    getFileContent: vi.fn(),
    deleteFile: vi.fn(),
    healthCheck: vi.fn(async () => true),
    ...(close ? { close: vi.fn(close) } : {}),
  }
}

function createCore(data: unknown, media: unknown): TrokkyCore {
  return new TrokkyCore(
    config,
    { data: data as never, media: media as never },
    {
      enableSecurity: false,
      jwtSecret: 'test-secret',
      enableEvents: false,
      cryptoAdapter: new WebCryptoAdapter(),
    }
  )
}

describe('TrokkyCore shutdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should close adapters that define close()', async () => {
    const data = createMockDataAdapter(async () => undefined)
    const media = createMockMediaAdapter(async () => undefined)
    const core = createCore(data, media)

    await core.shutdown()

    expect(data.close).toHaveBeenCalledTimes(1)
    expect(media.close).toHaveBeenCalledTimes(1)
  })

  it('should not blow up on adapters that hold nothing and define no close()', async () => {
    const data = createMockDataAdapter()
    const media = createMockMediaAdapter()
    const core = createCore(data, media)

    await expect(core.shutdown()).resolves.toBeUndefined()
    expect('close' in data).toBe(false)
  })

  it('should still close the other adapters when one throws', async () => {
    const data = createMockDataAdapter(async () => {
      throw new Error('pool refused to end')
    })
    const media = createMockMediaAdapter(async () => undefined)
    const core = createCore(data, media)

    await expect(core.shutdown()).resolves.toBeUndefined()

    expect(data.close).toHaveBeenCalledTimes(1)
    expect(media.close).toHaveBeenCalledTimes(1)
  })

  it('should close a shared adapter instance only once', async () => {
    const shared = { ...createMockDataAdapter(async () => undefined), ...createMockMediaAdapter() }
    shared.close = vi.fn(async () => undefined)
    const core = createCore(shared, shared)

    await core.shutdown()

    expect(shared.close).toHaveBeenCalledTimes(1)
  })

  it('should release the default event storage interval', async () => {
    const core = createCore(createMockDataAdapter(), createMockMediaAdapter())

    // The default event bus builds a MemoryEventStorage with autoCleanup on, whose interval
    // is what keeps a stopped process alive.
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    await core.shutdown()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('should keep cleanup() synchronous and free of adapter teardown', () => {
    const data = createMockDataAdapter(async () => undefined)
    const media = createMockMediaAdapter(async () => undefined)
    const core = createCore(data, media)

    // Existing hosts call this unawaited; it must stay sync and must not touch the adapters.
    const result = core.cleanup()

    expect(result).toBeUndefined()
    expect(data.close).not.toHaveBeenCalled()
    expect(media.close).not.toHaveBeenCalled()
  })
})
