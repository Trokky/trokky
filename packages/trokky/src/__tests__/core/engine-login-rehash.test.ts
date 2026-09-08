import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TrokkyCore } from '../../core/core/engine.js'
import type { AuditEvent } from '../../core/core/engine.js'
import type { TrokkyConfig } from '../../core/types/index.js'
import type { User } from '../../types/auth.js'
import { WebCryptoAdapter } from '../../core/crypto/webcrypto-adapter.js'
import { verifyPasswordHash } from '../../core/crypto/password-hash.js'

const PASSWORD = 'correct-horse-battery-staple'
const WRONG_PASSWORD = 'incorrect-horse-battery-staple'

// password: correct-horse-battery-staple, PBKDF2-SHA256, 4096 iterations, main's untagged format
const LEGACY_FIXTURE = 'jRy44Ly63u9bDpwpioe61qbX9oeBIi6frnMSflFdTy7mq2ziDAQSi4zNq0cRuauJ'

// password: correct-horse-battery-staple, bcrypt cost 10
const BCRYPT_FIXTURE = '$2b$10$DeH4vd1H41oVkDeJHS2SXOjPGzPxxuBMVbbxcfq2jkxpRND4S20h6'

const TAGGED_PREFIX = '$pbkdf2-sha256$100000$'

const config: TrokkyConfig = {
  storage: { adapter: 'mock', options: {} },
  schemas: [],
}

function createTestUser(passwordHash: string): User {
  return {
    id: 'user-001',
    username: 'admin',
    email: 'admin@example.com',
    passwordHash,
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'admin',
    permissions: ['content:read', 'content:write'],
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }
}

function createMockMediaAdapter() {
  return {
    uploadFile: vi.fn(),
    getFile: vi.fn(),
    getFileContent: vi.fn(),
    deleteFile: vi.fn(),
    healthCheck: vi.fn(async () => true),
  }
}

/**
 * Minimal DataStorageAdapter that keeps one user in memory and merges the
 * partials passed to saveUser, so a second login sees the upgraded hash.
 */
function createMockDataAdapter(user: User) {
  let stored: User = { ...user }

  const saveUser = vi.fn(async (_id: string, data: Partial<User>): Promise<User> => {
    stored = { ...stored, ...data }
    return { ...stored }
  })

  return {
    stored: () => stored,
    setStored: (patch: Partial<User>): void => {
      stored = { ...stored, ...patch }
    },
    saveUser,
    getUser: vi.fn(async () => ({ ...stored })),
    getUserByUsername: vi.fn(async () => ({ ...stored })),
    getUserByEmail: vi.fn(async () => ({ ...stored })),
    listUsers: vi.fn(async () => [{ ...stored }]),
    deleteUser: vi.fn(async () => undefined),
    getDocument: vi.fn(async () => null),
    saveDocument: vi.fn(async () => ({})),
    listDocuments: vi.fn(async () => []),
    deleteDocument: vi.fn(async () => undefined),
    getAppToken: vi.fn(async () => null),
    saveAppToken: vi.fn(async () => ({})),
    listAppTokens: vi.fn(async () => []),
    deleteAppToken: vi.fn(async () => undefined),
    getAppTokenByHash: vi.fn(async () => null),
    getSettings: vi.fn(async () => null),
    healthCheck: vi.fn(async () => true),
  }
}

type MockDataAdapter = ReturnType<typeof createMockDataAdapter>

/**
 * Wrap the mock adapter with a conditional write that compares the stored hash
 * at write time. onBeforeCompare simulates a concurrent password change landing
 * between the login's verify and this write.
 */
function withSaveUserIf(
  dataAdapter: MockDataAdapter,
  onBeforeCompare?: () => void
): MockDataAdapter & { saveUserIf: ReturnType<typeof vi.fn> } {
  const saveUserIf = vi.fn(
    async (
      _id: string,
      data: Partial<User>,
      condition: { passwordHash: string }
    ): Promise<User | null> => {
      onBeforeCompare?.()
      if (dataAdapter.stored().passwordHash !== condition.passwordHash) {
        return null
      }
      dataAdapter.setStored(data)
      return { ...dataAdapter.stored() }
    }
  )

  return { ...dataAdapter, saveUserIf }
}

function createCore(dataAdapter: MockDataAdapter, auditLogger?: (event: AuditEvent) => void): TrokkyCore {
  return new TrokkyCore(
    config,
    {
      data: dataAdapter as never,
      media: createMockMediaAdapter() as never,
    },
    {
      enableSecurity: false,
      jwtSecret: 'test-secret',
      enableEvents: false,
      // Injected explicitly so the test does not depend on runtime adapter detection
      cryptoAdapter: new WebCryptoAdapter(),
      auditLogger,
    }
  )
}

function saveUserPayload(dataAdapter: MockDataAdapter, callIndex: number): Partial<User> {
  return dataAdapter.saveUser.mock.calls[callIndex][1] as Partial<User>
}

describe('TrokkyCore.authenticateUser password hash upgrade', () => {
  let dataAdapter: MockDataAdapter
  let core: TrokkyCore

  const setup = (passwordHash: string): void => {
    dataAdapter = createMockDataAdapter(createTestUser(passwordHash))
    core = createCore(dataAdapter)
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should upgrade a legacy untagged hash to the tagged format on successful login', async () => {
    setup(LEGACY_FIXTURE)

    const result = await core.authenticateUser('admin', PASSWORD)

    expect(result).not.toBeNull()
    expect(result?.type).toBe('success')
    expect(dataAdapter.saveUser).toHaveBeenCalledTimes(1)

    const payload = saveUserPayload(dataAdapter, 0)
    expect(payload.lastLoginAt).toEqual(expect.any(String))
    expect(payload.passwordHash?.startsWith(TAGGED_PREFIX)).toBe(true)
    await expect(verifyPasswordHash(PASSWORD, payload.passwordHash as string)).resolves.toBe(true)
    await expect(verifyPasswordHash(WRONG_PASSWORD, payload.passwordHash as string)).resolves.toBe(
      false
    )
  })

  it('should not rewrite the password hash on a second login after the upgrade', async () => {
    setup(LEGACY_FIXTURE)

    await core.authenticateUser('admin', PASSWORD)
    const secondResult = await core.authenticateUser('admin', PASSWORD)

    expect(secondResult?.type).toBe('success')
    expect(dataAdapter.saveUser).toHaveBeenCalledTimes(2)

    const payload = saveUserPayload(dataAdapter, 1)
    expect(payload.lastLoginAt).toEqual(expect.any(String))
    expect(payload).not.toHaveProperty('passwordHash')
  })

  it('should return null and persist nothing when the password is wrong', async () => {
    setup(LEGACY_FIXTURE)

    const result = await core.authenticateUser('admin', WRONG_PASSWORD)

    expect(result).toBeNull()
    expect(dataAdapter.saveUser).not.toHaveBeenCalled()
    expect(dataAdapter.stored().passwordHash).toBe(LEGACY_FIXTURE)
  })

  it('should upgrade a bcrypt hash to the tagged format on successful login', async () => {
    setup(BCRYPT_FIXTURE)

    const result = await core.authenticateUser('admin', PASSWORD)

    expect(result?.type).toBe('success')
    expect(dataAdapter.saveUser).toHaveBeenCalledTimes(1)

    const payload = saveUserPayload(dataAdapter, 0)
    expect(payload.passwordHash?.startsWith(TAGGED_PREFIX)).toBe(true)
    await expect(verifyPasswordHash(PASSWORD, payload.passwordHash as string)).resolves.toBe(true)
  })

  it('should leave an up-to-date tagged hash untouched on successful login', async () => {
    const fresh = await new WebCryptoAdapter().hashPassword(PASSWORD)
    setup(fresh)

    const result = await core.authenticateUser('admin', PASSWORD)

    expect(result?.type).toBe('success')
    expect(dataAdapter.saveUser).toHaveBeenCalledTimes(1)

    const payload = saveUserPayload(dataAdapter, 0)
    expect(payload.lastLoginAt).toEqual(expect.any(String))
    expect(payload).not.toHaveProperty('passwordHash')
    expect(dataAdapter.stored().passwordHash).toBe(fresh)
  })

  it('should still authenticate when persisting the login update fails', async () => {
    setup(LEGACY_FIXTURE)
    dataAdapter.saveUser.mockRejectedValueOnce(new Error('disk full'))

    const result = await core.authenticateUser('admin', PASSWORD)

    expect(result).not.toBeNull()
    expect(dataAdapter.saveUser).toHaveBeenCalledTimes(1)
    // Nothing persisted, so the next login upgrades again.
    expect(dataAdapter.stored().passwordHash).toBe(LEGACY_FIXTURE)
  })

  it('should not overwrite a hash that changed concurrently when the adapter supports saveUserIf', async () => {
    const changedElsewhere =
      '$pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
    dataAdapter = createMockDataAdapter(createTestUser(LEGACY_FIXTURE))
    const conditionalAdapter = withSaveUserIf(dataAdapter, () => {
      // A password reset commits between our verify and the conditional write.
      dataAdapter.setStored({ passwordHash: changedElsewhere })
    })
    core = createCore(conditionalAdapter)

    const result = await core.authenticateUser('admin', PASSWORD)

    expect(result?.type).toBe('success')
    expect(conditionalAdapter.saveUserIf).toHaveBeenCalledTimes(1)
    // The upgraded hash was rejected, so the concurrent one survives
    expect(dataAdapter.stored().passwordHash).toBe(changedElsewhere)
    // lastLoginAt is still recorded through the plain fallback write
    expect(dataAdapter.saveUser).toHaveBeenCalledTimes(1)
    const payload = saveUserPayload(dataAdapter, 0)
    expect(payload.lastLoginAt).toEqual(expect.any(String))
    expect(payload).not.toHaveProperty('passwordHash')
    expect(dataAdapter.stored().lastLoginAt).toEqual(expect.any(String))
  })

  it('should upgrade the hash through saveUserIf when nothing changed concurrently', async () => {
    dataAdapter = createMockDataAdapter(createTestUser(LEGACY_FIXTURE))
    const conditionalAdapter = withSaveUserIf(dataAdapter)
    const auditLogger = vi.fn()
    core = createCore(conditionalAdapter, auditLogger)

    const result = await core.authenticateUser('admin', PASSWORD)

    expect(result?.type).toBe('success')
    expect(conditionalAdapter.saveUserIf).toHaveBeenCalledTimes(1)
    // The conditional write still emits the user_updated audit event updateUser would have
    const userUpdated = auditLogger.mock.calls
      .map(call => call[0] as AuditEvent)
      .filter(event => event.type === 'user_updated')
    expect(userUpdated).toHaveLength(1)
    expect(userUpdated[0]).toMatchObject({
      targetUserId: 'user-001',
      username: 'admin',
      action: 'User updated',
      success: true,
      details: {
        updatedFields: ['lastLoginAt', 'passwordHash'],
        previousRole: 'admin',
        newRole: 'admin'
      }
    })
    // No fallback write was needed: the conditional write carried lastLoginAt
    expect(dataAdapter.saveUser).not.toHaveBeenCalled()
    expect(dataAdapter.stored().passwordHash.startsWith(TAGGED_PREFIX)).toBe(true)
    expect(dataAdapter.stored().lastLoginAt).toEqual(expect.any(String))
    await expect(verifyPasswordHash(PASSWORD, dataAdapter.stored().passwordHash)).resolves.toBe(true)
  })

  it('should still upgrade through the fallback path when the adapter has no saveUserIf', async () => {
    setup(LEGACY_FIXTURE)

    const result = await core.authenticateUser('admin', PASSWORD)

    expect(result?.type).toBe('success')
    expect(dataAdapter).not.toHaveProperty('saveUserIf')
    expect(dataAdapter.saveUser).toHaveBeenCalledTimes(1)
    expect(dataAdapter.stored().passwordHash.startsWith(TAGGED_PREFIX)).toBe(true)
  })

  it('should not overwrite a password that changed between verify and persist', async () => {
    setup(LEGACY_FIXTURE)
    const changedElsewhere = '$pbkdf2-sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
    // getUserByUsername still returns the old record (what login verified), but the
    // re-read before persisting sees a newer hash written by a concurrent reset.
    dataAdapter.getUser.mockResolvedValueOnce({ ...dataAdapter.stored(), passwordHash: changedElsewhere })

    const result = await core.authenticateUser('admin', PASSWORD)

    expect(result).not.toBeNull()
    expect(dataAdapter.saveUser).toHaveBeenCalledTimes(1)
    const payload = saveUserPayload(dataAdapter, 0)
    expect(payload.lastLoginAt).toEqual(expect.any(String))
    expect(payload).not.toHaveProperty('passwordHash')
  })
})
