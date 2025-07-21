/**
 * Document Client Tests
 */

import { DocumentClient } from '../document/client'
import { HttpClient } from '../http/client'
import { CacheManager } from '../cache/manager'
import type { DocumentResult, CollectionResult, BaseDocument } from '../types'

// Mock the dependencies
jest.mock('../http/client')
jest.mock('../cache/manager')

describe('DocumentClient', () => {
  let documentClient: DocumentClient
  let mockHttpClient: jest.Mocked<HttpClient>
  let mockCacheManager: jest.Mocked<CacheManager>

  const mockDocument: DocumentResult<BaseDocument> = {
    data: { title: 'Test Document', _type: 'post' },
    _id: 'doc-1',
    _type: 'post',
    _createdAt: '2023-01-01T00:00:00Z',
    _updatedAt: '2023-01-01T00:00:00Z',
    _version: 1
  }

  const mockCollection: CollectionResult<BaseDocument> = {
    data: [mockDocument],
    total: 1,
    offset: 0,
    limit: 10,
    hasMore: false
  }

  beforeEach(() => {
    mockHttpClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn()
    } as any

    mockCacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      generateKey: jest.fn()
    } as any

    documentClient = new DocumentClient(mockHttpClient, mockCacheManager)
  })

  describe('getById', () => {
    it('should return cached document when available', async () => {
      const cacheKey = 'documents/post/doc-1'
      mockCacheManager.generateKey.mockReturnValue(cacheKey)
      mockCacheManager.get.mockReturnValue(mockDocument)

      const result = await documentClient.getById('post', 'doc-1')

      expect(result).toBe(mockDocument)
      expect(mockCacheManager.generateKey).toHaveBeenCalledWith('documents/post/doc-1')
      expect(mockCacheManager.get).toHaveBeenCalledWith(cacheKey)
      expect(mockHttpClient.get).not.toHaveBeenCalled()
    })

    it('should fetch from API when not cached', async () => {
      const cacheKey = 'documents/post/doc-1'
      mockCacheManager.generateKey.mockReturnValue(cacheKey)
      mockCacheManager.get.mockReturnValue(null)
      mockHttpClient.get.mockResolvedValue(mockDocument)

      const result = await documentClient.getById('post', 'doc-1')

      expect(result).toBe(mockDocument)
      expect(mockHttpClient.get).toHaveBeenCalledWith('/documents/post/doc-1')
      expect(mockCacheManager.set).toHaveBeenCalledWith(cacheKey, mockDocument)
    })

    it('should skip cache when useCache is false', async () => {
      mockHttpClient.get.mockResolvedValue(mockDocument)

      const result = await documentClient.getById('post', 'doc-1', false)

      expect(result).toBe(mockDocument)
      expect(mockCacheManager.get).not.toHaveBeenCalled()
      expect(mockCacheManager.set).not.toHaveBeenCalled()
      expect(mockHttpClient.get).toHaveBeenCalledWith('/documents/post/doc-1')
    })
  })

  describe('query', () => {
    it('should build query parameters correctly', async () => {
      const options = {
        filter: { status: 'published' },
        sort: { createdAt: -1 },
        limit: 20,
        offset: 10,
        select: ['title', 'slug']
      }

      mockCacheManager.generateKey.mockReturnValue('cache-key')
      mockCacheManager.get.mockReturnValue(null)
      mockHttpClient.get.mockResolvedValue(mockCollection)

      await documentClient.query('post', options)

      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/documents/post?filter=%7B%22status%22%3A%22published%22%7D&sort=%7B%22createdAt%22%3A-1%7D&limit=20&offset=10&select=title%2Cslug'
      )
    })

    it('should handle empty query options', async () => {
      mockCacheManager.generateKey.mockReturnValue('cache-key')
      mockCacheManager.get.mockReturnValue(null)
      mockHttpClient.get.mockResolvedValue(mockCollection)

      await documentClient.query('post')

      expect(mockHttpClient.get).toHaveBeenCalledWith('/documents/post')
    })

    it('should return cached results when available', async () => {
      const cacheKey = 'documents/post?limit=10'
      mockCacheManager.generateKey.mockReturnValue(cacheKey)
      mockCacheManager.get.mockReturnValue(mockCollection)

      const result = await documentClient.query('post', { limit: 10 })

      expect(result).toBe(mockCollection)
      expect(mockHttpClient.get).not.toHaveBeenCalled()
    })
  })

  describe('create', () => {
    it('should create document and invalidate cache', async () => {
      const newDocData = { title: 'New Document' }
      const expectedPayload = { ...newDocData, _type: 'post' }
      mockHttpClient.post.mockResolvedValue(mockDocument)

      const result = await documentClient.create('post', newDocData)

      expect(result).toBe(mockDocument)
      expect(mockHttpClient.post).toHaveBeenCalledWith('/documents/post', expectedPayload)
      expect(mockCacheManager.clear).toHaveBeenCalled() // Cache invalidation
    })
  })

  describe('update', () => {
    it('should update document and update cache', async () => {
      const updateData = { title: 'Updated Title' }
      const cacheKey = 'documents/post/doc-1'
      mockCacheManager.generateKey.mockReturnValue(cacheKey)
      mockHttpClient.patch.mockResolvedValue(mockDocument)

      const result = await documentClient.update('post', 'doc-1', updateData)

      expect(result).toBe(mockDocument)
      expect(mockHttpClient.patch).toHaveBeenCalledWith('/documents/post/doc-1', updateData)
      expect(mockCacheManager.set).toHaveBeenCalledWith(cacheKey, mockDocument)
      expect(mockCacheManager.clear).toHaveBeenCalled() // Cache invalidation
    })
  })

  describe('replace', () => {
    it('should replace document and update cache', async () => {
      const replaceData = { title: 'Replaced Document' }
      const expectedPayload = { ...replaceData, _type: 'post' }
      const cacheKey = 'documents/post/doc-1'
      mockCacheManager.generateKey.mockReturnValue(cacheKey)
      mockHttpClient.put.mockResolvedValue(mockDocument)

      const result = await documentClient.replace('post', 'doc-1', replaceData)

      expect(result).toBe(mockDocument)
      expect(mockHttpClient.put).toHaveBeenCalledWith('/documents/post/doc-1', expectedPayload)
      expect(mockCacheManager.set).toHaveBeenCalledWith(cacheKey, mockDocument)
      expect(mockCacheManager.clear).toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('should delete document and remove from cache', async () => {
      const cacheKey = 'documents/post/doc-1'
      mockCacheManager.generateKey.mockReturnValue(cacheKey)
      mockHttpClient.delete.mockResolvedValue(undefined)

      await documentClient.delete('post', 'doc-1')

      expect(mockHttpClient.delete).toHaveBeenCalledWith('/documents/post/doc-1')
      expect(mockCacheManager.delete).toHaveBeenCalledWith(cacheKey)
      expect(mockCacheManager.clear).toHaveBeenCalled()
    })
  })

  describe('search', () => {
    it('should search documents with text query', async () => {
      mockHttpClient.get.mockResolvedValue(mockCollection)

      const result = await documentClient.search('post', 'test search', ['title', 'content'])

      expect(result).toBe(mockCollection)
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/documents/post?filter=')
      )
      
      // Verify the filter was constructed properly
      const callArgs = mockHttpClient.get.mock.calls[0][0]
      expect(callArgs).toContain('%24text') // URL-encoded $text
      expect(callArgs).toContain('test+search') // URL-encoded "test search" (+ encoding)
    })

    it('should not cache search results', async () => {
      mockHttpClient.get.mockResolvedValue(mockCollection)

      await documentClient.search('post', 'test search')

      expect(mockCacheManager.get).not.toHaveBeenCalled()
      expect(mockCacheManager.set).not.toHaveBeenCalled()
    })
  })

  describe('count', () => {
    it('should count documents', async () => {
      mockHttpClient.get.mockResolvedValue({ count: 42 })

      const result = await documentClient.count('post')

      expect(result).toBe(42)
      expect(mockHttpClient.get).toHaveBeenCalledWith('/documents/post/count')
    })

    it('should count documents with filter', async () => {
      const filter = { status: 'published' }
      mockHttpClient.get.mockResolvedValue({ count: 15 })

      const result = await documentClient.count('post', filter)

      expect(result).toBe(15)
      expect(mockHttpClient.get).toHaveBeenCalledWith(
        '/documents/post/count?filter=%7B%22status%22%3A%22published%22%7D'
      )
    })
  })

  describe('exists', () => {
    it('should return true when document exists', async () => {
      mockHttpClient.get.mockResolvedValue({})

      const result = await documentClient.exists('post', 'doc-1')

      expect(result).toBe(true)
      expect(mockHttpClient.get).toHaveBeenCalledWith('/documents/post/doc-1/exists')
    })

    it('should return false when document does not exist', async () => {
      const notFoundError = { status: 404 }
      mockHttpClient.get.mockRejectedValue(notFoundError)

      const result = await documentClient.exists('post', 'non-existent')

      expect(result).toBe(false)
    })

    it('should throw on other errors', async () => {
      const serverError = { status: 500, message: 'Server error' }
      mockHttpClient.get.mockRejectedValue(serverError)

      await expect(documentClient.exists('post', 'doc-1')).rejects.toEqual(serverError)
    })
  })

  describe('getAll', () => {
    it('should get all documents with default limit', async () => {
      mockCacheManager.generateKey.mockReturnValue('cache-key')
      mockCacheManager.get.mockReturnValue(null)
      mockHttpClient.get.mockResolvedValue(mockCollection)

      const result = await documentClient.getAll('post')

      expect(result).toBe(mockCollection)
      expect(mockHttpClient.get).toHaveBeenCalledWith('/documents/post?limit=100')
    })

    it('should get all documents with custom limit', async () => {
      mockCacheManager.generateKey.mockReturnValue('cache-key')
      mockCacheManager.get.mockReturnValue(null)
      mockHttpClient.get.mockResolvedValue(mockCollection)

      const result = await documentClient.getAll('post', 50)

      expect(result).toBe(mockCollection)
      expect(mockHttpClient.get).toHaveBeenCalledWith('/documents/post?limit=50')
    })
  })
})