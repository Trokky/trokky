/**
 * Several sites, signed in through the device flow: an MCP client adds two real Trokky sites
 * the way an agent would, the person approves on each site (narrowing the access on one),
 * and content calls go to the right site with the right rights.
 */

import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { TrokkyCore } from '@trokky/trokky'
import { FilesystemDataAdapter } from '@trokky/trokky/adapters/filesystem-data'
import { FilesystemMediaAdapter } from '@trokky/trokky/adapters/filesystem-media'
import { createFetchHandler } from '@trokky/trokky/workers'
import { MAX_FINISH_WAIT_MS, createTrokkyMcpServer, finishWaitMs } from '../server.js'
import { signInsPath } from '../signins.js'
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

async function makeSite(host: string, deviceCodeTtl?: number): Promise<Site> {
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
      oauth2: { enabled: true, issuer: `http://${host}/api`, pollingInterval: 1, ...(deviceCodeTtl ? { deviceCodeTtl } : {}) }
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

/** A server whose sign-in polls wait a few milliseconds instead of the site's interval, recording what they were asked to wait */
async function connectFast(options: { loginWaitMs?: number; fetch?: typeof network } = {}): Promise<{ client: Client; close: () => Promise<void>; waits: number[] }> {
  const waits: number[] = []
  const server = createTrokkyMcpServer({
    store,
    fetch: options.fetch ?? network,
    loginWaitMs: options.loginWaitMs ?? 3000,
    signInPollSleep: ms => { waits.push(ms); return new Promise(resolve => setTimeout(resolve, 20)) }
  })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'test', version: '1.0.0' })
  await client.connect(clientTransport)
  return { client, close: () => server.close(), waits }
}

async function connect(readOnly = false, clientName = 'test'): Promise<Client> {
  const server = createTrokkyMcpServer({ store, fetch: network, loginWaitMs: 3000, readOnly })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: clientName, version: '1.0.0' })
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

async function addSite(client: Client, host: string, access: string, scopes?: string[]): Promise<{ status: string; name: string; url: string; granted: string[] }> {
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
    expect(news).toMatchObject({ status: 'added', name: 'news-8080', url: 'http://news.test:8080/api' })
    expect(news.granted).toEqual(expect.arrayContaining(['content:write', 'offline_access']))

    // On the docs site the person unticks everything but reading
    const docs = await addSite(client, 'docs.test:9090', 'full', ['content:read', 'offline_access'])
    expect(docs.granted.sort()).toEqual(['content:read', 'offline_access'])

    // The site's Studio names the agent and the machine, not "node"
    const grants = await sites['news.test:8080'].handler(new Request('http://news.test:8080/api/auth/grants', { headers: { Authorization: `Bearer ${sites['news.test:8080'].studioToken}` } }))
    const [grant] = ((await grants.json()) as { data: { grants: Array<{ userAgent?: string }> } }).data.grants
    expect(grant.userAgent).toMatch(/^trokky-mcp\/\d+\.\d+\.\d+ \(test; [^;]+; [^)]+\)$/)

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

  it('refuses an unknown sign-in and an unreachable site', async () => {
    const client = await connect()
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
    expect(gone.note).toContain('Preferences > Connected applications')

    // A site from before revocation existed answers 404
    sites['old.test'] = { ...sites['news.test:8080'], handler: async (): Promise<Response> => new Response('Not found', { status: 404 }) }
    await store.add('old', { url: 'http://old.test/api', ...oauth }, true)
    const old = await callJson<{ revokedOnSite: boolean; note?: string }>(client, 'remove_site', { name: 'old' })
    expect(old.revokedOnSite).toBe(false)
    expect(old.note).toContain('HTTP 404')
    expect(old.note).toContain('Preferences > Connected applications')
    expect(Object.keys((await store.list()).sites)).toEqual([])
  })

  it('signs in whatever the agent calls itself, and names the machine only when signing in', async () => {
    const seen: string[] = []
    const recording = network
    const client = await (async () => {
      const server = createTrokkyMcpServer({ store, fetch: (input, init) => { seen.push(new Headers(init?.headers).get('user-agent') ?? ''); return recording(input, init) }, loginWaitMs: 3000 })
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
      await server.connect(serverTransport)
      const c = new Client({ name: 'Zed’s agent 🤖\r\nX-Evil: 1', version: '1.0.0' })
      await c.connect(clientTransport)
      return c
    })()
    await addSite(client, 'news.test:8080', 'read')
    const signIn = seen[0]
    expect(signIn).toMatch(/^trokky-mcp\/\S+ \(Zed\?s agent \?\?\?\?X-Evil: 1; /)
    expect(signIn).toMatch(/^[\x20-\x7e]+$/)

    seen.length = 0
    await callJson(client, 'list_documents', { collection: 'posts' })
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatch(/^trokky-mcp\/[^ ]+$/)
  })

  it('refuses an API path the shared config could not address', async () => {
    const client = await connect()
    const result = await call(client, 'add_site', { url: 'http://news.test:8080/cms-backend' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('"api" segment')
  })
})

/** Retries `check` for up to two seconds */
async function eventually(check: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (await check()) return
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error('condition never became true')
}

describe('signing in without asking the user whether they approved', () => {
  type Started = { name: string; code: string; openThisLink: string; tellTheUser: string; next: string }
  const timed = async <T>(work: Promise<T>): Promise<{ value: T; ms: number }> => {
    const start = Date.now()
    const value = await work
    return { value, ms: Date.now() - start }
  }

  it('gives the agent a line to copy, and picks up an approval made while finish_add_site waits', async () => {
    const { client } = await connectFast({ loginWaitMs: 5000 })
    const started = await callJson<Started>(client, 'add_site', { url: 'http://news.test:8080', access: 'read' })
    expect(started.tellTheUser).toBe(`Open ${started.openThisLink} and check the code ${started.code}.`)
    expect(started.next).toContain('Do not ask the user whether they have approved')

    const finishing = timed(callJson<{ status: string; name: string; granted: string[] }>(client, 'finish_add_site', { name: started.name }))
    await new Promise(resolve => setTimeout(resolve, 150))
    await approveInBrowser('news.test:8080', started.code)
    const { value, ms } = await finishing
    expect(value).toMatchObject({ status: 'added', name: 'news-8080' })
    expect(value.granted).toContain('content:read')
    // Returned on the approval, not at the end of the wait
    expect(ms).toBeLessThan(2000)
  })

  it('reports waiting, saves the site in the background as soon as it is approved, then reports added', async () => {
    const { client } = await connectFast({ loginWaitMs: 300 })
    const started = await callJson<Started>(client, 'add_site', { url: 'http://news.test:8080' })

    const { value: waiting, ms } = await timed(callJson<{ status: string; secondsLeft: number; message: string }>(client, 'finish_add_site', { name: started.name }))
    expect(waiting.status).toBe('waiting')
    expect(waiting.secondsLeft).toBeGreaterThan(0)
    expect(waiting.message).toContain(started.code)
    expect(ms).toBeLessThan(1300)

    await approveInBrowser('news.test:8080', started.code)
    // Saved without anyone calling finish_add_site
    for (let i = 0; i < 100 && !(await store.get('news-8080')); i++) await new Promise(resolve => setTimeout(resolve, 20))
    expect((await store.get('news-8080'))?.authType).toBe('oauth2')

    expect(await callJson(client, 'finish_add_site', { name: started.name })).toMatchObject({ status: 'added', name: 'news-8080' })
    // Reported: forgotten shortly after (without holding up the answer)
    await eventually(async () => (await call(client, 'finish_add_site', { name: started.name })).content[0].text.includes('No sign-in in progress'))
  })

  it('saves the site as soon as it is approved, before finish_add_site is ever called', async () => {
    const { client } = await connectFast()
    const started = await callJson<Started>(client, 'add_site', { url: 'http://news.test:8080' })
    await approveInBrowser('news.test:8080', started.code)
    for (let i = 0; i < 100 && !(await store.get('news-8080')); i++) await new Promise(resolve => setTimeout(resolve, 20))
    expect((await store.get('news-8080'))?.clientId).toBe('trokky-mcp')
  })

  it('keeps polling through a moment the site cannot be reached', async () => {
    let failures = 2
    const flaky: typeof network = async (input, init) => {
      if (new URL(input).pathname.endsWith('/auth/token') && failures > 0) {
        failures--
        throw new Error('fetch failed: ECONNRESET')
      }
      return network(input, init)
    }
    const { client } = await connectFast({ fetch: flaky })
    const started = await callJson<Started>(client, 'add_site', { url: 'http://news.test:8080' })
    await approveInBrowser('news.test:8080', started.code)
    expect(await callJson(client, 'finish_add_site', { name: started.name })).toMatchObject({ status: 'added' })
    expect(failures).toBe(0)
  })

  it('reports a denial and saves nothing', async () => {
    const { client } = await connectFast()
    const started = await callJson<Started>(client, 'add_site', { url: 'http://news.test:8080' })
    await approveInBrowser('news.test:8080', started.code, undefined, 'deny')
    const denied = await callJson<{ status: string; message: string }>(client, 'finish_add_site', { name: started.name })
    expect(denied.status).toBe('denied')
    expect(denied.message).toContain('add_site starts a fresh sign-in')
    expect(Object.keys((await store.list()).sites)).toEqual([])
  })

  it('reports a code that expired before anyone approved it', async () => {
    sites['short.test'] = await makeSite('short.test', 1)
    const { client } = await connectFast()
    const started = await callJson<Started>(client, 'add_site', { url: 'http://short.test' })
    await new Promise(resolve => setTimeout(resolve, 1200))
    const expired = await callJson<{ status: string; message: string }>(client, 'finish_add_site', { name: started.name })
    expect(expired.status).toBe('expired')
    expect(expired.message).toContain('add_site starts a fresh sign-in')
    expect(Object.keys((await store.list()).sites)).toEqual([])
  })

  it('polls five seconds less often after each slow_down', async () => {
    let slowDowns = 2
    const slowing: typeof network = async (input, init) => {
      if (new URL(input).pathname.endsWith('/auth/token') && slowDowns > 0) {
        slowDowns--
        return new Response(JSON.stringify({ error: 'slow_down' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      return network(input, init)
    }
    const { client, waits } = await connectFast({ fetch: slowing })
    const started = await callJson<Started>(client, 'add_site', { url: 'http://news.test:8080' })
    await approveInBrowser('news.test:8080', started.code)
    expect(await callJson(client, 'finish_add_site', { name: started.name })).toMatchObject({ status: 'added' })
    // The site's interval is 1 s: then 6 s after the first slow_down, 11 s after the second
    expect(waits.slice(0, 3)).toEqual([1000, 6000, 11000])
  })

  it('finishes after a restart, from the saved sign-in, which holds no token', async () => {
    const first = await connectFast()
    const started = await callJson<Started>(first.client, 'add_site', { url: 'http://news.test:8080' })
    const file = signInsPath(store.configPath)
    expect((await stat(file)).mode & 0o777).toBe(0o600)
    await first.close()

    await approveInBrowser('news.test:8080', started.code)
    // Nothing polls any more: the first process is gone
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(await store.get('news-8080')).toBeUndefined()

    const second = await connectFast()
    const added = await callJson<{ status: string; name: string }>(second.client, 'finish_add_site', { name: started.name })
    expect(added).toMatchObject({ status: 'added', name: 'news-8080' })
    const saved = await store.get('news-8080')
    expect(saved?.token).toBeTruthy()
    // Gone once reported
    await eventually(async () => !(await readFile(file, 'utf8').then(() => true, () => false)))
  })

  it('keeps only the newest sign-in when add_site is called twice for one name', async () => {
    const { client } = await connectFast()
    const older = await callJson<Started>(client, 'add_site', { url: 'http://news.test:8080' })
    const newer = await callJson<Started>(client, 'add_site', { url: 'http://news.test:8080' })
    expect(newer.code).not.toBe(older.code)
    // Approving the abandoned code saves nothing: nothing polls it any more
    await approveInBrowser('news.test:8080', older.code)
    await new Promise(resolve => setTimeout(resolve, 200))
    expect(await store.get('news-8080')).toBeUndefined()
    await approveInBrowser('news.test:8080', newer.code)
    expect(await callJson(client, 'finish_add_site', { name: newer.name })).toMatchObject({ status: 'added' })
  })

  it('keeps an approval the site handed over while add_site replaced that sign-in, without touching the new one', async () => {
    // Hold the first sign-in's poll in flight until released
    let heldCode = ''
    let release: () => void = () => {}
    const released = new Promise<void>(resolve => { release = resolve })
    let holding = false
    const gated: typeof network = async (input, init) => {
      if (new URL(input).pathname.endsWith('/auth/token') && heldCode && String(init?.body).includes(heldCode) && !holding) {
        holding = true
        await released
      }
      return network(input, init)
    }
    const { client } = await connectFast({ fetch: gated })
    const older = await callJson<Started & { code: string }>(client, 'add_site', { url: 'http://news.test:8080' })
    const olderDevice = JSON.parse(await readFile(signInsPath(store.configPath), 'utf8'))['news-8080'].login.deviceCode as string
    heldCode = olderDevice
    await eventually(async () => holding)
    await approveInBrowser('news.test:8080', older.code)

    // Replaced while the site is about to hand over the approval
    const newer = await callJson<Started>(client, 'add_site', { url: 'http://news.test:8080' })
    release()
    // The approval was consumed on the site: it is saved, not thrown away
    await eventually(async () => Boolean(await store.get('news-8080')))
    // And the newer sign-in's record is untouched by the older one's outcome
    await new Promise(resolve => setTimeout(resolve, 100))
    const record = JSON.parse(await readFile(signInsPath(store.configPath), 'utf8'))['news-8080']
    expect(record.login.userCode).toBe(newer.code)
    expect(record.result).toBeUndefined()
  })

  it('reports added to every caller when two resume the same saved sign-in at once', async () => {
    const first = await connectFast()
    const started = await callJson<Started>(first.client, 'add_site', { url: 'http://news.test:8080' })
    await first.close()
    await approveInBrowser('news.test:8080', started.code)

    // Two MCP processes sharing the site list, and two parallel calls in one of them
    const a = await connectFast()
    const b = await connectFast()
    const results = await Promise.all([
      callJson<{ status: string }>(a.client, 'finish_add_site', { name: started.name }),
      callJson<{ status: string }>(a.client, 'finish_add_site', { name: started.name }),
      callJson<{ status: string }>(b.client, 'finish_add_site', { name: started.name })
    ])
    expect(results.map(result => result.status)).toEqual(['added', 'added', 'added'])
    expect((await store.get('news-8080'))?.authType).toBe('oauth2')
  })

  it('reports an approval saved in the background after a restart, from the saved outcome', async () => {
    const first = await connectFast({ loginWaitMs: 200 })
    const started = await callJson<Started>(first.client, 'add_site', { url: 'http://news.test:8080', access: 'read' })
    expect(await callJson(first.client, 'finish_add_site', { name: started.name })).toMatchObject({ status: 'waiting' })
    await approveInBrowser('news.test:8080', started.code)
    const file = signInsPath(store.configPath)
    await eventually(async () => (await readFile(file, 'utf8').catch(() => '')).includes('"added"'))
    // The outcome is recorded, never the tokens
    const token = (await store.get('news-8080'))?.token
    expect(token).toBeTruthy()
    expect(await readFile(file, 'utf8')).not.toContain(token)
    await first.close()

    const second = await connectFast()
    const added = await callJson<{ status: string; granted: string[] }>(second.client, 'finish_add_site', { name: started.name })
    expect(added.status).toBe('added')
    expect(added.granted).toContain('content:read')
  })

  it('remembers a slow_down across a restart', async () => {
    let slowDowns = 2
    const slowing: typeof network = async (input, init) => {
      if (new URL(input).pathname.endsWith('/auth/token') && slowDowns > 0) {
        slowDowns--
        return new Response(JSON.stringify({ error: 'slow_down' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      if (new URL(input).pathname.endsWith('/auth/token')) {
        return new Response(JSON.stringify({ error: 'authorization_pending' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
      }
      return network(input, init)
    }
    const first = await connectFast({ fetch: slowing })
    const started = await callJson<Started>(first.client, 'add_site', { url: 'http://news.test:8080' })
    const file = signInsPath(store.configPath)
    await eventually(async () => (await readFile(file, 'utf8').catch(() => '')).includes('"intervalMs": 11000'))
    await first.close()

    const second = await connectFast()
    await approveInBrowser('news.test:8080', started.code)
    expect(await callJson(second.client, 'finish_add_site', { name: started.name })).toMatchObject({ status: 'added' })
    expect(second.waits[0]).toBe(11000)
  })

  it('says when no lasting session was granted', async () => {
    const { client } = await connectFast()
    const started = await callJson<Started>(client, 'add_site', { url: 'http://news.test:8080', access: 'read' })
    await approveInBrowser('news.test:8080', started.code, ['content:read'])
    const added = await callJson<{ status: string; note?: string }>(client, 'finish_add_site', { name: started.name })
    expect(added.status).toBe('added')
    expect(added.note).toContain('No lasting session')
  })

  it('never waits longer than 100 seconds in one call', () => {
    expect(finishWaitMs()).toBe(90_000)
    expect(finishWaitMs(250_000)).toBe(MAX_FINISH_WAIT_MS)
    expect(MAX_FINISH_WAIT_MS).toBeLessThanOrEqual(100_000)
    expect(finishWaitMs(500)).toBe(500)
  })
})
