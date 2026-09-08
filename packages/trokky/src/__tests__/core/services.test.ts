/**
 * Unit tests for the domain services extracted from TrokkyCore.
 *
 * Each service is constructed directly with its dependency object (the same
 * wiring engine.ts performs) so the service can be exercised in isolation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AuthService } from '../../core/services/auth-service.js'
import { DocumentService } from '../../core/services/document-service.js'
import { TokenService } from '../../core/services/token-service.js'
import { UserService } from '../../core/services/user-service.js'
import type { MFARequirement } from '../../core/services/mfa-service.js'
import type { TOTPService } from '../../core/security/mfa/index.js'
import { WebCryptoAdapter } from '../../core/crypto/webcrypto-adapter.js'
import { SchemaRegistry } from '../../core/schema/registry.js'
import { DocumentValidator } from '../../core/validation/validator.js'
import { IdGenerator } from '../../core/utils/id-generator.js'
import { createLogger } from '../../core/utils/logger.js'
import { TrokkyEventBus } from '../../core/events/index.js'
import type {
  TrokkyConfig,
  UpdateUserData,
  User,
  UserSession
} from '../../core/types/index.js'
import {
  MemoryDataAdapter,
  TEST_JWT_SECRET,
  TEST_PBKDF2_ITERATIONS,
  testSchemas
} from '../helpers/test-helpers.js'

const logger = createLogger('trokky-test', 'services')

const config: TrokkyConfig = {
  storage: { adapter: 'memory', options: {} },
  schemas: testSchemas
}

const NO_MFA: MFARequirement = {
  required: false,
  methods: [],
  reason: 'not_required',
  userHasMFA: false
}

interface ServiceHarness {
  dataAdapter: MemoryDataAdapter
  authService: AuthService
  documentService: DocumentService
  tokenService: TokenService
  userService: UserService
  logAuditEvent: ReturnType<typeof vi.fn>
}

function createHarness(): ServiceHarness {
  const dataAdapter = new MemoryDataAdapter()
  const cryptoAdapter = new WebCryptoAdapter({ pbkdf2Iterations: TEST_PBKDF2_ITERATIONS })
  const schemas = new SchemaRegistry(testSchemas)
  const validator = new DocumentValidator(schemas)
  const idGenerator = new IdGenerator()
  const eventBus = new TrokkyEventBus()
  const logAuditEvent = vi.fn()

  const harness: Partial<ServiceHarness> = { dataAdapter, logAuditEvent }

  const authService: AuthService = new AuthService({
    cryptoAdapter,
    jwtSecret: TEST_JWT_SECRET,
    config,
    logger,
    getUser: id => dataAdapter.getUser(id),
    getUserByUsername: username => dataAdapter.getUserByUsername(username),
    updateUser: (id, userData) => userService.updateUser(id, userData),
    validateAppToken: token => tokenService.validateAppToken(token),
    logAuditEvent,
    checkMFARequired: async () => NO_MFA,
    isDeviceTrusted: async () => false,
    trustDevice: () => {
      throw new Error('trustDevice is not exercised by these tests')
    },
    getTOTPService: (): TOTPService => {
      throw new Error('getTOTPService is not exercised by these tests')
    }
  })

  const userService: UserService = new UserService({
    logger,
    dataStorage: dataAdapter,
    idGenerator,
    securityEnabled: true,
    eventBus,
    hashPassword: password => authService.hashPassword(password),
    checkWeakPassword: password => authService.checkWeakPassword(password),
    logAuditEvent,
    getUserCreatedWithPasswordCallback: () => undefined
  })

  const tokenService: TokenService = new TokenService({
    dataStorage: dataAdapter,
    idGenerator,
    cryptoAdapter,
    securityEnabled: true,
    logAuditEvent
  })

  const documentService = new DocumentService({
    logger,
    auditLog: logger,
    dataStorage: dataAdapter,
    schemas,
    idGenerator,
    securityEnabled: true,
    eventBus,
    eventsEnabled: false,
    validateDocument: (collection, data) => validator.validateDocument(collection, data)
  })

  return {
    ...(harness as ServiceHarness),
    authService,
    documentService,
    tokenService,
    userService
  }
}

async function seedUser(
  harness: ServiceHarness,
  overrides?: Partial<{ username: string; email: string; password: string; role: User['role'] }>
): Promise<User> {
  return harness.userService.createUser({
    username: overrides?.username ?? 'alice',
    email: overrides?.email ?? 'alice@example.com',
    password: overrides?.password ?? 'CorrectHorseBattery1!',
    firstName: 'Alice',
    lastName: 'Anderson',
    role: overrides?.role ?? 'editor'
  })
}

describe('AuthService', () => {
  let harness: ServiceHarness

  beforeEach(() => {
    harness = createHarness()
  })

  describe('password operations', () => {
    it('should hash a password into the tagged pbkdf2 format', async () => {
      const hash = await harness.authService.hashPassword('CorrectHorseBattery1!')

      expect(hash).not.toBe('CorrectHorseBattery1!')
      expect(hash.startsWith('$pbkdf2-sha256$')).toBe(true)
    })

    it('should produce a different hash each time for the same password', async () => {
      const first = await harness.authService.hashPassword('CorrectHorseBattery1!')
      const second = await harness.authService.hashPassword('CorrectHorseBattery1!')

      expect(first).not.toBe(second)
    })

    it('should verify a correct password against its hash', async () => {
      const hash = await harness.authService.hashPassword('CorrectHorseBattery1!')

      await expect(harness.authService.verifyPassword('CorrectHorseBattery1!', hash)).resolves.toBe(true)
    })

    it('should reject an incorrect password', async () => {
      const hash = await harness.authService.hashPassword('CorrectHorseBattery1!')

      await expect(harness.authService.verifyPassword('WrongPassword1!', hash)).resolves.toBe(false)
    })
  })

  describe('checkWeakPassword', () => {
    it('should flag passwords shorter than eight characters', () => {
      const result = harness.authService.checkWeakPassword('short')

      expect(result.isWeak).toBe(true)
      expect(result.reason).toContain('too short')
    })

    it('should flag common weak passwords', () => {
      expect(harness.authService.checkWeakPassword('password123').isWeak).toBe(true)
      expect(harness.authService.checkWeakPassword('changeme123').isWeak).toBe(true)
    })

    it('should flag passwords made of a single repeated character', () => {
      const result = harness.authService.checkWeakPassword('aaaaaaaaaaaaaaaa')

      expect(result.isWeak).toBe(true)
      expect(result.reason).toContain('repeated characters')
    })

    it('should flag passwords starting with a sequential run', () => {
      const result = harness.authService.checkWeakPassword('123456789abcdefg')

      expect(result.isWeak).toBe(true)
      expect(result.reason).toContain('sequential characters')
    })

    it('should flag passwords shorter than the recommended twelve characters', () => {
      const result = harness.authService.checkWeakPassword('Trokky9$x')

      expect(result.isWeak).toBe(true)
      expect(result.reason).toContain('shorter than recommended')
    })

    it('should accept a long, complex password', () => {
      const result = harness.authService.checkWeakPassword('Xk9!vPqmRt2#Lw')

      expect(result.isWeak).toBe(false)
      expect(result.reason).toBeUndefined()
    })
  })

  describe('JWT token operations', () => {
    let user: User

    beforeEach(async () => {
      harness = createHarness()
      user = await seedUser(harness)
    })

    it('should generate a three-part JWT for a user', async () => {
      const token = await harness.authService.generateAuthToken(user)

      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('should verify a token it generated and return the session', async () => {
      const token = await harness.authService.generateAuthToken(user)
      const session = await harness.authService.verifyAuthToken(token)

      expect(session).not.toBeNull()
      expect(session?.userId).toBe(user.id)
      expect(session?.username).toBe(user.username)
      expect(session?.role).toBe(user.role)
    })

    it('should return null for a malformed token', async () => {
      await expect(harness.authService.verifyAuthToken('not-a-jwt')).resolves.toBeNull()
    })

    it('should return null for a token with a tampered payload', async () => {
      const token = await harness.authService.generateAuthToken(user)
      const [header, , signature] = token.split('.')
      const forgedPayload = Buffer.from(
        JSON.stringify({ userId: 'attacker', username: 'attacker', role: 'admin' })
      ).toString('base64url')

      await expect(
        harness.authService.verifyAuthToken(`${header}.${forgedPayload}.${signature}`)
      ).resolves.toBeNull()
    })

    it('should honour a custom expiry when generating a token', async () => {
      const token = await harness.authService.generateAuthToken(user, '1h')
      const session = await harness.authService.verifyAuthToken(token)

      expect(session?.expiresAt).toBeTruthy()
      const expiresIn = new Date(session!.expiresAt!).getTime() - Date.now()
      expect(expiresIn).toBeGreaterThan(0)
      expect(expiresIn).toBeLessThanOrEqual(60 * 60 * 1000 + 5000)
    })
  })

  describe('authenticateUser', () => {
    let user: User

    beforeEach(async () => {
      harness = createHarness()
      user = await seedUser(harness)
    })

    it('should authenticate a user with valid credentials', async () => {
      const result = await harness.authService.authenticateUser('alice', 'CorrectHorseBattery1!')

      expect(result).not.toBeNull()
      expect(result?.type).toBe('success')
      if (result?.type === 'success') {
        expect(result.user.id).toBe(user.id)
        expect(result.token.split('.')).toHaveLength(3)
        expect(result.refreshToken).toBeTruthy()
      }
    })

    it('should return null for an incorrect password', async () => {
      await expect(
        harness.authService.authenticateUser('alice', 'WrongPassword1!')
      ).resolves.toBeNull()
    })

    it('should return null for a user that does not exist', async () => {
      await expect(
        harness.authService.authenticateUser('nobody', 'CorrectHorseBattery1!')
      ).resolves.toBeNull()
    })

    it('should return null for a deactivated user', async () => {
      await harness.userService.updateUser(user.id, { isActive: false } as UpdateUserData)

      await expect(
        harness.authService.authenticateUser('alice', 'CorrectHorseBattery1!')
      ).resolves.toBeNull()
    })
  })

  describe('refreshAuthToken', () => {
    beforeEach(async () => {
      harness = createHarness()
      await seedUser(harness)
    })

    it('should issue a new token pair for a valid refresh token', async () => {
      const login = await harness.authService.authenticateUser('alice', 'CorrectHorseBattery1!')
      expect(login?.type).toBe('success')
      if (login?.type !== 'success') return

      const refreshed = await harness.authService.refreshAuthToken(login.refreshToken)

      expect(refreshed).not.toBeNull()
      expect(refreshed?.token.split('.')).toHaveLength(3)
      expect(refreshed?.user.username).toBe('alice')
    })

    it('should return null for an invalid refresh token', async () => {
      await expect(harness.authService.refreshAuthToken('invalid-refresh-token')).resolves.toBeNull()
    })
  })

  describe('verifyAnyToken', () => {
    it('should resolve a user session from a user auth token', async () => {
      const user = await seedUser(harness)
      const token = await harness.authService.generateAuthToken(user)

      const session: UserSession | null = await harness.authService.verifyAnyToken(token)

      expect(session?.userId).toBe(user.id)
    })

    it('should return null for a token that is neither a JWT nor an app token', async () => {
      await expect(harness.authService.verifyAnyToken('garbage-token')).resolves.toBeNull()
    })
  })
})

describe('DocumentService', () => {
  let harness: ServiceHarness

  beforeEach(() => {
    harness = createHarness()
  })

  describe('document CRUD', () => {
    it('should save a new document and assign metadata', async () => {
      const doc = await harness.documentService.saveDocument('posts', {
        title: 'Hello world',
        content: 'First post'
      })

      expect(doc.id).toBeTruthy()
      expect(doc._collection).toBe('posts')
      expect(doc._revision).toBe(1)
      expect(doc.title).toBe('Hello world')
    })

    it('should get a document by ID', async () => {
      const created = await harness.documentService.saveDocument('posts', { title: 'Readable' })

      const found = await harness.documentService.getDocument('posts', created.id)

      expect(found?.id).toBe(created.id)
      expect(found?.title).toBe('Readable')
    })

    it('should return null for a document that does not exist', async () => {
      await expect(harness.documentService.getDocument('posts', 'missing-id')).resolves.toBeNull()
    })

    it('should update an existing document and bump the revision', async () => {
      const created = await harness.documentService.saveDocument('posts', { title: 'Draft' })

      const updated = await harness.documentService.saveDocument('posts', {
        id: created.id,
        title: 'Published'
      })

      expect(updated.id).toBe(created.id)
      expect(updated.title).toBe('Published')
      expect(updated._revision).toBe(2)
    })

    it('should list documents in a collection', async () => {
      await harness.documentService.saveDocument('posts', { title: 'One' })
      await harness.documentService.saveDocument('posts', { title: 'Two' })

      const docs = await harness.documentService.listDocuments('posts')

      expect(docs).toHaveLength(2)
    })

    it('should count documents in a collection', async () => {
      await harness.documentService.saveDocument('posts', { title: 'One' })
      await harness.documentService.saveDocument('posts', { title: 'Two' })

      await expect(harness.documentService.countDocuments('posts')).resolves.toBe(2)
    })

    it('should delete a document', async () => {
      const created = await harness.documentService.saveDocument('posts', { title: 'Doomed' })

      await harness.documentService.deleteDocument('posts', created.id)

      await expect(harness.documentService.getDocument('posts', created.id)).resolves.toBeNull()
    })

    it('should throw when deleting a document that does not exist', async () => {
      await expect(harness.documentService.deleteDocument('posts', 'missing-id')).rejects.toThrow()
    })
  })

  describe('validation and unknown collections', () => {
    it('should reject a document missing a required field', async () => {
      await expect(harness.documentService.saveDocument('posts', { content: 'no title' })).rejects.toThrow(
        /validation failed/i
      )
    })

    it('should throw for an unknown collection on save', async () => {
      await expect(harness.documentService.saveDocument('unknown', { title: 'x' })).rejects.toThrow()
    })

    it('should throw for an unknown collection on list', async () => {
      await expect(harness.documentService.listDocuments('unknown')).rejects.toThrow()
    })
  })

  describe('list options', () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        await harness.documentService.saveDocument('posts', { title: `Post ${i}` })
      }
    })

    it('should respect the limit option', async () => {
      const docs = await harness.documentService.listDocuments('posts', { limit: 2 })

      expect(docs).toHaveLength(2)
    })

    it('should respect the offset option', async () => {
      const docs = await harness.documentService.listDocuments('posts', { offset: 3 })

      expect(docs).toHaveLength(2)
    })
  })

  describe('audit logging', () => {
    it('should record a CREATE audit log when an audit context is supplied', async () => {
      const doc = await harness.documentService.saveDocument(
        'posts',
        { title: 'Audited' },
        { userId: 'user-1', userType: 'user', username: 'alice' }
      )

      const logs = await harness.documentService.getDocumentAuditLogs(doc.id)

      expect(logs).toHaveLength(1)
      expect(logs[0].actorId).toBe('user-1')
    })

    it('should not record audit logs when no audit context is supplied', async () => {
      const doc = await harness.documentService.saveDocument('posts', { title: 'Unaudited' })

      await expect(harness.documentService.getDocumentAuditLogs(doc.id)).resolves.toHaveLength(0)
    })
  })
})

describe('UserService', () => {
  let harness: ServiceHarness

  beforeEach(() => {
    harness = createHarness()
  })

  describe('user CRUD', () => {
    it('should create a user with a hashed password and default permissions', async () => {
      const user = await seedUser(harness)

      expect(user.id).toBeTruthy()
      expect(user.username).toBe('alice')
      expect(user.passwordHash).not.toBe('CorrectHorseBattery1!')
      expect(user.permissions).toContain('content:read')
    })

    it('should get a user by ID', async () => {
      const created = await seedUser(harness)

      const found = await harness.userService.getUser(created.id)

      expect(found?.id).toBe(created.id)
    })

    it('should get a user by username', async () => {
      const created = await seedUser(harness)

      const found = await harness.userService.getUserByUsername('alice')

      expect(found?.id).toBe(created.id)
    })

    it('should get a user by email', async () => {
      const created = await seedUser(harness)

      const found = await harness.userService.getUserByEmail('alice@example.com')

      expect(found?.id).toBe(created.id)
    })

    it('should return null when a user does not exist', async () => {
      await expect(harness.userService.getUserByUsername('nobody')).resolves.toBeNull()
    })

    it('should update a user', async () => {
      const created = await seedUser(harness)

      const updated = await harness.userService.updateUser(created.id, { firstName: 'Alicia' })

      expect(updated.firstName).toBe('Alicia')
      expect(updated.username).toBe('alice')
    })

    it('should throw when updating a user that does not exist', async () => {
      await expect(harness.userService.updateUser('missing-user', { firstName: 'X' })).rejects.toThrow()
    })

    it('should list users', async () => {
      await seedUser(harness)
      await seedUser(harness, { username: 'bob', email: 'bob@example.com' })

      const users = await harness.userService.listUsers()

      expect(users).toHaveLength(2)
    })

    it('should filter listed users by role', async () => {
      await seedUser(harness)
      await seedUser(harness, { username: 'bob', email: 'bob@example.com', role: 'admin' })

      const admins = await harness.userService.listUsers({ role: 'admin' })

      expect(admins).toHaveLength(1)
      expect(admins[0].username).toBe('bob')
    })

    it('should delete a user', async () => {
      const created = await seedUser(harness)

      await harness.userService.deleteUser(created.id)

      await expect(harness.userService.getUser(created.id)).resolves.toBeNull()
    })

    it('should throw when deleting a user that does not exist', async () => {
      await expect(harness.userService.deleteUser('missing-user')).rejects.toThrow()
    })
  })

  describe('user uniqueness', () => {
    it('should reject a duplicate username with a non-enumerating error', async () => {
      await seedUser(harness)

      await expect(
        seedUser(harness, { username: 'alice', email: 'other@example.com' })
      ).rejects.toThrow('User registration failed. Please check your details.')
    })

    it('should reject a duplicate email with a non-enumerating error', async () => {
      await seedUser(harness)

      await expect(
        seedUser(harness, { username: 'other', email: 'alice@example.com' })
      ).rejects.toThrow('User registration failed. Please check your details.')
    })
  })

  describe('getDefaultPermissions', () => {
    it('should grant admins user and settings management permissions', () => {
      const permissions = harness.userService.getDefaultPermissions('admin')

      expect(permissions).toContain('content:write')
      expect(permissions).toContain('users:write')
      expect(permissions).toContain('settings:write')
    })

    it('should grant editors write access without user management', () => {
      const permissions = harness.userService.getDefaultPermissions('editor')

      expect(permissions).toContain('content:write')
      expect(permissions).not.toContain('users:write')
    })

    it('should grant viewers read-only access', () => {
      const permissions = harness.userService.getDefaultPermissions('viewer')

      expect(permissions).toEqual(['content:read', 'studio:access'])
    })

    it('should fall back to read-only access for an unknown role', () => {
      const permissions = harness.userService.getDefaultPermissions('robot')

      expect(permissions).toEqual(['content:read', 'studio:access'])
    })
  })
})

describe('TokenService', () => {
  let harness: ServiceHarness

  beforeEach(() => {
    harness = createHarness()
  })

  it('should create an app token and return the plaintext value once', async () => {
    const result = await harness.tokenService.createAppToken(
      { name: 'CI token', permissions: ['content:read'] },
      'user-1'
    )

    expect(result.success).toBe(true)
    expect(result.token).toBeTruthy()
    expect(result.appToken?.name).toBe('CI token')
    expect(result.appToken?.tokenHash).not.toBe(result.token)
  })

  it('should validate a freshly created app token', async () => {
    const created = await harness.tokenService.createAppToken(
      { name: 'CI token', permissions: ['content:read'] },
      'user-1'
    )

    const validation = await harness.tokenService.validateAppToken(created.token!)

    expect(validation.valid).toBe(true)
    expect(validation.appToken?.id).toBe(created.appToken?.id)
  })

  it('should reject an unknown app token', async () => {
    const validation = await harness.tokenService.validateAppToken('tky_not_a_real_token')

    expect(validation.valid).toBe(false)
    expect(validation.appToken).toBeUndefined()
  })

  it('should list created app tokens', async () => {
    await harness.tokenService.createAppToken({ name: 'One', permissions: [] }, 'user-1')
    await harness.tokenService.createAppToken({ name: 'Two', permissions: [] }, 'user-1')

    const tokens = await harness.tokenService.listAppTokens()

    expect(tokens).toHaveLength(2)
  })

  it('should delete an app token and stop validating it', async () => {
    const created = await harness.tokenService.createAppToken(
      { name: 'Temp', permissions: [] },
      'user-1'
    )

    await harness.tokenService.deleteAppToken(created.appToken!.id)

    await expect(harness.tokenService.getAppToken(created.appToken!.id)).resolves.toBeNull()
    await expect(harness.tokenService.validateAppToken(created.token!)).resolves.toMatchObject({
      valid: false
    })
  })

  it('should throw when deleting an app token that does not exist', async () => {
    await expect(harness.tokenService.deleteAppToken('missing-token')).rejects.toThrow()
  })
})
