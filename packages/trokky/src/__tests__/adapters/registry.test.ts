import { describe, it, expect } from 'vitest'
import { getAdapterRegistry, registerAdapter } from '../../core/adapters/registry.js'

describe('Adapter Registry', () => {
  it('should return an AdapterRegistry instance', () => {
    const registry = getAdapterRegistry()
    expect(registry).toBeDefined()
    expect(typeof registry.getStatus).toBe('function')
  })

  it('should report status', () => {
    const registry = getAdapterRegistry()
    const status = registry.getStatus()
    expect(status).toBeDefined()
    expect(Array.isArray(status.dataAdapters)).toBe(true)
    expect(Array.isArray(status.mediaAdapters)).toBe(true)
  })

  it('should register a custom adapter', () => {
    const name = 'test-adapter-' + Date.now()
    registerAdapter({
      name,
      type: 'data',
      environments: ['node'],
      factory: () => ({} as any),
    })
    const status = getAdapterRegistry().getStatus()
    expect(status.dataAdapters).toContain(name)
  })

  it('should register filesystem-data when imported', async () => {
    await import('../../adapters/filesystem-data/index.js')
    const status = getAdapterRegistry().getStatus()
    expect(status.dataAdapters).toContain('filesystem-data')
  })

  it('should register filesystem-media when imported', async () => {
    await import('../../adapters/filesystem-media/index.js')
    const status = getAdapterRegistry().getStatus()
    expect(status.mediaAdapters).toContain('filesystem-media')
  })
})
