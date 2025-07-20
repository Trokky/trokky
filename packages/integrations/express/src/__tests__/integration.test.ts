import express from 'express'
import request from 'supertest'
import { TrokkyCore } from '@trokky/core'
import { FilesystemAdapter } from '@trokky/adapter-filesystem'
import { TrokkyExpress } from '../integration.js'
import type { ExpressIntegrationConfig } from '../types.js'
import path from 'path'
import os from 'os'
import fs from 'fs-extra'

describe('TrokkyExpress Integration', () => {
  let app: express.Application
  let trokkyCore: TrokkyCore
  let tempDir: string

  beforeEach(async () => {
    // Create unique temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `trokky-express-test-${Date.now()}-`))
    
    // Setup TrokkyCore with filesystem adapter
    const adapter = new FilesystemAdapter({
      contentPath: path.join(tempDir, 'content'),
      mediaPath: path.join(tempDir, 'media')
    })

    trokkyCore = new TrokkyCore(
      {
        name: 'Test CMS',
        schemas: [{
          name: 'posts',
          type: 'document',
          title: 'Posts',
          description: 'Blog posts collection',
          fields: {
            title: { type: 'string', required: true },
            content: { type: 'string' },
            status: { type: 'string' }
          }
        }],
        storage: { adapter: 'filesystem' }
      },
      adapter
    )

    // Setup Express app with Trokky integration
    const config: ExpressIntegrationConfig = {
      core: trokkyCore,
      basePath: '/api/v1',
      corsOptions: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      },
      authentication: {
        enabled: false // Disabled for testing
      },
      fileUpload: {
        maxFileSize: 5 * 1024 * 1024, // 5MB for testing
        maxFiles: 3,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'text/plain']
      }
    }

    const integration = TrokkyExpress.setup(config)
    
    app = express()
    
    // Apply Trokky middleware
    app.use(integration.middleware)
    
    // Mount Trokky routes (routes already include the basePath)
    app.use('/', integration.router)
    
    // Add error handler
    app.use(TrokkyExpress.getErrorHandler())
  })

  afterEach(async () => {
    // Clean up temporary directory
    await fs.remove(tempDir)
  })

  describe('Document Operations', () => {
    it('should create a document via POST request', async () => {
      const documentData = {
        title: 'Test Post',
        content: 'This is a test post',
        status: 'published'
      }

      const response = await request(app)
        .post('/api/v1/collections/posts')
        .send({ data: documentData })
        .expect(201)

      expect(response.body).toEqual({
        success: true,
        data: {
          document: expect.objectContaining({
            id: expect.any(String),
            title: 'Test Post',
            content: 'This is a test post',
            status: 'published',
            _collection: 'posts',
            _createdAt: expect.any(String),
            _updatedAt: expect.any(String),
            _revision: expect.any(Number)
          })
        }
      })
    })

    it('should list documents via GET request', async () => {
      // First create a document
      await trokkyCore.saveDocument('posts', {
        title: 'Post 1',
        content: 'Content 1'
      })

      const response = await request(app)
        .get('/api/v1/collections/posts')
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        data: {
          documents: expect.arrayContaining([
            expect.objectContaining({
              title: 'Post 1',
              content: 'Content 1'
            })
          ]),
          meta: expect.objectContaining({
            total: expect.any(Number)
          })
        }
      })
      
      // Verify our document is in the list
      const posts = response.body.data.documents
      const ourPost = posts.find((doc: any) => doc.title === 'Post 1')
      expect(ourPost).toBeDefined()
      expect(ourPost.content).toBe('Content 1')
    })

    it('should get a specific document via GET request', async () => {
      const doc = await trokkyCore.saveDocument('posts', {
        title: 'Specific Post',
        content: 'Specific content'
      })

      const response = await request(app)
        .get(`/api/v1/collections/posts/${doc.id}`)
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        data: {
          document: expect.objectContaining({
            id: doc.id,
            title: 'Specific Post',
            content: 'Specific content'
          })
        }
      })
    })

    it('should update a document via PUT request', async () => {
      const doc = await trokkyCore.saveDocument('posts', {
        title: 'Original Title',
        content: 'Original content'
      })

      const response = await request(app)
        .put(`/api/v1/collections/posts/${doc.id}`)
        .send({ data: { title: 'Updated Title' } })
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        data: {
          document: expect.objectContaining({
            id: doc.id,
            title: 'Updated Title',
            content: 'Original content' // Should preserve existing content
          })
        }
      })
    })

    it('should delete a document via DELETE request', async () => {
      const doc = await trokkyCore.saveDocument('posts', {
        title: 'To Delete',
        content: 'Delete me'
      })

      await request(app)
        .delete(`/api/v1/collections/posts/${doc.id}`)
        .expect(200)

      // Verify document is deleted
      const deletedDoc = await trokkyCore.getDocument('posts', doc.id)
      expect(deletedDoc).toBeNull()
    })
  })

  describe('Media Operations', () => {
    it('should handle file upload via POST request', async () => {
      const testContent = 'This is a test file content'
      
      const response = await request(app)
        .post('/api/v1/media/upload')
        .attach('files', Buffer.from(testContent), {
          filename: 'test.txt',
          contentType: 'text/plain'
        })
        .expect(201)

      expect(response.body).toEqual({
        success: true,
        data: {
          files: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              filename: 'test.txt',
              contentType: 'text/plain',
              size: testContent.length
            })
          ]),
          meta: {
            count: 1
          }
        }
      })
    })

    it('should reject files that are too large', async () => {
      const largeContent = Buffer.alloc(6 * 1024 * 1024) // 6MB (exceeds 5MB limit)
      
      const response = await request(app)
        .post('/api/v1/media/upload')
        .attach('files', largeContent, {
          filename: 'large.txt',
          contentType: 'text/plain'
        })
        .expect(413)

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: expect.stringContaining('File too large')
        }
      })
    })

    it('should reject disallowed file types', async () => {
      const response = await request(app)
        .post('/api/v1/media/upload')
        .attach('files', Buffer.from('malicious content'), {
          filename: 'malware.exe',
          contentType: 'application/octet-stream'
        })
        .expect(400)

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: expect.stringContaining('not allowed')
        }
      })
    })
  })

  describe('CORS Headers', () => {
    it('should include CORS headers in responses', async () => {
      const response = await request(app)
        .options('/api/v1/collections/posts')
        .expect(200)

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
      expect(response.headers['access-control-allow-methods']).toContain('GET')
      expect(response.headers['access-control-allow-headers']).toContain('Content-Type')
    })
  })

  describe('Error Handling', () => {
    it('should handle validation errors properly', async () => {
      const response = await request(app)
        .post('/api/v1/collections/posts')
        .send({ invalidField: 'value' }) // Missing required 'data' field
        .expect(400)

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: expect.stringContaining('required')
        }
      })
    })

    it('should handle not found errors', async () => {
      const response = await request(app)
        .get('/api/v1/collections/posts/nonexistent-id')
        .expect(404)

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: expect.stringContaining('not found')
        }
      })
    })
  })

  describe('Health Check', () => {
    it('should respond to health check requests', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        data: {
          status: 'healthy',
          timestamp: expect.any(String)
        }
      })
    })
  })
})