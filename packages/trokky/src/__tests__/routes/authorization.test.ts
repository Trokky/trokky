/**
 * Permission checks on media and token routes, API token expiry, and the
 * fetch handler's authentication default.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { TrokkyCore } from '../../core/core/engine.js'
import { TrokkyRoutes } from '../../routes/index.js'
import type { HttpResponse } from '../../types/http.js'
import { createFetchHandler } from '../../integrations/workers/index.js'
import {
  createTestCore,
  createTestRoutes,
  createAuthenticatedUser,
  createMockRequest,
  executeRoute
} from '../helpers/test-helpers.js'

interface TokenCreated {
  success: boolean
  data?: { token: string; appToken: { createdBy: string; permissions: string[] } }
}

function body<T>(response: HttpResponse): T {
  return (typeof response.body === 'string' ? JSON.parse(response.body) : response.body) as T
}

describe('route authorization', () => {
  let routes: TrokkyRoutes
  let core: TrokkyCore
  let dataAdapter: Awaited<ReturnType<typeof createTestRoutes>>['dataAdapter']

  beforeEach(async () => {
    const setup = await createTestRoutes()
    routes = setup.routes
    core = setup.core
    dataAdapter = setup.dataAdapter
  })

  async function apiToken(permissions: string[], expiresAt?: string): Promise<string> {
    const result = await core.createAppToken({ name: `t-${permissions.join('-')}`, permissions, expiresAt } as never, 'user-1')
    if (!result.token) throw new Error('token creation failed')
    return result.token
  }

  function call(method: string, path: string, token?: string, requestBody?: unknown): Promise<HttpResponse> {
    return executeRoute(routes, createMockRequest({
      method,
      path,
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: requestBody
    }))
  }

  describe('media routes', () => {
    it('should reject anonymous media listing', async () => {
      expect((await call('GET', '/api/media')).status).toBe(401)
    })

    it('should forbid a content-only API token from listing or deleting media', async () => {
      const token = await apiToken(['content:read'])
      expect((await call('GET', '/api/media', token)).status).toBe(403)
      expect((await call('DELETE', '/api/media/missing', token)).status).toBe(403)
      expect((await call('POST', '/api/media/bulk-delete', token, { ids: ['missing'] })).status).toBe(403)
    })

    it('should let a media:read API token list media but not delete it', async () => {
      const token = await apiToken(['media:read'])
      expect((await call('GET', '/api/media', token)).status).toBe(200)
      expect((await call('DELETE', '/api/media/missing', token)).status).toBe(403)
      expect((await call('PUT', '/api/media/missing', token, { alt: 'x' })).status).toBe(403)
    })

    it('should let a media:delete API token past the permission check', async () => {
      const token = await apiToken(['media:delete'])
      const status = (await call('DELETE', '/api/media/missing', token)).status
      expect(status).not.toBe(401)
      expect(status).not.toBe(403)
    })

    it('should require media:read to get one asset', async () => {
      expect((await call('GET', '/api/media/missing')).status).toBe(401)
      expect((await call('GET', '/api/media/missing', await apiToken(['content:read']))).status).toBe(403)
      expect((await call('GET', '/api/media/missing', await apiToken(['media:read']))).status).toBe(404)
    })

    it('should require the matching permission for upload, edit and bulk delete', async () => {
      const reader = await apiToken(['media:read'])
      expect((await call('POST', '/api/media/upload', reader)).status).toBe(403)
      expect((await call('POST', '/api/media/missing/regenerate-variants', reader)).status).toBe(403)
      expect((await call('POST', '/api/media/bulk-delete', reader, { ids: ['missing'] })).status).toBe(403)

      const uploader = await apiToken(['media:upload'])
      expect([401, 403]).not.toContain((await call('POST', '/api/media/upload', uploader)).status)
      const editor = await apiToken(['media:edit'])
      expect([401, 403]).not.toContain((await call('POST', '/api/media/missing/regenerate-variants', editor)).status)
      const deleter = await apiToken(['media:delete'])
      expect([401, 403]).not.toContain((await call('POST', '/api/media/bulk-delete', deleter, { ids: ['missing'] })).status)
    })

    it('should accept the media:* wildcard on an API token', async () => {
      const token = await apiToken(['media:*'])
      expect((await call('GET', '/api/media', token)).status).toBe(200)
    })

    it('should grant a user their role defaults even when stored permissions predate them', async () => {
      // Stored permissions are a snapshot; this editor was created without media:read
      const user = await core.createUser({
        username: 'oldeditor',
        email: 'old@example.com',
        password: 'TestPassword123!',
        role: 'editor',
        permissions: ['content:read']
      } as never)
      const token = await core.generateAuthToken(user)
      expect((await call('GET', '/api/media', token)).status).toBe(200)
    })

    it('should forbid a viewer from deleting media', async () => {
      const { token } = await createAuthenticatedUser(core, { role: 'viewer', username: 'viewer1', email: 'v@example.com' })
      expect((await call('GET', '/api/media', token)).status).toBe(200)
      expect((await call('DELETE', '/api/media/missing', token)).status).toBe(403)
    })
  })

  describe('token routes', () => {
    it('should forbid an editor from listing or creating API tokens', async () => {
      const { token } = await createAuthenticatedUser(core, { role: 'editor', username: 'editor1', email: 'e@example.com' })
      expect((await call('GET', '/api/tokens', token)).status).toBe(403)
      expect((await call('POST', '/api/tokens', token, { name: 'x', permissions: ['content:read'] })).status).toBe(403)
    })

    it('should record the admin who created a token', async () => {
      const { user, token } = await createAuthenticatedUser(core, { role: 'admin', username: 'admin1', email: 'a@example.com' })
      const response = await call('POST', '/api/tokens', token, { name: 'agent', permissions: ['content:read'] })
      expect(response.status).toBe(201)
      expect(body<TokenCreated>(response).data?.appToken.createdBy).toBe(user.id)
    })

    it('should refuse to mint a token with permissions the caller lacks', async () => {
      const minter = await apiToken(['tokens:write', 'content:read'])
      const escalate = await call('POST', '/api/tokens', minter, { name: 'x', permissions: ['content:read', 'content:write'] })
      expect(escalate.status).toBe(403)
      const allowed = await call('POST', '/api/tokens', minter, { name: 'y', permissions: ['content:read'] })
      expect(allowed.status).toBe(201)
    })

    it('should refuse a wildcard the caller does not hold as a wildcard', async () => {
      const minter = await apiToken(['tokens:write', 'content:read', 'content:write'])
      expect((await call('POST', '/api/tokens', minter, { name: 'x', permissions: ['content:*'] })).status).toBe(403)
    })

    it('should reject a past or malformed expiry', async () => {
      const { token } = await createAuthenticatedUser(core, { role: 'admin', username: 'admin2', email: 'a2@example.com' })
      const past = await call('POST', '/api/tokens', token, { name: 'x', permissions: ['content:read'], expiresAt: '2000-01-01T00:00:00Z' })
      expect(past.status).toBe(400)
      const garbage = await call('POST', '/api/tokens', token, { name: 'x', permissions: ['content:read'], expiresAt: 'soon' })
      expect(garbage.status).toBe(400)
    })

    it('should reject a token request without a permission list', async () => {
      const { token } = await createAuthenticatedUser(core, { role: 'admin', username: 'admin3', email: 'a3@example.com' })
      expect((await call('POST', '/api/tokens', token, { name: 'x', permissions: 'content:read' })).status).toBe(400)
      expect((await call('POST', '/api/tokens', token, { name: 'x', permissions: [] })).status).toBe(400)
    })

    it('should require tokens:read and tokens:write for the single-token routes', async () => {
      const token = await apiToken(['content:read'])
      expect((await call('GET', '/api/tokens/whatever', token)).status).toBe(403)
      expect((await call('PUT', '/api/tokens/whatever', token, { name: 'x' })).status).toBe(403)
    })

    it('should reject non-string and malformed permissions', async () => {
      const { token } = await createAuthenticatedUser(core, { role: 'admin', username: 'admin4', email: 'a4@example.com' })
      for (const permissions of [['content:read', 5], ['media'], ['media:'], ['media:read:extra'], ['media:*:x']]) {
        expect((await call('POST', '/api/tokens', token, { name: 'x', permissions })).status).toBe(400)
      }
    })

    it('should let an admin grant a wildcard no role lists', async () => {
      const { token } = await createAuthenticatedUser(core, { role: 'admin', username: 'admin5', email: 'a5@example.com' })
      expect((await call('POST', '/api/tokens', token, { name: 'x', permissions: ['content:*'] })).status).toBe(201)
    })

    it('should stop an API token from granting token permissions', async () => {
      const minter = await apiToken(['tokens:read', 'tokens:write', 'content:read'])
      expect((await call('POST', '/api/tokens', minter, { name: 'x', permissions: ['tokens:write'] })).status).toBe(403)
      expect((await call('POST', '/api/tokens', minter, { name: 'x', permissions: ['tokens:read'] })).status).toBe(403)
    })

    it('should stop an expiring API token from minting a longer-lived one', async () => {
      const parentExpiry = Date.now() + 3_600_000
      const minter = await apiToken(['tokens:write', 'content:read'], new Date(parentExpiry).toISOString())
      const forever = await call('POST', '/api/tokens', minter, { name: 'x', permissions: ['content:read'] })
      expect(forever.status).toBe(403)
      const later = await call('POST', '/api/tokens', minter, {
        name: 'x', permissions: ['content:read'], expiresAt: new Date(parentExpiry + 60_000).toISOString()
      })
      expect(later.status).toBe(403)
      const sooner = await call('POST', '/api/tokens', minter, {
        name: 'x', permissions: ['content:read'], expiresAt: new Date(parentExpiry - 60_000).toISOString()
      })
      expect(sooner.status).toBe(201)
    })

    it('should never let an API token act as the user who created it', async () => {
      const { user, token } = await createAuthenticatedUser(core, { role: 'admin', username: 'admin6', email: 'a6@example.com' })
      const minted = body<TokenCreated>(await call('POST', '/api/tokens', token, { name: 'site', permissions: ['content:read'] }))
      const apiKey = minted.data?.token as string
      expect(minted.data?.appToken.createdBy).toBe(user.id)

      const session = await core.verifyAnyToken(apiKey)
      expect(session?.role).toBe('api')
      expect(session?.userId).not.toBe(user.id)

      const me = await call('GET', '/api/auth/me', apiKey)
      expect(me.status).not.toBe(200)
      expect(JSON.stringify(me.body)).not.toContain(user.id)
    })

    it('should forbid deleting a token without tokens:delete', async () => {
      const token = await apiToken(['tokens:read'])
      expect((await call('DELETE', '/api/tokens/whatever', token)).status).toBe(403)
    })
  })

  describe('publishing on create', () => {
    it('should refuse to create a published document without publish permission', async () => {
      const writer = await apiToken(['content:read', 'content:write'])
      const published = await call('POST', '/api/collections/posts', writer, { data: { title: 'Live', _status: 'published' } })
      expect(published.status).toBe(403)
      const draft = await call('POST', '/api/collections/posts', writer, { data: { title: 'Draft', _status: 'draft' } })
      expect(draft.status).toBe(201)
    })

    it('should not let a create with an existing id unpublish without publish permission', async () => {
      const publisher = await apiToken(['content:*'])
      const live = body<{ data: { document: { id: string } } }>(await call('POST', '/api/collections/posts', publisher, { data: { title: 'Live', _status: 'published' } }))
      const id = live.data.document.id
      const writer = await apiToken(['content:read', 'content:write'])
      const overwrite = await call('POST', '/api/collections/posts', writer, { id, data: { title: 'Defaced', _status: 'draft' } })
      expect(overwrite.status).toBe(403)
      const omitted = await call('POST', '/api/collections/posts', writer, { id, data: { title: 'Defaced' } })
      expect(omitted.status).toBe(403)
      expect(((await core.getDocument('posts', id)) as { _status?: string })._status).toBe('published')
    })

    it('should reject a status other than draft or published', async () => {
      const token = await apiToken(['content:*'])
      for (const status of ['Published', ' published', 'live', ['published']]) {
        expect((await call('POST', '/api/collections/posts', token, { data: { title: 'x', _status: status } })).status).toBe(400)
      }
      const created = body<{ data: { document: { id: string } } }>(await call('POST', '/api/collections/posts', token, { data: { title: 'x' } }))
      expect((await call('PUT', `/api/collections/posts/${created.data.document.id}`, token, { data: { _status: 'LIVE' } })).status).toBe(400)
    })

    it('should create a published document with publish permission', async () => {
      const publisher = await apiToken(['content:read', 'content:write', 'content:publish'])
      const published = await call('POST', '/api/collections/posts', publisher, { data: { title: 'Live', _status: 'published' } })
      expect(published.status).toBe(201)
    })
  })

  describe('search', () => {
    async function seed(): Promise<void> {
      await core.saveDocument('posts', { title: 'Secret budget post' } as never)
      await core.saveDocument('authors', { name: 'Budget Author' } as never)
    }

    function search(q: string, token: string): Promise<HttpResponse> {
      const request = createMockRequest({ method: 'GET', path: '/api/search', headers: { authorization: `Bearer ${token}` } })
      return executeRoute(routes, { ...request, url: `/api/search?q=${encodeURIComponent(q)}` })
    }

    function titles(response: HttpResponse): string[] {
      return (body<{ data: { results: Array<{ title: string }> } }>(response).data.results).map(r => r.title)
    }

    it('should return only collections the token may read', async () => {
      await seed()
      const authorsOnly = await apiToken(['authors:read'])
      const response = await search('budget', authorsOnly)
      expect(response.status).toBe(200)
      expect(titles(response)).toEqual(['Budget Author'])
    })

    it('should honour content:* and collection wildcards', async () => {
      await seed()
      expect(titles(await search('budget', await apiToken(['content:*']))).sort()).toEqual(['Budget Author', 'Secret budget post'])
      expect(titles(await search('budget', await apiToken(['authors:*'])))).toEqual(['Budget Author'])
    })

    it('should verify the token once per search', async () => {
      const token = await apiToken(['content:read'])
      const verify = vi.spyOn(core, 'verifyAnyToken')
      try {
        await search('budget', token)
        expect(verify).toHaveBeenCalledTimes(1)
      } finally {
        verify.mockRestore()
      }
    })

    it('should reject an anonymous search', async () => {
      const request = createMockRequest({ method: 'GET', path: '/api/search' })
      expect((await executeRoute(routes, { ...request, url: '/api/search?q=budget' })).status).toBe(401)
    })

    it('should return every readable collection for content:read', async () => {
      await seed()
      const reader = await apiToken(['content:read'])
      expect(titles(await search('budget', reader)).sort()).toEqual(['Budget Author', 'Secret budget post'])
    })

    it('should leave media out without media:read', async () => {
      await core.uploadMedia(new File([new Uint8Array([1, 2, 3])], 'budget.png', { type: 'image/png' }))
      const reader = await apiToken(['content:read'])
      const withoutMedia = body<{ data: { results: Array<{ type: string }> } }>(await search('budget', reader))
      expect(withoutMedia.data.results.some(r => r.type === 'media')).toBe(false)
      const mediaReader = await apiToken(['media:read'])
      const withMedia = body<{ data: { results: Array<{ type: string }> } }>(await search('budget', mediaReader))
      expect(withMedia.data.results.some(r => r.type === 'media')).toBe(true)
    })
  })

  describe('API token expiry', () => {
    it('should reject an expired API token', async () => {
      const token = await apiToken(['media:read'], '2000-01-01T00:00:00Z')
      expect((await call('GET', '/api/media', token)).status).toBe(401)
    })

    it('should reject an API token whose expiry cannot be parsed', async () => {
      const token = await apiToken(['media:read'], 'not-a-date')
      expect((await call('GET', '/api/media', token)).status).toBe(401)
    })

    it('should accept a valid token even when its usage record cannot be written', async () => {
      const token = await apiToken(['media:read'])
      const save = vi.spyOn(dataAdapter, 'saveAppToken').mockRejectedValue(new Error('ENOENT: rename'))
      try {
        expect((await call('GET', '/api/media', token)).status).toBe(200)
      } finally {
        save.mockRestore()
      }
    })

    it('should accept an API token that has not expired yet', async () => {
      const token = await apiToken(['media:read'], new Date(Date.now() + 3_600_000).toISOString())
      expect((await call('GET', '/api/media', token)).status).toBe(200)
    })
  })
})

describe('token routes with authentication disabled', () => {
  it('should create a token attributed to system', async () => {
    const { core } = createTestCore()
    await core.init()
    const routes = new TrokkyRoutes({ core, basePath: '/api', authentication: { enabled: false } })
    const response = await executeRoute(routes, createMockRequest({
      method: 'POST', path: '/api/tokens', body: { name: 'x', permissions: ['content:read'] }
    }))
    expect(response.status).toBe(201)
    expect(body<TokenCreated>(response).data?.appToken.createdBy).toBe('system')
  })
})

describe('createFetchHandler authentication default', () => {
  async function handler(options: Record<string, unknown> = {}) {
    const { core } = createTestCore()
    await core.init()
    return createFetchHandler({ core, basePath: '/api', ...options })
  }

  it('should require authentication when no option is given', async () => {
    const api = await handler()
    expect((await api(new Request('http://x/api/users'))).status).toBe(401)
    expect((await api(new Request('http://x/api/collections/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: { title: 'anon' } })
    }))).status).toBe(401)
    expect((await api(new Request('http://x/api/tokens', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'x', permissions: ['content:read'] })
    }))).status).toBe(401)
  })

  it('should keep public routes public', async () => {
    const api = await handler()
    expect((await api(new Request('http://x/api/health'))).status).toBe(200)
    expect((await api(new Request('http://x/api/config/studio'))).status).toBe(200)
  })

  it('should stay on when a partial authentication object is given', async () => {
    for (const authentication of [{}, { publicPaths: ['/health'] }, { headerName: 'X-Api-Key' }]) {
      const api = await handler({ authentication })
      expect((await api(new Request('http://x/api/users'))).status).toBe(401)
    }
  })

  it('should honour an explicit opt-out', async () => {
    const api = await handler({ authentication: { enabled: false } })
    expect((await api(new Request('http://x/api/collections/posts'))).status).toBe(200)
  })
})
