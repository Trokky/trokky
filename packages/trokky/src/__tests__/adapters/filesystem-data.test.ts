import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest'
import { FilesystemDataAdapter } from '../../adapters/filesystem-data/filesystem-data-adapter.js'
import fs from 'fs-extra'
import path from 'path'
import os from 'os'

describe('FilesystemDataAdapter', () => {
  let adapter: FilesystemDataAdapter
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trokky-test-'))
    const dirs = ['content', 'users', 'tokens', 'webhooks', 'settings', 'audit-logs']
    for (const dir of dirs) {
      await fs.ensureDir(path.join(tempDir, dir))
    }
    adapter = new FilesystemDataAdapter({
      contentDir: path.join(tempDir, 'content'),
      usersDir: path.join(tempDir, 'users'),
      tokensDir: path.join(tempDir, 'tokens'),
      webhooksDir: path.join(tempDir, 'webhooks'),
      settingsDir: path.join(tempDir, 'settings'),
    })
    // Give async init time to complete
    await new Promise(resolve => setTimeout(resolve, 50))
  })

  afterEach(async () => {
    await fs.remove(tempDir)
  })

  // The routes layer normalises every incoming sort into `field.asc` / `field.desc` before it
  // reaches an adapter, which is the grammar the postgres adapter parses. This adapter only
  // understood `-field`, so API sorting silently did nothing on a filesystem-backed site.
  describe('sorting', () => {
    beforeEach(async () => {
      await adapter.saveDocument('posts', 'a', { title: 'A', order: 2 })
      await adapter.saveDocument('posts', 'b', { title: 'B', order: 1 })
      await adapter.saveDocument('posts', 'c', { title: 'C', order: 3 })
    })

    it('should sort ascending with the field.asc form the routes layer produces', async () => {
      const docs = await adapter.listDocuments('posts', { sort: 'order.asc' })
      expect(docs.map(d => (d as Record<string, unknown>).order)).toEqual([1, 2, 3])
    })

    it('should sort descending with the field.desc form', async () => {
      const docs = await adapter.listDocuments('posts', { sort: 'order.desc' })
      expect(docs.map(d => (d as Record<string, unknown>).order)).toEqual([3, 2, 1])
    })

    it('should still honour the -field prefix form', async () => {
      const docs = await adapter.listDocuments('posts', { sort: '-order' })
      expect(docs.map(d => (d as Record<string, unknown>).order)).toEqual([3, 2, 1])
    })
  })

  describe('healthCheck', () => {
    it('should return true after initialization', async () => {
      const result = await adapter.healthCheck()
      expect(result).toBe(true)
    })

    it('should create required directories', async () => {
      expect(await fs.pathExists(path.join(tempDir, 'content'))).toBe(true)
      expect(await fs.pathExists(path.join(tempDir, 'users'))).toBe(true)
    })
  })

  describe('document CRUD', () => {
    it('should save and retrieve a document', async () => {
      const saved = await adapter.saveDocument('article', 'doc-001', {
        title: 'Test Article',
        body: 'Content here',
      })

      expect(saved).toBeDefined()
      expect(saved.id).toBe('doc-001')

      const retrieved = await adapter.getDocument('article', 'doc-001')
      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe('doc-001')
      expect((retrieved as any).title).toBe('Test Article')
    })

    it('should return null for non-existent document', async () => {
      const result = await adapter.getDocument('article', 'nonexistent')
      expect(result).toBeNull()
    })

    it('should update an existing document', async () => {
      await adapter.saveDocument('article', 'doc-001', { title: 'Original' })
      const updated = await adapter.saveDocument('article', 'doc-001', { title: 'Updated' })
      expect((updated as any).title).toBe('Updated')

      const retrieved = await adapter.getDocument('article', 'doc-001')
      expect((retrieved as any).title).toBe('Updated')
    })

    it('should add timestamps to documents', async () => {
      const saved = await adapter.saveDocument('article', 'doc-001', { title: 'Test' })
      expect(saved._createdAt || saved.createdAt).toBeDefined()
      expect(saved._updatedAt || saved.updatedAt).toBeDefined()
    })

    it('should list documents in a collection', async () => {
      await adapter.saveDocument('article', 'doc-001', { title: 'First' })
      await adapter.saveDocument('article', 'doc-002', { title: 'Second' })
      await adapter.saveDocument('article', 'doc-003', { title: 'Third' })

      const docs = await adapter.listDocuments('article')
      expect(docs.length).toBe(3)
    })

    it('should support pagination with limit and offset', async () => {
      for (let i = 1; i <= 10; i++) {
        await adapter.saveDocument('article', `doc-${String(i).padStart(3, '0')}`, {
          title: `Article ${i}`,
        })
      }

      const page1 = await adapter.listDocuments('article', { limit: 3 })
      expect(page1.length).toBe(3)

      const page2 = await adapter.listDocuments('article', { limit: 3, offset: 3 })
      expect(page2.length).toBe(3)

      // No overlap between pages
      const ids1 = new Set(page1.map(d => d.id))
      const ids2 = new Set(page2.map(d => d.id))
      for (const id of ids2) {
        expect(ids1.has(id)).toBe(false)
      }
    })

    it('should return empty array for empty collection', async () => {
      const docs = await adapter.listDocuments('nonexistent')
      expect(docs).toEqual([])
    })

    it('should delete a document', async () => {
      await adapter.saveDocument('article', 'doc-001', { title: 'To Delete' })
      await adapter.deleteDocument('article', 'doc-001')

      const result = await adapter.getDocument('article', 'doc-001')
      expect(result).toBeNull()
    })

    it('should handle deleting non-existent document', async () => {
      // May throw or silently succeed — adapter-specific behavior
      try {
        await adapter.deleteDocument('article', 'nonexistent')
      } catch (error) {
        // Some adapters throw for non-existent deletes
        expect(error).toBeDefined()
      }
    })

    it('should isolate collections from each other', async () => {
      await adapter.saveDocument('article', 'doc-001', { title: 'Article' })
      await adapter.saveDocument('category', 'doc-001', { title: 'Category' })

      const articles = await adapter.listDocuments('article')
      const categories = await adapter.listDocuments('category')

      expect(articles.length).toBe(1)
      expect(categories.length).toBe(1)
      expect((articles[0] as any).title).toBe('Article')
      expect((categories[0] as any).title).toBe('Category')
    })
  })

  describe('document filtering', () => {
    beforeEach(async () => {
      await adapter.saveDocument('article', 'doc-001', {
        title: 'Published Article',
        status: 'published',
        category: 'news',
      })
      await adapter.saveDocument('article', 'doc-002', {
        title: 'Draft Article',
        status: 'draft',
        category: 'tech',
      })
      await adapter.saveDocument('article', 'doc-003', {
        title: 'Another Published',
        status: 'published',
        category: 'tech',
      })
    })

    it('should filter by field value', async () => {
      const published = await adapter.listDocuments('article', {
        filter: { status: 'published' },
      })
      expect(published.length).toBe(2)
      for (const doc of published) {
        expect((doc as any).status).toBe('published')
      }
    })

    it('should filter by multiple fields', async () => {
      const techPublished = await adapter.listDocuments('article', {
        filter: { status: 'published', category: 'tech' },
      })
      expect(techPublished.length).toBe(1)
      expect((techPublished[0] as any).title).toBe('Another Published')
    })
  })

  describe('user CRUD', () => {
    it('should save and retrieve a user', async () => {
      const saved = await adapter.saveUser('user-001', {
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashed-password',
        role: 'editor',
      })

      expect(saved).toBeDefined()
      expect(saved.username).toBe('testuser')

      const retrieved = await adapter.getUser('user-001')
      expect(retrieved).toBeDefined()
      expect(retrieved!.username).toBe('testuser')
    })

    it('should return null for non-existent user', async () => {
      const result = await adapter.getUser('nonexistent')
      expect(result).toBeNull()
    })

    it('should find user by username', async () => {
      await adapter.saveUser('user-001', {
        username: 'admin',
        email: 'admin@example.com',
        password: 'hashed',
        role: 'admin',
      })

      const user = await adapter.getUserByUsername('admin')
      expect(user).toBeDefined()
      expect(user!.username).toBe('admin')
    })

    it('should find user by email', async () => {
      await adapter.saveUser('user-001', {
        username: 'testuser',
        email: 'test@example.com',
        password: 'hashed',
        role: 'editor',
      })

      const user = await adapter.getUserByEmail('test@example.com')
      expect(user).toBeDefined()
      expect(user!.email).toBe('test@example.com')
    })

    it('should return null for non-existent username', async () => {
      const user = await adapter.getUserByUsername('nobody')
      expect(user).toBeNull()
    })

    it('should list users', async () => {
      await adapter.saveUser('user-001', {
        username: 'user1',
        email: 'u1@example.com',
        password: 'h1',
        role: 'editor',
      })
      await adapter.saveUser('user-002', {
        username: 'user2',
        email: 'u2@example.com',
        password: 'h2',
        role: 'viewer',
      })

      const users = await adapter.listUsers()
      expect(users.length).toBe(2)
    })

    it('should delete a user', async () => {
      await adapter.saveUser('user-001', {
        username: 'todelete',
        email: 'del@example.com',
        password: 'h',
        role: 'viewer',
      })

      await adapter.deleteUser('user-001')
      const result = await adapter.getUser('user-001')
      expect(result).toBeNull()
    })
  })

  describe('saveUserIf (conditional update)', () => {
    beforeEach(async () => {
      await adapter.saveUser('user-001', {
        username: 'admin',
        email: 'admin@example.com',
        password: 'ignored',
        passwordHash: 'hash-v1',
        role: 'admin',
      })
    })

    it('should apply the update when the stored password hash matches', async () => {
      const updated = await adapter.saveUserIf(
        'user-001',
        { passwordHash: 'hash-v2', lastLoginAt: '2026-09-07T10:00:00.000Z' },
        { passwordHash: 'hash-v1' }
      )

      expect(updated).not.toBeNull()
      expect(updated!.passwordHash).toBe('hash-v2')

      const stored = await adapter.getUser('user-001')
      expect(stored!.passwordHash).toBe('hash-v2')
      expect(stored!.lastLoginAt).toBe('2026-09-07T10:00:00.000Z')
    })

    it('should return null and write nothing when the stored password hash differs', async () => {
      const updated = await adapter.saveUserIf(
        'user-001',
        { passwordHash: 'hash-v2', lastLoginAt: '2026-09-07T10:00:00.000Z' },
        { passwordHash: 'stale-hash' }
      )

      expect(updated).toBeNull()

      const stored = await adapter.getUser('user-001')
      expect(stored!.passwordHash).toBe('hash-v1')
      expect(stored!.lastLoginAt).toBeUndefined()
    })

    it('should return null for a user that does not exist', async () => {
      const updated = await adapter.saveUserIf(
        'user-999',
        { passwordHash: 'hash-v2' },
        { passwordHash: 'hash-v1' }
      )

      expect(updated).toBeNull()
    })
  })

  describe('security - path traversal prevention', () => {
    it('should reject collection names with path traversal', async () => {
      await expect(
        adapter.getDocument('../../../etc', 'passwd')
      ).rejects.toThrow()
    })

    it('should reject document IDs with path traversal', async () => {
      await expect(
        adapter.getDocument('article', '../../etc/passwd')
      ).rejects.toThrow()
    })

    it('should reject collection names with null bytes', async () => {
      await expect(
        adapter.getDocument('article\0evil', 'doc-001')
      ).rejects.toThrow()
    })
  })

  describe('app tokens', () => {
    it('should save and retrieve an app token', async () => {
      const saved = await adapter.saveAppToken('token-001', {
        name: 'CI Token',
        token: 'tky_abc123',
        tokenHash: 'hash123',
        permissions: ['content:read'],
        createdBy: 'user-001',
      } as any)

      expect(saved).toBeDefined()

      const retrieved = await adapter.getAppToken('token-001')
      expect(retrieved).toBeDefined()
      expect(retrieved!.name).toBe('CI Token')
    })

    it('should list app tokens', async () => {
      await adapter.saveAppToken('token-001', {
        name: 'Token 1',
        token: 'tky_1',
        tokenHash: 'h1',
        permissions: ['content:read'],
        createdBy: 'user-001',
      } as any)
      await adapter.saveAppToken('token-002', {
        name: 'Token 2',
        token: 'tky_2',
        tokenHash: 'h2',
        permissions: ['content:read'],
        createdBy: 'user-001',
      } as any)

      const tokens = await adapter.listAppTokens()
      expect(tokens.length).toBe(2)
    })

    it('should delete an app token', async () => {
      await adapter.saveAppToken('token-001', {
        name: 'To Delete',
        token: 'tky_del',
        tokenHash: 'hdel',
        permissions: [],
        createdBy: 'user-001',
      } as any)

      await adapter.deleteAppToken('token-001')
      const result = await adapter.getAppToken('token-001')
      expect(result).toBeNull()
    })
  })

  describe('mfa and passkeys round-trip', () => {
    it('reads back the MFA enrolment and passkeys that saveUser persisted', async () => {
      const created = await adapter.saveUser('user-mfa', {
        username: 'mfauser',
        email: 'mfa@example.com',
        passwordHash: 'hash',
        role: 'admin',
        permissions: [],
        isActive: true
      } as any)
      expect(created.id).toBe('user-mfa')

      const mfa = { enabled: false, methods: [{ type: 'totp', enabled: false, verified: false, secret: 'SECRET' }] }
      const passkeys = [{ id: 'cred-1', publicKey: 'pk', counter: 0 }]
      await adapter.saveUser('user-mfa', { mfa, passkeys } as any)

      // Previously the write persisted these but the read mapping dropped them,
      // so TOTP enrolment always failed with "No pending TOTP setup found".
      const read = await adapter.getUser('user-mfa')
      expect((read as any).mfa).toEqual(mfa)
      expect((read as any).passkeys).toEqual(passkeys)
    })
  })
})
