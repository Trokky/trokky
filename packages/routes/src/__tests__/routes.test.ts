import { TrokkyRoutes } from '../routes.js'
import { TrokkyCore, SecurityValidator, InvalidInputError } from '@trokky/core'
import type { HttpRequest, RoutesConfig } from '../types.js'

// Mock @trokky/core
jest.mock('@trokky/core', () => ({
  TrokkyCore: jest.fn(),
  SecurityValidator: {
    validateCollectionName: jest.fn(),
    validateDocumentId: jest.fn(),
    validateDocumentData: jest.fn()
  },
  InvalidInputError: class extends Error {
    constructor(message: string, public field: string) {
      super(message)
      this.name = 'InvalidInputError'
    }
  }
}))

describe('TrokkyRoutes', () => {
  let mockCore: jest.Mocked<TrokkyCore>
  let routes: TrokkyRoutes
  let config: RoutesConfig

  beforeEach(() => {
    // Create mock core instance
    mockCore = {
      listDocuments: jest.fn(),
      saveDocument: jest.fn(),
      getDocument: jest.fn(),
      deleteDocument: jest.fn(),
      uploadMedia: jest.fn(),
      getMedia: jest.fn(),
      deleteMedia: jest.fn(),
      healthCheck: jest.fn()
    } as any

    // Mock TrokkyCore constructor
    ;(TrokkyCore as jest.MockedClass<typeof TrokkyCore>).mockImplementation(() => mockCore)

    config = {
      core: mockCore,
      basePath: '/api/v1',
      corsOptions: {
        origin: ['http://localhost:3000'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: false
      },
      authentication: {
        enabled: false // Disabled for most tests
      }
    }

    // Reset all mocks before creating routes
    jest.clearAllMocks()
    
    // Reset SecurityValidator mocks to default (pass-through)
    ;(SecurityValidator.validateCollectionName as jest.Mock).mockImplementation(() => {})
    ;(SecurityValidator.validateDocumentId as jest.Mock).mockImplementation(() => {})
    ;(SecurityValidator.validateDocumentData as jest.Mock).mockImplementation(() => {})

    routes = new TrokkyRoutes(config)
  })

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const minimalConfig = { core: mockCore }
      const minimalRoutes = new TrokkyRoutes(minimalConfig)
      
      expect(minimalRoutes).toBeInstanceOf(TrokkyRoutes)
      expect(minimalRoutes.getRoutes()).toHaveLength(20) // 5 collection + 3 media + 7 users + 3 auth + health + CORS
    })

    it('should register all expected routes', () => {
      const routeList = routes.getRoutes()
      const routePaths = routeList.map(r => `${r.method}:${r.path}`)
      
      // Collection routes
      expect(routePaths).toContain('GET:/api/v1/collections/:collection')
      expect(routePaths).toContain('POST:/api/v1/collections/:collection')
      expect(routePaths).toContain('GET:/api/v1/collections/:collection/:id')
      expect(routePaths).toContain('PUT:/api/v1/collections/:collection/:id')
      expect(routePaths).toContain('DELETE:/api/v1/collections/:collection/:id')
      
      // Media routes
      expect(routePaths).toContain('POST:/api/v1/media/upload')
      expect(routePaths).toContain('GET:/api/v1/media/:id')
      expect(routePaths).toContain('DELETE:/api/v1/media/:id')
      
      // User management routes
      expect(routePaths).toContain('GET:/api/v1/users')
      expect(routePaths).toContain('POST:/api/v1/users')
      expect(routePaths).toContain('GET:/api/v1/users/:id')
      expect(routePaths).toContain('PUT:/api/v1/users/:id')
      expect(routePaths).toContain('DELETE:/api/v1/users/:id')
      expect(routePaths).toContain('GET:/api/v1/users/by-username/:username')
      expect(routePaths).toContain('GET:/api/v1/users/by-email/:email')
      
      // Authentication routes
      expect(routePaths).toContain('POST:/api/v1/auth/login')
      expect(routePaths).toContain('POST:/api/v1/auth/logout')
      expect(routePaths).toContain('POST:/api/v1/auth/validate')
      
      // System routes
      expect(routePaths).toContain('GET:/api/v1/health')
      expect(routePaths).toContain('OPTIONS:/api/v1/*')
    })
  })

  describe('route matching', () => {
    it('should find exact route matches', () => {
      const route = routes.findRoute('GET', '/api/v1/health')
      expect(route).toBeDefined()
      expect(route?.method).toBe('GET')
      expect(route?.path).toBe('/api/v1/health')
    })

    it('should find parameterized route matches', () => {
      const route = routes.findRoute('GET', '/api/v1/collections/posts')
      expect(route).toBeDefined()
      expect(route?.method).toBe('GET')
      expect(route?.path).toBe('/api/v1/collections/:collection')
    })

    it('should extract parameters from routes', () => {
      const params = routes.extractParams('/api/v1/collections/:collection/:id', '/api/v1/collections/posts/123')
      expect(params).toEqual({
        collection: 'posts',
        id: '123'
      })
    })

    it('should handle URL encoding in parameters', () => {
      const params = routes.extractParams('/api/v1/collections/:collection', '/api/v1/collections/my%20collection')
      expect(params).toEqual({
        collection: 'my collection'
      })
    })

    it('should return undefined for non-matching routes', () => {
      const route = routes.findRoute('GET', '/api/v1/nonexistent')
      expect(route).toBeUndefined()
    })
  })

  describe('listDocuments handler', () => {
    const createListRequest = (overrides: Partial<HttpRequest> = {}): HttpRequest => ({
      method: 'GET',
      url: '/api/v1/collections/posts',
      path: '/api/v1/collections/posts',
      query: {},
      params: { collection: 'posts' },
      headers: {},
      ...overrides
    })

    it('should handle successful document listing', async () => {
      const mockDocuments = [
        { _id: '1', title: 'Post 1', _collection: 'posts' },
        { _id: '2', title: 'Post 2', _collection: 'posts' }
      ]
      mockCore.listDocuments.mockResolvedValue(mockDocuments)

      const request = createListRequest()
      const route = routes.findRoute('GET', '/api/v1/collections/posts')
      
      const response = await route!.handler(request)

      expect(SecurityValidator.validateCollectionName).toHaveBeenCalledWith('posts')
      expect(mockCore.listDocuments).toHaveBeenCalledWith('posts', {})
      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        data: {
          documents: mockDocuments,
          meta: {
            total: 2,
            limit: undefined,
            offset: undefined
          }
        }
      })
    })

    it('should handle query parameters', async () => {
      mockCore.listDocuments.mockResolvedValue([])

      const request = createListRequest({
        query: {
          limit: '10',
          offset: '20',
          filter: '{"status":"published"}',
          sort: 'title'
        }
      })
      const route = routes.findRoute('GET', '/api/v1/collections/posts')
      
      await route!.handler(request)

      expect(mockCore.listDocuments).toHaveBeenCalledWith('posts', {
        limit: 10,
        offset: 20,
        filter: { status: 'published' },
        sort: 'title'
      })
    })

    it('should handle invalid filter JSON', async () => {
      const request = createListRequest({
        query: { filter: 'invalid-json' }
      })
      const route = routes.findRoute('GET', '/api/v1/collections/posts')
      
      const response = await route!.handler(request)

      expect(response.status).toBe(400)
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid filter format'
        }
      })
    })

    it('should handle security validation errors', async () => {
      ;(SecurityValidator.validateCollectionName as jest.Mock).mockImplementation(() => {
        throw new InvalidInputError('Invalid collection name', 'collection')
      })

      const request = createListRequest()
      const route = routes.findRoute('GET', '/api/v1/collections/posts')
      
      const response = await route!.handler(request)

      expect(response.status).toBe(400)
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid collection name'
        }
      })
    })
  })

  describe('createDocument handler', () => {
    const createCreateRequest = (body: any = {}): HttpRequest => ({
      method: 'POST',
      url: '/api/v1/collections/posts',
      path: '/api/v1/collections/posts',
      query: {},
      params: { collection: 'posts' },
      headers: { 'Content-Type': 'application/json' },
      body
    })

    it('should create document successfully', async () => {
      const mockDocument = { _id: '123', title: 'New Post', _collection: 'posts' }
      mockCore.saveDocument.mockResolvedValue(mockDocument)

      const request = createCreateRequest({
        data: { title: 'New Post', content: 'Content here' }
      })
      const route = routes.findRoute('POST', '/api/v1/collections/posts')
      
      const response = await route!.handler(request)

      expect(SecurityValidator.validateCollectionName).toHaveBeenCalledWith('posts')
      expect(mockCore.saveDocument).toHaveBeenCalledWith('posts', { title: 'New Post', content: 'Content here', id: undefined })
      expect(response.status).toBe(201)
      expect(response.body).toEqual({
        success: true,
        data: { document: mockDocument }
      })
    })

    it('should create document with custom ID', async () => {
      const mockDocument = { _id: 'custom-id', title: 'New Post', _collection: 'posts' }
      mockCore.saveDocument.mockResolvedValue(mockDocument)

      const request = createCreateRequest({
        data: { title: 'New Post' },
        id: 'custom-id'
      })
      const route = routes.findRoute('POST', '/api/v1/collections/posts')
      
      await route!.handler(request)

      expect(mockCore.saveDocument).toHaveBeenCalledWith('posts', { title: 'New Post', id: 'custom-id' })
    })

    it('should reject request without data', async () => {
      const request = createCreateRequest({ notData: 'invalid' })
      const route = routes.findRoute('POST', '/api/v1/collections/posts')
      
      const response = await route!.handler(request)

      expect(response.status).toBe(400)
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Document data is required'
        }
      })
    })
  })

  describe('getDocument handler', () => {
    const createGetRequest = (): HttpRequest => ({
      method: 'GET',
      url: '/api/v1/collections/posts/123',
      path: '/api/v1/collections/posts/123',
      query: {},
      params: { collection: 'posts', id: '123' },
      headers: {}
    })

    it('should get document successfully', async () => {
      const mockDocument = { _id: '123', title: 'Post 1', _collection: 'posts' }
      mockCore.getDocument.mockResolvedValue(mockDocument)

      const request = createGetRequest()
      const route = routes.findRoute('GET', '/api/v1/collections/posts/123')
      
      const response = await route!.handler(request)

      expect(SecurityValidator.validateCollectionName).toHaveBeenCalledWith('posts')
      expect(SecurityValidator.validateDocumentId).toHaveBeenCalledWith('123')
      expect(mockCore.getDocument).toHaveBeenCalledWith('posts', '123')
      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        data: { document: mockDocument }
      })
    })

    it('should handle document not found', async () => {
      mockCore.getDocument.mockResolvedValue(null)

      const request = createGetRequest()
      const route = routes.findRoute('GET', '/api/v1/collections/posts/123')
      
      const response = await route!.handler(request)

      expect(response.status).toBe(404)
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document posts/123 not found'
        }
      })
    })
  })

  describe('updateDocument handler', () => {
    const createUpdateRequest = (body: any = {}): HttpRequest => ({
      method: 'PUT',
      url: '/api/v1/collections/posts/123',
      path: '/api/v1/collections/posts/123',
      query: {},
      params: { collection: 'posts', id: '123' },
      headers: { 'Content-Type': 'application/json' },
      body
    })

    it('should update document successfully', async () => {
      const existingDoc = { 
        _id: '123', 
        _collection: 'posts',
        _createdAt: '2024-01-01',
        _updatedAt: '2024-01-01',
        _revision: 1,
        _status: 'published',
        title: 'Old Title',
        content: 'Old content'
      }
      const updatedDoc = { ...existingDoc, title: 'New Title', _updatedAt: '2024-01-02' }
      
      mockCore.getDocument.mockResolvedValue(existingDoc)
      mockCore.saveDocument.mockResolvedValue(updatedDoc)

      const request = createUpdateRequest({
        data: { title: 'New Title' }
      })
      const route = routes.findRoute('PUT', '/api/v1/collections/posts/123')
      
      const response = await route!.handler(request)

      expect(mockCore.getDocument).toHaveBeenCalledWith('posts', '123')
      expect(mockCore.saveDocument).toHaveBeenCalledWith('posts', {
        title: 'New Title',
        content: 'Old content',
        id: '123'
      })
      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        data: { document: updatedDoc }
      })
    })

    it('should handle document not found for update', async () => {
      mockCore.getDocument.mockResolvedValue(null)

      const request = createUpdateRequest({
        data: { title: 'New Title' }
      })
      const route = routes.findRoute('PUT', '/api/v1/collections/posts/123')
      
      const response = await route!.handler(request)

      expect(response.status).toBe(404)
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Document posts/123 not found'
        }
      })
    })
  })

  describe('deleteDocument handler', () => {
    it('should delete document successfully', async () => {
      mockCore.deleteDocument.mockResolvedValue(undefined)

      const request: HttpRequest = {
        method: 'DELETE',
        url: '/api/v1/collections/posts/123',
        path: '/api/v1/collections/posts/123',
        query: {},
        params: { collection: 'posts', id: '123' },
        headers: {}
      }
      const route = routes.findRoute('DELETE', '/api/v1/collections/posts/123')
      
      const response = await route!.handler(request)

      expect(SecurityValidator.validateCollectionName).toHaveBeenCalledWith('posts')
      expect(SecurityValidator.validateDocumentId).toHaveBeenCalledWith('123')
      expect(mockCore.deleteDocument).toHaveBeenCalledWith('posts', '123')
      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        data: { message: 'Document deleted successfully' }
      })
    })
  })

  describe('CORS handling', () => {
    it('should handle OPTIONS request', async () => {
      const request: HttpRequest = {
        method: 'OPTIONS',
        url: '/api/v1/collections/posts',
        path: '/api/v1/collections/posts',
        query: {},
        params: {},
        headers: {}
      }
      const route = routes.findRoute('OPTIONS', '/api/v1/collections/posts')
      
      const response = await route!.handler(request)

      expect(response.status).toBe(200)
      expect(response.headers).toMatchObject({
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      })
    })

    it('should include CORS headers in all responses', async () => {
      mockCore.healthCheck.mockResolvedValue(true)

      const request: HttpRequest = {
        method: 'GET',
        url: '/api/v1/health',
        path: '/api/v1/health',
        query: {},
        params: {},
        headers: {}
      }
      const route = routes.findRoute('GET', '/api/v1/health')
      
      const response = await route!.handler(request)

      expect(response.headers).toMatchObject({
        'Access-Control-Allow-Origin': 'http://localhost:3000',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      })
    })
  })

  describe('health check', () => {
    it('should return healthy status', async () => {
      mockCore.healthCheck.mockResolvedValue(true)

      const request: HttpRequest = {
        method: 'GET',
        url: '/api/v1/health',
        path: '/api/v1/health',
        query: {},
        params: {},
        headers: {}
      }
      const route = routes.findRoute('GET', '/api/v1/health')
      
      const response = await route!.handler(request)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        data: {
          status: 'healthy',
          timestamp: expect.any(String)
        }
      })
    })

    it('should return unhealthy status', async () => {
      mockCore.healthCheck.mockResolvedValue(false)

      const request: HttpRequest = {
        method: 'GET',
        url: '/api/v1/health',
        path: '/api/v1/health',
        query: {},
        params: {},
        headers: {}
      }
      const route = routes.findRoute('GET', '/api/v1/health')
      
      const response = await route!.handler(request)

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        success: true,
        data: {
          status: 'unhealthy',
          timestamp: expect.any(String)
        }
      })
    })
  })

  describe('error handling', () => {
    it('should handle unexpected errors', async () => {
      mockCore.listDocuments.mockRejectedValue(new Error('Unexpected error'))

      const request: HttpRequest = {
        method: 'GET',
        url: '/api/v1/collections/posts',
        path: '/api/v1/collections/posts',
        query: {},
        params: { collection: 'posts' },
        headers: {}
      }
      const route = routes.findRoute('GET', '/api/v1/collections/posts')
      
      const response = await route!.handler(request)

      expect(response.status).toBe(500)
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      })
    })
  })

  describe('Security Tests', () => {
    describe('path traversal protection', () => {
      it('should validate collection names in parameter extraction', () => {
        ;(SecurityValidator.validateCollectionName as jest.Mock).mockImplementation(() => {
          throw new InvalidInputError('Invalid collection name', 'collection')
        })

        expect(() => {
          routes.extractParams('/api/v1/collections/:collection', '/api/v1/collections/../../../etc/passwd')
        }).toThrow('Invalid collection name')
      })

      it('should validate document IDs in parameter extraction', () => {
        ;(SecurityValidator.validateDocumentId as jest.Mock).mockImplementation(() => {
          throw new InvalidInputError('Invalid document ID', 'id')
        })

        expect(() => {
          routes.extractParams('/api/v1/collections/:collection/:id', '/api/v1/collections/posts/../../../etc/passwd')
        }).toThrow('Invalid document ID')
      })

      it('should handle URL encoded path traversal attempts', () => {
        ;(SecurityValidator.validateCollectionName as jest.Mock).mockImplementation((value: string) => {
          if (value.includes('..')) {
            throw new InvalidInputError('Path traversal detected', 'collection')
          }
        })

        expect(() => {
          routes.extractParams('/api/v1/collections/:collection', '/api/v1/collections/%2E%2E%2F%2E%2E%2Fetc')
        }).toThrow('Path traversal detected')
      })
    })

    describe('authentication enforcement', () => {
      let authRoutes: TrokkyRoutes

      beforeEach(() => {
        const authConfig = {
          ...config,
          authentication: {
            enabled: true,
            validateToken: jest.fn().mockResolvedValue(true),
            publicPaths: ['/health']
          }
        }
        authRoutes = new TrokkyRoutes(authConfig)
      })

      it('should require authentication for protected endpoints', async () => {
        const request: HttpRequest = {
          method: 'GET',
          url: '/api/v1/collections/posts',
          path: '/api/v1/collections/posts',
          query: {},
          params: { collection: 'posts' },
          headers: {}
        }
        const route = authRoutes.findRoute('GET', '/api/v1/collections/posts')
        
        const response = await route!.handler(request)

        expect(response.status).toBe(401)
        expect(response.body).toEqual({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Missing authentication token'
          }
        })
      })

      it('should allow access to public paths without authentication', async () => {
        mockCore.healthCheck.mockResolvedValue(true)

        const request: HttpRequest = {
          method: 'GET',
          url: '/api/v1/health',
          path: '/api/v1/health',
          query: {},
          params: {},
          headers: {}
        }
        const route = authRoutes.findRoute('GET', '/api/v1/health')
        
        const response = await route!.handler(request)

        expect(response.status).toBe(200)
        expect(mockCore.healthCheck).toHaveBeenCalled()
      })

      it('should validate authentication tokens', async () => {
        const validateToken = jest.fn().mockResolvedValue(false)
        const authConfig = {
          ...config,
          authentication: {
            enabled: true,
            validateToken
          }
        }
        const authRoutes = new TrokkyRoutes(authConfig)

        const request: HttpRequest = {
          method: 'GET',
          url: '/api/v1/collections/posts',
          path: '/api/v1/collections/posts',
          query: {},
          params: { collection: 'posts' },
          headers: { 'Authorization': 'Bearer invalid-token' }
        }
        const route = authRoutes.findRoute('GET', '/api/v1/collections/posts')
        
        const response = await route!.handler(request)

        expect(response.status).toBe(401)
        expect(validateToken).toHaveBeenCalledWith('invalid-token')
        expect(response.body).toEqual({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid authentication credentials'
          }
        })
      })

      it('should handle Bearer token format', async () => {
        const validateToken = jest.fn().mockResolvedValue(true)
        const authConfig = {
          ...config,
          authentication: {
            enabled: true,
            validateToken
          }
        }
        const authRoutes = new TrokkyRoutes(authConfig)
        mockCore.listDocuments.mockResolvedValue([])

        const request: HttpRequest = {
          method: 'GET',
          url: '/api/v1/collections/posts',
          path: '/api/v1/collections/posts',
          query: {},
          params: { collection: 'posts' },
          headers: { 'Authorization': 'Bearer valid-token' }
        }
        const route = authRoutes.findRoute('GET', '/api/v1/collections/posts')
        
        const response = await route!.handler(request)

        expect(response.status).toBe(200)
        expect(validateToken).toHaveBeenCalledWith('valid-token')
      })
    })

    describe('input validation', () => {
      it('should validate request body structure for create document', async () => {
        const request: HttpRequest = {
          method: 'POST',
          url: '/api/v1/collections/posts',
          path: '/api/v1/collections/posts',
          query: {},
          params: { collection: 'posts' },
          headers: { 'Content-Type': 'application/json' },
          body: null // Invalid body
        }
        const route = routes.findRoute('POST', '/api/v1/collections/posts')
        
        const response = await route!.handler(request)

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Request body is required'
          }
        })
      })

      it('should validate data field presence in request body', async () => {
        const request: HttpRequest = {
          method: 'POST',
          url: '/api/v1/collections/posts',
          path: '/api/v1/collections/posts',
          query: {},
          params: { collection: 'posts' },
          headers: { 'Content-Type': 'application/json' },
          body: { notData: 'invalid' }
        }
        const route = routes.findRoute('POST', '/api/v1/collections/posts')
        
        const response = await route!.handler(request)

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Document data is required'
          }
        })
      })
    })

    describe('media upload security', () => {
      it('should validate file count limits', async () => {
        const tooManyFiles = Array(11).fill(null).map((_, i) => ({
          name: `file${i}.jpg`,
          type: 'image/jpeg',
          size: 1024
        } as File))

        const request: HttpRequest = {
          method: 'POST',
          url: '/api/v1/media/upload',
          path: '/api/v1/media/upload',
          query: {},
          params: {},
          headers: {},
          files: tooManyFiles
        }
        const route = routes.findRoute('POST', '/api/v1/media/upload')
        
        const response = await route!.handler(request)

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Too many files. Maximum 10 files allowed'
          }
        })
      })

      it('should validate file size limits', async () => {
        const largeFile = {
          name: 'large.jpg',
          type: 'image/jpeg',
          size: 60 * 1024 * 1024 // 60MB
        } as File

        const request: HttpRequest = {
          method: 'POST',
          url: '/api/v1/media/upload',
          path: '/api/v1/media/upload',
          query: {},
          params: {},
          headers: {},
          files: [largeFile]
        }
        const route = routes.findRoute('POST', '/api/v1/media/upload')
        
        const response = await route!.handler(request)

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'File large.jpg is too large. Maximum size is 50MB'
          }
        })
      })

      it('should validate file types', async () => {
        const maliciousFile = {
          name: 'malware.exe',
          type: 'application/octet-stream',
          size: 1024
        } as File

        const request: HttpRequest = {
          method: 'POST',
          url: '/api/v1/media/upload',
          path: '/api/v1/media/upload',
          query: {},
          params: {},
          headers: {},
          files: [maliciousFile]
        }
        const route = routes.findRoute('POST', '/api/v1/media/upload')
        
        const response = await route!.handler(request)

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'File type application/octet-stream is not allowed'
          }
        })
      })

      it('should validate file extensions', async () => {
        const executableFile = {
          name: 'script.exe',
          type: 'image/jpeg', // Spoofed content type
          size: 1024
        } as File

        const request: HttpRequest = {
          method: 'POST',
          url: '/api/v1/media/upload',
          path: '/api/v1/media/upload',
          query: {},
          params: {},
          headers: {},
          files: [executableFile]
        }
        const route = routes.findRoute('POST', '/api/v1/media/upload')
        
        const response = await route!.handler(request)

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'File extension .exe is not allowed'
          }
        })
      })

      it('should prevent path traversal in filenames', async () => {
        const traversalFile = {
          name: '../../../etc/passwd',
          type: 'text/plain',
          size: 1024
        } as File

        const request: HttpRequest = {
          method: 'POST',
          url: '/api/v1/media/upload',
          path: '/api/v1/media/upload',
          query: {},
          params: {},
          headers: {},
          files: [traversalFile]
        }
        const route = routes.findRoute('POST', '/api/v1/media/upload')
        
        const response = await route!.handler(request)

        expect(response.status).toBe(400)
        expect(response.body).toEqual({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Invalid filename. Path separators not allowed'
          }
        })
      })
    })

    describe('CORS security', () => {
      it('should not include CORS headers when CORS is not configured', () => {
        const noCorsConfig = {
          core: mockCore,
          basePath: '/api/v1'
          // No corsOptions
        }
        const noCorsRoutes = new TrokkyRoutes(noCorsConfig)

        const request: HttpRequest = {
          method: 'OPTIONS',
          url: '/api/v1/collections/posts',
          path: '/api/v1/collections/posts',
          query: {},
          params: {},
          headers: {}
        }
        const route = noCorsRoutes.findRoute('OPTIONS', '/api/v1/collections/posts')
        
        return route!.handler(request).then(response => {
          expect(response.status).toBe(200)
          expect(response.headers['Access-Control-Allow-Origin']).toBeUndefined()
        })
      })

      it('should handle specific origin configuration', async () => {
        const specificOriginConfig = {
          ...config,
          corsOptions: {
            origin: 'https://example.com',
            methods: ['GET', 'POST']
          }
        }
        const corsRoutes = new TrokkyRoutes(specificOriginConfig)

        const request: HttpRequest = {
          method: 'OPTIONS',
          url: '/api/v1/collections/posts',
          path: '/api/v1/collections/posts',
          query: {},
          params: {},
          headers: {}
        }
        const route = corsRoutes.findRoute('OPTIONS', '/api/v1/collections/posts')
        
        const response = await route!.handler(request)

        expect(response.headers['Access-Control-Allow-Origin']).toBe('https://example.com')
        expect(response.headers['Access-Control-Allow-Methods']).toBe('GET, POST')
      })
    })
  })
})