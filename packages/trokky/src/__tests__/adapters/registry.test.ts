import { describe, it, expect } from 'vitest'
import { getAdapterRegistry, registerAdapter, adapterNotFoundMessage } from '../../core/adapters/registry.js'

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

describe('adapter not registered', () => {
  it('should name the import for a media adapter too', () => {
    expect(adapterNotFoundMessage('media', 's3-media', ['filesystem-media'])).toContain(
      "import '@trokky/trokky/adapters/s3-media'"
    )
  })

  it('should list what is registered, or say none is', () => {
    expect(adapterNotFoundMessage('data', 'postgres-data', ['filesystem-data'])).toContain(
      'registered data adapters: filesystem-data'
    )
    expect(adapterNotFoundMessage('data', 'postgres-data', [])).toContain('registered data adapters: none')
  })

  it('should say when a media adapter is configured as the data adapter', () => {
    expect(adapterNotFoundMessage('data', 'filesystem-media', [])).toContain(
      '"filesystem-media" is a media adapter: it belongs under storage.media, not storage.data'
    )
  })

  it.each([
    ['postgres', 'postgres-data'],
    ['filesystem', 'filesystem-data'],
  ])('should suggest %s -> %s for a near miss', (name, hint) => {
    expect(adapterNotFoundMessage('data', name, [])).toContain(`did you mean "${hint}"?`)
  })

  it('should suggest from a name that extends the adapter family, whatever its case', () => {
    expect(adapterNotFoundMessage('data', 'postgresql', [])).toContain('did you mean "postgres-data"?')
    expect(adapterNotFoundMessage('data', 'Postgres', [])).toContain('did you mean "postgres-data"?')
  })

  it('should not read inherited object members as adapters', () => {
    expect(adapterNotFoundMessage('data', 'constructor', [])).not.toContain("import '")
    expect(adapterNotFoundMessage('media', 'toString', [])).not.toContain('is a data adapter')
  })

  it('should not suggest anything for an unrelated or empty name', () => {
    expect(adapterNotFoundMessage('data', 'mongodb', [])).not.toContain('did you mean')
    expect(adapterNotFoundMessage('data', '', [])).not.toContain('did you mean')
  })

  it.each([
    ['filesystem-data', '../../adapters/filesystem-data/index.js', 'data'],
    ['postgres-data', '../../adapters/postgres-data/index.js', 'data'],
    ['cloudflare-d1', '../../adapters/cloudflare-d1/index.js', 'data'],
    ['filesystem-media', '../../adapters/filesystem-media/index.js', 'media'],
    ['s3-media', '../../adapters/s3-media/index.js', 'media'],
    ['cloudflare-r2', '../../adapters/cloudflare-r2/index.js', 'media'],
  ] as const)('should map %s to the module that registers it', async (name, modulePath, kind) => {
    await import(modulePath)
    const status = getAdapterRegistry().getStatus()
    expect(kind === 'data' ? status.dataAdapters : status.mediaAdapters).toContain(name)
    expect(adapterNotFoundMessage(kind, name, [])).toContain(`@trokky/trokky/adapters/${name}`)
  })
})
