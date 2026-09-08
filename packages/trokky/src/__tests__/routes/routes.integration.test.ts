/**
 * Integration tests for TrokkyRoutes.
 *
 * Routes are resolved through the real registrar (findRoute + extractParams)
 * and executed against a real TrokkyCore backed by in-memory adapters.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { TrokkyCore } from '../../core/core/engine.js'
import type { Document, User } from '../../core/types/index.js'
import type { TrokkyRoutes } from '../../routes/index.js'
import {
  createAuthenticatedUser,
  createMockRequest,
  createTestRoutes,
  executeRoute,
  parseResponseBody,
  MemoryDataAdapter,
  MemoryMediaAdapter
} from '../helpers/test-helpers.js'

interface CollectionSummary {
  name: string
}

interface CollectionsListData {
  collections: CollectionSummary[]
}

type PostDocument = Document & { title?: string; content?: string }

interface DocumentListData {
  documents: PostDocument[]
}

interface DocumentData {
  document: PostDocument
}

interface LoginData {
  token: string
  user: { username: string }
}

interface SessionData {
  username: string
}

interface ValidateData {
  valid: boolean
}

interface UserListData {
  users: User[]
}

interface UserData {
  user: User
}

interface SchemaData {
  schema: { name: string; fields: Record<string, unknown> }
}

interface HealthData {
  status: string
}

describe('TrokkyRoutes integration', () => {
  let routes: TrokkyRoutes
  let core: TrokkyCore
  let dataAdapter: MemoryDataAdapter
  let mediaAdapter: MemoryMediaAdapter

  beforeEach(async () => {
    const setup = await createTestRoutes()
    routes = setup.routes
    core = setup.core
    dataAdapter = setup.dataAdapter
    mediaAdapter = setup.mediaAdapter
  })

  afterEach(() => {
    dataAdapter.clear()
    mediaAdapter.clear()
    core.cleanup()
  })

  describe('GET /health', () => {
    it('should report a healthy status', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({ method: 'GET', path: '/api/health' })
      )
      const body = parseResponseBody<HealthData>(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data?.status).toBe('healthy')
    })
  })

  describe('collection routes', () => {
    let adminToken: string

    beforeEach(async () => {
      const auth = await createAuthenticatedUser(core, {
        username: 'collections-admin',
        email: 'collections-admin@example.com',
        role: 'admin'
      })
      adminToken = auth.token
    })

    it('should list all registered collections', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'GET',
          path: '/api/collections',
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      )
      const body = parseResponseBody<CollectionsListData>(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      const names = (body.data?.collections ?? []).map(c => c.name)
      expect(names).toContain('posts')
      expect(names).toContain('authors')
    })

    it('should list documents in a collection', async () => {
      await core.saveDocument('posts', { title: 'Test Post', content: 'Test content' })

      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'GET',
          path: '/api/collections/posts',
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      )
      const body = parseResponseBody<DocumentListData>(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data?.documents).toBeInstanceOf(Array)
      expect(body.data?.documents).toHaveLength(1)
      expect(body.data?.documents[0].title).toBe('Test Post')
    })

    it('should return 404 when listing an unknown collection', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'GET',
          path: '/api/collections/unknown',
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(404)
      expect(body.success).toBe(false)
    })

    it('should create a new document', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'POST',
          path: '/api/collections/posts',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: { data: { title: 'New Post', content: 'New content' } }
        })
      )
      const body = parseResponseBody<DocumentData>(response)

      expect(response.status).toBe(201)
      expect(body.success).toBe(true)
      expect(body.data?.document.title).toBe('New Post')
      expect(body.data?.document.id).toBeDefined()
      expect(body.data?.document._collection).toBe('posts')
    })

    it('should reject a document that is missing required fields', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'POST',
          path: '/api/collections/posts',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: { data: { content: 'Missing title' } }
        })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(400)
      expect(body.success).toBe(false)
    })

    it('should get a document by id', async () => {
      const doc = await core.saveDocument('posts', { title: 'Test Post', content: 'Test content' })

      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'GET',
          path: `/api/collections/posts/${doc.id}`,
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      )
      const body = parseResponseBody<DocumentData>(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data?.document.id).toBe(doc.id)
      expect(body.data?.document.title).toBe('Test Post')
    })

    it('should return 404 for a non-existent document', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'GET',
          path: '/api/collections/posts/non-existent-id',
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(404)
      expect(body.success).toBe(false)
    })

    it('should update a document and bump its revision', async () => {
      const doc = await core.saveDocument('posts', {
        title: 'Original Title',
        content: 'Original content'
      })

      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'PUT',
          path: `/api/collections/posts/${doc.id}`,
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: { data: { title: 'Updated Title', content: 'Updated content' } }
        })
      )
      const body = parseResponseBody<DocumentData>(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data?.document.title).toBe('Updated Title')
      expect(body.data?.document._revision ?? 0).toBeGreaterThan(doc._revision ?? 0)
    })

    it('should delete a document', async () => {
      const doc = await core.saveDocument('posts', {
        title: 'To Delete',
        content: 'Will be deleted'
      })

      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'DELETE',
          path: `/api/collections/posts/${doc.id}`,
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      await expect(core.getDocument('posts', doc.id)).resolves.toBeNull()
    })
  })

  describe('authentication routes', () => {
    const testPassword = 'TestPassword123!'
    let testUser: User

    beforeEach(async () => {
      testUser = await core.createUser({
        username: 'testuser',
        email: 'test@example.com',
        password: testPassword,
        firstName: 'Test',
        lastName: 'User',
        role: 'editor'
      })
    })

    it('should log in with valid credentials', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'POST',
          path: '/api/auth/login',
          headers: { 'Content-Type': 'application/json' },
          body: { username: 'testuser', password: testPassword }
        })
      )
      const body = parseResponseBody<LoginData>(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data?.token).toBeDefined()
      expect(body.data?.user.username).toBe('testuser')
    })

    it('should reject an invalid password', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'POST',
          path: '/api/auth/login',
          headers: { 'Content-Type': 'application/json' },
          body: { username: 'testuser', password: 'wrongpassword' }
        })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(401)
      expect(body.success).toBe(false)
    })

    it('should reject an unknown user', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'POST',
          path: '/api/auth/login',
          headers: { 'Content-Type': 'application/json' },
          body: { username: 'nonexistent', password: 'anypassword' }
        })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(401)
      expect(body.success).toBe(false)
    })

    it('should return the current user for a valid token', async () => {
      const token = await core.generateAuthToken(testUser)

      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'GET',
          path: '/api/auth/me',
          headers: { Authorization: `Bearer ${token}` }
        })
      )
      const body = parseResponseBody<SessionData>(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data?.username).toBe('testuser')
    })

    it('should reject /auth/me without a token', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({ method: 'GET', path: '/api/auth/me' })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(401)
      expect(body.success).toBe(false)
    })

    it('should report a valid token as valid', async () => {
      const token = await core.generateAuthToken(testUser)

      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'POST',
          path: '/api/auth/validate',
          headers: { 'Content-Type': 'application/json' },
          body: { token }
        })
      )
      const body = parseResponseBody<ValidateData>(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data?.valid).toBe(true)
    })

    it('should report an invalid token as not valid', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'POST',
          path: '/api/auth/validate',
          headers: { 'Content-Type': 'application/json' },
          body: { token: 'invalid-token' }
        })
      )
      const body = parseResponseBody<ValidateData>(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data?.valid).toBe(false)
    })
  })

  describe('user management routes', () => {
    let adminUser: User
    let adminToken: string

    beforeEach(async () => {
      const auth = await createAuthenticatedUser(core, {
        username: 'users-admin',
        email: 'users-admin@example.com',
        role: 'admin'
      })
      adminUser = auth.user
      adminToken = auth.token
    })

    it('should list users for an admin', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'GET',
          path: '/api/users',
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      )
      const body = parseResponseBody<UserListData>(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data?.users).toBeInstanceOf(Array)
    })

    it('should deny editors without the users:read permission', async () => {
      const { token } = await createAuthenticatedUser(core, {
        username: 'plain-editor',
        email: 'plain-editor@example.com',
        role: 'editor'
      })

      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'GET',
          path: '/api/users',
          headers: { Authorization: `Bearer ${token}` }
        })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(403)
      expect(body.success).toBe(false)
    })

    it('should create a user as an admin', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'POST',
          path: '/api/users',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json'
          },
          body: {
            username: 'newuser',
            email: 'new@example.com',
            password: 'NewPassword123!',
            firstName: 'New',
            lastName: 'User',
            role: 'viewer'
          }
        })
      )
      const body = parseResponseBody<UserData>(response)

      expect(response.status).toBe(201)
      expect(body.success).toBe(true)
      expect(body.data?.user.username).toBe('newuser')
    })

    it('should get a user by id', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'GET',
          path: `/api/users/${adminUser.id}`,
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      )
      const body = parseResponseBody<UserData>(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data?.user.id).toBe(adminUser.id)
    })
  })

  describe('schema routes', () => {
    let adminToken: string

    beforeEach(async () => {
      const auth = await createAuthenticatedUser(core, {
        username: 'schema-admin',
        email: 'schema-admin@example.com',
        role: 'admin'
      })
      adminToken = auth.token
    })

    it('should get a schema by name', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'GET',
          path: '/api/schemas/posts',
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      )
      const body = parseResponseBody<SchemaData>(response)

      expect(response.status).toBe(200)
      expect(body.success).toBe(true)
      expect(body.data?.schema.name).toBe('posts')
      expect(body.data?.schema.fields).toBeDefined()
    })

    it('should return 404 for an unknown schema', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'GET',
          path: '/api/schemas/unknown',
          headers: { Authorization: `Bearer ${adminToken}` }
        })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(404)
      expect(body.success).toBe(false)
    })
  })

  // Issue 008: authentication failures, permission denials and validation
  // errors used to collapse into a single 400 INVALID_INPUT response. These
  // tests pin the three status codes apart so they cannot merge again.
  describe('auth error status codes', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return 401 UNAUTHORIZED when the token is missing', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({ method: 'GET', path: '/api/collections' })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(401)
      expect(body.success).toBe(false)
      expect((body.error as { code?: string }).code).toBe('UNAUTHORIZED')
    })

    it('should return 401 UNAUTHORIZED for a malformed token', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'GET',
          path: '/api/collections',
          headers: { Authorization: 'Bearer not-a-real-token' }
        })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(401)
      expect((body.error as { code?: string }).code).toBe('UNAUTHORIZED')
    })

    it('should return 401 UNAUTHORIZED for an expired token', async () => {
      const { user } = await createAuthenticatedUser(core, {
        username: 'expiring-admin',
        email: 'expiring-admin@example.com',
        role: 'admin'
      })
      const shortLivedToken = await core.generateAuthToken(user, '1s')

      // The token is accepted while it is still valid...
      const beforeExpiry = await executeRoute(
        routes,
        createMockRequest({
          method: 'GET',
          path: '/api/collections',
          headers: { Authorization: `Bearer ${shortLivedToken}` }
        })
      )
      expect(beforeExpiry.status).toBe(200)

      // ...and rejected once its exp claim is in the past.
      vi.setSystemTime(new Date(Date.now() + 60_000))

      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'GET',
          path: '/api/collections',
          headers: { Authorization: `Bearer ${shortLivedToken}` }
        })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(401)
      expect((body.error as { code?: string }).code).toBe('UNAUTHORIZED')
    })

    it('should return 401 UNAUTHORIZED for wrong login credentials', async () => {
      await createAuthenticatedUser(core, {
        username: 'login-check',
        email: 'login-check@example.com',
        password: 'CorrectPassword123!',
        role: 'editor'
      })

      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'POST',
          path: '/api/auth/login',
          headers: { 'Content-Type': 'application/json' },
          body: { username: 'login-check', password: 'WrongPassword123!' }
        })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(401)
      expect((body.error as { code?: string }).code).toBe('UNAUTHORIZED')
    })

    it('should return 403 FORBIDDEN when an authenticated user lacks the permission', async () => {
      const doc = await core.saveDocument('posts', { title: 'Protected', content: 'Body' })
      const { token } = await createAuthenticatedUser(core, {
        username: 'viewer-user',
        email: 'viewer-user@example.com',
        role: 'viewer'
      })

      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'DELETE',
          path: `/api/collections/posts/${doc.id}`,
          headers: { Authorization: `Bearer ${token}` }
        })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(403)
      expect(body.success).toBe(false)
      expect((body.error as { code?: string }).code).toBe('FORBIDDEN')
    })

    it('should return 403 FORBIDDEN when an authenticated user lacks admin access', async () => {
      // validateAdminAccess guards user management, webhooks and settings. It denies on a
      // missing permission, not a missing identity, so it must be 403: a 401 sends the
      // Studio into a token refresh and, on failure, signs the editor out for what is
      // really an authorisation decision.
      const { token } = await createAuthenticatedUser(core, {
        username: 'editor-user',
        email: 'editor-user@example.com',
        role: 'editor'
      })

      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'POST',
          path: '/api/users',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: { username: 'new-user', email: 'new-user@example.com', password: 'Passw0rd!x' }
        })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(403)
      expect((body.error as { code?: string }).code).toBe('FORBIDDEN')
    })

    it('should still return 400 INVALID_INPUT for a genuine bad request', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({
          method: 'POST',
          path: '/api/auth/login',
          headers: { 'Content-Type': 'application/json' },
          body: { username: 'someone' }
        })
      )
      const body = parseResponseBody(response)

      expect(response.status).toBe(400)
      expect((body.error as { code?: string }).code).toBe('INVALID_INPUT')
    })
  })

  describe('route infrastructure', () => {
    it('should return 404 for an unknown route', async () => {
      const response = await executeRoute(
        routes,
        createMockRequest({ method: 'GET', path: '/api/unknown-endpoint' })
      )

      expect(response.status).toBe(404)
    })

    it('should list all available routes', () => {
      const allRoutes = routes.getRoutes()

      expect(allRoutes.length).toBeGreaterThanOrEqual(40)
      expect(allRoutes.some(r => r.path === '/api/collections')).toBe(true)
      expect(allRoutes.some(r => r.path === '/api/auth/login')).toBe(true)
      expect(allRoutes.some(r => r.path === '/api/health')).toBe(true)
    })
  })
})
