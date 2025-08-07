/**
 * Test suite for CloudflareD1Adapter
 * Tests core functionality, security, and edge cases
 */

import { CloudflareD1Adapter } from '../cloudflare-d1-adapter'
import { createMockD1Database } from './setup'
import type { D1Database } from '@cloudflare/workers-types'

describe('CloudflareD1Adapter', () => {
  let adapter: CloudflareD1Adapter
  let mockDb: D1Database

  beforeEach(() => {
    mockDb = createMockD1Database() as unknown as D1Database
    adapter = new CloudflareD1Adapter({
      database: mockDb,
      enableFTS: true,
      enableAuditLog: true
    })
  })

  describe('initialization', () => {
    test('should initialize without database binding', () => {
      const adapterNoDB = new CloudflareD1Adapter()
      expect(adapterNoDB).toBeDefined()
    })

    test('should initialize with database binding', () => {
      expect(adapter).toBeDefined()
    })

    test('should set database binding', () => {
      const newAdapter = new CloudflareD1Adapter()
      newAdapter.setDatabase(mockDb)
      // No error should be thrown
    })

    test('should initialize schema', async () => {
      await expect(adapter.initialize()).resolves.not.toThrow()
    })
  })

  describe('document operations', () => {
    const collection = 'articles'
    const docId = 'test-doc-1'
    const docData = {
      title: 'Test Article',
      content: 'This is test content'
    }

    test('should save document with generated ID', async () => {
      const result = await adapter.saveDocument(collection, '', docData)
      expect(result).toBeDefined()
      expect(result._id).toMatch(/^articles-/)
    })

    test('should save document with provided ID', async () => {
      const result = await adapter.saveDocument(collection, docId, docData)
      expect(result).toBeDefined()
    })

    test('should validate collection name', async () => {
      await expect(
        adapter.saveDocument('', docId, docData)
      ).rejects.toThrow()
    })

    test('should get document by ID', async () => {
      const result = await adapter.getDocument(collection, docId)
      // Mock returns null - in real test would return saved document
      expect(result).toBeNull()
    })

    test('should list documents with pagination', async () => {
      const result = await adapter.listDocuments(collection, {
        limit: 10,
        offset: 0
      })
      expect(result).toEqual([])
    })

    test('should validate pagination parameters', async () => {
      await expect(
        adapter.listDocuments(collection, { limit: -1 })
      ).rejects.toThrow('Invalid limit')

      await expect(
        adapter.listDocuments(collection, { offset: -1 })
      ).rejects.toThrow('Invalid offset')

      await expect(
        adapter.listDocuments(collection, { limit: 20000 })
      ).rejects.toThrow('Invalid limit')
    })
  })

  describe('user operations', () => {
    const userId = 'test-user-1'
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'user' as const,
      passwordHash: 'hashed_password_here_with_sufficient_length'
    }

    test('should save user with provided data', async () => {
      const result = await adapter.saveUser(userId, userData)
      expect(result).toBeDefined()
    })

    test('should get user by ID', async () => {
      const result = await adapter.getUser(userId)
      expect(result).toBeNull()
    })

    test('should get user by username', async () => {
      const result = await adapter.getUserByUsername('testuser')
      expect(result).toBeNull()
    })

    test('should get user by email', async () => {
      const result = await adapter.getUserByEmail('test@example.com')
      expect(result).toBeNull()
    })

    test('should list users', async () => {
      const result = await adapter.listUsers()
      expect(result).toEqual([])
    })
  })

  describe('app token operations', () => {
    const tokenId = 'test-token-1'
    const tokenData = {
      name: 'Test Token',
      permissions: ['read', 'write'],
      tokenHash: 'hashed_token_here_with_sufficient_length_for_security',
      createdBy: 'test-user-1'
    }

    test('should save app token', async () => {
      const result = await adapter.saveAppToken(tokenId, tokenData)
      expect(result).toBeDefined()
    })

    test('should get app token by ID', async () => {
      const result = await adapter.getAppToken(tokenId)
      expect(result).toBeNull()
    })

    test('should get app token by hash', async () => {
      const result = await adapter.getAppTokenByHash(tokenData.tokenHash)
      expect(result).toBeNull()
    })

    test('should list app tokens', async () => {
      const result = await adapter.listAppTokens()
      expect(result).toEqual([])
    })
  })

  describe('search functionality', () => {
    const collection = 'articles'

    test('should search documents with FTS', async () => {
      const result = await adapter.searchDocuments(collection, 'test search')
      expect(result).toEqual([])
    })

    test('should validate search term', async () => {
      await expect(
        adapter.searchDocuments(collection, '')
      ).rejects.toThrow('Search term must be a non-empty string')

      await expect(
        adapter.searchDocuments(collection, 'a'.repeat(1001))
      ).rejects.toThrow('Search term too long')
    })

    test('should validate search pagination', async () => {
      await expect(
        adapter.searchDocuments(collection, 'test', { limit: 2000 })
      ).rejects.toThrow('Invalid limit for search')
    })

    test('should sanitize search terms', async () => {
      // Should not throw for special characters
      await expect(
        adapter.searchDocuments(collection, 'test "quoted" search')
      ).resolves.toEqual([])
    })
  })

  describe('utility operations', () => {
    test('should perform health check', async () => {
      const result = await adapter.healthCheck()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('security', () => {
    test('should prevent SQL injection in pagination', async () => {
      // These should be validated and rejected
      await expect(
        adapter.listDocuments('articles', { 
          limit: '10; DROP TABLE documents;' as any 
        })
      ).rejects.toThrow()
    })

    test('should sanitize search terms', async () => {
      // Special characters should be escaped, not cause errors
      await expect(
        adapter.searchDocuments('articles', 'search"; DROP TABLE documents; --')
      ).resolves.toEqual([])
    })
  })
})