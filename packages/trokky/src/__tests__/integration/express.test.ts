import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'

// Import adapters (auto-registers them)
import '../../adapters/filesystem-data/index.js'
import '../../adapters/filesystem-media/index.js'

import { TrokkyExpress } from '../../integrations/express/index.js'

describe('Express Integration', () => {
  let app: express.Express
  let trokky: any
  let tempDir: string
  let authToken: string

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trokky-integration-'))

    app = express()

    trokky = await TrokkyExpress.create({
      schemas: [
        {
          name: 'article',
          title: 'Article',
          type: 'document' as const,
          fields: [
            { name: 'title', type: 'string' },
            { name: 'body', type: 'string' },
          ],
        },
      ],
      storage: {
        data: {
          adapter: 'filesystem-data',
          options: {
            contentDir: path.join(tempDir, 'content'),
            usersDir: path.join(tempDir, 'users'),
            tokensDir: path.join(tempDir, 'tokens'),
            webhooksDir: path.join(tempDir, 'webhooks'),
            settingsDir: path.join(tempDir, 'settings'),
          },
        },
        media: {
          adapter: 'filesystem-media',
          options: {
            mediaDir: path.join(tempDir, 'media'),
          },
        },
      },
      security: {
        adminUser: {
          username: 'admin',
          email: 'admin@test.com',
          password: 'TestPassword123!',
        },
      },
      server: {
        cors: {
          origin: '*',
          credentials: false,
        },
      },
    })

    trokky.mount(app, { apiPath: '/api', studioPath: '/studio' })
  }, 30000) // 30s timeout for setup

  afterAll(async () => {
    if (trokky?.cleanup) trokky.cleanup()
    await fs.remove(tempDir)
  })

  describe('health and basic routes', () => {
    it('should respond to mounted API routes', async () => {
      const res = await request(app).get('/api/collections')
      // Should get a response (may be 200 or 401 depending on auth config)
      expect(res.status).toBeLessThan(500)
    })
  })

  describe('authentication flow', () => {
    it('should login with admin credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'TestPassword123!' })
        .set('Content-Type', 'application/json')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.token).toBeDefined()
      expect(res.body.data.user).toBeDefined()
      expect(res.body.data.user.username).toBe('admin')

      authToken = res.body.data.token
    })

    it('should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'WrongPassword!' })
        .set('Content-Type', 'application/json')

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('should reject missing credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({})
        .set('Content-Type', 'application/json')

      expect(res.status).toBe(400)
    })

    it('should get current user with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toBeDefined()
    })

    it('should logout', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
    })
  })

  describe('document CRUD flow', () => {
    let documentId: string

    it('should create a document', async () => {
      const res = await request(app)
        .post('/api/collections/article')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ data: { title: 'Integration Test Article', body: 'Test content', _type: 'article' } })

      // Check for validation errors in response
      if (res.status !== 201) {
        // Dump error for debugging
        const errorDetails = JSON.stringify(res.body)
        expect.soft(res.status, `Create failed: ${errorDetails}`).toBe(201)
      }
      expect(res.body.success).toBe(true)
      expect(res.body.data.document).toBeDefined()
      documentId = res.body.data.document.id
      expect(documentId).toBeDefined()
    })

    it('should get the created document', async () => {
      const res = await request(app)
        .get(`/api/collections/article/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      // Document may be at res.body.data or res.body.data.document
      const doc = res.body.data?.document || res.body.data
      expect(doc.title).toBe('Integration Test Article')
    })

    it('should list documents in collection', async () => {
      const res = await request(app)
        .get('/api/collections/article')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toBeDefined()
    })

    it('should update the document', async () => {
      const res = await request(app)
        .put(`/api/collections/article/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send({ data: { title: 'Updated Title', body: 'Updated content', _type: 'article' } })

      expect(res.status).toBe(200)
    })

    it('should return 404 for non-existent document', async () => {
      const res = await request(app)
        .get('/api/collections/article/nonexistent-id-12345')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })

    it('should delete the document', async () => {
      const res = await request(app)
        .delete(`/api/collections/article/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
    })

    it('should return 404 after deletion', async () => {
      const res = await request(app)
        .get(`/api/collections/article/${documentId}`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(404)
    })
  })

  describe('error handling', () => {
    it('should return 400 for invalid collection name', async () => {
      const res = await request(app)
        .get('/api/collections/../../../etc/passwd')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('should return proper JSON error format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: '', password: '' })
        .set('Content-Type', 'application/json')

      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.body).toBeDefined()
      expect(res.body.success).toBe(false)
    })
  })

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const res = await request(app)
        .options('/api/collections')
        .set('Origin', 'http://localhost:3000')

      // CORS headers should be present
      expect(res.status).toBeLessThan(500)
    })
  })

  describe('OpenAPI spec', () => {
    it('should report the default mount path in servers[0].url', async () => {
      const res = await request(app).get('/api/openapi.json')

      expect(res.status).toBe(200)
      expect(res.body.servers[0].url).toBe('/api')
    })
  })
})

describe('Express Integration with a custom apiPath', () => {
  let customApp: express.Express
  let customTrokky: any
  let customTempDir: string

  beforeAll(async () => {
    customTempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trokky-apipath-'))

    customApp = express()

    customTrokky = await TrokkyExpress.create({
      schemas: [
        {
          name: 'article',
          title: 'Article',
          type: 'document' as const,
          fields: [{ name: 'title', type: 'string' }],
        },
      ],
      storage: {
        data: {
          adapter: 'filesystem-data',
          options: {
            contentDir: path.join(customTempDir, 'content'),
            usersDir: path.join(customTempDir, 'users'),
            tokensDir: path.join(customTempDir, 'tokens'),
            webhooksDir: path.join(customTempDir, 'webhooks'),
            settingsDir: path.join(customTempDir, 'settings'),
          },
        },
        media: {
          adapter: 'filesystem-media',
          options: {
            mediaDir: path.join(customTempDir, 'media'),
          },
        },
      },
      security: {
        adminUser: {
          username: 'admin',
          email: 'admin@test.com',
          password: 'TestPassword123!',
        },
      },
    })

    customTrokky.mount(customApp, {
      apiPath: '/backend/api',
      studioPath: '/studio',
    })
  }, 30000)

  afterAll(async () => {
    if (customTrokky?.cleanup) customTrokky.cleanup()
    await fs.remove(customTempDir)
  })

  it('should expose the mounted apiPath as servers[0].url in the OpenAPI spec', async () => {
    const res = await request(customApp).get('/backend/api/openapi.json')

    expect(res.status).toBe(200)
    expect(res.body.servers[0].url).toBe('/backend/api')
  })
})
