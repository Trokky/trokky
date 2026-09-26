/**
 * OAuth2 tokens are scoped: a device-flow token holds the scopes the user granted, intersected
 * with what the user may do, and cannot reach account or security routes. Device and
 * authorization codes live in the data adapter's store, so a flow survives changing process.
 */

import { createHash } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrokkyCore } from '../../core/core/engine.js'
import { WebCryptoAdapter } from '../../core/crypto/webcrypto-adapter.js'
import { scopedPermissions } from '../../core/security/oauth2/scoped-permissions.js'
import { clearFallbackAuthFlowStates, getAuthFlowState, saveAuthFlowState } from '../../core/security/auth-flow-store.js'
import { GoogleOAuthService } from '../../core/security/oauth/google.js'
import { FilesystemDataAdapter } from '../../adapters/filesystem-data/filesystem-data-adapter.js'
import { FilesystemMediaAdapter } from '../../adapters/filesystem-media/filesystem-media-adapter.js'
import { TrokkyRoutes } from '../../routes/index.js'
import type { HttpResponse } from '../../types/http.js'
import type { User } from '../../types/user.js'
import {
  TEST_JWT_SECRET,
  TEST_PBKDF2_ITERATIONS,
  testSchemas,
  createMockRequest,
  executeRoute
} from '../helpers/test-helpers.js'

const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code'
const ALL_SCOPES = 'openid profile content:read content:write content:delete content:publish media:read media:write media:delete offline_access'

interface Site {
  core: TrokkyCore
  routes: TrokkyRoutes
  data: FilesystemDataAdapter
}

let dir: string
const cores: TrokkyCore[] = []

async function site(storageDir = dir, extra: { clients?: unknown[] } = {}): Promise<Site> {
  const data = new FilesystemDataAdapter({
        contentDir: path.join(storageDir, 'content'),
        usersDir: path.join(storageDir, 'users'),
        tokensDir: path.join(storageDir, 'tokens'),
        webhooksDir: path.join(storageDir, 'webhooks'),
        settingsDir: path.join(storageDir, 'settings'),
        auditLogsDir: path.join(storageDir, 'audit-logs'),
        authFlowStateDir: path.join(storageDir, 'auth-flow-state')
      })
  const core = new TrokkyCore(
    { storage: { adapter: 'filesystem-data', options: {} }, schemas: testSchemas } as never,
    {
      data,
      media: new FilesystemMediaAdapter({ mediaDir: path.join(storageDir, 'media') })
    },
    {
      jwtSecret: TEST_JWT_SECRET,
      enableEvents: false,
      cryptoAdapter: new WebCryptoAdapter({ pbkdf2Iterations: TEST_PBKDF2_ITERATIONS }),
      oauth2: { enabled: true, issuer: 'http://cms.test/api', ...extra }
    } as never
  )
  await core.init()
  cores.push(core)
  const routes = new TrokkyRoutes({ core, basePath: '/api', authentication: { enabled: true, publicPaths: [] } })
  return { core, routes, data }
}

function body<T = Record<string, unknown>>(response: HttpResponse): T {
  return (typeof response.body === 'string' ? JSON.parse(response.body) : response.body) as T
}

function call(s: Site, method: string, route: string, token?: string, requestBody?: unknown, query?: Record<string, string>): Promise<HttpResponse> {
  const request = createMockRequest({
    method,
    path: route,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: requestBody,
    query
  })
  const url = query ? `${route}?${new URLSearchParams(query)}` : route
  return executeRoute(s.routes, { ...request, url })
}

async function user(s: Site, username: string, role: User['role'], permissions?: string[]): Promise<{ user: User; token: string }> {
  const created = await s.core.createUser({
    username,
    email: `${username}@example.com`,
    password: 'TestPassword123!',
    role,
    ...(permissions ? { permissions } : {})
  } as never)
  return { user: created, token: await s.core.generateAuthToken(created) }
}

async function startDevice(s: Site, scope = ALL_SCOPES): Promise<{ device_code: string; user_code: string }> {
  const response = await call(s, 'POST', '/api/auth/device', undefined, { client_id: 'trokky-cli', scope })
  expect(response.status).toBe(200)
  return body(response)
}

async function approve(s: Site, studioToken: string, userCode: string, scopes?: string[]): Promise<HttpResponse> {
  return call(s, 'POST', '/api/auth/device/verify', studioToken, { user_code: userCode, action: 'authorize', ...(scopes ? { scopes } : {}) })
}

async function poll(s: Site, deviceCode: string): Promise<HttpResponse> {
  return call(s, 'POST', '/api/auth/token', undefined, { grant_type: DEVICE_GRANT, device_code: deviceCode, client_id: 'trokky-cli' })
}

/** Run the whole device flow and return the access token */
async function deviceToken(s: Site, studioToken: string, scopes: string[], request = ALL_SCOPES): Promise<string> {
  const { device_code, user_code } = await startDevice(s, request)
  expect((await approve(s, studioToken, user_code, scopes)).status).toBe(200)
  const response = await poll(s, device_code)
  expect(response.status).toBe(200)
  return body<{ access_token: string }>(response).access_token
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'trokky-oauth2-'))
})

afterEach(async () => {
  for (const core of cores.splice(0)) await core.shutdown?.()
  await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 20 })
})

describe('scopedPermissions', () => {
  it('gives an admin exactly the granted scopes, never more', () => {
    expect(scopedPermissions({ role: 'admin', permissions: [] }, ['content:read']).sort()).toEqual(['content:read'])
  })

  it('never lends a user a permission they lack', () => {
    const viewer = scopedPermissions({ role: 'viewer', permissions: [] }, ['content:write', 'media:delete'])
    expect(viewer).toEqual(['content:read', 'media:read'])
  })

  it('keeps a per-collection user to their collections under a site-wide scope', () => {
    const granted = scopedPermissions({ role: 'viewer', permissions: ['posts:write', 'authors:*'] }, ['content:write'])
    // Reading is the viewer role's own content:read, which covers every collection
    expect(granted.sort()).toEqual(['authors:write', 'content:read', 'posts:write'])
    expect(granted).not.toContain('content:write')
  })

  it('counts role defaults a stored snapshot predates', () => {
    expect(scopedPermissions({ role: 'editor', permissions: ['content:read'] }, ['media:delete'])).toContain('media:delete')
  })
})

describe('what a scoped token may do', () => {
  it('reads with a read scope and cannot write, even for an admin', async () => {
    const s = await site()
    const { token: studio } = await user(s, 'admin1', 'admin')
    const token = await deviceToken(s, studio, ['content:read', 'offline_access'])

    expect((await call(s, 'GET', '/api/collections/posts', token)).status).toBe(200)
    expect((await call(s, 'POST', '/api/collections/posts', token, { data: { title: 'no' } })).status).toBe(403)
    expect((await call(s, 'GET', '/api/media', token)).status).toBe(403)
  })

  it('writes with a write scope but cannot publish without the publish scope', async () => {
    const s = await site()
    const { token: studio } = await user(s, 'admin2', 'admin')
    const writer = await deviceToken(s, studio, ['content:write'])
    expect((await call(s, 'POST', '/api/collections/posts', writer, { data: { title: 'draft' } })).status).toBe(201)
    expect((await call(s, 'POST', '/api/collections/posts', writer, { data: { title: 'live', _status: 'published' } })).status).toBe(403)

    const publisher = await deviceToken(s, studio, ['content:write', 'content:publish'])
    expect((await call(s, 'POST', '/api/collections/posts', publisher, { data: { title: 'live', _status: 'published' } })).status).toBe(201)
  })

  it("does not let a token without delete remove the user's own documents", async () => {
    const s = await site()
    const { token: studio } = await user(s, 'writer1', 'editor')
    const writer = await deviceToken(s, studio, ['content:write'])
    const created = body<{ data: { document: { id: string } } }>(await call(s, 'POST', '/api/collections/posts', writer, { data: { title: 'mine' } }))
    expect((await call(s, 'DELETE', `/api/collections/posts/${created.data.document.id}`, writer)).status).toBe(403)
  })

  it('caps a token at what the user can do', async () => {
    const s = await site()
    const { token: studio } = await user(s, 'viewer1', 'viewer')
    const token = await deviceToken(s, studio, ['content:read', 'content:write'])
    expect((await call(s, 'GET', '/api/collections/posts', token)).status).toBe(200)
    expect((await call(s, 'POST', '/api/collections/posts', token, { data: { title: 'no' } })).status).toBe(403)
  })

  it('reaches no admin surface, even when an admin granted it', async () => {
    const s = await site()
    const { token: studio } = await user(s, 'admin3', 'admin')
    const token = await deviceToken(s, studio, ALL_SCOPES.split(' '))
    expect((await call(s, 'GET', '/api/users', token)).status).not.toBe(200)
    expect((await call(s, 'GET', '/api/tokens', token)).status).toBe(403)
    expect((await call(s, 'POST', '/api/tokens', token, { name: 'x', permissions: ['content:read'] })).status).toBe(403)
    expect((await call(s, 'PUT', '/api/config/settings', token, { settings: { siteName: 'x' } })).status).not.toBe(200)
  })
})

describe('account and security routes', () => {
  it('refuses a scoped token everywhere under /auth except reading the profile with profile scope', async () => {
    const s = await site()
    const { token: studio } = await user(s, 'admin4', 'admin')
    const withProfile = await deviceToken(s, studio, ['profile', 'content:read'])
    const withoutProfile = await deviceToken(s, studio, ['content:read'])

    expect((await call(s, 'GET', '/api/auth/me', withProfile)).status).toBe(200)
    expect((await call(s, 'GET', '/api/auth/me', withoutProfile)).status).toBe(403)
    expect((await call(s, 'POST', '/api/auth/passkey/register/options', withProfile, {})).status).toBe(403)
    expect((await call(s, 'GET', '/api/auth/mfa/status', withProfile)).status).toBe(403)

    // Cannot approve another device, which would let a token grant itself more
    const other = await startDevice(s)
    expect((await approve(s, withProfile, other.user_code)).status).toBe(403)
  })

  it('answers an unauthenticated account route with 401, not an error', async () => {
    const s = await site()
    for (const [method, route] of [['POST', '/api/auth/passkey/register/options'], ['GET', '/api/auth/mfa/status'], ['POST', '/api/auth/device/verify']]) {
      expect((await call(s, method, route, undefined, {})).status).toBe(401)
    }
  })

  it('cannot be exchanged for a Studio session', async () => {
    const s = await site()
    const { token: studio } = await user(s, 'admin5', 'admin')
    const token = await deviceToken(s, studio, ['content:read'])
    const refreshed = await call(s, 'POST', '/api/auth/refresh', undefined, { refreshToken: token })
    expect(refreshed.status).not.toBe(200)
  })

  it('accepts neither an OAuth2 refresh token nor an MFA token as a bearer', async () => {
    const s = await site()
    const { user: admin, token: studio } = await user(s, 'admin6', 'admin')
    const { device_code, user_code } = await startDevice(s, 'content:read offline_access')
    await approve(s, studio, user_code)
    const tokens = body<{ refresh_token: string }>(await poll(s, device_code))
    expect(tokens.refresh_token).toBeTruthy()
    expect(await s.core.verifyAnyToken(tokens.refresh_token)).toBeNull()

    const crypto = new WebCryptoAdapter({ pbkdf2Iterations: TEST_PBKDF2_ITERATIONS })
    for (const type of ['mfa_pending', 'mfa_setup', 'oauth2_refresh']) {
      const forged = await crypto.generateJWT({ userId: admin.id, username: admin.username, type }, TEST_JWT_SECRET, { expiresIn: '5m' })
      expect(await s.core.verifyAnyToken(forged)).toBeNull()
    }
    // An access token must say what it was granted
    const scopeless = await crypto.generateJWT({ sub: admin.id, username: admin.username, type: 'oauth2_access', role: 'admin', permissions: ['users:write'] }, TEST_JWT_SECRET, { expiresIn: '5m' })
    expect(await s.core.verifyAnyToken(scopeless)).toBeNull()
    // A Studio session still works
    expect((await s.core.verifyAnyToken(studio))?.role).toBe('admin')
  })
})

describe('device flow', () => {
  it('survives the approval and the poll landing on different processes', async () => {
    const a = await site()
    const b = await site()
    const { token: studio } = await user(a, 'admin7', 'admin')
    const { device_code, user_code } = await startDevice(a)
    // Both cores share this process, so an in-memory fallback would pass by accident; clearing
    // it proves the codes live in the data adapter
    clearFallbackAuthFlowStates()

    expect(body<{ success: boolean }>(await call(b, 'GET', '/api/auth/device/verify', studio, undefined, { code: user_code })).success).toBe(true)
    expect((await poll(b, device_code)).status).toBe(400) // still pending
    expect((await approve(b, studio, user_code, ['content:read'])).status).toBe(200)
    const tokens = await poll(a, device_code)
    expect(tokens.status).toBe(200)
    expect(body<{ scope: string }>(tokens).scope).toBe('content:read')
  })

  it('issues tokens once', async () => {
    const s = await site()
    const { token: studio } = await user(s, 'admin8', 'admin')
    const { device_code, user_code } = await startDevice(s)
    await approve(s, studio, user_code)
    const [first, second] = await Promise.all([poll(s, device_code), poll(s, device_code)])
    expect([first.status, second.status].sort()).toEqual([200, 400])
  })

  it('lets the person narrow the request, and nothing more', async () => {
    const s = await site()
    const { token: studio } = await user(s, 'admin9', 'admin')
    const { device_code, user_code } = await startDevice(s, 'content:read media:read')
    // A scope that was not requested is ignored, not added
    expect((await approve(s, studio, user_code, ['media:read', 'content:delete'])).status).toBe(200)
    expect(body<{ scope: string }>(await poll(s, device_code)).scope).toBe('media:read')

    const empty = await startDevice(s, 'content:read')
    expect((await approve(s, studio, empty.user_code, [])).status).toBe(400)
  })

  it('approves a user code once', async () => {
    const s = await site()
    const { token: studio } = await user(s, 'admin10', 'admin')
    const { user_code } = await startDevice(s)
    expect((await approve(s, studio, user_code)).status).toBe(200)
    expect((await approve(s, studio, user_code)).status).toBe(400)
  })

  it('reports a denial and an unknown code', async () => {
    const s = await site()
    const { token: studio } = await user(s, 'admin11', 'admin')
    const { device_code, user_code } = await startDevice(s)
    await call(s, 'POST', '/api/auth/device/verify', studio, { user_code, action: 'deny' })
    expect(body<{ error: string }>(await poll(s, device_code)).error).toBe('access_denied')
    expect(body<{ error: string }>(await poll(s, 'not-a-real-device-code')).error).toBe('expired_token')
  })
})

describe('authorization code flow', () => {
  const client = { id: 'web-app', name: 'Web app', redirectUris: ['https://app.example.com/callback'] }
  const challenge = 'a'.repeat(43)

  it('refuses an approval with an unregistered redirect, even a denial', async () => {
    const s = await site(dir, { clients: [client] })
    const { token: studio } = await user(s, 'admin12', 'admin')
    for (const action of ['approve', 'deny']) {
      const response = await call(s, 'POST', '/api/auth/authorize', studio, {
        action, client_id: 'web-app', redirect_uri: 'https://evil.example.com/steal', scopes: ['content:read'], state: 'state-123', code_challenge: challenge
      })
      expect(response.status).toBe(400)
    }
  })

  it('refuses scopes the client may not have, and issues a code for a valid approval', async () => {
    const s = await site(dir, { clients: [{ ...client, allowedScopes: ['content:read'] }] })
    const { token: studio } = await user(s, 'admin13', 'admin')
    const base = { action: 'approve', client_id: 'web-app', redirect_uri: client.redirectUris[0], state: 'state-123', code_challenge: challenge }
    expect((await call(s, 'POST', '/api/auth/authorize', studio, { ...base, scopes: ['content:write'] })).status).toBe(400)
    const ok = await call(s, 'POST', '/api/auth/authorize', studio, { ...base, scopes: ['content:read'] })
    expect(ok.status).toBe(200)
    expect(body<{ data: { redirectUrl: string } }>(ok).data.redirectUrl).toContain('code=')
  })
})

describe('metadata', () => {
  it('publishes the endpoints and every scope', async () => {
    const s = await site()
    const response = await call(s, 'GET', '/api/.well-known/oauth-authorization-server')
    expect(response.status).toBe(200)
    const metadata = body<{ scopes_supported: string[]; device_authorization_endpoint: string; revocation_endpoint?: string }>(response)
    expect(metadata.scopes_supported).toEqual(expect.arrayContaining(['content:publish', 'media:delete']))
    expect(metadata.device_authorization_endpoint).toBe('http://cms.test/api/auth/device')
    expect(metadata.revocation_endpoint).toBeUndefined()
  })
})

describe('review fixes', () => {
  it('fails closed when a scoped token\'s user cannot be loaded, whatever the token claims', async () => {
    const s = await site()
    const { token: studio } = await user(s, 'admin20', 'admin')
    const token = await deviceToken(s, studio, ['content:read'])
    const getUser = vi.spyOn(s.data, 'getUser').mockRejectedValue(new Error('storage down'))
    try {
      expect(await s.core.verifyAnyToken(token)).toBeNull()
    } finally {
      getUser.mockRestore()
    }
  })

  it('forgets the user when refusing a scoped token, so a handler that swallows the refusal sees nobody', async () => {
    const s = await site(dir, { clients: [{ id: 'web-app', name: 'Web app', redirectUris: ['https://app.example.com/cb'] }] })
    const { token: studio } = await user(s, 'admin21', 'admin')
    const base = { action: 'approve', client_id: 'web-app', redirect_uri: 'https://app.example.com/cb', state: 'state-123', code_challenge: 'a'.repeat(43) }
    expect((await call(s, 'POST', '/api/auth/authorize', studio, { ...base, scopes: ['content:read'] })).status).toBe(200)

    const query = { response_type: 'code', client_id: 'web-app', redirect_uri: 'https://app.example.com/cb', scope: 'content:read', state: 'state-123', code_challenge: 'a'.repeat(43), code_challenge_method: 'S256' }
    const asStudio = body<{ data: { hasExistingConsent: boolean } }>(await call(s, 'GET', '/api/auth/authorize', studio, undefined, query))
    expect(asStudio.data.hasExistingConsent).toBe(true)

    const scoped = await deviceToken(s, studio, ['content:read'])
    const asScoped = body<{ data: { hasExistingConsent: boolean } }>(await call(s, 'GET', '/api/auth/authorize', scoped, undefined, query))
    expect(asScoped.data.hasExistingConsent).toBe(false)
  })

  it('gives a scoped token a minimal profile and nobody the second-factor secrets', async () => {
    const s = await site()
    const { user: admin, token: studio } = await user(s, 'admin22', 'admin')
    await s.data.saveUser(admin.id, {
      ...(await s.core.getUser(admin.id)),
      mfa: { enabled: true, methods: [{ type: 'totp', enabled: true, verified: true, secret: 'TOTPSECRET' }], backupCodes: ['h1', 'h2'] }
    } as never)

    const scoped = await deviceToken(s, studio, ['profile'])
    const profile = body<{ data: Record<string, unknown> }>(await call(s, 'GET', '/api/auth/me', scoped))
    const allowed = ['email', 'firstName', 'id', 'lastName', 'role', 'username']
    expect(Object.keys(profile.data).filter(key => !allowed.includes(key))).toEqual([])
    expect(profile.data.id).toBe(admin.id)
    expect(JSON.stringify(profile)).not.toContain('TOTPSECRET')
    expect(profile.data.mfa).toBeUndefined()

    const own = await call(s, 'GET', '/api/auth/me', studio)
    expect(own.status).toBe(200)
    const text = JSON.stringify(body(own))
    expect(text).not.toContain('TOTPSECRET')
    expect(text).not.toContain('"h1"')
    expect(body<{ data: { mfa: { backupCodesRemaining: number } } }>(own).data.mfa.backupCodesRemaining).toBe(2)
  })

  it('shows audit history only for collections the caller can read', async () => {
    const s = await site()
    const { user: admin, token: studio } = await user(s, 'admin23', 'admin')
    const created = body<{ data: { document: { id: string } } }>(await call(s, 'POST', '/api/collections/posts', studio, { data: { title: 'secret draft' } }))
    const id = created.data.document.id

    const mediaOnly = await deviceToken(s, studio, ['media:read'])
    const hidden = body<{ data: { auditLogs: unknown[] } }>(await call(s, 'GET', `/api/audit-logs/documents/${id}`, mediaOnly))
    expect(hidden.data.auditLogs).toEqual([])
    const ownHistory = body<{ data: { auditLogs: unknown[] } }>(await call(s, 'GET', `/api/audit-logs/actors/${admin.id}`, mediaOnly))
    expect(JSON.stringify(ownHistory)).not.toContain('secret draft')

    const reader = await deviceToken(s, studio, ['content:read'])
    const shown = body<{ data: { auditLogs: unknown[] } }>(await call(s, 'GET', `/api/audit-logs/documents/${id}`, reader))
    expect(shown.data.auditLogs.length).toBeGreaterThan(0)
  })

  it('keeps a narrowed consent narrow on the next visit', async () => {
    const s = await site(dir, { clients: [{ id: 'web-app', name: 'Web app', redirectUris: ['https://app.example.com/cb'] }] })
    const { token: studio } = await user(s, 'admin24', 'admin')
    const base = { action: 'approve', client_id: 'web-app', redirect_uri: 'https://app.example.com/cb', state: 'state-123', code_challenge: 'a'.repeat(43) }
    await call(s, 'POST', '/api/auth/authorize', studio, { ...base, scopes: ['content:read', 'content:delete'] })
    await call(s, 'POST', '/api/auth/authorize', studio, { ...base, scopes: ['content:read'] })
    const query = { response_type: 'code', client_id: 'web-app', redirect_uri: 'https://app.example.com/cb', scope: 'content:read content:delete', state: 'state-123', code_challenge: 'a'.repeat(43), code_challenge_method: 'S256' }
    const again = body<{ data: { hasExistingConsent: boolean } }>(await call(s, 'GET', '/api/auth/authorize', studio, undefined, query))
    expect(again.data.hasExistingConsent).toBe(false)
  })

  it('lets exactly one of an approval and a denial racing win', async () => {
    const s = await site()
    const { token: studio } = await user(s, 'admin25', 'admin')
    for (let round = 0; round < 5; round++) {
      const { user_code } = await startDevice(s)
      const results = await Promise.all([
        approve(s, studio, user_code),
        call(s, 'POST', '/api/auth/device/verify', studio, { user_code, action: 'deny' })
      ])
      expect(results.map(r => r.status).sort()).toEqual([200, 400])
    }
  })

  it('tells a reloaded approval page the code was already handled', async () => {
    const s = await site()
    const { token: studio } = await user(s, 'admin26', 'admin')
    const { user_code } = await startDevice(s)
    await approve(s, studio, user_code)
    const reload = await call(s, 'GET', '/api/auth/device/verify', studio, undefined, { code: user_code.toLowerCase().replace('-', '') })
    expect(reload.status).toBe(400)
    expect(JSON.stringify(body(reload))).toContain('ALREADY_PROCESSED')
  })

  it('refuses tokens to a different client than the one that asked', async () => {
    const s = await site(dir, { clients: [{ id: 'web-app', name: 'Web app', redirectUris: ['https://app.example.com/cb'] }] })
    const { token: studio } = await user(s, 'admin27', 'admin')
    const { device_code, user_code } = await startDevice(s)
    await approve(s, studio, user_code)
    const stolen = await call(s, 'POST', '/api/auth/token', undefined, { grant_type: DEVICE_GRANT, device_code, client_id: 'web-app' })
    expect(body<{ error: string }>(stolen).error).toBe('invalid_grant')
    expect((await poll(s, device_code)).status).toBe(200)
  })

  it('checks each part of an approval, and lets a denial through without scopes', async () => {
    const s = await site(dir, { clients: [{ id: 'web-app', name: 'Web app', redirectUris: ['https://app.example.com/cb'], allowedScopes: ['content:read'] }] })
    const { token: studio } = await user(s, 'admin28', 'admin')
    const base = { action: 'approve', client_id: 'web-app', redirect_uri: 'https://app.example.com/cb', state: 'state-123', code_challenge: 'a'.repeat(43), scopes: ['content:read'] }
    const status = async (overrides: Record<string, unknown>): Promise<number> =>
      (await call(s, 'POST', '/api/auth/authorize', studio, { ...base, ...overrides })).status
    expect(await status({ scopes: ['content:read', 'content:write'] })).toBe(400)
    expect(await status({ scopes: 'content:read' })).toBe(400)
    expect(await status({ code_challenge: 'short' })).toBe(400)
    expect(await status({ client_id: 'nobody' })).toBe(400)
    expect(await status({ action: 'deny', scopes: [] })).toBe(200)
    expect(await status({})).toBe(200)
  })
})

describe('linking a Google account', () => {
  async function withGoogle(s: Site): Promise<() => void> {
    const spies = [
      vi.spyOn(s.core, 'getOAuthConfig').mockReturnValue({ clientId: 'id', clientSecret: 'secret', redirectUri: 'https://cms.test/cb' } as never),
      vi.spyOn(GoogleOAuthService.prototype, 'exchangeCodeForTokens').mockResolvedValue({ accessToken: 'at' } as never),
      vi.spyOn(GoogleOAuthService.prototype, 'getUserInfo').mockResolvedValue({ sub: 'google-attacker', email: 'attacker@example.com', email_verified: true } as never),
      vi.spyOn(GoogleOAuthService.prototype, 'validateUserInfo').mockReturnValue(undefined)
    ]
    return () => spies.forEach(spy => spy.mockRestore())
  }

  async function init(s: Site, mode: string, token?: string): Promise<{ state: string; codeVerifier: string }> {
    const response = await call(s, 'POST', '/api/auth/oauth/google/init', token, { mode })
    expect(response.status).toBe(200)
    return body<{ data: { state: string; codeVerifier: string } }>(response).data
  }

  it('links only when the flow was started as a link by the signed-in user', async () => {
    const s = await site()
    const restore = await withGoogle(s)
    try {
      const { token: studio } = await user(s, 'admin29', 'admin')
      const scoped = await deviceToken(s, studio, ['openid'])

      // Started as a login by nobody, finished claiming "link" with the victim's token
      for (const token of [scoped, studio]) {
        // A state is single use, so each attempt needs its own
        const flow = await init(s, 'login')
        const hijack = await call(s, 'POST', '/api/auth/oauth/google/callback', token, { code: 'c', state: flow.state, codeVerifier: flow.codeVerifier, mode: 'link' })
        expect(hijack.status).not.toBe(200)
      }

      // The real thing: Studio starts a link as the user, then finishes it
      const link = await init(s, 'link', studio)
      const linked = await call(s, 'POST', '/api/auth/oauth/google/callback', undefined, { code: 'c', state: link.state, codeVerifier: link.codeVerifier, mode: 'link' })
      expect(linked.status).toBe(200)
    } finally {
      restore()
    }
  })
})

describe('trusted clients', () => {
  const verifier = 'v'.repeat(64)
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const redirect = 'https://hr.example.com/callback'

  /** The jobs-admin flow: authorization code with PKCE, `openid profile offline_access` */
  async function signIn(s: Site, studioToken: string, clientId: string): Promise<string> {
    const approved = await call(s, 'POST', '/api/auth/authorize', studioToken, {
      action: 'approve', client_id: clientId, redirect_uri: redirect,
      scopes: ['openid', 'profile', 'offline_access'], state: 'state-123', code_challenge: challenge
    })
    expect(approved.status).toBe(200)
    const code = new URL(body<{ data: { redirectUrl: string } }>(approved).data.redirectUrl).searchParams.get('code')
    const tokens = await call(s, 'POST', '/api/auth/token', undefined, {
      grant_type: 'authorization_code', client_id: clientId, code, redirect_uri: redirect, code_verifier: verifier
    })
    expect(tokens.status).toBe(200)
    return body<{ access_token: string }>(tokens).access_token
  }

  it('acts as the user for a trusted client, and holds only its scopes otherwise', async () => {
    const s = await site(dir, { clients: [
      { id: 'jobs-admin', name: 'Jobs admin', redirectUris: [redirect], trusted: true },
      { id: 'other-app', name: 'Other app', redirectUris: [redirect] }
    ] })
    const { token: studio } = await user(s, 'admin30', 'admin')

    const trusted = await signIn(s, studio, 'jobs-admin')
    const session = await s.core.verifyAnyToken(trusted)
    // What a site's `auth: 'admin'` custom route checks
    expect(session?.role).toBe('admin')
    expect((await call(s, 'POST', '/api/collections/posts', trusted, { data: { title: 'hr' } })).status).toBe(201)

    const other = await signIn(s, studio, 'other-app')
    expect((await s.core.verifyAnyToken(other))?.role).toBe('api')
    expect((await call(s, 'GET', '/api/users', other)).status).not.toBe(200)
  })

  it('keeps a trusted client out of account security and administration, and lets it read the profile', async () => {
    const s = await site(dir, { clients: [{ id: 'jobs-admin', name: 'Jobs admin', redirectUris: [redirect], trusted: true }] })
    const { user: admin, token: studio } = await user(s, 'admin31', 'admin')
    const trusted = await signIn(s, studio, 'jobs-admin')

    const me = await call(s, 'GET', '/api/auth/me', trusted)
    expect(me.status).toBe(200)
    const profile = body<{ data: Record<string, unknown> }>(me).data
    expect(profile).toMatchObject({ id: admin.id, role: 'admin' })
    expect(profile.mfa).toBeUndefined()
    expect(profile.permissions).toBeUndefined()

    // A stolen application token must not be able to take the account or outlive the grant
    expect((await call(s, 'PUT', `/api/users/${admin.id}`, trusted, { mfa: { enabled: false, methods: [] }, email: 'attacker@example.com' })).status).toBe(403)
    expect((await call(s, 'POST', '/api/users', trusted, { username: 'x', email: 'x@example.com', password: 'TestPassword123!', role: 'admin' })).status).toBe(403)
    expect((await call(s, 'GET', '/api/users', trusted)).status).toBe(403)
    expect((await call(s, 'POST', '/api/tokens', trusted, { name: 'forever', permissions: ['content:read'] })).status).toBe(403)
    expect((await call(s, 'GET', '/api/tokens', trusted)).status).toBe(403)
    expect((await call(s, 'GET', '/api/webhooks', trusted)).status).toBe(403)
    expect((await call(s, 'PUT', '/api/config/settings', trusted, { settings: { siteName: 'x' } })).status).toBe(403)
    expect((await s.core.getUser(admin.id))?.email).toBe(`${admin.username}@example.com`)
    expect((await call(s, 'POST', '/api/auth/passkey/register/options', trusted, {})).status).toBe(403)
    expect((await call(s, 'POST', '/api/auth/refresh', undefined, { refreshToken: trusted })).status).not.toBe(200)
  })
})

describe('audit trail', () => {
  it('records the application that made a change for the user', async () => {
    const s = await site()
    const { token: studio } = await user(s, 'admin33', 'admin')
    const { device_code, user_code } = await call(s, 'POST', '/api/auth/device', undefined, { client_id: 'trokky-mcp', scope: 'content:read content:write' })
      .then(r => body<{ device_code: string; user_code: string }>(r))
    await approve(s, studio, user_code)
    const agent = body<{ access_token: string }>(await call(s, 'POST', '/api/auth/token', undefined, { grant_type: DEVICE_GRANT, device_code, client_id: 'trokky-mcp' })).access_token

    const byAgent = body<{ data: { document: { id: string } } }>(await call(s, 'POST', '/api/collections/posts', agent, { data: { title: 'Agent draft' } }))
    const byPerson = body<{ data: { document: { id: string } } }>(await call(s, 'POST', '/api/collections/posts', studio, { data: { title: 'My draft' } }))

    const history = async (id: string) =>
      body<{ data: { auditLogs: Array<{ actorUsername?: string; metadata?: { via?: { clientId: string; clientName: string } } }> } }>(
        await call(s, 'GET', `/api/audit-logs/documents/${id}`, studio)).data.auditLogs
    const agentEntry = (await history(byAgent.data.document.id))[0]
    expect(agentEntry.actorUsername).toBe('admin33')
    expect(agentEntry.metadata?.via).toEqual({ clientId: 'trokky-mcp', clientName: 'Trokky MCP (AI agent)' })
    expect((await history(byPerson.data.document.id))[0].metadata?.via).toBeUndefined()
  })
})

describe('built-in client', () => {
  it('cannot be made trusted through config', async () => {
    const s = await site(dir, { clients: [{ id: 'trokky-cli', name: 'CLI', redirectUris: [], trusted: true, grantTypes: ['urn:ietf:params:oauth:grant-type:device_code', 'refresh_token'] }] })
    const { token: studio } = await user(s, 'admin32', 'admin')
    const token = await deviceToken(s, studio, ['content:read'])
    expect((await s.core.verifyAnyToken(token))?.role).toBe('api')
  })
})

describe('flow store', () => {
  it('reads by taking and putting back when an adapter cannot read', async () => {
    const records = new Map<string, unknown>()
    const adapter = {
      saveAuthFlowState: async (state: { id: string }) => { records.set(state.id, state) },
      consumeAuthFlowState: async (id: string) => { const state = records.get(id) ?? null; records.delete(id); return state }
    }
    const state = { id: 'flow-x', kind: 'oauth2_device' as const, data: { a: 1 }, expiresAt: new Date(Date.now() + 60_000).toISOString() }
    await saveAuthFlowState(adapter as never, state)
    expect((await getAuthFlowState(adapter as never, 'flow-x', 'oauth2_device'))?.data).toEqual({ a: 1 })
    expect(records.has('flow-x')).toBe(true)
  })
})
