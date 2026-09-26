/**
 * The shared site store: the same file and lock protocol as the Trokky CLI.
 */

import { mkdtemp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SiteStore, apiBaseOf, takeOverStaleLock } from '../sites.js'

let dir: string
let configPath: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'trokky-sites-'))
  configPath = path.join(dir, '.trokky', 'config.yaml')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

const site = (url = 'https://cms.example.com/api') => ({ url, token: 't', authType: 'api-token' as const })

describe('SiteStore', () => {
  it('adds, lists, defaults and removes sites', async () => {
    const store = new SiteStore(configPath)
    await store.add('one', site(), false)
    await store.add('two', site('https://two.example.com/api'), false)
    expect((await store.list()).defaultSite).toBe('one')

    expect(await store.setDefault('two')).toBe(true)
    expect(await store.setDefault('nope')).toBe(false)
    expect((await store.list()).defaultSite).toBe('two')

    expect(await store.remove('two')).toBe(true)
    const { sites, defaultSite } = await store.list()
    expect(Object.keys(sites)).toEqual(['one'])
    expect(defaultSite).toBe('one')
  })

  it('reads a config the Trokky CLI wrote', async () => {
    await mkdir(path.dirname(configPath), { recursive: true })
    await writeFile(configPath, [
      'version: "1.0"',
      'default: prod',
      'instances:',
      '    prod:',
      '        url: https://cms.example.com/api',
      '        token: eyJ.abc.def',
      '        refreshToken: eyJ.ghi.jkl',
      '        authType: oauth2',
      '        tokenExpiresAt: "2099-01-01T00:00:00Z"',
      '        addedAt: "2026-09-01T00:00:00Z"',
      ''
    ].join('\n'))
    const store = new SiteStore(configPath)
    const { sites, defaultSite } = await store.list()
    expect(defaultSite).toBe('prod')
    expect(sites.prod).toMatchObject({ url: 'https://cms.example.com/api', authType: 'oauth2', refreshToken: 'eyJ.ghi.jkl' })
    expect(await store.token('prod')).toBe('eyJ.abc.def')
  })

  it('writes privately, atomically, and loses nothing under concurrent writers', async () => {
    const stores = Array.from({ length: 4 }, () => new SiteStore(configPath))
    await Promise.all(Array.from({ length: 24 }, (_, i) => stores[i % 4].add(`site-${i}`, site(), false)))

    const { sites } = await stores[0].list()
    expect(Object.keys(sites)).toHaveLength(24)
    expect((await stat(configPath)).mode & 0o777).toBe(0o600)
    const leftovers = (await readdir(path.dirname(configPath))).filter(file => file !== 'config.yaml')
    expect(leftovers).toEqual([])
  })

  it('recovers a lock abandoned by a crashed process', async () => {
    await mkdir(path.dirname(configPath), { recursive: true })
    await writeFile(`${configPath}.lock`, '12345')
    const old = new Date(Date.now() - 120_000)
    await utimes(`${configPath}.lock`, old, old)
    await new SiteStore(configPath).add('x', site(), true)
    expect(Object.keys((await new SiteStore(configPath).list()).sites)).toEqual(['x'])
  })

  it('refuses to overwrite a config it cannot read', async () => {
    await mkdir(path.dirname(configPath), { recursive: true })
    await writeFile(configPath, 'not: [valid: yaml: {{')
    const store = new SiteStore(configPath)
    await expect(store.list()).rejects.toThrow('not valid YAML')
    await expect(store.add('x', site(), true)).rejects.toThrow('not valid YAML')
    expect(await readFile(configPath, 'utf8')).toBe('not: [valid: yaml: {{')
  })
})

describe('apiBaseOf', () => {
  it('reads a stored URL the way the CLI does', () => {
    expect(apiBaseOf('https://cms.example.com')).toBe('https://cms.example.com/api')
    expect(apiBaseOf('https://cms.example.com/')).toBe('https://cms.example.com/api')
    expect(apiBaseOf('https://cms.example.com/api/')).toBe('https://cms.example.com/api')
    expect(apiBaseOf('https://cms.example.com/api/v1')).toBe('https://cms.example.com/api/v1')
    expect(apiBaseOf('https://example.com/backend/api')).toBe('https://example.com/backend/api')
    expect(apiBaseOf('https://example.com/cms')).toBe('https://example.com/cms/api')
  })
})

describe('names', () => {
  it('refuses a name in use, and replaces only the same site', async () => {
    const store = new SiteStore(configPath)
    await store.add('prod', site('https://cms.example.com/api'), true)
    await expect(store.add('prod', site('https://prod.evil.com/api'), false)).rejects.toThrow('already exists')
    await expect(store.add('prod', site('https://prod.evil.com/api'), false, true)).rejects.toThrow('same address')
    await store.add('prod', { ...site('https://cms.example.com'), token: 'again' }, false, true)
    expect((await store.get('prod'))?.token).toBe('again')
  })

  it('picks a new default only when one site is left', async () => {
    const store = new SiteStore(configPath)
    await store.add('a', site(), true)
    await store.add('b', site(), false)
    await store.add('c', site(), false)
    await store.remove('a')
    expect((await store.list()).defaultSite).toBeUndefined()
    await store.remove('b')
    await store.setDefault('c')
    await store.add('d', site(), false)
    await store.remove('c')
    expect((await store.list()).defaultSite).toBe('d')
  })

  it('gives a session its address and token from the same record', async () => {
    const store = new SiteStore(configPath)
    await store.add('s', site('https://cms.example.com'), true)
    expect(await store.session('s')).toEqual({ url: 'https://cms.example.com', token: 't' })
  })
})

describe('the shared lock and file', () => {
  it('puts back a lock that proved live during a takeover', async () => {
    await mkdir(path.dirname(configPath), { recursive: true })
    await writeFile(`${configPath}.lock`, 'live-owner')
    await takeOverStaleLock(`${configPath}.lock`)
    expect(await readFile(`${configPath}.lock`, 'utf8')).toBe('live-owner')
    expect((await readdir(path.dirname(configPath))).filter(f => f.endsWith('.stale'))).toEqual([])
  })

  it('releases only its own lock', async () => {
    const store = new SiteStore(configPath)
    await store.add('a', site(), true)
    // Another process holds the lock now; an add from here must wait for it, not remove it
    await writeFile(`${configPath}.lock`, 'someone-else')
    const pending = store.add('b', site(), false)
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(await readFile(`${configPath}.lock`, 'utf8')).toBe('someone-else')
    await rm(`${configPath}.lock`)
    await pending
    expect(Object.keys((await store.list()).sites).sort()).toEqual(['a', 'b'])
  })

  it('does not remove a lock another process took over while it was held', async () => {
    let finishRefresh: () => void = () => {}
    const store = new SiteStore(configPath, () => new Promise(resolve => {
      finishRefresh = () => resolve(new Response(JSON.stringify({ access_token: 'new', expires_in: 3600 })))
    }))
    await store.add('s', { url: 'https://cms.example.com/api', token: 'old', refreshToken: 'r', authType: 'oauth2', tokenExpiresAt: new Date(Date.now() - 1000).toISOString() }, true)

    const renewing = store.token('s')
    // The refresh holds the lock; meanwhile another process takes it over as stale
    await new Promise(resolve => setTimeout(resolve, 100))
    await writeFile(`${configPath}.lock`, 'new-owner')
    finishRefresh()
    await renewing
    expect(await readFile(`${configPath}.lock`, 'utf8')).toBe('new-owner')
  })

  it('keeps keys it does not know, at the top level and on a site', async () => {
    await mkdir(path.dirname(configPath), { recursive: true })
    await writeFile(configPath, [
      'version: "1.0"',
      'default: a',
      'cli:',
      '  colour: never',
      'instances:',
      '  a:',
      '    url: https://a.example.com/api',
      '    token: t',
      '    futureField: kept',
      ''
    ].join('\n'))
    await new SiteStore(configPath).add('b', site(), false)
    const text = await readFile(configPath, 'utf8')
    expect(text).toContain('colour: never')
    expect(text).toContain('futureField: kept')
  })
})

describe('token renewal', () => {
  const expired = () => new Date(Date.now() - 60_000).toISOString()
  const oauthSite = (token = 'old') => ({
    url: 'https://cms.example.com/api', token, refreshToken: 'refresh-1', authType: 'oauth2' as const,
    tokenExpiresAt: expired(), clientId: 'trokky-mcp'
  })

  it('renews an expired token with the client it was issued to, and stores the rotation', async () => {
    const requests: Array<Record<string, string>> = []
    const store = new SiteStore(configPath, async (_url, init) => {
      requests.push(JSON.parse(String(init?.body)))
      return new Response(JSON.stringify({ access_token: 'new', refresh_token: 'refresh-2', expires_in: 3600 }))
    })
    await store.add('s', oauthSite(), true)

    expect(await store.token('s')).toBe('new')
    expect(requests).toEqual([{ grant_type: 'refresh_token', refresh_token: 'refresh-1', client_id: 'trokky-mcp' }])
    const saved = await store.get('s')
    expect(saved).toMatchObject({ token: 'new', refreshToken: 'refresh-2' })
    expect(Date.parse(saved?.tokenExpiresAt ?? '')).toBeGreaterThan(Date.now())
    expect(await store.token('s')).toBe('new')
    expect(requests).toHaveLength(1)
  })

  it('reuses a token another process already renewed', async () => {
    let requests = 0
    const store = new SiteStore(configPath, async () => {
      requests++
      return new Response(JSON.stringify({ access_token: 'from-network', expires_in: 3600 }))
    })
    await store.add('s', oauthSite('old'), true)

    // What this process saw before the CLI renewed the token behind its back
    const staleView = await store.get('s')
    await new SiteStore(configPath).add('s', { ...oauthSite('renewed-elsewhere'), tokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString() }, true, true)
    expect(staleView?.token).toBe('old')

    // The server rejected the old token; the store must pick up the renewal, not repeat it
    expect(await store.token('s', staleView?.token)).toBe('renewed-elsewhere')
    expect(requests).toBe(0)
  })

  it('explains an ended session', async () => {
    const store = new SiteStore(configPath, async () =>
      new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Refresh token expired' }), { status: 400 }))
    await store.add('s', oauthSite(), true)
    await expect(store.token('s')).rejects.toThrow('Sign in again with add_site')
  })

  it('keeps the refresh token when the server does not rotate it', async () => {
    const store = new SiteStore(configPath, async () => new Response(JSON.stringify({ access_token: 'new', expires_in: 3600 })))
    await store.add('s', oauthSite(), true)
    await store.token('s')
    expect((await store.get('s'))?.refreshToken).toBe('refresh-1')
  })

  it('does not renew a token whose expiry it cannot read, as the CLI does', async () => {
    const store = new SiteStore(configPath, async () => { throw new Error('no network expected') })
    await store.add('s', { ...oauthSite(), tokenExpiresAt: 'soon-ish' }, true)
    expect(await store.token('s')).toBe('old')
  })

  it('renews a token that expires within five minutes', async () => {
    let requests = 0
    const store = new SiteStore(configPath, async () => { requests++; return new Response(JSON.stringify({ access_token: 'new', expires_in: 3600 })) })
    await store.add('s', { ...oauthSite(), tokenExpiresAt: new Date(Date.now() + 60_000).toISOString() }, true)
    expect(await store.token('s')).toBe('new')
    expect(requests).toBe(1)
  })

  it('never renews an API token', async () => {
    const store = new SiteStore(configPath, async () => { throw new Error('no network expected') })
    await store.add('s', { ...site(), tokenExpiresAt: expired() }, true)
    expect(await store.token('s')).toBe('t')
  })
})
