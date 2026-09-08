import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  AuthStore,
  AUTH_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
} from '../services/auth-store.js'

describe('auth store persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('persists a session under the two token keys', () => {
    const store = new AuthStore()
    store.persist('access-1', 'refresh-1')

    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('access-1')
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1')
    expect(store.getToken()).toBe('access-1')
    expect(store.getRefreshToken()).toBe('refresh-1')
  })

  it('reads a session left by a previous page load', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'from-storage')
    localStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-from-storage')

    const store = new AuthStore()

    expect(store.getTokens()).toEqual({
      token: 'from-storage',
      refreshToken: 'refresh-from-storage',
    })
  })

  it('keeps the stored refresh token when only an access token is renewed', () => {
    const store = new AuthStore()
    store.persist('access-1', 'refresh-1')
    store.persist('access-2')

    expect(store.getToken()).toBe('access-2')
    expect(store.getRefreshToken()).toBe('refresh-1')
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1')
  })

  it('clears both keys and the in-memory copy on sign-out', () => {
    const store = new AuthStore()
    store.persist('access-1', 'refresh-1')
    store.clear()

    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
    expect(store.getTokens()).toEqual({ token: null, refreshToken: null })
  })

  it('notifies subscribers on persist and clear, and stops after unsubscribe', () => {
    const store = new AuthStore()
    const seen: Array<string | null> = []
    const unsubscribe = store.subscribe(tokens => seen.push(tokens.token))

    store.persist('access-1', 'refresh-1')
    store.clear()
    unsubscribe()
    store.persist('access-2')

    expect(seen).toEqual(['access-1', null])
  })

  it('survives a localStorage that throws, keeping the token in memory', () => {
    const store = new AuthStore()
    const setItem = vi
      .spyOn(localStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

    expect(() => store.persist('access-1', 'refresh-1')).not.toThrow()
    expect(store.getToken()).toBe('access-1')

    setItem.mockRestore()
  })
})

describe('auth store refresh', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('runs one refresh for concurrent callers and persists the new session', async () => {
    const store = new AuthStore()
    store.persist('stale', 'refresh-1')

    type Session = { token: string; refreshToken: string }
    let resolveRefresh: (value: Session) => void = () => {}
    const refresher = vi.fn(
      () =>
        new Promise<Session>(resolve => {
          resolveRefresh = resolve
        })
    )
    store.setRefresher(refresher)

    const first = store.refresh()
    const second = store.refresh()
    const third = store.refresh()

    resolveRefresh({ token: 'fresh', refreshToken: 'refresh-2' })
    const results = await Promise.all([first, second, third])

    expect(refresher).toHaveBeenCalledTimes(1)
    expect(results.every(r => r?.token === 'fresh')).toBe(true)
    expect(store.getToken()).toBe('fresh')
    expect(store.getRefreshToken()).toBe('refresh-2')
  })

  it('allows a later refresh once the first has settled', async () => {
    const store = new AuthStore()
    store.persist('stale', 'refresh-1')

    const refresher = vi
      .fn()
      .mockResolvedValue({ token: 'fresh', refreshToken: 'refresh-1' })
    store.setRefresher(refresher)

    await store.refresh()
    await store.refresh()

    expect(refresher).toHaveBeenCalledTimes(2)
  })

  it('clears the session when the refresh is rejected by the server', async () => {
    const store = new AuthStore()
    store.persist('stale', 'refresh-1')
    store.setRefresher(vi.fn().mockResolvedValue(null))

    expect(await store.refresh()).toBeNull()
    expect(store.getToken()).toBeNull()
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
  })

  it('clears the session when the refresh request throws', async () => {
    const store = new AuthStore()
    store.persist('stale', 'refresh-1')
    store.setRefresher(vi.fn().mockRejectedValue(new Error('network down')))

    expect(await store.refresh()).toBeNull()
    expect(store.getToken()).toBeNull()
  })

  it('does not call the server when there is no refresh token', async () => {
    const store = new AuthStore()
    store.persist('access-only')
    const refresher = vi.fn()
    store.setRefresher(refresher)

    expect(await store.refresh()).toBeNull()
    expect(refresher).not.toHaveBeenCalled()
  })
})

describe('401 handling in the API client', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  /** A fetch that answers every call with the given status and JSON body. */
  function respondWith(status: number, body: unknown) {
    return vi.fn(async () =>
      Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        statusText: String(status),
        headers: { get: () => 'application/json' },
        json: async () => body,
      } as unknown as Response)
    )
  }

  async function freshClient() {
    const { ApiClient } = await import('../services/api-client.js')
    const { authStore } = await import('../services/auth-store.js')
    const client = new ApiClient('http://example.test/api')
    client.setBackendUrl('http://example.test/api')
    return { client, authStore }
  }

  it('asks the session owner once and retries the request once', async () => {
    const { client, authStore } = await freshClient()
    authStore.persist('stale-token', 'refresh-1')

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: { get: () => 'application/json' },
        json: async () => ({ error: { message: 'expired' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: () => 'application/json' },
        json: async () => ({ data: { id: 'u1' } }),
      })
    global.fetch = fetchMock as unknown as typeof fetch

    const onUnauthorized = vi.fn().mockResolvedValue(true)
    client.onUnauthorized = onUnauthorized

    const result = await client.get('/auth/me')

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(true)
  })

  it('does not retry unboundedly when the retried request 401s again', async () => {
    const { client, authStore } = await freshClient()
    authStore.persist('stale-token', 'refresh-1')

    const fetchMock = respondWith(401, { error: { message: 'expired' } })
    global.fetch = fetchMock as unknown as typeof fetch

    // A recovery that always claims success is the pathological case: the old
    // client re-entered request() with no attempt counter and recursed.
    const onUnauthorized = vi.fn().mockResolvedValue(true)
    client.onUnauthorized = onUnauthorized

    await expect(client.get('/collections/article')).rejects.toThrow()

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up without a retry when recovery fails', async () => {
    const { client, authStore } = await freshClient()
    authStore.persist('stale-token', 'refresh-1')

    const fetchMock = respondWith(401, { error: { message: 'expired' } })
    global.fetch = fetchMock as unknown as typeof fetch
    client.onUnauthorized = vi.fn().mockResolvedValue(false)

    await expect(client.get('/collections/article')).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never asks for recovery on the auth endpoints themselves', async () => {
    const { client, authStore } = await freshClient()
    authStore.persist('stale-token', 'refresh-1')

    const fetchMock = respondWith(401, { error: { message: 'expired' } })
    global.fetch = fetchMock as unknown as typeof fetch
    const onUnauthorized = vi.fn().mockResolvedValue(true)
    client.onUnauthorized = onUnauthorized

    await expect(
      client.post('/auth/refresh', { refreshToken: 'refresh-1' })
    ).rejects.toThrow()

    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

})

describe('a session that ended must stay ended', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('discards a refresh that resolves after clear()', async () => {
    const store = new AuthStore()
    let resolveRefresh: (value: any) => void = () => {}
    store.setRefresher(() => new Promise(resolve => { resolveRefresh = resolve }))
    store.persist('old-token', 'old-refresh')

    const pending = store.refresh()
    store.clear()
    resolveRefresh({ token: 'late-token', refreshToken: 'late-refresh' })
    await pending

    expect(store.getTokens().token).toBeNull()
    expect(store.getTokens().refreshToken).toBeNull()
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull()
  })

  it('does not let a late failure clear a newer session', async () => {
    const store = new AuthStore()
    let rejectRefresh: (reason?: unknown) => void = () => {}
    store.setRefresher(() => new Promise((_resolve, reject) => { rejectRefresh = reject }))
    store.persist('old-token', 'old-refresh')

    const pending = store.refresh()
    store.clear()
    store.persist('new-token', 'new-refresh')
    rejectRefresh(new Error('network'))
    await pending

    expect(store.getTokens().token).toBe('new-token')
  })
})
