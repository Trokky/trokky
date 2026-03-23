import { describe, it, expect } from 'vitest'

describe('Studio exports', () => {
  it('should export FieldRenderer', async () => {
    const mod = await import('../fields/index')
    expect(mod.FieldRenderer).toBeDefined()
  })

  it('should export FieldWrapper', async () => {
    const mod = await import('../fields/index')
    expect(mod.FieldWrapper).toBeDefined()
  })

  it('should export fieldRegistry', async () => {
    const mod = await import('../fields/index')
    expect(mod.fieldRegistry).toBeDefined()
  })

  it('should export FieldRegistry class', async () => {
    const mod = await import('../fields/index')
    expect(mod.FieldRegistry).toBeDefined()
  })

  it('should export field plugin definitions', async () => {
    const mod = await import('../fields/index')
    // Check a few key plugin exports
    expect(mod.stringFieldPlugin).toBeDefined()
    expect(mod.numberFieldPlugin).toBeDefined()
    expect(mod.booleanFieldPlugin).toBeDefined()
  })

  it('should export validation functions', async () => {
    const mod = await import('../fields/index')
    expect(mod.validateStringField || mod.StringFieldComponent).toBeDefined()
  })
})

describe('Studio logger', () => {
  it('should export createStudioLogger', async () => {
    const mod = await import('../utils/logger')
    expect(mod.createStudioLogger).toBeDefined()
  })

  it('should create a logger instance', async () => {
    const { createStudioLogger } = await import('../utils/logger')
    const logger = createStudioLogger('TestComponent')
    expect(logger).toBeDefined()
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.error).toBe('function')
  })
})
