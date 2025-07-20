import { Request, Response } from 'express'
import { ExpressAdapter } from '../adapter.js'
import type { HttpRequest, HttpResponse } from '@trokky/routes'
import type { ExpressRequestWithFiles } from '../types.js'

// Mock Express Request and Response
const mockRequest = (overrides: Partial<ExpressRequestWithFiles> = {}): ExpressRequestWithFiles => ({
  method: 'GET',
  originalUrl: '/api/v1/test',
  url: '/api/v1/test',
  path: '/api/v1/test',
  query: {},
  params: {},
  headers: {},
  body: undefined,
  ...overrides
} as ExpressRequestWithFiles)

const mockResponse = (): Partial<Response> => {
  const res: any = {
    statusCode: 200,
    headers: {},
    status: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis()
  }
  return res
}

describe('ExpressAdapter', () => {
  let adapter: ExpressAdapter

  beforeEach(() => {
    adapter = new ExpressAdapter()
  })

  describe('convertRequest', () => {
    it('should convert basic Express request to HttpRequest', () => {
      const expressReq = mockRequest({
        method: 'POST',
        originalUrl: '/api/v1/collections/posts',
        path: '/api/v1/collections/posts',
        query: { limit: '10', offset: '0' },
        params: { collection: 'posts' },
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer token123'
        },
        body: { title: 'Test Post' }
      })

      const httpRequest = adapter.convertRequest(expressReq)

      expect(httpRequest).toEqual({
        method: 'POST',
        url: '/api/v1/collections/posts',
        path: '/api/v1/collections/posts',
        query: { limit: '10', offset: '0' },
        params: { collection: 'posts' },
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer token123'
        },
        body: { title: 'Test Post' },
        files: undefined
      })
    })

    it('should handle array query parameters', () => {
      const expressReq = mockRequest({
        query: {
          tags: ['tech', 'programming'],
          category: 'blog'
        }
      })

      const httpRequest = adapter.convertRequest(expressReq)

      expect(httpRequest.query).toEqual({
        tags: ['tech', 'programming'],
        category: 'blog'
      })
    })

    it('should handle array headers', () => {
      const expressReq = mockRequest({
        headers: {
          'accept': ['application/json', 'text/html'],
          'user-agent': 'test-agent'
        }
      })

      const httpRequest = adapter.convertRequest(expressReq)

      expect(httpRequest.headers).toEqual({
        'accept': ['application/json', 'text/html'],
        'user-agent': 'test-agent'
      })
    })

    it('should convert Multer files to File objects', () => {
      const multerFile: Express.Multer.File = {
        fieldname: 'files',
        originalname: 'test.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 12,
        buffer: Buffer.from('test content'),
        destination: '',
        filename: '',
        path: '',
        stream: {} as any
      }

      const expressReq = mockRequest({
        files: [multerFile]
      })

      const httpRequest = adapter.convertRequest(expressReq)

      expect(httpRequest.files).toHaveLength(1)
      expect(httpRequest.files![0]).toMatchObject({
        name: 'test.txt',
        type: 'text/plain',
        size: 12
      })
    })

    it('should handle single Multer file', () => {
      const multerFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'single.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        buffer: Buffer.alloc(1024),
        destination: '',
        filename: '',
        path: '',
        stream: {} as any
      }

      const expressReq = mockRequest({
        files: multerFile
      })

      const httpRequest = adapter.convertRequest(expressReq)

      expect(httpRequest.files).toHaveLength(1)
      expect(httpRequest.files![0]).toMatchObject({
        name: 'single.jpg',
        type: 'image/jpeg',
        size: 1024
      })
    })
  })

  describe('handleRoute', () => {
    it('should create Express handler that calls framework-agnostic handler', async () => {
      const mockHandler = jest.fn().mockResolvedValue({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { success: true, data: 'test' }
      } as HttpResponse)

      const expressHandler = adapter.handleRoute(mockHandler)
      const expressReq = mockRequest()
      const expressRes = mockResponse()
      const next = jest.fn()

      await expressHandler(expressReq, expressRes as Response, next)

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/api/v1/test',
          path: '/api/v1/test'
        })
      )

      expect(expressRes.status).toHaveBeenCalledWith(200)
      expect(expressRes.set).toHaveBeenCalledWith('Content-Type', 'application/json')
      expect(expressRes.json).toHaveBeenCalledWith({ success: true, data: 'test' })
    })

    it('should handle string responses', async () => {
      const mockHandler = jest.fn().mockResolvedValue({
        status: 200,
        headers: {},
        body: 'Plain text response'
      } as HttpResponse)

      const expressHandler = adapter.handleRoute(mockHandler)
      const expressReq = mockRequest()
      const expressRes = mockResponse()
      const next = jest.fn()

      await expressHandler(expressReq, expressRes as Response, next)

      expect(expressRes.send).toHaveBeenCalledWith('Plain text response')
    })

    it('should handle null/undefined responses', async () => {
      const mockHandler = jest.fn().mockResolvedValue({
        status: 204,
        headers: {},
        body: null
      } as HttpResponse)

      const expressHandler = adapter.handleRoute(mockHandler)
      const expressReq = mockRequest()
      const expressRes = mockResponse()
      const next = jest.fn()

      await expressHandler(expressReq, expressRes as Response, next)

      expect(expressRes.end).toHaveBeenCalled()
    })

    it('should pass errors to Express error middleware', async () => {
      const error = new Error('Test error')
      const mockHandler = jest.fn().mockRejectedValue(error)

      const expressHandler = adapter.handleRoute(mockHandler)
      const expressReq = mockRequest()
      const expressRes = mockResponse()
      const next = jest.fn()

      await expressHandler(expressReq, expressRes as Response, next)

      expect(next).toHaveBeenCalledWith(error)
    })
  })

})