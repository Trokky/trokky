/**
 * Several sites, signed in through the device flow: an MCP client adds two real Trokky sites
 * the way an agent would, the person approves on each site (narrowing the access on one),
 * and content calls go to the right site with the right rights.
 */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { TrokkyCore } from '@trokky/trokky'
import { FilesystemDataAdapter } from '@trokky/trokky/adapters/filesystem-data'
import { FilesystemMediaAdapter } from '@trokky/trokky/adapters/filesystem-media'
import { createFetchHandler } from '@trokky/trokky/workers'
import { createTrokkyMcpServer } from '../server.js'
import { SiteStore } from '../sites.js'

const SCHEMAS = [{ name: 'posts', type: 'document', title: 'Posts', fields: { title: { type: 'string', required: true } } }]

interface Site {
  core: TrokkyCore
  handler: (request: Request) => Promise<Response>
  studioToken: string
}

interface ToolResult {
  isError?: boolean
  content: Array<{ type: string; text: string }>
}

let dir: string
const cores: TrokkyCore[] = []
let sites: Record<string, Site>
let store: SiteStore

async function makeSite(host: string): Promise<Site> {
  const root = path.join(dir, host)
  const core = new TrokkyCore(
    { storage: { adapter: 'filesystem-data', options: {} }, schemas: SCHEMAS } as never,
    {
      data: new FilesystemDataAdapter({
        contentDir: path.join(root, 'content'), usersDir: path.join(root, 'users'), tokensDir: path.join(root, 'tokens'),
        webhooksDir: path.join(root, 'webhooks'), authFlowStateDir: path.join(root, 'flow'),
        auditLogsDir: path.join(root, 'audit'), settingsDir: path.join(root, 'settings')
      }),
      media: new FilesystemMediaAdapter({ mediaDir: path.join(root, 'media') })
    },
    {
      jwtSecret: `secret-for-${host}-that-is-long-enough`,
      enableEvents: false,
      oauth2: { enabled: true, issuer: `http://${host}/api`, pollingInterval: 1 }
    } as never
  )
  await core.init()
  cores.push(core)
  const admin = await core.createUser({ username: 'editor', email: `editor@${host}`, password: 'TestPassword123!', role: 'admin' } as never)
  const handler = createFetchHandler({ core, basePath: '/api' })
  return { core, handler, studioToken: await core.generateAuthToken(admin) }
}

/** Routes each request to the site whose host it names, as the network would */
const network = (input: string, init?: RequestInit): Promise<Response> => {
  const site = sites[new URL(input).host]
  if (!site) return Promise.reject(new Error(`getaddrinfo ENOTFOUND ${new URL(input).host}`))
  return site.handler(new Request(input, init))
}

async function connect(readOnly = false): Promise<Client> {
  const server = createTrokkyMcpServer({ store, fetch: network, loginWaitMs: 3000, readOnly })
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

/** What the person does in the browser: open the link, untick what they will not grant, approve */
async function approveInBrowser(host: string, code: string, scopes?: string[], action = 'authorize'): Promise<void> {
  const response = await sites[host].handler(new Request(`http://${host}/api/auth/device/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sites[host].studioToken}` },
    body: JSON.stringify({ user_code: code, action, ...(scopes ? { scopes } : {}) })
  }))
  expect(response.status).toBe(200)
}

async function addSite(client: Client, host: string, access: string, scopes?: string[]): Promise<{ added: string; granted: string[] }> {
  const started = await callJson<{ name: string; code: string; openThisLink: string }>(client, 'add_site', { url: `http://${host}`, access })
  expect(started.openThisLink).toContain(started.code)
  await approveInBrowser(host, started.code, scopes)
  return callJson(client, 'finish_add_site', { name: started.name })
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'trokky-multisite-'))
  sites = { 'news.test:8080': await makeSite('news.test:8080'), 'docs.test:9090': await makeSite('docs.test:9090') }
  store = new SiteStore(path.join(dir, 'home', '.trokky', 'config.yaml'), network)
})

afterEach(async () => {
  for (const core of cores.splice(0)) await core.shutdown?.()
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 20 })
})

describe('several sites through the device flow', () => {
  it('adds two sites, keeps the narrowed access, and routes each call to its site', async () => {
    const client = await connect()
    expect((await call(client, 'list_documents', { collection: 'posts' })).content[0].text).toContain('No site is set up yet')

    const news = await addSite(client, 'news.test:8080', 'edit')
    expect(news.added).toBe('news-8080')
    expect(news.granted).toEqual(expect.arrayContaining(['content:write', 'offline_access']))

    // On the docs site the person unticks everything but reading
    const docs = await addSite(client, 'docs.test:9090', 'full', ['content:read', 'offline_access'])
    expect(docs.granted.sort()).toEqual(['content:read', 'offline_access'])

    const listed = await callJson<Array<{ name: string; default: boolean; signIn: string }>>(client, 'list_sites')
    expect(listed.map(s => [s.name, s.default])).toEqual([['news-8080', true], ['docs-9090', false]])
    expect(listed[0].signIn).toContain('AI agent')

    // The default site takes writes; the docs site holds read access only
    const created = await callJson<{ id: string }>(client, 'create_document', { collection: 'posts', data: { title: 'On news' } })
    expect(created.id).toBeTruthy()
    const refused = await call(client, 'create_document', { site: 'docs-9090', collection: 'posts', data: { title: 'No' } })
    expect(refused.isError).toBe(true)
    expect(refused.content[0].text).toContain('403')

    // Each site sees only its own content
    expect((await callJson<{ total: number }>(client, 'list_documents', { collection: 'posts' })).total).toBe(1)
    expect((await callJson<{ total: number }>(client, 'list_documents', { site: 'docs-9090', collection: 'posts' })).total).toBe(0)

    await callJson(client, 'set_default_site', { name: 'docs-9090' })
    expect((await callJson<{ total: number }>(client, 'list_documents', { collection: 'posts' })).total).toBe(0)

    // The tokens are the site's AI-agent client, and a CLI reading the same file sees both sites
    const saved = await store.list()
    expect(saved.sites['news-8080'].clientId).toBe('trokky-mcp')
    expect(saved.defaultSite).toBe('docs-9090')
  })

  it('renews an expired token and recovers from a rejected one', async () => {
    const client = await connect()
    await addSite(client, 'news.test:8080', 'edit')
    const before = await store.get('news-8080')
    // A token issued within the same second as the last one would be identical
    await new Promise(resolve => setTimeout(resolve, 1100))

    // Expired: renewed before the call
    await store.add('news-8080', { ...before!, tokenExpiresAt: new Date(Date.now() - 60_000).toISOString() }, true, true)
    expect((await call(client, 'list_documents', { collection: 'posts' })).isError).toBeFalsy()
    const renewed = await store.get('news-8080')
    expect(renewed?.token).not.toBe(before?.token)
    expect(Date.parse(renewed?.tokenExpiresAt ?? '')).toBeGreaterThan(Date.now())

    // Rejected while it looked valid: renewed once after the 401, and the call succeeds
    await store.add('news-8080', { ...renewed!, token: 'eyJ.not.valid' }, true, true)
    expect((await call(client, 'list_documents', { collection: 'posts' })).isError).toBeFalsy()
  })

  it('reports a pending, a denied and an unknown sign-in', async () => {
    const client = await connect()
    const started = await callJson<{ name: string; code: string }>(client, 'add_site', { url: 'http://news.test:8080' })
    const pending = await callJson<{ status: string }>(client, 'finish_add_site', { name: started.name })
    expect(pending.status).toBe('pending')

    await approveInBrowser('news.test:8080', started.code, undefined, 'deny')
    const denied = await call(client, 'finish_add_site', { name: started.name })
    expect(denied.isError).toBe(true)
    expect(denied.content[0].text).toContain('denied')
    expect(Object.keys((await store.list()).sites)).toEqual([])

    expect((await call(client, 'finish_add_site', { name: 'nothing' })).content[0].text).toContain('No sign-in in progress')
    expect((await call(client, 'add_site', { url: 'http://nowhere.test' })).content[0].text).toContain('ENOTFOUND')
  })

  it('asks only for read access when the server is read-only, whatever the agent requests', async () => {
    const client = await connect(true)
    const result = await addSite(client, 'news.test:8080', 'full')
    expect(result.granted.filter(scope => scope.endsWith(':write') || scope.endsWith(':delete') || scope.endsWith(':publish'))).toEqual([])
    expect(result.granted).toContain('content:read')
  })

  it('does not let a new sign-in take over an existing site', async () => {
    const client = await connect()
    // A site the person added with the CLI, the default
    await store.add('news-8080', { url: 'http://news.test:8080/api', token: 'real', authType: 'api-token' }, true)

    // An agent told to add another site under the same name is stopped before any link is made
    const hijack = await call(client, 'add_site', { url: 'http://docs.test:9090', name: 'news-8080' })
    expect(hijack.isError).toBe(true)
    expect(hijack.content[0].text).toContain('already exists')
    const disguised = await call(client, 'add_site', { url: 'http://docs.test:9090', name: 'news-8080', replace: true })
    expect(disguised.isError).toBe(true)
    expect((await store.get('news-8080'))?.url).toBe('http://news.test:8080/api')

    // Signing in again to the same site is allowed
    const started = await callJson<{ name: string; code: string; warning?: string }>(client, 'add_site', { url: 'http://news.test:8080', replace: true })
    expect(started.warning).toContain('plain http')
    await approveInBrowser('news.test:8080', started.code)
    await callJson(client, 'finish_add_site', { name: started.name })
    expect((await store.get('news-8080'))?.authType).toBe('oauth2')
  })

  it('forgets a site', async () => {
    const client = await connect()
    await addSite(client, 'news.test:8080', 'read')
    const saved = (await store.get('news-8080'))!
    const sent: Array<Record<string, unknown>> = []
    const site = sites['news.test:8080']
    const handler = site.handler
    site.handler = async (request: Request): Promise<Response> => {
      if (request.url.endsWith('/auth/revoke')) sent.push(await request.clone().json() as Record<string, unknown>)
      return handler(request)
    }
    expect(await callJson(client, 'remove_site', { name: 'news-8080' })).toEqual({ removed: 'news-8080', revokedOnSite: true })
    expect(await callJson(client, 'list_sites')).toEqual([])
    // The refresh token is what is revoked (it outlives the access token), under the MCP's own client
    expect(sent).toEqual([{ token: saved.refreshToken, client_id: 'trokky-mcp' }])
    // Revoked on the site as well: the approval is gone from its Studio, and the token is dead
    const probe = await handler(new Request('http://news.test:8080/api/collections/posts', { headers: { Authorization: `Bearer ${saved.token}` } }))
    expect(probe.status).toBe(401)
  })

  it('revokes the access token of a site signed in without a refresh token', async () => {
    const client = await connect()
    await addSite(client, 'news.test:8080', 'read')
    const saved = (await store.get('news-8080'))!
    await store.add('news-8080', { ...saved, refreshToken: undefined }, true, true)
    expect(await callJson(client, 'remove_site', { name: 'news-8080' })).toEqual({ removed: 'news-8080', revokedOnSite: true })
    const probe = await sites['news.test:8080'].handler(new Request('http://news.test:8080/api/collections/posts', { headers: { Authorization: `Bearer ${saved.token}` } }))
    expect(probe.status).toBe(401)
  })

  it('still forgets a site that cannot be reached or refuses the revocation', async () => {
    const client = await connect()
    const oauth = { token: 'access', refreshToken: 'refresh', authType: 'oauth2' as const, clientId: 'trokky-mcp' }
    await store.add('gone', { url: 'http://gone.test/api', ...oauth }, true)
    const gone = await callJson<{ revokedOnSite: boolean; note?: string }>(client, 'remove_site', { name: 'gone' })
    expect(gone.revokedOnSite).toBe(false)
    expect(gone.note).toContain('could not be reached')

    // A site from before revocation existed answers 404
    sites['old.test'] = { ...sites['news.test:8080'], handler: async (): Promise<Response> => new Response('Not found', { status: 404 }) }
    await store.add('old', { url: 'http://old.test/api', ...oauth }, true)
    const old = await callJson<{ revokedOnSite: boolean; note?: string }>(client, 'remove_site', { name: 'old' })
    expect(old.revokedOnSite).toBe(false)
    expect(old.note).toContain('HTTP 404')
    expect(Object.keys((await store.list()).sites)).toEqual([])
  })

  it('refuses an API path the shared config could not address', async () => {
    const client = await connect()
    const result = await call(client, 'add_site', { url: 'http://news.test:8080/cms-backend' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('"api" segment')
  })
})
