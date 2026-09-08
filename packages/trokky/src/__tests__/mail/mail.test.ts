import { describe, it, expect, vi } from 'vitest'
import type { MailAdapter, MailMessage, MailResult } from '../../mail/types.js'

function createMockAdapter(): MailAdapter {
  return {
    name: 'mock-adapter',
    send: vi.fn(async (message: MailMessage): Promise<MailResult> => ({
      success: true,
      messageId: `msg-${Date.now()}`,
    })),
  }
}

describe('Mail', () => {
  describe('MailService', () => {
    it('should be importable', async () => {
      const mod = await import('../../mail/index.js')
      expect(mod.MailService).toBeDefined()
    })
  })

  describe('BuiltInTemplateRenderer', () => {
    it('should be importable', async () => {
      const mod = await import('../../mail/templates/built-in-templates.js')
      expect(mod.BuiltInTemplateRenderer).toBeDefined()
    })
  })

  describe('Console adapter', () => {
    it('should import without errors', async () => {
      const mod = await import('../../mail/adapters/console.js')
      expect(mod.ConsoleMailAdapter).toBeDefined()
    })

    it('should instantiate with config', async () => {
      const { ConsoleMailAdapter } = await import('../../mail/adapters/console.js')
      const adapter = new ConsoleMailAdapter({ verbose: true })
      expect(adapter).toBeDefined()
    })

    it('should send email and return success', async () => {
      const { ConsoleMailAdapter } = await import('../../mail/adapters/console.js')
      const adapter = new ConsoleMailAdapter()
      const result = await adapter.send({
        to: 'user@example.com',
        from: 'noreply@example.com',
        subject: 'Test',
        text: 'Hello',
      })
      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
    })
  })

  describe('Mock adapter contract', () => {
    it('should implement MailAdapter interface', () => {
      const adapter = createMockAdapter()
      expect(adapter.name).toBe('mock-adapter')
      expect(typeof adapter.send).toBe('function')
    })

    it('should return success on send', async () => {
      const adapter = createMockAdapter()
      const result = await adapter.send({
        to: 'test@example.com',
        from: 'noreply@example.com',
        subject: 'Test',
        text: 'Body',
      })
      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
    })

    it('should be callable multiple times', async () => {
      const adapter = createMockAdapter()
      await adapter.send({ to: 'a@b.com', from: 'x@y.com', subject: 'One', text: '1' })
      await adapter.send({ to: 'c@d.com', from: 'x@y.com', subject: 'Two', text: '2' })
      expect(adapter.send).toHaveBeenCalledTimes(2)
    })
  })
})
