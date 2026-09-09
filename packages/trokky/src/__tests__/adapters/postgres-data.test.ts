import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getAdapterRegistry } from '../../core/adapters/registry.js'
import type { PostgresDataAdapter as PostgresDataAdapterType } from '../../adapters/postgres-data/postgres-data-adapter.js'

interface QueryCall {
  text: string
  params: unknown[]
}

interface QueryResult {
  rows: Record<string, unknown>[]
  rowCount: number
}

const queryCalls: QueryCall[] = []
let nextResults: QueryResult[] = []

const poolQuery = vi.fn(async (text: string, params?: unknown[]): Promise<QueryResult> => {
  queryCalls.push({ text, params: params ?? [] })
  return nextResults.shift() ?? { rows: [], rowCount: 0 }
})

const poolEnd = vi.fn(async (): Promise<void> => undefined)

vi.mock('pg', () => {
  class MockPool {
    query = poolQuery
    end = poolEnd
    async connect(): Promise<unknown> {
      return { query: poolQuery, release: (): void => undefined }
    }
    on(): void {
      return undefined
    }
  }
  return { Pool: MockPool, default: { Pool: MockPool } }
})

function userRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'user-001',
    username: 'admin',
    email: 'admin@example.com',
    password_hash: 'hash-v2',
    first_name: 'Ada',
    last_name: 'Lovelace',
    role: 'admin',
    permissions: [],
    is_active: true,
    profile_image: null,
    preferences: {},
    oauth_providers: [],
    mfa: {},
    passkeys: [],
    last_login_at: '2026-09-07T10:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-09-07T10:00:00.000Z',
    ...overrides
  }
}

async function createAdapter(): Promise<PostgresDataAdapterType> {
  const { PostgresDataAdapter } = await import('../../adapters/postgres-data/postgres-data-adapter.js')
  const adapter = new PostgresDataAdapter({ autoMigrate: false })
  // Skip connection/migration bootstrap: the pool is mocked
  ;(adapter as unknown as { initialized: boolean }).initialized = true
  return adapter
}

describe('PostgresDataAdapter', () => {
  it('should be importable', async () => {
    const mod = await import('../../adapters/postgres-data/index.js')
    expect(mod.PostgresDataAdapter).toBeDefined()
  })

  it('should export adapter class with constructor', async () => {
    const { PostgresDataAdapter } = await import('../../adapters/postgres-data/index.js')
    expect(typeof PostgresDataAdapter).toBe('function')
  })

  it('should auto-register as postgres-data adapter', async () => {
    await import('../../adapters/postgres-data/index.js')
    const status = getAdapterRegistry().getStatus()
    expect(status.dataAdapters).toContain('postgres-data')
  })

  describe('saveUserIf (conditional update)', () => {
    beforeEach(() => {
      queryCalls.length = 0
      nextResults = []
      poolQuery.mockClear()
    })

    it('should update in one statement guarded by the expected password hash', async () => {
      const adapter = await createAdapter()
      nextResults = [{ rows: [userRow()], rowCount: 1 }]

      const updated = await adapter.saveUserIf(
        'user-001',
        { passwordHash: 'hash-v2', lastLoginAt: '2026-09-07T10:00:00.000Z' },
        { passwordHash: 'hash-v1' }
      )

      expect(updated).not.toBeNull()
      expect(updated!.passwordHash).toBe('hash-v2')

      // A single conditional UPDATE, no separate read.
      // The SET list is built from the keys present in the update, so the guard's placeholder
      // is whatever comes after them: passwordHash ($2), lastLoginAt ($3), updated_at ($4).
      expect(queryCalls).toHaveLength(1)
      expect(queryCalls[0].text).toContain('UPDATE')
      expect(queryCalls[0].text).toContain('WHERE id = $1 AND password_hash = $5')
      expect(queryCalls[0].text).toContain('RETURNING *')
      expect(queryCalls[0].params).toContain('hash-v1')
    })

    it('should return null when no row matched the expected password hash', async () => {
      const adapter = await createAdapter()
      nextResults = [{ rows: [], rowCount: 0 }]

      const updated = await adapter.saveUserIf(
        'user-001',
        { passwordHash: 'hash-v2' },
        { passwordHash: 'stale-hash' }
      )

      expect(updated).toBeNull()
      expect(queryCalls).toHaveLength(1)
    })

    it('should persist lastLoginAt on the conditional update', async () => {
      const adapter = await createAdapter()
      const loginAt = '2026-09-08T08:30:00.000Z'
      nextResults = [{ rows: [userRow({ last_login_at: loginAt })], rowCount: 1 }]

      const updated = await adapter.saveUserIf(
        'user-001',
        { passwordHash: 'hash-v2', lastLoginAt: loginAt },
        { passwordHash: 'hash-v1' }
      )

      expect(updated).not.toBeNull()
      expect(updated!.lastLoginAt).toBe(loginAt)
      expect(queryCalls[0].text).toContain('last_login_at = $3')
      expect(queryCalls[0].params[2]).toBe(loginAt)
    })
  })

  describe('saveUser (update branch)', () => {
    beforeEach(() => {
      queryCalls.length = 0
      nextResults = []
      poolQuery.mockClear()
    })

    it('should persist lastLoginAt when updating an existing user', async () => {
      const adapter = await createAdapter()
      const loginAt = '2026-09-08T09:15:00.000Z'
      // saveUser reads the existing row first, then issues the UPDATE
      nextResults = [
        { rows: [userRow()], rowCount: 1 },
        { rows: [userRow({ last_login_at: loginAt })], rowCount: 1 }
      ]

      const saved = await adapter.saveUser('user-001', { lastLoginAt: loginAt })

      expect(queryCalls).toHaveLength(2)
      expect(queryCalls[1].text).toContain('last_login_at = $2')
      expect(queryCalls[1].params[1]).toBe(loginAt)
      expect(saved.lastLoginAt).toBe(loginAt)
    })

    it('should leave last_login_at untouched when the update omits lastLoginAt', async () => {
      const adapter = await createAdapter()
      const storedLoginAt = '2026-09-07T10:00:00.000Z'
      nextResults = [
        { rows: [userRow()], rowCount: 1 },
        { rows: [userRow()], rowCount: 1 }
      ]

      const saved = await adapter.saveUser('user-001', { firstName: 'Grace' })

      expect(queryCalls).toHaveLength(2)
      // An omitted key is not in the SET list at all, so the column is never written
      expect(queryCalls[1].text).toContain('first_name = $2')
      expect(queryCalls[1].text).not.toContain('last_login_at')
      expect(queryCalls[1].params).not.toContain(storedLoginAt)
      // The stored value survives the update
      expect(saved.lastLoginAt).toBe(storedLoginAt)
    })

    it('should write NULL for a field the update clears explicitly', async () => {
      const adapter = await createAdapter()
      nextResults = [
        { rows: [userRow()], rowCount: 1 },
        { rows: [userRow({ profile_image: null })], rowCount: 1 }
      ]

      const saved = await adapter.saveUser('user-001', { profileImage: null } as never)

      expect(queryCalls[1].text).toContain('profile_image = $2')
      expect(queryCalls[1].params[1]).toBeNull()
      // A cleared field reads back as undefined, never null
      expect(saved.profileImage).toBeUndefined()
    })
  })

  describe('close', () => {
    beforeEach(() => {
      poolEnd.mockClear()
    })

    it('should end the connection pool', async () => {
      const adapter = await createAdapter()

      await adapter.close()

      expect(poolEnd).toHaveBeenCalledTimes(1)
    })

    it('should end the pool exactly once when closed twice', async () => {
      const adapter = await createAdapter()

      await adapter.close()
      await adapter.close()

      // pg throws on a second end(); shutdown paths do get entered twice
      expect(poolEnd).toHaveBeenCalledTimes(1)
    })

    it('should end the pool once for concurrent close calls', async () => {
      const adapter = await createAdapter()

      await Promise.all([adapter.close(), adapter.close()])

      expect(poolEnd).toHaveBeenCalledTimes(1)
    })

    it('should surface a pool that fails to close', async () => {
      const adapter = await createAdapter()
      poolEnd.mockRejectedValueOnce(new Error('pool already ended'))

      await expect(adapter.close()).rejects.toThrow('pool already ended')
    })
  })
})
