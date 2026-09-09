/**
 * The storage conformance suite run against a REAL PostgresDataAdapter.
 *
 * Isolation rules, because this talks to a live server that holds other people's work:
 *  - the admin URL is opened only long enough to `CREATE DATABASE trokky_conformance`;
 *  - every table, row and DROP happens inside `trokky_conformance` and nowhere else;
 *  - each adapter gets a unique table prefix and drops exactly its own tables in teardown;
 *  - no database is ever dropped.
 *
 * When no server answers, the whole suite is skipped with one message and the run still
 * exits 0 — that is the expected state in CI.
 */

import { randomBytes } from 'crypto'
import { Pool } from 'pg'
import { afterAll, describe, it } from 'vitest'
import { PostgresDataAdapter } from '../../adapters/postgres-data/postgres-data-adapter.js'
import type { DataStorageAdapter } from '../../core/types/storage-adapters.js'
import { describeDataAdapterConformance } from './conformance.js'

const ADMIN_URL = process.env.TROKKY_TEST_POSTGRES_URL ?? 'postgres://igf:igf@localhost:5434/postgres'
const CONFORMANCE_DB = 'trokky_conformance'
const PROBE_TIMEOUT_MS = 2000

/** Tables `createTables()` creates, in an order that is safe to drop. */
const TABLE_ENTITIES = [
  'documents',
  'audit_logs',
  'users',
  'app_tokens',
  'webhooks',
  'settings',
  'migrations'
]

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url)
  parsed.pathname = `/${database}`
  return parsed.toString()
}

/**
 * Connect to the admin URL just long enough to make sure `trokky_conformance` exists.
 * Returns the connection string for it, or null when the server cannot be reached.
 */
async function ensureConformanceDatabase(): Promise<string | null> {
  const admin = new Pool({ connectionString: ADMIN_URL, connectionTimeoutMillis: PROBE_TIMEOUT_MS, max: 1 })
  try {
    await admin.query('SELECT 1')
    try {
      await admin.query(`CREATE DATABASE ${CONFORMANCE_DB}`)
    } catch (error) {
      // 42P04 = duplicate_database: someone (probably a previous run) got there first.
      if ((error as { code?: string }).code !== '42P04') {
        throw error
      }
    }
    return withDatabase(ADMIN_URL, CONFORMANCE_DB)
  } catch {
    return null
  } finally {
    await admin.end().catch(() => undefined)
  }
}

const conformanceUrl = await ensureConformanceDatabase()

if (!conformanceUrl) {
  // Written straight to stderr on purpose: src/__tests__/setup.ts silences console.log/info/warn,
  // and vitest swallows console output belonging to a file whose tasks are all skipped.
  process.stderr.write(
    `[conformance] Postgres unreachable at ${ADMIN_URL} — skipping Postgres conformance (this is expected in CI).\n`
  )

  describe.skip('PostgresDataAdapter conformance (Postgres unreachable)', () => {
    it('needs a reachable Postgres server', () => {
      throw new Error('unreachable: the suite is skipped')
    })
  })
} else {
  const url = conformanceUrl
  // One long-lived pool inside trokky_conformance, used only to drop each adapter's tables.
  const maintenance = new Pool({ connectionString: url, max: 2 })
  const prefixesByAdapter = new Map<DataStorageAdapter, string>()

  async function createAdapter(): Promise<DataStorageAdapter> {
    const tablePrefix = `c${randomBytes(4).toString('hex')}_`
    const adapter = new PostgresDataAdapter({
      connection: url,
      tablePrefix,
      autoMigrate: true
    })
    prefixesByAdapter.set(adapter, tablePrefix)

    // The adapter initialises lazily; a first real call waits for the migration to finish.
    await adapter.listDocuments('conformance_readiness_probe')
    return adapter
  }

  async function teardown(adapter: DataStorageAdapter): Promise<void> {
    const tablePrefix = prefixesByAdapter.get(adapter)
    prefixesByAdapter.delete(adapter)
    if (tablePrefix) {
      for (const entity of TABLE_ENTITIES) {
        await maintenance.query(`DROP TABLE IF EXISTS public.${tablePrefix}${entity} CASCADE`)
      }
    }
    await adapter.close?.()
  }

  afterAll(async () => {
    await maintenance.end().catch(() => undefined)
  })

  describeDataAdapterConformance('PostgresDataAdapter', { createAdapter, teardown })
}
