import { describe, it, expect } from 'vitest'

describe('trokky package', () => {
  it('should export core modules', async () => {
    const trokky = await import('../index.js')
    expect(trokky).toBeDefined()
    expect(trokky.TrokkyCore).toBeDefined()
  })

  it('should export route handler', async () => {
    const routes = await import('../routes/index.js')
    expect(routes.TrokkyRoutes).toBeDefined()
  })

  it('should export structure builder', async () => {
    const structure = await import('../structure/index.js')
    expect(structure.StructureBuilder).toBeDefined()
  })

  it('should export mail service', async () => {
    const mail = await import('../mail/index.js')
    expect(mail.MailService).toBeDefined()
  })

  it('should export adapter registry', async () => {
    const trokky = await import('../index.js')
    expect(trokky.registerAdapter).toBeDefined()
    expect(trokky.getAdapterRegistry).toBeDefined()
  })
})
