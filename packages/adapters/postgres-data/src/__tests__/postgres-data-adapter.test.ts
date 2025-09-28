import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { PostgresDataAdapter } from '../postgres-data-adapter.js'
import type { PostgresDataAdapterConfig } from '../types.js'

// Mock pg module
const mockQuery = jest.fn()
const mockConnect = jest.fn()
const mockEnd = jest.fn()
const mockOn = jest.fn()

const mockPool = {
  query: mockQuery,
  connect: mockConnect,
  end: mockEnd,
  on: mockOn
}

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => mockPool)
}))

describe('PostgresDataAdapter', () => {
  let adapter: PostgresDataAdapter
  let config: PostgresDataAdapterConfig

  beforeEach(() => {
    jest.clearAllMocks()

    config = {
      connection: 'postgresql://test:test@localhost:5432/trokky_test',
      schema: 'public',
      tablePrefix: 'test_',
      autoMigrate: false, // Disable auto-migration for unit tests
      enableQueryLogging: false
    }

    adapter = new PostgresDataAdapter(config)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create adapter with default config', () => {
      const defaultAdapter = new PostgresDataAdapter()
      expect(defaultAdapter).toBeInstanceOf(PostgresDataAdapter)
    })

    it('should create adapter with custom config', () => {
      expect(adapter).toBeInstanceOf(PostgresDataAdapter)
      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockOn).toHaveBeenCalledWith('connect', expect.any(Function))
    })
  })

  describe('healthCheck', () => {
    it('should return true when database is healthy', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ health: 1 }]
      })

      const result = await adapter.healthCheck()

      expect(result).toBe(true)
      expect(mockQuery).toHaveBeenCalledWith('SELECT 1 as health')
    })

    it('should return false when database is unhealthy', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Connection failed'))

      const result = await adapter.healthCheck()

      expect(result).toBe(false)
    })
  })

  describe('getDocument', () => {
    it('should return document when found', async () => {
      const mockRow = {
        id: 'test-id',
        collection: 'articles',
        data: { title: 'Test Article', content: 'Test content' },
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
        created_by: 'user-1',
        updated_by: 'user-1'
      }

      mockQuery.mockResolvedValueOnce({
        rows: [mockRow]
      })

      const document = await adapter.getDocument('articles', 'test-id')

      expect(document).toEqual({
        _id: 'test-id',
        _collection: 'articles',
        _createdAt: '2024-01-01T00:00:00.000Z',
        _updatedAt: '2024-01-01T00:00:00.000Z',
        _createdBy: 'user-1',
        _updatedBy: 'user-1',
        title: 'Test Article',
        content: 'Test content'
      })
    })

    it('should return null when document not found', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: []
      })

      const document = await adapter.getDocument('articles', 'missing-id')

      expect(document).toBeNull()
    })

    it('should validate collection name', async () => {
      await expect(adapter.getDocument('', 'test-id'))
        .rejects.toThrow()
    })

    it('should validate document id', async () => {
      await expect(adapter.getDocument('articles', ''))
        .rejects.toThrow()
    })
  })

  describe('saveDocument', () => {
    it('should save document successfully', async () => {
      const mockRow = {
        id: 'test-id',
        collection: 'articles',
        data: { title: 'Test Article', content: 'Test content' },
        created_at: new Date('2024-01-01T00:00:00Z'),
        updated_at: new Date('2024-01-01T00:00:00Z'),
        created_by: 'user-1',
        updated_by: 'user-1'
      }

      mockQuery.mockResolvedValueOnce({
        rows: [mockRow]
      })

      const documentData = { title: 'Test Article', content: 'Test content' }
      const auditContext = {
        actor: { type: 'user' as const, id: 'user-1' }
      }

      const document = await adapter.saveDocument('articles', 'test-id', documentData, auditContext)

      expect(document).toEqual({
        _id: 'test-id',
        _collection: 'articles',
        _createdAt: '2024-01-01T00:00:00.000Z',
        _updatedAt: '2024-01-01T00:00:00.000Z',
        _createdBy: 'user-1',
        _updatedBy: 'user-1',
        title: 'Test Article',
        content: 'Test content'
      })
    })

    it('should validate document size', async () => {
      const largeData = { content: 'x'.repeat(11 * 1024 * 1024) } // > 10MB

      await expect(adapter.saveDocument('articles', 'test-id', largeData))
        .rejects.toThrow('Document exceeds maximum size')
    })
  })

  describe('listDocuments', () => {
    it('should list documents with default options', async () => {
      const mockRows = [
        {
          id: 'doc-1',
          collection: 'articles',
          data: { title: 'Article 1' },
          created_at: new Date('2024-01-01T00:00:00Z'),
          updated_at: new Date('2024-01-01T00:00:00Z')
        }
      ]

      mockQuery.mockResolvedValueOnce({
        rows: mockRows
      })

      const documents = await adapter.listDocuments('articles')

      expect(documents).toHaveLength(1)
      expect(documents[0]).toEqual({
        _id: 'doc-1',
        _collection: 'articles',
        _createdAt: '2024-01-01T00:00:00.000Z',
        _updatedAt: '2024-01-01T00:00:00.000Z',
        _createdBy: undefined,
        _updatedBy: undefined,
        title: 'Article 1'
      })
    })

    it('should respect limit option', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: []
      })

      await adapter.listDocuments('articles', { limit: 10 })

      const queryCall = mockQuery.mock.calls[0]
      expect(queryCall[1]).toContain(10) // Should contain limit value
    })

    it('should enforce maximum limit', async () => {
      mockQuery.mkResolvedValueOnce({
        rows: []
      })

      await adapter.listDocuments('articles', { limit: 2000 })

      const queryCall = mockQuery.mock.calls[0]
      expect(queryCall[1]).toContain(1000) // Should be capped at MAX_LIST_LIMIT
    })
  })

  describe('deleteDocument', () => {
    it('should delete document successfully', async () => {
      mockQuery.mockResolvedValueOnce({
        rowCount: 1
      })

      await expect(adapter.deleteDocument('articles', 'test-id'))
        .resolves.not.toThrow()
    })

    it('should throw error when document not found', async () => {
      mockQuery.mockResolvedValueOnce({
        rowCount: 0
      })

      await expect(adapter.deleteDocument('articles', 'missing-id'))
        .rejects.toThrow('Document articles:missing-id not found')
    })
  })

  describe('documentExists', () => {
    it('should return true when document exists', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ exists: 1 }]
      })

      const exists = await adapter.documentExists('articles', 'test-id')
      expect(exists).toBe(true)
    })

    it('should return false when document does not exist', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: []
      })

      const exists = await adapter.documentExists('articles', 'missing-id')
      expect(exists).toBe(false)
    })
  })

  describe('countDocuments', () => {
    it('should return document count', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '42' }]
      })

      const count = await adapter.countDocuments('articles')
      expect(count).toBe(42)
    })

    it('should handle filters in count query', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ count: '5' }]
      })

      const count = await adapter.countDocuments('articles', { status: 'published' })
      expect(count).toBe(5)
    })
  })

  describe('getStorageInfo', () => {
    it('should return storage information', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ collection: 'articles' }, { collection: 'pages' }] })
        .mockResolvedValueOnce({ rows: [{ count: '100' }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })

      const info = await adapter.getStorageInfo()

      expect(info).toEqual({
        collections: ['articles', 'pages'],
        documentCount: 100,
        userCount: 5,
        tokenCount: 3,
        database: 'postgresql'
      })
    })
  })
})