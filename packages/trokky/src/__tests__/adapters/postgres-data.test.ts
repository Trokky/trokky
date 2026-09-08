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

vi.mock('pg', () => {
  class MockPool {
    query = poolQuery
    async connect(): Promise<unknown> {
      return { query: poolQuery, release: (): void => undefined }
    }
    async end(): Promise<void> {
      return undefined
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

      // A single conditional UPDATE, no separate read
      expect(queryCalls).toHaveLength(1)
      expect(queryCalls[0].text).toContain('UPDATE')
      expect(queryCalls[0].text).toContain('WHERE id = $1 AND password_hash = $16')
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
  })
})
