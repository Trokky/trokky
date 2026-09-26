/**
 * End to end: an MCP client talks to the Trokky MCP server, which talks to a real
 * Trokky core through the fetch handler. Nothing is mocked but the network.
 */

import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { TrokkyCore } from '@trokky/trokky'
import { FilesystemDataAdapter } from '@trokky/trokky/adapters/filesystem-data'
import { FilesystemMediaAdapter } from '@trokky/trokky/adapters/filesystem-media'
import { createFetchHandler } from '@trokky/trokky/workers'
import { createTrokkyMcpServer, type TrokkyMcpOptions } from '../server.js'

const SCHEMAS = [
  {
    name: 'posts',
    type: 'document',
    title: 'Posts',
    fields: {
      title: { type: 'string', required: true },
      body: { type: 'string' },
      category: { type: 'string' }
    }
  }
]

// Smallest valid PNG: 1x1 transparent pixel
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

interface ToolResult {
  isError?: boolean
  content: Array<{ type: string; text: string }>
}

let dir: string
let core: TrokkyCore
let fetchImpl: NonNullable<TrokkyMcpOptions['fetch']>
let uploads: string

async function token(permissions: string[]): Promise<string> {
  const result = await core.createAppToken({ name: permissions.join(' '), permissions } as never, 'system')
  if (!result.token) throw new Error(result.error ?? 'token creation failed')
  return result.token
}

async function connect(options: Partial<TrokkyMcpOptions> & { token: string }): Promise<Client> {
  const server = createTrokkyMcpServer({ apiUrl: 'http://cms.test/api', fetch: fetchImpl, ...options })
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
  dir = await mkdtemp(path.join(tmpdir(), 'trokky-mcp-'))
  uploads = path.join(dir, 'uploads')
  await mkdir(uploads)
  core = new TrokkyCore(
    { storage: { adapter: 'filesystem-data', options: {} }, schemas: SCHEMAS } as never,
    {
      data: new FilesystemDataAdapter({
        contentDir: path.join(dir, 'content'),
        usersDir: path.join(dir, 'users'),
        tokensDir: path.join(dir, 'tokens'),
        webhooksDir: path.join(dir, 'webhooks'),
        authFlowStateDir: path.join(dir, 'auth-flow-state'),
        auditLogsDir: path.join(dir, 'audit-logs'),
        settingsDir: path.join(dir, 'settings')
      }),
      media: new FilesystemMediaAdapter({ mediaDir: path.join(dir, 'media') })
    },
    { jwtSecret: 'test-secret-that-is-long-enough-for-hs256', enableEvents: false }
  )
  await core.init()
  const handler = createFetchHandler({ core, basePath: '/api', authentication: { enabled: true, publicPaths: [] } })
  fetchImpl = (input, init) => handler(new Request(input, init))
})

afterEach(async () => {
  await core.shutdown?.()
  // Audit entries are written after the response, so the directory can still be filling
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 20 })
})

describe('tool set', () => {
  it('should offer every tool in read-write mode with uploads configured', async () => {
    const client = await connect({ token: await token(['content:read']), uploadRoots: [uploads] })
    const names = (await client.listTools()).tools.map(tool => tool.name).sort()
    expect(names).toEqual([
      'create_document', 'delete_document', 'get_document', 'get_media', 'get_schema',
      'list_collections', 'list_documents', 'list_media', 'search', 'set_status',
      'update_document', 'upload_media'
    ])
  })

  it('should offer only reading tools in read-only mode', async () => {
    const client = await connect({ token: await token(['content:read']), readOnly: true, uploadRoots: [uploads] })
    const tools = (await client.listTools()).tools
    expect(tools.map(tool => tool.name).sort()).toEqual([
      'get_document', 'get_media', 'get_schema', 'list_collections', 'list_documents', 'list_media', 'search'
    ])
    expect(tools.every(tool => tool.annotations?.readOnlyHint === true)).toBe(true)
  })

  it('should not offer upload_media when no upload directory is configured', async () => {
    const client = await connect({ token: await token(['content:read']) })
    const names = (await client.listTools()).tools.map(tool => tool.name)
    expect(names).not.toContain('upload_media')
    expect(names).toContain('create_document')
  })

  it('should mark delete_document destructive', async () => {
    const client = await connect({ token: await token(['content:read']) })
    const del = (await client.listTools()).tools.find(tool => tool.name === 'delete_document')
    expect(del?.annotations?.destructiveHint).toBe(true)
  })
})

describe('content workflow', () => {
  it('should describe collections with their fields', async () => {
    const client = await connect({ token: await token(['content:read']) })
    const collections = await callJson<Array<{ name: string; fields: Record<string, string> }>>(client, 'list_collections')
    const posts = collections.find(c => c.name === 'posts')
    expect(posts?.fields).toMatchObject({ title: 'string (required)', body: 'string', category: 'string' })

    const schema = await callJson<{ name: string; fields: Record<string, unknown> }>(client, 'get_schema', { collection: 'posts' })
    expect(schema.name).toBe('posts')
    expect(Object.keys(schema.fields)).toEqual(expect.arrayContaining(['title', 'body', 'category']))
  })

  it('should create a draft, update it, publish it, find it by filter and delete it', async () => {
    const client = await connect({ token: await token(['content:*']) })

    const created = await callJson<{ id: string; _status: string; title: string }>(client, 'create_document', {
      collection: 'posts', data: { title: 'Hello', body: 'First', category: 'news' }
    })
    const id = created.id
    expect(created._status).toBe('draft')

    await callJson(client, 'update_document', { collection: 'posts', id, data: { body: 'Edited' } })
    const fetched = await callJson<Record<string, unknown>>(client, 'get_document', { collection: 'posts', id })
    expect(fetched).toMatchObject({ body: 'Edited', title: 'Hello', category: 'news' })

    const draftsOnly = await callJson<{ documents: unknown[] }>(client, 'list_documents', {
      collection: 'posts', filter: { _status: 'published' }
    })
    expect(draftsOnly.documents).toHaveLength(0)

    await callJson(client, 'set_status', { collection: 'posts', id, status: 'published' })
    const published = await callJson<{ documents: Array<{ id: string }>; total: number; hasMore: boolean }>(client, 'list_documents', {
      collection: 'posts', filter: { _status: 'published', category: 'news' }
    })
    expect(published.documents.map(d => d.id)).toEqual([id])
    expect(published.total).toBe(1)
    expect(published.hasMore).toBe(false)

    const deleted = await callJson<{ deleted: boolean }>(client, 'delete_document', { collection: 'posts', id })
    expect(deleted.deleted).toBe(true)
    const gone = await call(client, 'get_document', { collection: 'posts', id })
    expect(gone.isError).toBe(true)
    expect(gone.content[0].text).toContain('404')
  })

  it('should create a document already published when asked', async () => {
    const client = await connect({ token: await token(['content:*']) })
    const created = await callJson<{ _status: string }>(client, 'create_document', {
      collection: 'posts', data: { title: 'Live' }, status: 'published'
    })
    expect(created._status).toBe('published')
  })

  it('should not let update_document change the status', async () => {
    const client = await connect({ token: await token(['content:*']) })
    const document = await callJson<{ id: string }>(client, 'create_document', { collection: 'posts', data: { title: 'Draft' } })
    await callJson(client, 'update_document', { collection: 'posts', id: document.id, data: { _status: 'published', title: 'Still draft' } })
    const fetched = await callJson<Record<string, unknown>>(client, 'get_document', { collection: 'posts', id: document.id })
    expect(fetched).toMatchObject({ _status: 'draft', title: 'Still draft' })
  })

  it('should page through documents', async () => {
    const client = await connect({ token: await token(['content:*']) })
    for (const title of ['a', 'b', 'c']) {
      await callJson(client, 'create_document', { collection: 'posts', data: { title } })
    }
    const first = await callJson<{ documents: unknown[]; hasMore: boolean; total: number }>(client, 'list_documents', { collection: 'posts', limit: 2 })
    expect(first.documents).toHaveLength(2)
    expect(first.total).toBe(3)
    expect(first.hasMore).toBe(true)
    const second = await callJson<{ documents: unknown[]; hasMore: boolean }>(client, 'list_documents', { collection: 'posts', limit: 2, offset: 2 })
    expect(second.documents).toHaveLength(1)
    expect(second.hasMore).toBe(false)
  })

  it('should search across collections', async () => {
    const client = await connect({ token: await token(['content:*']) })
    await callJson(client, 'create_document', { collection: 'posts', data: { title: 'Budget report 2026' } })
    const results = JSON.stringify(await callJson(client, 'search', { query: 'budget' }))
    expect(results).toContain('Budget report 2026')
  })

  it('should reject a validation failure with the server\'s details', async () => {
    const client = await connect({ token: await token(['content:*']) })
    const result = await call(client, 'create_document', { collection: 'posts', data: { body: 'no title' } })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('400')
  })
})

describe('singletons', () => {
  it('should report the id the structure gives a singleton, and read and write it there', async () => {
    const singletonCore = new TrokkyCore(
      { storage: { adapter: 'filesystem-data', options: {} }, schemas: [
        ...SCHEMAS,
        { name: 'settings', type: 'singleton', singleton: true, title: 'Settings', fields: { siteName: { type: 'string' } } }
      ] } as never,
      {
        data: new FilesystemDataAdapter({
          contentDir: path.join(dir, 's-content'), usersDir: path.join(dir, 's-users'), tokensDir: path.join(dir, 's-tokens'),
          webhooksDir: path.join(dir, 's-webhooks'), authFlowStateDir: path.join(dir, 's-flow'),
          auditLogsDir: path.join(dir, 's-audit'), settingsDir: path.join(dir, 's-settings')
        }),
        media: new FilesystemMediaAdapter({ mediaDir: path.join(dir, 's-media') })
      },
      { jwtSecret: 'test-secret-that-is-long-enough-for-hs256', enableEvents: false }
    )
    await singletonCore.init()
    const handler = createFetchHandler({
      core: singletonCore,
      basePath: '/api',
      authentication: { enabled: true, publicPaths: [] },
      structureConfig: { items: [{ type: 'singleton', schemaType: 'settings', documentId: 'site-settings' }] }
    })
    const created = await singletonCore.createAppToken({ name: 's', permissions: ['content:*'] } as never, 'system')
    const client = await connect({ token: created.token as string, fetch: (input, init) => handler(new Request(input, init)) })

    const collections = await callJson<Array<{ name: string; documentId?: string }>>(client, 'list_collections')
    const settings = collections.find(c => c.name === 'settings')
    expect(settings?.documentId).toBe('site-settings')

    await callJson(client, 'update_document', { collection: 'settings', id: 'site-settings', data: { siteName: 'Trokky' } })
    const read = await callJson<{ id: string; siteName: string }>(client, 'get_document', { collection: 'settings', id: 'site-settings' })
    expect(read).toMatchObject({ id: 'site-settings', siteName: 'Trokky' })
    const all = await callJson<{ documents: unknown[] }>(client, 'list_documents', { collection: 'settings' })
    expect(all.documents).toHaveLength(1)
    await singletonCore.shutdown?.()
  })
})

describe('permissions and errors', () => {
  it('should report a 403 as a missing permission, not a transient failure', async () => {
    const client = await connect({ token: await token(['content:read']) })
    const result = await call(client, 'create_document', { collection: 'posts', data: { title: 'Nope' } })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('403')
    expect(result.content[0].text).toContain('lacks the permission')
  })

  it('should report a rejected token', async () => {
    const client = await connect({ token: 'f'.repeat(64) })
    const result = await call(client, 'list_collections')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('401')
  })

  it('should report an unreachable server', async () => {
    const client = await connect({
      token: await token(['content:read']),
      fetch: () => Promise.reject(new Error('connect ECONNREFUSED'))
    })
    const result = await call(client, 'list_collections')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('ECONNREFUSED')
  })

  it('should report a non-JSON response', async () => {
    const client = await connect({
      token: await token(['content:read']),
      fetch: () => Promise.resolve(new Response('<html>Bad gateway</html>', { status: 502 }))
    })
    const result = await call(client, 'list_collections')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('502')
  })

  it('should encode path segments so an id cannot reach another route', async () => {
    const seen: string[] = []
    const client = await connect({
      token: await token(['content:read']),
      fetch: (input, init) => { seen.push(input); return fetchImpl(input, init) }
    })
    await call(client, 'get_document', { collection: 'posts', id: '../../users' })
    expect(seen[0]).toBe('http://cms.test/api/collections/posts/..%2F..%2Fusers')
  })
})

describe('media', () => {
  it('should upload a file from an upload directory and list it', async () => {
    await writeFile(path.join(uploads, 'pixel.png'), PNG)
    const client = await connect({ token: await token(['media:read', 'media:upload']), uploadRoots: [uploads] })
    const uploaded = await callJson<{ id: string }>(client, 'upload_media', { path: 'pixel.png' })
    expect(uploaded.id).toBeTruthy()

    const listed = await callJson<{ media: Array<{ id: string }> }>(client, 'list_media')
    expect(listed.media.map(m => m.id)).toContain(uploaded.id)
    const one = await callJson<{ id: string }>(client, 'get_media', { id: uploaded.id })
    expect(one.id).toBe(uploaded.id)
  })

  it('should refuse a path outside the upload directories', async () => {
    await writeFile(path.join(dir, 'secret.png'), PNG)
    const client = await connect({ token: await token(['media:upload']), uploadRoots: [uploads] })
    for (const attempt of ['../secret.png', path.join(dir, 'secret.png')]) {
      const result = await call(client, 'upload_media', { path: attempt })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('outside the allowed upload directories')
    }
  })

  it('should refuse a symlink that leads out of an upload directory', async () => {
    await writeFile(path.join(dir, 'secret.png'), PNG)
    await symlink(path.join(dir, 'secret.png'), path.join(uploads, 'link.png'))
    const client = await connect({ token: await token(['media:upload']), uploadRoots: [uploads] })
    const result = await call(client, 'upload_media', { path: 'link.png' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('outside the allowed upload directories')
  })

  it('should refuse a sibling directory that shares the root\'s prefix', async () => {
    const sibling = `${uploads}-evil`
    await mkdir(sibling)
    await writeFile(path.join(sibling, 'x.png'), PNG)
    const client = await connect({ token: await token(['media:upload']), uploadRoots: [uploads] })
    const result = await call(client, 'upload_media', { path: path.join(sibling, 'x.png') })
    expect(result.isError).toBe(true)
  })

  it('should refuse a file type the server would reject, before reading it', async () => {
    await writeFile(path.join(uploads, 'run.sh'), 'echo hi')
    const client = await connect({ token: await token(['media:upload']), uploadRoots: [uploads] })
    const result = await call(client, 'upload_media', { path: 'run.sh' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Unsupported file type')
  })

  it('should refuse a file over the size limit', async () => {
    await writeFile(path.join(uploads, 'pixel.png'), PNG)
    const client = await connect({ token: await token(['media:upload']), uploadRoots: [uploads], maxUploadBytes: 10 })
    const result = await call(client, 'upload_media', { path: 'pixel.png' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('limit')
  })
})
