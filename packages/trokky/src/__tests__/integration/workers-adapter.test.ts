/**
 * The edge integration is a pair of conversions around the route registry.
 * These pin the conversions, because everything else in the Workers path
 * assumes they are faithful: query and header shapes, body parsing per content
 * type, multipart producing web `File`s, and binary responses passing through
 * without being JSON-stringified.
 */
import { describe, it, expect } from 'vitest'
import { toHttpRequest, toResponse } from '../../integrations/workers/adapter.js'

describe('toHttpRequest', () => {
  it('strips the base path so route patterns match as they do behind Express', async () => {
    const req = await toHttpRequest(new Request('https://cms.example.com/api/collections/post'), '/api')
    expect(req.path).toBe('/collections/post')
    expect(req.url).toBe('https://cms.example.com/api/collections/post')
    expect(req.method).toBe('GET')
  })

  it('leaves the path alone when the base path does not match, and maps / to /', async () => {
    expect((await toHttpRequest(new Request('https://x.dev/health'), '/api')).path).toBe('/health')
    expect((await toHttpRequest(new Request('https://x.dev/api'), '/api')).path).toBe('/')
  })

  it('collapses single query values and keeps repeated ones as arrays', async () => {
    const req = await toHttpRequest(new Request('https://x.dev/api/c?limit=10&tag=a&tag=b'), '/api')
    expect(req.query.limit).toBe('10')
    expect(req.query.tag).toEqual(['a', 'b'])
  })

  it('lowercases headers the way the route layer expects', async () => {
    const req = await toHttpRequest(
      new Request('https://x.dev/api/c', { headers: { Authorization: 'Bearer t' } }),
      '/api'
    )
    expect(req.headers.authorization).toBe('Bearer t')
  })

  it('parses a JSON body, and treats an empty one as no body rather than an error', async () => {
    const withBody = await toHttpRequest(
      new Request('https://x.dev/api/c', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' }),
      '/api'
    )
    expect(withBody.body).toEqual({ a: 1 })

    const empty = await toHttpRequest(
      new Request('https://x.dev/api/c', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '' }),
      '/api'
    )
    expect(empty.body).toBeUndefined()
  })

  it('never reads a body for GET or HEAD', async () => {
    const req = await toHttpRequest(new Request('https://x.dev/api/c'), '/api')
    expect(req.body).toBeUndefined()
  })

  it('splits multipart into fields and web File objects', async () => {
    const form = new FormData()
    form.append('title', 'Hello')
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }))

    const req = await toHttpRequest(new Request('https://x.dev/api/media/upload', { method: 'POST', body: form }), '/api')
    expect(req.body).toEqual({ title: 'Hello' })
    expect(req.files).toHaveLength(1)
    expect(req.files?.[0]).toBeInstanceOf(File)
    expect(req.files?.[0].name).toBe('a.png')
    expect(await req.files?.[0].arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer)
  })

  it('parses urlencoded bodies', async () => {
    const req = await toHttpRequest(
      new Request('https://x.dev/api/c', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'a=1&b=two',
      }),
      '/api'
    )
    expect(req.body).toEqual({ a: '1', b: 'two' })
  })
})

describe('toResponse', () => {
  it('serialises objects as JSON and keeps the status and headers', async () => {
    const res = toResponse({ status: 201, headers: { 'x-trace': 'abc' }, body: { ok: true } })
    expect(res.status).toBe(201)
    expect(res.headers.get('x-trace')).toBe('abc')
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('passes binary through without JSON-stringifying it', async () => {
    const bytes = new Uint8Array([137, 80, 78, 71])
    const res = toResponse({ status: 200, headers: { 'content-type': 'image/png' }, body: bytes })
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes)
  })

  it('sends a bodyless response for null, not the string "null"', async () => {
    const res = toResponse({ status: 204, headers: {}, body: null })
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
  })

  it('does not override a content type the handler already set', async () => {
    const res = toResponse({ status: 200, headers: { 'content-type': 'text/html' }, body: '<p>hi</p>' })
    expect(res.headers.get('content-type')).toBe('text/html')
    expect(await res.text()).toBe('<p>hi</p>')
  })
})
