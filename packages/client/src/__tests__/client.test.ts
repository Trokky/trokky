/**
 * Trokky Client Tests
 */

import { TrokkyClient } from '../client'
import type { ClientConfig, AuthTokens, BaseDocument } from '../types'

// Mock all dependencies
jest.mock('../http/client')
jest.mock('../cache/manager')
jest.mock('../document/client')

describe('TrokkyClient', () => {
  let client: TrokkyClient
  let mockConfig: ClientConfig

  const mockTokens: AuthTokens = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token'
  }

  const mockDocument = {
    data: { title: 'Test Document', _type: 'post' },
    _id: 'doc-1',
    _type: 'post',
    _createdAt: '2023-01-01T00:00:00Z',
    _updatedAt: '2023-01-01T00:00:00Z',
    _version: 1
  }

  beforeEach(() => {
    mockConfig = {
      baseUrl: 'https://api.example.com',
      apiVersion: 'v1',
      timeout: 5000
    }

    client = new TrokkyClient(mockConfig)
    
    // Reset all mocks
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should initialize all components', () => {
      expect(client.http).toBeDefined()
      expect(client.cache).toBeDefined()
      expect(client.documents).toBeDefined()
    })
  })

  describe('authentication methods', () => {
    it('should delegate authenticate to http client', async () => {
      const credentials = { username: 'test@example.com', password: 'password' }
      const mockAuthenticate = jest.fn().mockResolvedValue(mockTokens)
      client.http.authenticate = mockAuthenticate

      const result = await client.authenticate(credentials)

      expect(result).toBe(mockTokens)
      expect(mockAuthenticate).toHaveBeenCalledWith(credentials)
    })

    it('should delegate refreshAuth to http client', async () => {
      const mockRefreshAuth = jest.fn().mockResolvedValue(mockTokens)
      client.http.refreshAuth = mockRefreshAuth

      const result = await client.refreshAuth()

      expect(result).toBe(mockTokens)
      expect(mockRefreshAuth).toHaveBeenCalled()
    })

    it('should delegate logout to http client and clear cache', async () => {
      const mockLogout = jest.fn().mockResolvedValue(undefined)
      const mockCacheClear = jest.fn()
      client.http.logout = mockLogout
      client.cache.clear = mockCacheClear

      await client.logout()

      expect(mockLogout).toHaveBeenCalled()
      expect(mockCacheClear).toHaveBeenCalled()
    })

    it('should delegate isAuthenticated to http client', () => {
      const mockIsAuthenticated = jest.fn().mockReturnValue(true)
      client.http.isAuthenticated = mockIsAuthenticated

      const result = client.isAuthenticated()

      expect(result).toBe(true)
      expect(mockIsAuthenticated).toHaveBeenCalled()
    })

    it('should delegate getTokens to http client', () => {
      const mockGetTokens = jest.fn().mockReturnValue(mockTokens)
      client.http.getTokens = mockGetTokens

      const result = client.getTokens()

      expect(result).toBe(mockTokens)
      expect(mockGetTokens).toHaveBeenCalled()
    })

    it('should delegate setTokens to http client', () => {
      const mockSetTokens = jest.fn()
      client.http.setTokens = mockSetTokens

      client.setTokens(mockTokens)

      expect(mockSetTokens).toHaveBeenCalledWith(mockTokens)
    })
  })

  describe('document methods', () => {
    beforeEach(() => {
      // Setup document client mocks
      client.documents.getById = jest.fn()
      client.documents.query = jest.fn()
      client.documents.create = jest.fn()
      client.documents.update = jest.fn()
      client.documents.replace = jest.fn()
      client.documents.delete = jest.fn()
      client.documents.search = jest.fn()
      client.documents.count = jest.fn()
      client.documents.exists = jest.fn()
    })

    it('should delegate getDocument to document client', async () => {
      const mockGetById = client.documents.getById as jest.Mock
      mockGetById.mockResolvedValue(mockDocument)

      const result = await client.getDocument('post', 'doc-1')

      expect(result).toBe(mockDocument)
      expect(mockGetById).toHaveBeenCalledWith('post', 'doc-1', true)
    })

    it('should delegate queryDocuments to document client', async () => {
      const mockQuery = client.documents.query as jest.Mock
      const mockResult = { data: [mockDocument], total: 1, offset: 0, limit: 10, hasMore: false }
      mockQuery.mockResolvedValue(mockResult)

      const options = { limit: 10 }
      const result = await client.queryDocuments('post', options)

      expect(result).toBe(mockResult)
      expect(mockQuery).toHaveBeenCalledWith('post', options, true)
    })

    it('should delegate createDocument to document client', async () => {
      const mockCreate = client.documents.create as jest.Mock
      mockCreate.mockResolvedValue(mockDocument)

      const data = { title: 'New Document' }
      const result = await client.createDocument('post', data)

      expect(result).toBe(mockDocument)
      expect(mockCreate).toHaveBeenCalledWith('post', data)
    })

    it('should delegate updateDocument to document client', async () => {
      const mockUpdate = client.documents.update as jest.Mock
      mockUpdate.mockResolvedValue(mockDocument)

      const data = { title: 'Updated Document' }
      const result = await client.updateDocument('post', 'doc-1', data)

      expect(result).toBe(mockDocument)
      expect(mockUpdate).toHaveBeenCalledWith('post', 'doc-1', data)
    })

    it('should delegate replaceDocument to document client', async () => {
      const mockReplace = client.documents.replace as jest.Mock
      mockReplace.mockResolvedValue(mockDocument)

      const data = { title: 'Replaced Document' }
      const result = await client.replaceDocument('post', 'doc-1', data)

      expect(result).toBe(mockDocument)
      expect(mockReplace).toHaveBeenCalledWith('post', 'doc-1', data)
    })

    it('should delegate deleteDocument to document client', async () => {
      const mockDelete = client.documents.delete as jest.Mock
      mockDelete.mockResolvedValue(undefined)

      await client.deleteDocument('post', 'doc-1')

      expect(mockDelete).toHaveBeenCalledWith('post', 'doc-1')
    })

    it('should delegate searchDocuments to document client', async () => {
      const mockSearch = client.documents.search as jest.Mock
      const mockResult = { data: [mockDocument], total: 1, offset: 0, limit: 10, hasMore: false }
      mockSearch.mockResolvedValue(mockResult)

      const result = await client.searchDocuments('post', 'test search', ['title'])

      expect(result).toBe(mockResult)
      expect(mockSearch).toHaveBeenCalledWith('post', 'test search', ['title'], {})
    })

    it('should delegate countDocuments to document client', async () => {
      const mockCount = client.documents.count as jest.Mock
      mockCount.mockResolvedValue(42)

      const result = await client.countDocuments('post')

      expect(result).toBe(42)
      expect(mockCount).toHaveBeenCalledWith('post', undefined)
    })

    it('should delegate documentExists to document client', async () => {
      const mockExists = client.documents.exists as jest.Mock
      mockExists.mockResolvedValue(true)

      const result = await client.documentExists('post', 'doc-1')

      expect(result).toBe(true)
      expect(mockExists).toHaveBeenCalledWith('post', 'doc-1')
    })
  })

  describe('media methods', () => {
    beforeEach(() => {
      client.http.upload = jest.fn()
      client.http.get = jest.fn()
      client.http.delete = jest.fn()
    })

    it('should delegate uploadFile to http client', async () => {
      const mockUpload = client.http.upload as jest.Mock
      const mockResult = { _id: 'file-1', filename: 'test.jpg', url: 'https://example.com/test.jpg' }
      mockUpload.mockResolvedValue(mockResult)

      const file = new File(['content'], 'test.jpg')
      const result = await client.uploadFile(file)

      expect(result).toBe(mockResult)
      expect(mockUpload).toHaveBeenCalledWith(file, undefined)
    })

    it('should delegate getMedia to http client', async () => {
      const mockGet = client.http.get as jest.Mock
      const mockResult = { _id: 'file-1', filename: 'test.jpg', url: 'https://example.com/test.jpg' }
      mockGet.mockResolvedValue(mockResult)

      const result = await client.getMedia('file-1')

      expect(result).toBe(mockResult)
      expect(mockGet).toHaveBeenCalledWith('/media/file-1')
    })

    it('should delegate deleteMedia to http client', async () => {
      const mockDelete = client.http.delete as jest.Mock
      mockDelete.mockResolvedValue(undefined)

      await client.deleteMedia('file-1')

      expect(mockDelete).toHaveBeenCalledWith('/media/file-1')
    })
  })

  describe('utility methods', () => {
    beforeEach(() => {
      client.http.get = jest.fn()
    })

    it('should ping API', async () => {
      const mockGet = client.http.get as jest.Mock
      const mockResult = { status: 'ok', timestamp: '2023-01-01T00:00:00Z' }
      mockGet.mockResolvedValue(mockResult)

      const result = await client.ping()

      expect(result).toBe(mockResult)
      expect(mockGet).toHaveBeenCalledWith('/ping')
    })

    it('should check health', async () => {
      const mockGet = client.http.get as jest.Mock
      const mockResult = { status: 'healthy', services: { database: 'ok', storage: 'ok' } }
      mockGet.mockResolvedValue(mockResult)

      const result = await client.health()

      expect(result).toBe(mockResult)
      expect(mockGet).toHaveBeenCalledWith('/health')
    })

    it('should clear cache', () => {
      const mockClear = jest.fn()
      client.cache.clear = mockClear

      client.clearCache()

      expect(mockClear).toHaveBeenCalled()
    })

    it('should get cache stats', () => {
      const mockSize = jest.fn().mockReturnValue(42)
      client.cache.size = mockSize

      const result = client.getCacheStats()

      expect(result).toEqual({ size: 42 })
      expect(mockSize).toHaveBeenCalled()
    })

    it('should destroy client and cleanup resources', () => {
      const mockDestroy = jest.fn()
      client.cache.destroy = mockDestroy

      client.destroy()

      expect(mockDestroy).toHaveBeenCalled()
    })
  })
})