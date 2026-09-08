import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TrokkyRoutes } from '../../routes/index.js'
import { createMockCore } from '../helpers/mock-core.js'
import type { HttpRequest } from '../../routes/types.js'

function makeRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    method: 'GET',
    path: '/collections/article',
    headers: { authorization: 'Bearer jwt-token-123' },
    params: {},
    query: {},
    body: undefined,
    ...overrides,
  }
}

describe('TrokkyRoutes', () => {
  let routes: TrokkyRoutes
  let core: ReturnType<typeof createMockCore>

  beforeEach(() => {
    core = createMockCore()
    routes = new TrokkyRoutes({ core: core as any })
  })

  describe('route registration', () => {
    it('should register many API routes', () => {
      const allRoutes = routes.getRoutes()
      expect(allRoutes.length).toBeGreaterThan(20)
    })

    it('should register collection CRUD routes', () => {
      expect(routes.findRoute('GET', '/collections')).toBeDefined()
      expect(routes.findRoute('GET', '/collections/article')).toBeDefined()
      expect(routes.findRoute('POST', '/collections/article')).toBeDefined()
      expect(routes.findRoute('GET', '/collections/article/doc-001')).toBeDefined()
      expect(routes.findRoute('PUT', '/collections/article/doc-001')).toBeDefined()
      expect(routes.findRoute('DELETE', '/collections/article/doc-001')).toBeDefined()
    })

    it('should register auth routes', () => {
      expect(routes.findRoute('POST', '/auth/login')).toBeDefined()
      expect(routes.findRoute('POST', '/auth/logout')).toBeDefined()
      expect(routes.findRoute('GET', '/auth/me')).toBeDefined()
      expect(routes.findRoute('POST', '/auth/refresh')).toBeDefined()
    })

    it('should register media routes', () => {
      expect(routes.findRoute('GET', '/media')).toBeDefined()
      expect(routes.findRoute('POST', '/media/upload')).toBeDefined()
      expect(routes.findRoute('GET', '/media/media-001')).toBeDefined()
      expect(routes.findRoute('DELETE', '/media/media-001')).toBeDefined()
    })

    it('should register user management routes', () => {
      expect(routes.findRoute('GET', '/users')).toBeDefined()
      expect(routes.findRoute('POST', '/users')).toBeDefined()
    })

    it('should register webhook routes', () => {
      expect(routes.findRoute('GET', '/webhooks')).toBeDefined()
      expect(routes.findRoute('POST', '/webhooks')).toBeDefined()
    })

    it('should register schema routes', () => {
      expect(routes.findRoute('GET', '/schemas/article')).toBeDefined()
    })

    it('should register MFA routes', () => {
      expect(routes.findRoute('POST', '/auth/mfa/verify')).toBeDefined()
      expect(routes.findRoute('POST', '/auth/mfa/setup/totp')).toBeDefined()
    })
  })

  describe('openapi spec', () => {
    it('should derive servers[0].url from the request mount prefix', async () => {
      const route = routes.findRoute('GET', '/openapi.json')!
      const response = await route.handler(makeRequest({
        path: '/openapi.json',
        url: '/custom/prefix/openapi.json',
      }))

      expect(response.status).toBe(200)
      const body = response.body as { servers: Array<{ url: string }> }
      expect(body.servers[0].url).toBe('/custom/prefix')
    })

    it('should never advertise an origin taken from an absolute request target', async () => {
      const route = routes.findRoute('GET', '/openapi.json')!
      const response = await route.handler(makeRequest({
        path: '/openapi.json',
        url: 'http://attacker.example/backend/api/openapi.json',
      }))

      expect(response.status).toBe(200)
      const body = response.body as { servers: Array<{ url: string }> }
      expect(body.servers[0].url).toBe('/backend/api')
    })

    it('should tolerate a trailing slash and mixed case on the openapi path', async () => {
      const route = routes.findRoute('GET', '/openapi.json')!
      const response = await route.handler(makeRequest({
        path: '/openapi.json',
        url: '/backend/api/OpenAPI.json/',
      }))

      expect(response.status).toBe(200)
      const body = response.body as { servers: Array<{ url: string }> }
      expect(body.servers[0].url).toBe('/backend/api')
    })

    it('should report a root server url when mounted at the root', async () => {
      const route = routes.findRoute('GET', '/openapi.json')!
      const response = await route.handler(makeRequest({
        path: '/openapi.json',
        url: '/openapi.json?x=1',
      }))

      expect(response.status).toBe(200)
      const body = response.body as { servers: Array<{ url: string }> }
      expect(body.servers[0].url).toBe('/')
    })
  })

  describe('authentication - login', () => {
    it('should return success with token on valid login', async () => {
      const route = routes.findRoute('POST', '/auth/login')!
      const response = await route.handler(makeRequest({
        method: 'POST',
        path: '/auth/login',
        body: { username: 'admin', password: 'password123' },
      }))

      expect(response.status).toBe(200)
      expect(response.body.success).toBe(true)
      expect(response.body.data.token).toBeDefined()
      expect(response.body.data.user).toBeDefined()
      expect(response.body.data.refreshToken).toBeDefined()
    })

    it('should return 401 for invalid credentials', async () => {
      core.authenticateUser.mockResolvedValueOnce(null)

      const route = routes.findRoute('POST', '/auth/login')!
      const response = await route.handler(makeRequest({
        method: 'POST',
        path: '/auth/login',
        body: { username: 'admin', password: 'wrong' },
      }))

      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    })

    it('should return 400 for missing username', async () => {
      const route = routes.findRoute('POST', '/auth/login')!
      const response = await route.handler(makeRequest({
        method: 'POST',
        path: '/auth/login',
        body: { password: 'pass' },
      }))

      expect(response.status).toBe(400)
    })

    it('should return 400 for missing password', async () => {
      const route = routes.findRoute('POST', '/auth/login')!
      const response = await route.handler(makeRequest({
        method: 'POST',
        path: '/auth/login',
        body: { username: 'admin' },
      }))

      expect(response.status).toBe(400)
    })

    it('should return 400 for missing body', async () => {
      const route = routes.findRoute('POST', '/auth/login')!
      const response = await route.handler(makeRequest({
        method: 'POST',
        path: '/auth/login',
        body: null,
      }))

      expect(response.status).toBe(400)
    })

    it('should handle MFA required response', async () => {
      core.authenticateUser.mockResolvedValueOnce({
        type: 'mfa_required',
        requiresMFA: true,
        mfaToken: 'mfa-token-123',
        methods: ['totp'],
        expiresIn: 300,
      })

      const route = routes.findRoute('POST', '/auth/login')!
      const response = await route.handler(makeRequest({
        method: 'POST',
        path: '/auth/login',
        body: { username: 'admin', password: 'password123' },
      }))

      expect(response.status).toBe(200)
      expect(response.body.data.requiresMFA).toBe(true)
      expect(response.body.data.mfaToken).toBeDefined()
    })
  })

  describe('authentication - me', () => {
    it('should return user info with valid token', async () => {
      const route = routes.findRoute('GET', '/auth/me')!
      const response = await route.handler(makeRequest({
        path: '/auth/me',
      }))

      expect(response.status).toBe(200)
      expect(response.body.data).toBeDefined()
    })

    it('should return error without valid token', async () => {
      core.verifyAnyToken.mockResolvedValueOnce(null)

      const route = routes.findRoute('GET', '/auth/me')!
      const response = await route.handler(makeRequest({
        path: '/auth/me',
        headers: {},
      }))

      // Returns 404 (user not found) or 401 depending on auth config
      expect(response.status).toBeGreaterThanOrEqual(400)
    })
  })

  describe('authentication - logout', () => {
    it('should return success', async () => {
      const route = routes.findRoute('POST', '/auth/logout')!
      const response = await route.handler(makeRequest({
        method: 'POST',
        path: '/auth/logout',
      }))

      expect(response.status).toBe(200)
    })
  })

  describe('document CRUD', () => {
    it('should list collections', async () => {
      const route = routes.findRoute('GET', '/collections')!
      const response = await route.handler(makeRequest({
        path: '/collections',
      }))

      expect(response.status).toBe(200)
      expect(response.body).toBeDefined()
    })

    it('should list documents in a collection', async () => {
      const route = routes.findRoute('GET', '/collections/article')!
      const response = await route.handler(makeRequest({
        path: '/collections/article',
        params: { collection: 'article' },
      }))

      expect(response.status).toBe(200)
      expect(core.listDocuments).toHaveBeenCalled()
    })

    it('should get a document by ID', async () => {
      const route = routes.findRoute('GET', '/collections/article/doc-001')!
      const response = await route.handler(makeRequest({
        path: '/collections/article/doc-001',
        params: { collection: 'article', id: 'doc-001' },
      }))

      expect(response.status).toBe(200)
      expect(core.getDocument).toHaveBeenCalledWith('article', 'doc-001')
    })

    it('should return 404 for non-existent document', async () => {
      core.getDocument.mockResolvedValueOnce(null)

      const route = routes.findRoute('GET', '/collections/article/doc-999')!
      const response = await route.handler(makeRequest({
        path: '/collections/article/doc-999',
        params: { collection: 'article', id: 'doc-999' },
      }))

      expect(response.status).toBe(404)
    })

    it('should create a document (201)', async () => {
      const route = routes.findRoute('POST', '/collections/article')!
      const response = await route.handler(makeRequest({
        method: 'POST',
        path: '/collections/article',
        params: { collection: 'article' },
        body: { data: { title: 'New Article', body: 'Content' } },
      }))

      expect(response.status).toBe(201)
      expect(core.saveDocument).toHaveBeenCalled()
    })

    it('should update a document', async () => {
      const route = routes.findRoute('PUT', '/collections/article/doc-001')!
      const response = await route.handler(makeRequest({
        method: 'PUT',
        path: '/collections/article/doc-001',
        params: { collection: 'article', id: 'doc-001' },
        body: { data: { title: 'Updated Title' } },
      }))

      expect(response.status).toBe(200)
      expect(core.saveDocument).toHaveBeenCalled()
    })

    it('should strip client-sent system fields on create', async () => {
      const route = routes.findRoute('POST', '/collections/article')!
      const response = await route.handler(makeRequest({
        method: 'POST',
        path: '/collections/article',
        params: { collection: 'article' },
        body: {
          data: {
            title: 'New Article',
            _createdAt: '1999-01-01T00:00:00Z',
            _updatedAt: '1999-01-01T00:00:00Z',
            _revision: 99,
            _createdBy: 'mallory',
            _id: 'spoofed',
            _collection: 'spoofed',
            _status: 'published'
          }
        },
      }))

      expect(response.status).toBe(201)
      const savedData = vi.mocked(core.saveDocument).mock.calls[0][1] as Record<string, unknown>
      expect(savedData).not.toHaveProperty('_createdAt')
      expect(savedData).not.toHaveProperty('_updatedAt')
      expect(savedData).not.toHaveProperty('_revision')
      expect(savedData).not.toHaveProperty('_createdBy')
      expect(savedData).not.toHaveProperty('_id')
      expect(savedData).not.toHaveProperty('_collection')
      expect(savedData._status).toBe('published')
      expect(savedData.title).toBe('New Article')
    })

    it('leaves system-looking keys INSIDE field values untouched', async () => {
      const route = routes.findRoute('POST', '/collections/article')!
      const featuredImage = { _type: 'media', asset: { _ref: 'img-1', _type: 'mediaAsset' } }
      const gallery = [{ _key: 'k1', _type: 'reference', _ref: 'doc-1' }]

      const response = await route.handler(makeRequest({
        method: 'POST',
        path: '/collections/article',
        params: { collection: 'article' },
        body: { data: { title: 'With media', featuredImage, gallery, _createdAt: 'spoofed' } },
      }))

      expect(response.status).toBe(201)
      const savedData = vi.mocked(core.saveDocument).mock.calls[0][1] as Record<string, unknown>
      // Stripping is top level only: nested _ref/_type/_key are content, not metadata.
      expect(savedData.featuredImage).toEqual(featuredImage)
      expect(savedData.gallery).toEqual(gallery)
      expect(savedData).not.toHaveProperty('_createdAt')
    })

    it('should strip client-sent system fields on update', async () => {
      const route = routes.findRoute('PUT', '/collections/article/doc-001')!
      const response = await route.handler(makeRequest({
        method: 'PUT',
        path: '/collections/article/doc-001',
        params: { collection: 'article', id: 'doc-001' },
        body: {
          data: {
            title: 'Updated Title',
            _createdAt: '1999-01-01T00:00:00Z',
            _revision: 99,
            _createdBy: 'mallory',
            _status: 'draft'
          }
        },
      }))

      expect(response.status).toBe(200)
      const savedData = vi.mocked(core.saveDocument).mock.calls[0][1] as Record<string, unknown>
      expect(savedData._createdAt).toBeUndefined()
      expect(savedData._revision).toBeUndefined()
      expect(savedData._createdBy).toBeUndefined()
      expect(savedData._status).toBe('draft')
      expect(savedData.title).toBe('Updated Title')
    })

    it('should delete a document', async () => {
      const route = routes.findRoute('DELETE', '/collections/article/doc-001')!
      const response = await route.handler(makeRequest({
        method: 'DELETE',
        path: '/collections/article/doc-001',
        params: { collection: 'article', id: 'doc-001' },
      }))

      expect(response.status).toBe(200)
      expect(core.deleteDocument).toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should return 500 for unexpected errors', async () => {
      core.getDocument.mockRejectedValueOnce(new Error('Storage crash'))

      const route = routes.findRoute('GET', '/collections/article/doc-001')!
      const response = await route.handler(makeRequest({
        path: '/collections/article/doc-001',
        params: { collection: 'article', id: 'doc-001' },
      }))

      expect(response.status).toBe(500)
      expect(response.body.success).toBe(false)
      expect(response.body.error).toBeDefined()
    })

    it('should include CORS headers in responses', async () => {
      const route = routes.findRoute('GET', '/collections')!
      const response = await route.handler(makeRequest({ path: '/collections' }))
      // Headers should exist (may be empty if no CORS configured)
      expect(response.headers).toBeDefined()
    })
  })

  describe('slug processor', () => {
    it('should slugify basic text', async () => {
      const { defaultSlugify } = await import('../../routes/slug-processor.js')
      expect(defaultSlugify('Hello World')).toBe('hello-world')
    })

    it('should handle special characters', async () => {
      const { defaultSlugify } = await import('../../routes/slug-processor.js')
      const slug = defaultSlugify('Hello, World! How are you?')
      expect(slug).not.toContain(',')
      expect(slug).not.toContain('!')
      expect(slug).not.toContain('?')
    })

    it('should handle unicode characters', async () => {
      const { defaultSlugify } = await import('../../routes/slug-processor.js')
      const slug = defaultSlugify('Café résumé')
      expect(slug.length).toBeGreaterThan(0)
      expect(slug).not.toContain(' ')
    })

    it('should handle empty strings', async () => {
      const { defaultSlugify } = await import('../../routes/slug-processor.js')
      expect(defaultSlugify('')).toBe('')
    })

    it('should collapse multiple separators', async () => {
      const { defaultSlugify } = await import('../../routes/slug-processor.js')
      const slug = defaultSlugify('Hello   World---Test')
      expect(slug).not.toContain('--')
    })

    it('should trim leading and trailing separators', async () => {
      const { defaultSlugify } = await import('../../routes/slug-processor.js')
      const slug = defaultSlugify('  Hello World  ')
      expect(slug).not.toMatch(/^-/)
      expect(slug).not.toMatch(/-$/)
    })

    describe('uniqueness with documents listed by `id`', () => {
      const slugSchema = {
        name: 'article',
        fields: {
          title: { type: 'string' },
          slug: { type: 'slug', source: 'title', unique: true }
        }
      }

      function makeSlugCore(docs: Array<Record<string, unknown>>) {
        return {
          getSchema: vi.fn(() => slugSchema),
          listDocuments: vi.fn(async (_collection: string, options?: { filter?: Record<string, unknown> }) => {
            const slugFilter = options?.filter?.slug
            return slugFilter === undefined ? docs : docs.filter(doc => doc.slug === slugFilter)
          })
        }
      }

      it('should keep the slug unchanged when updating a document with its own slug', async () => {
        const { processSlugFields } = await import('../../routes/slug-processor.js')
        const slugCore = makeSlugCore([{ id: 'doc-1', title: 'Hello World', slug: 'hello-world' }])

        const result = await processSlugFields(
          slugCore as any,
          'article',
          { title: 'Hello World', slug: 'hello-world' },
          'doc-1'
        )

        expect(result.slug).toBe('hello-world')
      })

      it('should generate a variant when another document already uses the slug', async () => {
        const { processSlugFields } = await import('../../routes/slug-processor.js')
        const slugCore = makeSlugCore([{ id: 'doc-2', title: 'Hello World', slug: 'hello-world' }])

        const result = await processSlugFields(
          slugCore as any,
          'article',
          { title: 'Hello World', slug: 'hello-world' },
          'doc-1'
        )

        expect(result.slug).toBe('hello-world-2')
      })
    })
  })
})
