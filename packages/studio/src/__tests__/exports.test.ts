import { describe, it, expect } from 'vitest'

describe('Studio exports', () => {
  // FieldRenderer/FieldWrapper import React components that depend on trokky/i18n
  // which requires React to be resolvable. Skipped in unit tests, verified by Vite build.
  it.skip('should export FieldRenderer component', async () => {
    const mod = await import('../fields/components/FieldRenderer')
    expect(mod.FieldRenderer).toBeDefined()
  })

  it.skip('should export FieldWrapper component', async () => {
    const mod = await import('../fields/components/FieldWrapper')
    expect(mod.FieldWrapper).toBeDefined()
  })

  it('should export FieldRegistry class', async () => {
    const { FieldRegistry } = await import('../fields/registry/index')
    expect(FieldRegistry).toBeDefined()
  })

  it('should export fieldRegistry singleton', async () => {
    const { fieldRegistry } = await import('../fields/registry/index')
    expect(fieldRegistry).toBeDefined()
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
