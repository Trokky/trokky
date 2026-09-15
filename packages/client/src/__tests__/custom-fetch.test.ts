/**
 * A caller can supply the fetch the client uses. The reason is in-process rendering: a Worker
 * that serves Trokky can hand the client its own fetch handler, and an Astro page then reads
 * content without a network round trip or a subrequest. Pinned: the supplied fetch is what
 * gets called, with the URL and auth header the client would have sent over the wire, and the
 * global fetch is never touched.
 */
import { describe, it, expect, vi } from 'vitest'
import { HttpClient } from '../http/client.js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('ClientConfig.fetch', () => {
  it('routes every request through the supplied fetch, never the global one', async () => {
    const globalSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('global fetch must not be used'))
    const custom = vi.fn(async () => json({ success: true, data: { ok: true } }))
    const client = new HttpClient({ baseUrl: 'https://cms.example.org/api', apiToken: 'tok_1', fetch: custom })

    const result = await client.get<{ ok: boolean }>('/health')

    expect(result).toMatchObject({ ok: true })
    expect(globalSpy).not.toHaveBeenCalled()
    expect(custom).toHaveBeenCalledTimes(1)
    const [url, init] = custom.mock.calls[0] as unknown as [string, RequestInit]
    expect(String(url)).toBe('https://cms.example.org/api/health')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok_1')
    globalSpy.mockRestore()
  })

  it('accepts a Worker fetch handler as-is, which takes a Request rather than a URL', async () => {
    // The shape a Trokky Worker exports: (request: Request) => Promise<Response>.
    const handler = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init)
      return json({ success: true, data: { path: new URL(request.url).pathname, method: request.method } })
    })
    const client = new HttpClient({ baseUrl: 'https://worker.internal/api', fetch: handler as unknown as typeof fetch })

    const result = await client.get<{ path: string; method: string }>('/collections/articles')

    expect(result).toMatchObject({ path: '/api/collections/articles', method: 'GET' })
  })

  it('falls back to the global fetch when none is supplied', async () => {
    const globalSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ success: true, data: { ok: true } }))
    const client = new HttpClient({ baseUrl: 'https://cms.example.org/api' })

    await client.get('/health')

    expect(globalSpy).toHaveBeenCalledTimes(1)
    globalSpy.mockRestore()
  })
})
