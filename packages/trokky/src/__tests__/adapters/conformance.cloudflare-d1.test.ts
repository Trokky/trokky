/**
 * The storage conformance suite run against a REAL D1 database.
 *
 * "Real" means workerd's own D1 implementation, not a SQLite stand-in: Miniflare
 * boots the same runtime Cloudflare runs and hands back a `D1Database` binding.
 * So the suite exercises actual D1 semantics — batch atomicity, `meta.changes`,
 * `DELETE … RETURNING`, SQLite type affinity — from an ordinary Node test run,
 * with no separate test runner.
 *
 * Each test gets a brand new in-memory database, so isolation is total and
 * teardown is disposal. Unlike the Postgres runner there is nothing to skip
 * around: this has no external dependency and always runs.
 */

import { describe, it } from 'vitest'
import { Miniflare } from 'miniflare'
import type { D1Database } from '@cloudflare/workers-types'
import { CloudflareD1Adapter } from '../../adapters/cloudflare-d1/cloudflare-d1-adapter.js'
import type { DataStorageAdapter } from '../../core/types/storage-adapters.js'
import { describeDataAdapterConformance } from './conformance.js'

/** Miniflare needs a script; nothing ever fetches it. We only want the binding. */
const IDLE_WORKER = 'export default { fetch: () => new Response(null, { status: 204 }) }'

const instancesByAdapter = new Map<DataStorageAdapter, Miniflare>()

async function createAdapter(): Promise<DataStorageAdapter> {
  const mf = new Miniflare({
    modules: true,
    script: IDLE_WORKER,
    // A unique name per test keeps two adapters from sharing storage.
    d1Databases: { DB: `conformance-${Math.random().toString(36).slice(2)}` },
  })
  const database = (await mf.getD1Database('DB')) as unknown as D1Database

  const adapter = new CloudflareD1Adapter({ database, autoMigrate: true })
  instancesByAdapter.set(adapter, mf)

  // The adapter migrates lazily; a first real call waits for the schema.
  await adapter.listDocuments('conformance_readiness_probe')
  return adapter
}

async function teardown(adapter: DataStorageAdapter): Promise<void> {
  const mf = instancesByAdapter.get(adapter)
  instancesByAdapter.delete(adapter)
  await adapter.close?.()
  await mf?.dispose()
}

describeDataAdapterConformance('CloudflareD1Adapter', { createAdapter, teardown })

describe('CloudflareD1Adapter test harness', () => {
  it('runs against workerd D1, so these results mean D1 and not SQLite-in-Node', async () => {
    const adapter = await createAdapter()
    try {
      // A D1-specific behaviour Node's sqlite bindings do not share: a bound
      // undefined is rejected rather than coerced, which is why the adapter
      // must normalise parameters before binding.
      await adapter.healthCheck()
    } finally {
      await teardown(adapter)
    }
  })
})
