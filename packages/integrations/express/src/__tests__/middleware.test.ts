import express, { Request, Response, NextFunction } from 'express'
import request from 'supertest'
import { TrokkyExpressMiddleware } from '../middleware.js'
import type { ExpressIntegrationConfig } from '../types.js'

// Mock TrokkyCore for testing
const mockCore = {
  saveDocument: jest.fn(),
  getDocument: jest.fn(),
  listDocuments: jest.fn(),
  deleteDocument: jest.fn(),
  uploadMedia: jest.fn(),
  getMedia: jest.fn(),
  deleteMedia: jest.fn(),
  healthCheck: jest.fn()
} as any

describe('TrokkyExpressMiddleware', () => {
  let app: express.Application
  let middleware: TrokkyExpressMiddleware

  beforeEach(() => {
    app = express()
    jest.clearAllMocks()
  })

  describe('Body Parser Middleware', () => {
    it('should parse JSON bodies with default configuration', async () => {
      const config: ExpressIntegrationConfig = {
        core: mockCore
      }
      
      middleware = new TrokkyExpressMiddleware(config)
      app.use(middleware.getMiddleware())
      
      app.post('/test', (req: Request, res: Response) => {
        res.json({ received: req.body })
      })

      const testData = { title: 'Test Post', content: 'Test content' }
      
      const response = await request(app)
        .post('/test')
        .send(testData)
        .expect(200)

      expect(response.body.received).toEqual(testData)
    })

    it('should respect custom JSON body parser limits', async () => {
      const config: ExpressIntegrationConfig = {
        core: mockCore,
        bodyParser: {
          json: {
            limit: '1kb'
          }
        }
      }
      
      middleware = new TrokkyExpressMiddleware(config)
      app.use(middleware.getMiddleware())
      
      app.post('/test', (req: Request, res: Response) => {
        res.json({ received: req.body })
      })

      // Send data larger than 1kb
      const largeData = { content: 'x'.repeat(2000) }
      
      await request(app)
        .post('/test')
        .send(largeData)
        .expect(413) // Payload Too Large
    })

    it('should parse URL-encoded bodies', async () => {
      const config: ExpressIntegrationConfig = {
        core: mockCore
      }
      
      middleware = new TrokkyExpressMiddleware(config)
      app.use(middleware.getMiddleware())
      
      app.post('/test', (req: Request, res: Response) => {
        res.json({ received: req.body })
      })

      const response = await request(app)
        .post('/test')
        .type('form')
        .send('title=Test&content=Content')
        .expect(200)

      expect(response.body.received).toEqual({
        title: 'Test',
        content: 'Content'
      })
    })
  })

  describe('Security Headers Middleware', () => {
    it('should add custom security headers', async () => {
      const config: ExpressIntegrationConfig = {
        core: mockCore,
        security: {
          customHeaders: {
            'X-Custom-Header': 'custom-value',
            'X-API-Version': '1.0'
          }
        }
      }
      
      middleware = new TrokkyExpressMiddleware(config)
      app.use(middleware.getMiddleware())
      
      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true })
      })

      const response = await request(app)
        .get('/test')
        .expect(200)

      expect(response.headers['x-custom-header']).toBe('custom-value')
      expect(response.headers['x-api-version']).toBe('1.0')
    })

    it('should add default security headers', async () => {
      const config: ExpressIntegrationConfig = {
        core: mockCore,
        security: {
          customHeaders: {}
        }
      }
      
      middleware = new TrokkyExpressMiddleware(config)
      app.use(middleware.getMiddleware())
      
      app.get('/test', (req: Request, res: Response) => {
        res.json({ success: true })
      })

      const response = await request(app)
        .get('/test')
        .expect(200)

      expect(response.headers['x-content-type-options']).toBe('nosniff')
      expect(response.headers['x-frame-options']).toBe('DENY')
      expect(response.headers['x-xss-protection']).toBe('1; mode=block')
    })
  })

  describe('File Upload Middleware', () => {
    it('should handle file uploads within limits', async () => {
      const config: ExpressIntegrationConfig = {
        core: mockCore,
        fileUpload: {
          maxFileSize: 1024 * 1024, // 1MB
          maxFiles: 2,
          allowedMimeTypes: ['text/plain', 'image/jpeg']
        }
      }
      
      middleware = new TrokkyExpressMiddleware(config)
      app.use(middleware.getMiddleware())
      
      app.post('/upload', (req: Request, res: Response) => {
        res.json({ files: req.files })
      })

      const response = await request(app)
        .post('/upload')
        .attach('files', Buffer.from('test content'), {
          filename: 'test.txt',
          contentType: 'text/plain'
        })
        .expect(200)

      expect(response.body.files).toHaveLength(1)
      expect(response.body.files[0].originalname).toBe('test.txt')
    })

    it('should reject files exceeding size limit', async () => {
      const config: ExpressIntegrationConfig = {
        core: mockCore,
        fileUpload: {
          maxFileSize: 100, // 100 bytes
          maxFiles: 1
        }
      }
      
      middleware = new TrokkyExpressMiddleware(config)
      app.use(middleware.getMiddleware())
      app.use(TrokkyExpressMiddleware.createErrorHandler())
      
      app.post('/upload', (req: Request, res: Response) => {
        res.json({ files: req.files })
      })

      await request(app)
        .post('/upload')
        .attach('files', Buffer.alloc(200), { // 200 bytes
          filename: 'large.txt',
          contentType: 'text/plain'
        })
        .expect(413)
    })

    it('should reject disallowed MIME types', async () => {
      const config: ExpressIntegrationConfig = {
        core: mockCore,
        fileUpload: {
          allowedMimeTypes: ['text/plain']
        }
      }
      
      middleware = new TrokkyExpressMiddleware(config)
      app.use(middleware.getMiddleware())
      app.use(TrokkyExpressMiddleware.createErrorHandler())
      
      app.post('/upload', (req: Request, res: Response) => {
        res.json({ files: req.files })
      })

      await request(app)
        .post('/upload')
        .attach('files', Buffer.from('content'), {
          filename: 'image.jpg',
          contentType: 'image/jpeg' // Not in allowed types
        })
        .expect(400)
    })

    it('should reject dangerous file extensions', async () => {
      const config: ExpressIntegrationConfig = {
        core: mockCore,
        fileUpload: {
          allowedMimeTypes: ['application/octet-stream']
        }
      }
      
      middleware = new TrokkyExpressMiddleware(config)
      app.use(middleware.getMiddleware())
      app.use(TrokkyExpressMiddleware.createErrorHandler())
      
      app.post('/upload', (req: Request, res: Response) => {
        res.json({ files: req.files })
      })

      await request(app)
        .post('/upload')
        .attach('files', Buffer.from('malicious content'), {
          filename: 'malware.exe',
          contentType: 'application/octet-stream'
        })
        .expect(400)
    })

    it('should reject files with multiple extensions including dangerous ones', async () => {
      const config: ExpressIntegrationConfig = {
        core: mockCore,
        fileUpload: {
          allowedMimeTypes: ['application/octet-stream']
        }
      }
      
      middleware = new TrokkyExpressMiddleware(config)
      app.use(middleware.getMiddleware())
      app.use(TrokkyExpressMiddleware.createErrorHandler())
      
      app.post('/upload', (req: Request, res: Response) => {
        res.json({ files: req.files })
      })

      // Test various dangerous multi-extension combinations
      const dangerousFiles = [
        'archive.tar.exe',
        'script.sh.txt',
        'backup.sql.php',
        'config.json.js'
      ]

      for (const filename of dangerousFiles) {
        await request(app)
          .post('/upload')
          .attach('files', Buffer.from('content'), {
            filename,
            contentType: 'application/octet-stream'
          })
          .expect(400)
      }
    })

    it('should allow safe files with multiple extensions', async () => {
      const config: ExpressIntegrationConfig = {
        core: mockCore,
        fileUpload: {
          allowedMimeTypes: ['text/plain']
        }
      }
      
      middleware = new TrokkyExpressMiddleware(config)
      app.use(middleware.getMiddleware())
      
      app.post('/upload', (req: Request, res: Response) => {
        res.json({ files: req.files })
      })

      // Test safe multi-extension files
      const safeFiles = [
        'backup.tar.gz',
        'data.csv.bak',
        'readme.txt.old'
      ]

      for (const filename of safeFiles) {
        await request(app)
          .post('/upload')
          .attach('files', Buffer.from('content'), {
            filename,
            contentType: 'text/plain'
          })
          .expect(200)
      }
    })

    it('should reject files with path traversal in filename', async () => {
      const config: ExpressIntegrationConfig = {
        core: mockCore,
        fileUpload: {
          allowedMimeTypes: ['text/plain']
        }
      }
      
      middleware = new TrokkyExpressMiddleware(config)
      app.use(middleware.getMiddleware())
      
      app.post('/upload', (req: Request, res: Response, next: NextFunction) => {
        // This should not be reached if file validation fails
        res.json({ files: req.files })
      })
      
      app.use(TrokkyExpressMiddleware.createErrorHandler())

      await request(app)
        .post('/upload')
        .attach('files', Buffer.from('content'), {
          filename: 'file..with..dots',
          contentType: 'text/plain'
        })
        .expect(400)
    })
  })

  describe('Error Handler Middleware', () => {
    it('should handle validation errors', async () => {
      app.get('/error', (req: Request, res: Response, next: NextFunction) => {
        const error = new Error('Validation failed: field is required')
        next(error)
      })
      
      app.use(TrokkyExpressMiddleware.createErrorHandler())

      const response = await request(app)
        .get('/error')
        .expect(500)

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Validation failed: field is required'
        }
      })
    })

    it('should handle file upload errors with appropriate status codes', async () => {
      app.get('/file-error', (req: Request, res: Response, next: NextFunction) => {
        const error = new Error('File too large. Maximum size is 1MB')
        next(error)
      })
      
      app.use(TrokkyExpressMiddleware.createErrorHandler())

      const response = await request(app)
        .get('/file-error')
        .expect(413)

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'File too large. Maximum size is 1MB'
        }
      })
    })

    it('should handle not found errors', async () => {
      app.get('/not-found', (req: Request, res: Response, next: NextFunction) => {
        const error = new Error('Document not found')
        next(error)
      })
      
      app.use(TrokkyExpressMiddleware.createErrorHandler())

      const response = await request(app)
        .get('/not-found')
        .expect(404)

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document not found'
        }
      })
    })

    it('should not handle errors if response already sent', () => {
      const req = {} as Request
      const res = {
        headersSent: true
      } as Response
      const next = jest.fn()
      const error = new Error('Test error')

      const errorHandler = TrokkyExpressMiddleware.createErrorHandler()
      errorHandler(error, req, res, next)

      expect(next).toHaveBeenCalledWith(error)
    })
  })
})