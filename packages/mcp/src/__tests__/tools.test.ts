/**
 * Tool behaviour against a scripted fetch: exact requests sent, and how each kind of
 * response (empty, huge, malformed, failing) comes back to the agent.
 */

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createTrokkyMcpServer, type TrokkyMcpOptions } from '../server.js'
import { MAX_RESULT_CHARS, resolveUploadPath } from '../tools.js'

interface Sent {
  url: string
  method: string
  body?: BodyInit | null
}

interface ToolResult {
  isError?: boolean
  content: Array<{ type: string; text: string }>
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

function reply(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

let sent: Sent[]
let respond: (request: Sent) => Response
let dir: string

async function connect(options: Partial<TrokkyMcpOptions> = {}): Promise<Client> {
  const server = createTrokkyMcpServer({
    apiUrl: 'http://cms.test/api',
    token: 'a'.repeat(64),
    fetch: async (url, init) => {
      const request = { url, method: init?.method ?? 'GET', body: init?.body }
      sent.push(request)
      return respond(request)
    },
    ...options
  })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'test', version: '1.0.0' })
  await client.connect(clientTransport)
  return client
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as ToolResult
}

async function callJson<T = Record<string, unknown>>(client: Client, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const result = await call(client, name, args)
  if (result.isError) throw new Error(`${name} failed: ${result.content[0]?.text}`)
  return JSON.parse(result.content[0].text) as T
}

beforeEach(async () => {
  sent = []
  respond = () => reply({ success: true, data: {} })
  dir = await mkdtemp(path.join(tmpdir(), 'trokky-mcp-tools-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('requests', () => {
  it('should send sort, expand, limit and offset, and leave out empty values', async () => {
    respond = () => reply({ success: true, data: { documents: [], pagination: { total: 0 } } })
    const client = await connect()
    await callJson(client, 'list_documents', { collection: 'posts', sort: '-title', expand: '*', limit: 5, offset: 10 })
    const url = new URL(sent[0].url)
    expect(url.pathname).toBe('/api/collections/posts')
    expect(Object.fromEntries(url.searchParams)).toEqual({ sort: '-title', expand: '*', limit: '5', offset: '10' })

    await callJson(client, 'list_documents', { collection: 'posts', sort: '' })
    expect(new URL(sent[1].url).searchParams.has('sort')).toBe(false)
  })

  it('should send expand on get_document', async () => {
    respond = () => reply({ success: true, data: { document: { id: 'p1' } } })
    const client = await connect()
    await callJson(client, 'get_document', { collection: 'posts', id: 'p1', expand: 'author' })
    expect(new URL(sent[0].url).searchParams.get('expand')).toBe('author')
  })

  it('should not double the slash when the API URL ends with one', async () => {
    respond = () => reply({ success: true, data: { collections: [] } })
    const client = await connect({ apiUrl: 'http://cms.test/api/' })
    await callJson(client, 'list_collections')
    expect(sent[0].url).toBe('http://cms.test/api/collections')
  })

  it('should refuse "." and ".." as a name or id before sending anything', async () => {
    const client = await connect()
    for (const args of [{ collection: '..', id: 'tokens' }, { collection: 'posts', id: '.' }, { collection: 'posts', id: '..' }]) {
      const result = await call(client, 'delete_document', args)
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Invalid name or id')
    }
    expect(sent).toHaveLength(0)
  })

  it('should send list_media paging and search limit', async () => {
    respond = () => reply({ success: true, data: [], meta: { total: 0 } })
    const client = await connect()
    await callJson(client, 'list_media', { limit: 3, offset: 6 })
    expect(Object.fromEntries(new URL(sent[0].url).searchParams)).toEqual({ limit: '3', offset: '6' })

    respond = () => reply({ success: true, data: { results: [], total: 0 } })
    await callJson(client, 'search', { query: 'budget', limit: 7 })
    expect(Object.fromEntries(new URL(sent[1].url).searchParams)).toEqual({ q: 'budget', limit: '7' })
  })
})

describe('responses', () => {
  it('should answer in compact JSON', async () => {
    respond = () => reply({ success: true, data: { document: { id: 'p1', nested: { a: 1 } } } })
    const client = await connect()
    expect((await call(client, 'get_document', { collection: 'posts', id: 'p1' })).content[0].text).toBe('{"id":"p1","nested":{"a":1}}')
  })

  it('should make one request at a time', async () => {
    let inFlight = 0
    let peak = 0
    const client = await connect({
      fetch: async url => {
        inFlight++
        peak = Math.max(peak, inFlight)
        await new Promise(resolve => setTimeout(resolve, 5))
        inFlight--
        return url.endsWith('/config/structure')
          ? reply({ success: true, data: { structure: { items: [] } } })
          : reply({ success: true, data: { collections: [] } })
      }
    })
    await callJson(client, 'list_collections')
    expect(peak).toBe(1)
  })

  it('should cope with malformed collections, media and search payloads', async () => {
    const client = await connect()
    respond = request => request.url.endsWith('/config/structure')
      ? reply({ success: true, data: {} })
      : reply({ success: true, data: { collections: 'nope' } })
    expect(await callJson(client, 'list_collections')).toEqual([])

    respond = () => reply({ success: true, data: [{ id: 42 }, { id: '..' }, null], meta: { total: 3, media: 'overwritten?' } })
    const listed = await callJson<{ media: Array<Record<string, unknown> | null>; total: number }>(client, 'list_media')
    expect(listed.total).toBe(3)
    expect(listed.media).toEqual([{ id: 42 }, { id: '..' }, null])

    respond = () => reply({ success: true, data: { total: 2, results: [null, { type: 'media', id: '..', title: 'x' }] } })
    const found = await callJson<{ results: unknown[] }>(client, 'search', { query: 'xx' })
    expect(found.results).toEqual([{ type: 'media', id: '..', title: 'x' }])
  })

  it('should encode a media id in its URL', async () => {
    respond = () => reply({ success: true, data: { file: { id: 'a b/c' } } })
    const client = await connect()
    expect((await callJson<{ url: string }>(client, 'get_media', { id: 'x' })).url).toBe('http://cms.test/api/media/a%20b%2Fc/file')
  })

  it('should fall back on page fullness for hasMore when the server gives no total', async () => {
    const client = await connect()
    respond = () => reply({ success: true, data: { documents: [{ id: 'a' }, { id: 'b' }] } })
    expect((await callJson<{ hasMore: boolean }>(client, 'list_documents', { collection: 'posts', limit: 2 })).hasMore).toBe(true)
    respond = () => reply({ success: true, data: { documents: [{ id: 'a' }] } })
    expect((await callJson<{ hasMore: boolean }>(client, 'list_documents', { collection: 'posts', limit: 2 })).hasMore).toBe(false)
  })

  it('should drop storage bookkeeping from documents', async () => {
    respond = () => reply({ success: true, data: { document: {
      id: 'p1', _id: 'p1', _collection: 'posts', _revision: 3, _status: 'draft', _createdAt: 't', _updatedAt: 't',
      _createdBy: 'u', _updatedBy: 'u', _createdByType: 'USER', _updatedByType: 'USER', title: 'Hi'
    } } })
    const client = await connect()
    expect(await callJson(client, 'get_document', { collection: 'posts', id: 'p1' }))
      .toEqual({ id: 'p1', _status: 'draft', _createdAt: 't', _updatedAt: 't', title: 'Hi' })
  })

  it('should pass media paging metadata through and add each file\'s URL', async () => {
    respond = () => reply({ success: true, data: [{ id: 'm1', filename: 'a.png' }], meta: { total: 9, hasMore: true } })
    const client = await connect()
    const listed = await callJson<{ media: Array<{ url: string }>; total: number; hasMore: boolean }>(client, 'list_media')
    expect(listed.total).toBe(9)
    expect(listed.hasMore).toBe(true)
    expect(listed.media[0].url).toBe('http://cms.test/api/media/m1/file')

    respond = () => reply({ success: true, data: { file: { id: 'm2' } } })
    expect((await callJson<{ url: string }>(client, 'get_media', { id: 'm2' })).url).toBe('http://cms.test/api/media/m2/file')
  })

  it('should strip Studio routes from search results and give media its file URL', async () => {
    respond = () => reply({ success: true, data: { total: 2, results: [
      { type: 'document', id: 'p1', collection: 'posts', title: 'Budget', url: '/content/posts/p1', excerpt: '', metadata: { matchedField: 'title' } },
      { type: 'media', id: 'm1', title: 'budget.pdf', url: '/media?file=m1', excerpt: '' }
    ] } })
    const client = await connect()
    const found = await callJson<{ total: number; results: Array<Record<string, unknown>> }>(client, 'search', { query: 'budget' })
    expect(found.total).toBe(2)
    expect(found.results[0]).toEqual({ type: 'document', id: 'p1', collection: 'posts', title: 'Budget', excerpt: '' })
    expect(found.results[1].url).toBe('http://cms.test/api/media/m1/file')
  })

  it('should report singleton ids from the structure and hide server-managed fields', async () => {
    respond = request => request.url.endsWith('/config/structure')
      ? reply({ success: true, data: { structure: { items: [{ type: 'group', items: [
        { schemaType: 'settings', documentId: 'site-settings' },
        { schemaType: 'settings', documentId: 'second-entry' }
      ] }] } } })
      : reply({ success: true, data: { collections: [
        { name: 'settings', type: 'singleton', fields: { siteName: { type: 'string' } } },
        { name: 'footer', singleton: true, fields: {} },
        { name: 'posts', type: 'document', fields: { title: { type: 'string', required: true }, _thumbnail: { type: 'media' } } }
      ] } })
    const client = await connect()
    const collections = await callJson<Array<Record<string, unknown>>>(client, 'list_collections')
    expect(collections.find(c => c.name === 'settings')).toMatchObject({ singleton: true, documentId: 'site-settings' })
    expect(collections.find(c => c.name === 'footer')).toMatchObject({ singleton: true, documentId: 'footer' })
    const posts = collections.find(c => c.name === 'posts')
    expect(posts?.singleton).toBeUndefined()
    expect(posts?.fields).toEqual({ title: 'string (required)' })
  })

  it('should still list collections when the structure cannot be read', async () => {
    respond = request => request.url.endsWith('/config/structure')
      ? reply({ success: false, error: { code: 'FORBIDDEN', message: 'no' } }, 403)
      : reply({ success: true, data: { collections: [{ name: 'settings', type: 'singleton', fields: {} }] } })
    const client = await connect()
    const collections = await callJson<Array<Record<string, unknown>>>(client, 'list_collections')
    expect(collections[0]).toMatchObject({ documentId: 'settings' })
  })

  it('should truncate an oversized result and say so', async () => {
    respond = () => reply({ success: true, data: { document: { id: 'big', body: 'x'.repeat(MAX_RESULT_CHARS * 2) } } })
    const client = await connect()
    const result = await call(client, 'get_document', { collection: 'posts', id: 'big' })
    expect(result.isError).toBeFalsy()
    expect(result.content[0].text.startsWith('{"id":"big","body":"xxx')).toBe(true)
    expect(result.content[0].text.length).toBeLessThan(MAX_RESULT_CHARS + 500)
    expect(result.content[0].text).toContain('[Truncated')
  })

  it('should return null rather than break when the server sends no data', async () => {
    respond = () => reply({ success: true })
    const client = await connect()
    const result = await call(client, 'get_document', { collection: 'posts', id: 'p1' })
    expect(result.isError).toBeFalsy()
    expect(result.content[0].text).toBe('null')
  })

  it('should treat a 204 as success', async () => {
    respond = () => new Response(null, { status: 204 })
    const client = await connect()
    expect(await callJson(client, 'delete_document', { collection: 'posts', id: 'p1' }))
      .toEqual({ deleted: true, collection: 'posts', id: 'p1' })
  })
})

describe('errors', () => {
  it('should add a hint for each status an agent can act on', async () => {
    const client = await connect()
    const cases: Array<[number, string]> = [
      [400, 'get_schema'], [401, 'rejected'], [403, 'lacks the permission'], [404, 'list_documents show'], [429, 'Wait']
    ]
    for (const [status, hint] of cases) {
      respond = () => reply({ success: false, error: { code: 'X', message: 'm' } }, status)
      const result = await call(client, 'list_collections')
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain(hint)
    }
  })

  it('should include the server\'s error details', async () => {
    respond = () => reply({ success: false, error: { code: 'VALIDATION_ERROR', message: 'bad', details: [{ field: 'title' }] } }, 400)
    const client = await connect()
    expect((await call(client, 'list_collections')).content[0].text).toContain('Details: [{"field":"title"}]')
  })

  it('should treat success:false as a failure even with status 200', async () => {
    respond = () => reply({ success: false, error: { code: 'NOPE', message: 'refused' } })
    const client = await connect()
    const result = await call(client, 'list_collections')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('NOPE')
  })

  it('should say when the server did not answer in JSON', async () => {
    respond = () => new Response('<html>Bad gateway</html>', { status: 502 })
    const client = await connect()
    expect((await call(client, 'list_collections')).content[0].text).toContain('Expected JSON from GET /collections, got status 502')
  })

  it('should wrap a network failure', async () => {
    respond = () => { throw new Error('getaddrinfo ENOTFOUND cms.test') }
    const client = await connect()
    const text = (await call(client, 'list_collections')).content[0].text
    expect(text).toContain('NETWORK_ERROR')
    expect(text).toContain('Could not reach http://cms.test/api')
  })
})

describe('upload_media', () => {
  let uploads: string

  beforeEach(async () => {
    uploads = path.join(dir, 'uploads')
    await mkdir(uploads)
    respond = () => reply({ success: true, data: { files: [{ id: 'm1' }] } }, 201)
  })

  function uploadedFile(): File {
    return (sent[0].body as FormData).get('file') as File
  }

  it('should take the type from the file, whatever its case', async () => {
    await writeFile(path.join(uploads, 'photo.JPG'), PNG)
    const client = await connect({ uploadRoots: [uploads] })
    const uploaded = await callJson<{ id: string; url: string }>(client, 'upload_media', { path: 'photo.JPG' })
    expect(uploadedFile().type).toBe('image/jpeg')
    expect(uploadedFile().name).toBe('photo.JPG')
    expect(uploaded.url).toBe('http://cms.test/api/media/m1/file')
  })

  it('should store the file under a new name that keeps its extension', async () => {
    await writeFile(path.join(uploads, 'IMG_0001.png'), PNG)
    const client = await connect({ uploadRoots: [uploads] })
    await callJson(client, 'upload_media', { path: 'IMG_0001.png', filename: 'team-photo.png' })
    expect(uploadedFile().name).toBe('team-photo.png')
    expect(uploadedFile().type).toBe('image/png')
  })

  it('should refuse a rename that changes the type', async () => {
    await writeFile(path.join(uploads, '.env'), 'SECRET=1')
    await writeFile(path.join(uploads, 'pixel.png'), PNG)
    const client = await connect({ uploadRoots: [uploads] })
    const disguised = await call(client, 'upload_media', { path: '.env', filename: 'notes.txt' })
    expect(disguised.isError).toBe(true)
    expect(disguised.content[0].text).toContain('Unsupported file type')
    const renamed = await call(client, 'upload_media', { path: 'pixel.png', filename: 'pixel.txt' })
    expect(renamed.isError).toBe(true)
    expect(renamed.content[0].text).toContain('keep the file\'s extension')
    expect(sent).toHaveLength(0)
  })

  it('should refuse SVG, which can carry script', async () => {
    await writeFile(path.join(uploads, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    const client = await connect({ uploadRoots: [uploads] })
    const result = await call(client, 'upload_media', { path: 'logo.svg' })
    expect(result.isError).toBe(true)
    expect(sent).toHaveLength(0)
  })

  it('should refuse a directory', async () => {
    await mkdir(path.join(uploads, 'album.png'))
    const client = await connect({ uploadRoots: [uploads] })
    const result = await call(client, 'upload_media', { path: 'album.png' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Not a file')
  })

  it('should accept a file exactly at the size limit and refuse one byte over', async () => {
    await writeFile(path.join(uploads, 'pixel.png'), PNG)
    const atLimit = await connect({ uploadRoots: [uploads], maxUploadBytes: PNG.length })
    expect((await call(atLimit, 'upload_media', { path: 'pixel.png' })).isError).toBeFalsy()
    const underLimit = await connect({ uploadRoots: [uploads], maxUploadBytes: PNG.length - 1 })
    expect((await call(underLimit, 'upload_media', { path: 'pixel.png' })).isError).toBe(true)
  })

  it('should refuse to resolve anything when no root is configured', async () => {
    await expect(resolveUploadPath('x.png', [])).rejects.toThrow('Uploads are disabled')
  })
})

describe('annotations', () => {
  it('should mark publishing, updating and deleting destructive, and creating and uploading not', async () => {
    const client = await connect({ uploadRoots: [dir] })
    const hints = Object.fromEntries((await client.listTools()).tools.map(tool => [tool.name, tool.annotations?.destructiveHint]))
    expect(hints).toMatchObject({
      set_status: true, update_document: true, delete_document: true, create_document: false, upload_media: false
    })
  })

  it('should tell the agent how media and reference values look', async () => {
    const client = await connect()
    const create = (await client.listTools()).tools.find(tool => tool.name === 'create_document')
    const schema = JSON.stringify(create?.inputSchema)
    expect(schema).toContain('mediaAsset')
    expect(schema).toContain('_ref')
    expect(client.getInstructions()).toContain('mediaAsset')
  })
})
