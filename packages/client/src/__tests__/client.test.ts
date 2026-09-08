import { describe, it, expect } from 'vitest'

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

describe('ShortcodeResolver', () => {
  it('should export parsing functions', async () => {
    const { parseShortcodeAttrs, resolveShortcodes } = await import('../shortcodes/parser.js')
    expect(typeof parseShortcodeAttrs).toBe('function')
    expect(typeof resolveShortcodes).toBe('function')
  })
})
