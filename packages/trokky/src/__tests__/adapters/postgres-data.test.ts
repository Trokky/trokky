import { describe, it, expect } from 'vitest'
import { getAdapterRegistry } from '../../core/adapters/registry.js'

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
})
