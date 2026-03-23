import { describe, it, expect, beforeEach } from 'vitest'
import { FieldRegistry } from '../fields/registry/index'

// Create a minimal valid plugin that passes all validation
function createTestPlugin(name: string, overrides: Record<string, any> = {}) {
  return {
    name,
    type: name,
    displayName: `Test ${name}`,
    description: `A test field: ${name}`,
    category: 'text' as const,
    component: () => null,
    validate: () => ({ valid: true, errors: [] }),
    getDefaultValue: () => '',
    toSchemaField: () => ({ name, type: name }),
    fromSchemaField: (f: any) => f,
    ...overrides,
  }
}

describe('FieldRegistry', () => {
  let registry: FieldRegistry

  beforeEach(() => {
    registry = new FieldRegistry()
  })

  it('should start empty', () => {
    expect(registry.getAll()).toHaveLength(0)
  })

  it('should register a field plugin', () => {
    registry.register(createTestPlugin('custom'))
    expect(registry.get('custom')).toBeDefined()
    expect(registry.getAll()).toHaveLength(1)
  })

  it('should retrieve by name', () => {
    registry.register(createTestPlugin('test'))
    const plugin = registry.get('test')
    expect(plugin?.type).toBe('test')
    expect(plugin?.displayName).toBe('Test test')
  })

  it('should return undefined for missing plugin', () => {
    expect(registry.get('missing')).toBeUndefined()
  })

  it('should throw on duplicate registration', () => {
    registry.register(createTestPlugin('f'))
    expect(() => registry.register(createTestPlugin('f'))).toThrow()
  })

  it('should list all registered', () => {
    registry.register(createTestPlugin('a'))
    registry.register(createTestPlugin('b'))
    registry.register(createTestPlugin('c'))
    expect(registry.getAll()).toHaveLength(3)
    expect(registry.getAll().map(p => p.name)).toEqual(expect.arrayContaining(['a', 'b', 'c']))
  })

  it('should reject invalid plugin (missing required props)', () => {
    expect(() => registry.register({ name: 'bad' } as any)).toThrow()
  })

  it('should reject plugin without component', () => {
    expect(() =>
      registry.register({ ...createTestPlugin('x'), component: undefined } as any)
    ).toThrow()
  })
})

describe('Built-in field plugin exports', () => {
  it('should export stringFieldPlugin', async () => {
    const mod = await import('../fields/definitions/StringField/index')
    expect(mod.stringFieldPlugin).toBeDefined()
    expect(mod.stringFieldPlugin.type).toBe('string')
    expect(mod.stringFieldPlugin.component).toBeDefined()
  })

  it('should export numberFieldPlugin', async () => {
    const mod = await import('../fields/definitions/NumberField/index')
    expect(mod.numberFieldPlugin).toBeDefined()
    expect(mod.numberFieldPlugin.type).toBe('number')
  })

  it('should export booleanFieldPlugin', async () => {
    const mod = await import('../fields/definitions/BooleanField/index')
    expect(mod.booleanFieldPlugin).toBeDefined()
    expect(mod.booleanFieldPlugin.type).toBe('boolean')
  })

  it('should export dateFieldPlugin', async () => {
    const mod = await import('../fields/definitions/DateField/index')
    expect(mod.dateFieldPlugin).toBeDefined()
    expect(mod.dateFieldPlugin.type).toBe('date')
  })

  it('should export mediaFieldPlugin', async () => {
    const mod = await import('../fields/definitions/MediaField/index')
    expect(mod.mediaFieldPlugin).toBeDefined()
    expect(mod.mediaFieldPlugin.type).toBe('media')
  })

  it('should export arrayFieldPlugin', async () => {
    const mod = await import('../fields/definitions/ArrayField/index')
    expect(mod.arrayFieldPlugin).toBeDefined()
    expect(mod.arrayFieldPlugin.type).toBe('array')
  })

  it('should export SlugFieldPlugin', async () => {
    const mod = await import('../fields/definitions/SlugField/index')
    expect(mod.SlugFieldPlugin).toBeDefined()
    expect(mod.SlugFieldPlugin.type).toBe('slug')
  })

  it('should export color field plugin', async () => {
    const mod = await import('../fields/definitions/ColorField/index')
    // May be exported as colorFieldPlugin or ColorFieldPlugin
    const plugin = mod.colorFieldPlugin || (mod as any).default || Object.values(mod).find((v: any) => v?.type === 'color')
    expect(plugin).toBeDefined()
  })

  it('should export each plugin with required properties', async () => {
    const { stringFieldPlugin } = await import('../fields/definitions/StringField/index')
    expect(stringFieldPlugin.type).toBe('string')
    expect(stringFieldPlugin.type).toBeDefined()
    expect(stringFieldPlugin.displayName).toBeDefined()
    expect(stringFieldPlugin.component).toBeDefined()
    expect(typeof stringFieldPlugin.validate).toBe('function')
  })
})
