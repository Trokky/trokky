import { describe, it, expect, vi, afterEach } from 'vitest'

// QueryBuilder needs an HttpClient and CacheManager; the chaining tests never touch them.
const mockHttp = {} as never
const mockCache = {} as never

describe('Client exports', () => {
  it('should export TrokkyClient', async () => {
    const mod = await import('../index.js')
    expect(mod.TrokkyClient).toBeDefined()
  })

  it('should export HttpClient', async () => {
    const mod = await import('../index.js')
    expect(mod.HttpClient).toBeDefined()
  })

  it('should export QueryBuilder', async () => {
    const mod = await import('../index.js')
    expect(mod.QueryBuilder).toBeDefined()
  })

  it('should export MediaHelper', async () => {
    const mod = await import('../index.js')
    expect(mod.MediaHelper).toBeDefined()
  })

  it('should export CacheManager', async () => {
    const mod = await import('../index.js')
    expect(mod.CacheManager).toBeDefined()
  })

  it('should export ShortcodeResolver', async () => {
    const mod = await import('../index.js')
    expect(mod.ShortcodeResolver).toBeDefined()
  })

  it('should export DocumentClient', async () => {
    const mod = await import('../index.js')
    expect(mod.DocumentClient).toBeDefined()
  })
})

describe('QueryBuilder', () => {
  it('should create a query builder with collection', async () => {
    const { QueryBuilder } = await import('../query/builder.js')
    const qb = new QueryBuilder(mockHttp, mockCache, 'article')
    expect(qb).toBeDefined()
  })

  it('should support chainable filter (where)', async () => {
    const { QueryBuilder } = await import('../query/builder.js')
    const qb = new QueryBuilder(mockHttp, mockCache, 'article')
      .where('status', 'published')
    expect(qb).toBeDefined()
  })

  it('should support chainable limit', async () => {
    const { QueryBuilder } = await import('../query/builder.js')
    const qb = new QueryBuilder(mockHttp, mockCache, 'article').limit(10)
    expect(qb).toBeDefined()
  })

  it('should support chainable offset', async () => {
    const { QueryBuilder } = await import('../query/builder.js')
    const qb = new QueryBuilder(mockHttp, mockCache, 'article').offset(20)
    expect(qb).toBeDefined()
  })

  it('should support chainable sort', async () => {
    const { QueryBuilder } = await import('../query/builder.js')
    const qb = new QueryBuilder(mockHttp, mockCache, 'article').sort({ createdAt: 'desc' })
    expect(qb).toBeDefined()
  })

  it('should support published() filter', async () => {
    const { QueryBuilder } = await import('../query/builder.js')
    const qb = new QueryBuilder(mockHttp, mockCache, 'article').published()
    expect(qb).toBeDefined()
  })

  it('should support draft() filter', async () => {
    const { QueryBuilder } = await import('../query/builder.js')
    const qb = new QueryBuilder(mockHttp, mockCache, 'article').draft()
    expect(qb).toBeDefined()
  })

  it('should support search', async () => {
    const { QueryBuilder } = await import('../query/builder.js')
    const qb = new QueryBuilder(mockHttp, mockCache, 'article').search('keyword')
    expect(qb).toBeDefined()
  })

  it('should support full chain', async () => {
    const { QueryBuilder } = await import('../query/builder.js')
    const qb = new QueryBuilder(mockHttp, mockCache, 'article')
      .published()
      .where('category', 'tech')
      .sort({ createdAt: 'desc' })
      .limit(10)
      .offset(0)
    expect(qb).toBeDefined()
  })
})

describe('CacheManager', () => {
  it('should create instance', async () => {
    const { CacheManager } = await import('../cache/manager.js')
    const cache = new CacheManager()
    expect(cache).toBeDefined()
  })

  it('should set and get values', async () => {
    const { CacheManager } = await import('../cache/manager.js')
    const cache = new CacheManager()
    cache.set('key1', { data: 'test' })
    const result = cache.get('key1')
    expect(result).toEqual({ data: 'test' })
  })

  it('should return null for missing keys', async () => {
    const { CacheManager } = await import('../cache/manager.js')
    const cache = new CacheManager()
    const result = cache.get('missing')
    // May return null or undefined
    expect(result == null).toBe(true)
  })

  it('should clear cache', async () => {
    const { CacheManager } = await import('../cache/manager.js')
    const cache = new CacheManager()
    cache.set('a', 1)
    cache.clear()
    expect(cache.get('a') == null).toBe(true)
  })
})

describe('HttpClient', () => {
  it('should create with base URL', async () => {
    const { HttpClient } = await import('../http/client.js')
    const client = new HttpClient({ baseUrl: 'http://localhost:3000/api' })
    expect(client).toBeDefined()
  })

  it('should support auth token', async () => {
    const { HttpClient } = await import('../http/client.js')
    const client = new HttpClient({
      baseUrl: 'http://localhost:3000/api',
      token: 'test-token',
    })
    expect(client).toBeDefined()
  })
})

describe('HttpClient 401 handling', () => {
  const jsonResponse = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    headers: { get: () => 'application/json' },
    json: async () => body,
  })

  const signedIn = async () => {
    const { HttpClient } = await import('../http/client.js')
    return new HttpClient({
      baseUrl: 'http://localhost:3000/api',
      token: 'access-1',
      refreshToken: 'refresh-1',
      retries: 3,
    })
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should not refresh or clear tokens when /auth/login returns 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } })
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = await signedIn()

    await expect(
      client.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'someone', password: 'wrong' }),
      })
    ).rejects.toMatchObject({ status: 401 })

    // One call only: the login itself. No /auth/refresh round trip.
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes('/auth/refresh'))).toBe(true)
    // A wrong password must not wipe the caller's existing session.
    expect(client.getTokens()).toMatchObject({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
    })
  })

  it('should not recurse when /auth/refresh itself returns 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' } })
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = await signedIn()

    await expect(client.refreshAuth()).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('should still refresh once and retry when an ordinary endpoint returns 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired authentication token' } })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: 'access-2', refreshToken: 'refresh-2' })
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: { id: 'a1' } }))
    vi.stubGlobal('fetch', fetchMock)

    const client = await signedIn()

    const result = await client.request('/collections/article/a1')

    expect(result).toMatchObject({ id: 'a1' })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/auth/refresh')
    expect(client.getTokens()).toMatchObject({ accessToken: 'access-2' })
  })
})

describe('ShortcodeResolver', () => {
  it('should export parsing functions', async () => {
    const { parseShortcodeAttrs, resolveShortcodes } = await import('../shortcodes/parser.js')
    expect(typeof parseShortcodeAttrs).toBe('function')
    expect(typeof resolveShortcodes).toBe('function')
  })
})
