/**
 * Authentication, user and document integration tests for TrokkyCore.
 *
 * These exercise the public TrokkyCore facade end to end against the
 * in-memory adapters, so they stay valid across internal service refactors.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { TrokkyCore } from '../../core/core/engine.js'
import type { User } from '../../core/types/index.js'
import {
  createTestCore,
  createTestUser,
  MemoryDataAdapter,
  MemoryMediaAdapter
} from '../helpers/test-helpers.js'

interface TestContext {
  core: TrokkyCore
  dataAdapter: MemoryDataAdapter
  mediaAdapter: MemoryMediaAdapter
}

async function setupCore(): Promise<TestContext> {
  const context = createTestCore()
  await context.core.init()
  return context
}

describe('TrokkyCore authentication integration', () => {
  let core: TrokkyCore
  let dataAdapter: MemoryDataAdapter
  let mediaAdapter: MemoryMediaAdapter

  beforeEach(async () => {
    ;({ core, dataAdapter, mediaAdapter } = await setupCore())
  })

  afterEach(() => {
    dataAdapter.clear()
    mediaAdapter.clear()
    core.cleanup()
  })

  describe('password hashing', () => {
    it('should hash a password into something other than the plain text', async () => {
      const password = 'MySecurePassword123!'
      const hash = await core.hashPassword(password)

      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash.length).toBeGreaterThan(20)
    })

    it('should produce different hashes for the same password', async () => {
      const password = 'MySecurePassword123!'
      const hash1 = await core.hashPassword(password)
      const hash2 = await core.hashPassword(password)

      expect(hash1).not.toBe(hash2)
    })

    it('should verify a correct password', async () => {
      const password = 'MySecurePassword123!'
      const hash = await core.hashPassword(password)

      await expect(core.verifyPassword(password, hash)).resolves.toBe(true)
    })

    it('should reject an incorrect password', async () => {
      const hash = await core.hashPassword('MySecurePassword123!')

      await expect(core.verifyPassword('WrongPassword', hash)).resolves.toBe(false)
    })

    it('should reject an empty password against a real hash', async () => {
      const hash = await core.hashPassword('ValidPassword123!')

      await expect(core.verifyPassword('', hash)).resolves.toBe(false)
    })
  })

  describe('authenticateUser', () => {
    it('should authenticate a user with valid credentials', async () => {
      const password = 'TestPassword123!'
      const user = await createTestUser(core, {
        username: 'authuser',
        email: 'auth@example.com',
        password
      })

      const result = await core.authenticateUser('authuser', password)

      expect(result).not.toBeNull()
      expect(result?.type).toBe('success')
      if (result?.type === 'success') {
        expect(result.user.id).toBe(user.id)
        expect(result.user.username).toBe('authuser')
        expect(result.token.split('.')).toHaveLength(3)
        expect(result.refreshToken).toBeTruthy()
      }
    })

    it('should not authenticate with an email address (username only)', async () => {
      const password = 'TestPassword123!'
      await createTestUser(core, {
        username: 'emailuser',
        email: 'emailtest@example.com',
        password
      })

      await expect(core.authenticateUser('emailtest@example.com', password)).resolves.toBeNull()
    })

    it('should reject authentication with a wrong password', async () => {
      await createTestUser(core, {
        username: 'wrongpwuser',
        email: 'wrongpw@example.com',
        password: 'CorrectPassword123!'
      })

      await expect(core.authenticateUser('wrongpwuser', 'WrongPassword!')).resolves.toBeNull()
    })

    it('should reject authentication for a non-existent user', async () => {
      await expect(core.authenticateUser('nonexistent', 'SomePassword123!')).resolves.toBeNull()
    })

    it('should reject authentication with empty credentials', async () => {
      await expect(core.authenticateUser('', '')).resolves.toBeNull()
    })
  })

  describe('JWT generation and verification', () => {
    it('should generate a token in JWT format', async () => {
      const user = await createTestUser(core)
      const token = await core.generateAuthToken(user)

      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('should verify a valid auth token and expose the session', async () => {
      const user = await createTestUser(core)
      const token = await core.generateAuthToken(user)

      const session = await core.verifyAuthToken(token)

      expect(session).not.toBeNull()
      expect(session?.userId).toBe(user.id)
      expect(session?.username).toBe(user.username)
    })

    it('should reject a structurally invalid token', async () => {
      await expect(core.verifyAuthToken('invalid.token.here')).resolves.toBeNull()
    })

    it('should reject a tampered token', async () => {
      const user = await createTestUser(core)
      const token = await core.generateAuthToken(user)

      const parts = token.split('.')
      parts[1] = `${parts[1]}tampered`

      await expect(core.verifyAuthToken(parts.join('.'))).resolves.toBeNull()
    })

    it('should generate a verifiable token with a custom expiry', async () => {
      const user = await createTestUser(core)
      const token = await core.generateAuthToken(user, '1h')

      await expect(core.verifyAuthToken(token)).resolves.not.toBeNull()
    })

    it('should generate a verifiable remember-me token', async () => {
      const user = await createTestUser(core)
      const token = await core.generateAuthToken(user, '24h', true)

      await expect(core.verifyAuthToken(token)).resolves.not.toBeNull()
    })
  })

  describe('refreshAuthToken', () => {
    it('should issue a new token pair for a valid refresh token', async () => {
      const password = 'TestPassword123!'
      await createTestUser(core, { username: 'refreshuser', password })

      const authResult = await core.authenticateUser('refreshuser', password)
      expect(authResult?.type).toBe('success')
      if (authResult?.type !== 'success') return

      const refreshResult = await core.refreshAuthToken(authResult.refreshToken)

      expect(refreshResult).not.toBeNull()
      expect(refreshResult?.token.split('.')).toHaveLength(3)
      expect(refreshResult?.refreshToken).toBeTruthy()
      expect(refreshResult?.user.username).toBe('refreshuser')
    })

    it('should reject an invalid refresh token', async () => {
      await expect(core.refreshAuthToken('invalid-refresh-token')).resolves.toBeNull()
    })
  })

  describe('full authentication flow', () => {
    it('should complete a login, verify, refresh and verify cycle', async () => {
      const password = 'FlowTestPassword123!'
      const user = await createTestUser(core, {
        username: 'flowuser',
        email: 'flow@example.com',
        password
      })

      const loginResult = await core.authenticateUser('flowuser', password)
      expect(loginResult?.type).toBe('success')
      if (loginResult?.type !== 'success') {
        throw new Error('Login should succeed')
      }

      const session1 = await core.verifyAuthToken(loginResult.token)
      expect(session1?.userId).toBe(user.id)

      const refreshResult = await core.refreshAuthToken(loginResult.refreshToken)
      expect(refreshResult).not.toBeNull()

      const session2 = await core.verifyAuthToken(refreshResult!.token)
      expect(session2?.userId).toBe(user.id)
    })
  })

  describe('verifyAnyToken', () => {
    it('should verify a user auth token', async () => {
      const user = await createTestUser(core)
      const token = await core.generateAuthToken(user)

      const session = await core.verifyAnyToken(token)

      expect(session?.userId).toBe(user.id)
    })

    it('should return null for an invalid token', async () => {
      await expect(core.verifyAnyToken('totally-invalid-token')).resolves.toBeNull()
    })
  })
})

describe('TrokkyCore user management integration', () => {
  let core: TrokkyCore
  let dataAdapter: MemoryDataAdapter
  let mediaAdapter: MemoryMediaAdapter

  beforeEach(async () => {
    ;({ core, dataAdapter, mediaAdapter } = await setupCore())
  })

  afterEach(() => {
    dataAdapter.clear()
    mediaAdapter.clear()
    core.cleanup()
  })

  describe('user CRUD', () => {
    it('should create a user without echoing the plain password', async () => {
      const user = await core.createUser({
        username: 'newuser',
        email: 'new@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
        role: 'editor'
      })

      expect(user.id).toBeDefined()
      expect(user.username).toBe('newuser')
      expect(user.email).toBe('new@example.com')
      expect(user.role).toBe('editor')
      expect((user as User & { password?: string }).password).toBeUndefined()
    })

    it('should get a user by id', async () => {
      const created = await createTestUser(core, { username: 'getbyid' })

      const user = await core.getUser(created.id)

      expect(user?.id).toBe(created.id)
      expect(user?.username).toBe('getbyid')
    })

    it('should get a user by username', async () => {
      await createTestUser(core, { username: 'getbyname' })

      const user = await core.getUserByUsername('getbyname')

      expect(user?.username).toBe('getbyname')
    })

    it('should get a user by email', async () => {
      await createTestUser(core, { email: 'getbyemail@test.com' })

      const user = await core.getUserByEmail('getbyemail@test.com')

      expect(user?.email).toBe('getbyemail@test.com')
    })

    it('should update a user and leave untouched fields alone', async () => {
      const created = await createTestUser(core, { username: 'updateme' })

      const updated = await core.updateUser(created.id, { email: 'updated@example.com' })

      expect(updated.email).toBe('updated@example.com')
      expect(updated.username).toBe('updateme')
    })

    it('should list users', async () => {
      await createTestUser(core, { username: 'list1', email: 'list1@example.com' })
      await createTestUser(core, { username: 'list2', email: 'list2@example.com' })
      await createTestUser(core, { username: 'list3', email: 'list3@example.com' })

      const users = await core.listUsers()

      expect(users.length).toBeGreaterThanOrEqual(3)
    })

    it('should delete a user', async () => {
      const user = await createTestUser(core, { username: 'deleteme' })

      await core.deleteUser(user.id)

      await expect(core.getUser(user.id)).resolves.toBeNull()
    })
  })

  describe('user validation', () => {
    it('should reject a duplicate username', async () => {
      await createTestUser(core, { username: 'duplicate' })

      await expect(
        core.createUser({
          username: 'duplicate',
          email: 'different@example.com',
          password: 'Password123!',
          firstName: 'Dup',
          lastName: 'User',
          role: 'editor'
        })
      ).rejects.toThrow()
    })

    it('should reject a duplicate email', async () => {
      await createTestUser(core, { email: 'duplicate@example.com' })

      await expect(
        core.createUser({
          username: 'differentuser',
          email: 'duplicate@example.com',
          password: 'Password123!',
          firstName: 'Dup',
          lastName: 'Email',
          role: 'editor'
        })
      ).rejects.toThrow()
    })
  })
})

describe('TrokkyCore document operations integration', () => {
  let core: TrokkyCore
  let dataAdapter: MemoryDataAdapter
  let mediaAdapter: MemoryMediaAdapter

  beforeEach(async () => {
    ;({ core, dataAdapter, mediaAdapter } = await setupCore())
  })

  afterEach(() => {
    dataAdapter.clear()
    mediaAdapter.clear()
    core.cleanup()
  })

  describe('document CRUD', () => {
    it('should save a document with generated metadata', async () => {
      const doc = await core.saveDocument('posts', {
        title: 'Test Post',
        content: 'Test content'
      })

      expect(doc.id).toBeDefined()
      expect(doc.title).toBe('Test Post')
      expect(doc._collection).toBe('posts')
      expect(doc._createdAt).toBeDefined()
      expect(doc._updatedAt).toBeDefined()
    })

    it('should get a document by id', async () => {
      const saved = await core.saveDocument('posts', { title: 'Get Test' })

      const doc = await core.getDocument('posts', saved.id)

      expect(doc?.title).toBe('Get Test')
    })

    it('should update a document and bump its revision', async () => {
      const saved = await core.saveDocument('posts', {
        title: 'Original',
        content: 'Original content'
      })

      const updated = await core.saveDocument('posts', {
        id: saved.id,
        title: 'Updated',
        content: 'Original content'
      })

      expect(updated.id).toBe(saved.id)
      expect(updated.title).toBe('Updated')
      expect(updated._revision ?? 0).toBeGreaterThan(saved._revision ?? 0)
    })

    it('should list documents in a collection', async () => {
      await core.saveDocument('posts', { title: 'Post 1' })
      await core.saveDocument('posts', { title: 'Post 2' })

      const docs = await core.listDocuments('posts')

      expect(docs.length).toBeGreaterThanOrEqual(2)
    })

    it('should count documents in a collection', async () => {
      await core.saveDocument('posts', { title: 'Counted 1' })
      await core.saveDocument('posts', { title: 'Counted 2' })

      await expect(core.countDocuments('posts')).resolves.toBe(2)
    })

    it('should delete a document', async () => {
      const saved = await core.saveDocument('posts', { title: 'Delete Me' })

      await core.deleteDocument('posts', saved.id)

      await expect(core.getDocument('posts', saved.id)).resolves.toBeNull()
    })
  })

  describe('document validation', () => {
    it('should reject a document missing a required field', async () => {
      await expect(core.saveDocument('posts', { content: 'No title' })).rejects.toThrow()
    })

    it('should reject an unknown collection', async () => {
      await expect(core.saveDocument('nonexistent', { title: 'Test' })).rejects.toThrow()
    })
  })
})
