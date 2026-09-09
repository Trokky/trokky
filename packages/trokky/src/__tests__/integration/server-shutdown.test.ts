import { describe, it, expect, vi } from 'vitest'
import type { Server } from 'http'
import { createShutdownHandler } from '../../integrations/express/server.js'
import { withDefaults } from '../../integrations/express/config.js'
import { MailService } from '../../mail/mail-service.js'
import { BuiltInTemplateRenderer } from '../../mail/templates/built-in-templates.js'
import type { MailAdapter } from '../../types/mail.js'
import type { ExpressIntegration } from '../../integrations/express/types.js'

const config = withDefaults({ storage: { adapter: 'mock', options: {} }, schemas: [] })

/**
 * A Server stand-in whose close() invokes its callback, which is all the shutdown
 * handler asks of it. Records when it drained so ordering can be asserted.
 */
function createMockServer(order: string[]) {
  return {
    close: vi.fn((cb: () => void) => {
      order.push('server')
      cb()
    }),
  } as unknown as Server
}

function createMockIntegration(shutdown?: () => Promise<void>): ExpressIntegration {
  return {
    core: { shutdown: vi.fn(shutdown ?? (async () => undefined)) },
  } as unknown as ExpressIntegration
}

function createMailService(adapter: MailAdapter): MailService {
  return new MailService({
    adapter,
    templateRenderer: new BuiltInTemplateRenderer({ brandName: 'Test' }),
    defaultFrom: 'noreply@example.com',
  })
}

function createMailAdapter(close?: () => Promise<void>): MailAdapter {
  return {
    send: vi.fn(async () => ({ success: true, messageId: 'msg-1' })),
    sendBatch: vi.fn(async () => ({ success: true, sent: 0, failed: 0, results: [] })),
    healthCheck: vi.fn(async () => true),
    getAdapterName: () => 'mock',
    ...(close ? { close: vi.fn(close) } : {}),
  } as MailAdapter
}

describe('createShutdownHandler', () => {
  it('should close a mail adapter that defines close()', async () => {
    const adapter = createMailAdapter(async () => undefined)
    const stop = createShutdownHandler(
      createMockServer([]),
      config,
      createMockIntegration(),
      createMailService(adapter)
    )

    await stop()

    expect(adapter.close).toHaveBeenCalledTimes(1)
  })

  it('should tolerate a mail adapter with nothing to close', async () => {
    // console and resend hold no sockets, so they define no close()
    const adapter = createMailAdapter()
    const stop = createShutdownHandler(
      createMockServer([]),
      config,
      createMockIntegration(),
      createMailService(adapter)
    )

    await expect(stop()).resolves.toBeUndefined()
    expect(adapter.close).toBeUndefined()
  })

  it('should work with no mail service at all', async () => {
    const integration = createMockIntegration()
    const stop = createShutdownHandler(createMockServer([]), config, integration)

    await expect(stop()).resolves.toBeUndefined()
    expect(integration.core!.shutdown).toHaveBeenCalledTimes(1)
  })

  it('should still close mail when the core teardown throws', async () => {
    const adapter = createMailAdapter(async () => undefined)
    const stop = createShutdownHandler(
      createMockServer([]),
      config,
      createMockIntegration(async () => {
        throw new Error('pool refused to end')
      }),
      createMailService(adapter)
    )

    await expect(stop()).resolves.toBeUndefined()
    expect(adapter.close).toHaveBeenCalledTimes(1)
  })

  it('should still tear down the core when the mail close throws', async () => {
    const adapter = createMailAdapter(async () => {
      throw new Error('smtp transport already gone')
    })
    const integration = createMockIntegration()
    const stop = createShutdownHandler(
      createMockServer([]),
      config,
      integration,
      createMailService(adapter)
    )

    await expect(stop()).resolves.toBeUndefined()
    expect(integration.core!.shutdown).toHaveBeenCalledTimes(1)
    expect(adapter.close).toHaveBeenCalledTimes(1)
  })

  it('should release handles only after the HTTP server has drained', async () => {
    const order: string[] = []
    const adapter = createMailAdapter(async () => {
      order.push('mail')
    })
    const stop = createShutdownHandler(
      createMockServer(order),
      config,
      createMockIntegration(async () => {
        order.push('core')
      }),
      createMailService(adapter)
    )

    await stop()

    expect(order).toEqual(['server', 'core', 'mail'])
  })

  it('should ignore a second stop while one is already in flight', async () => {
    const adapter = createMailAdapter(async () => undefined)
    const integration = createMockIntegration()
    const stop = createShutdownHandler(
      createMockServer([]),
      config,
      integration,
      createMailService(adapter)
    )

    await stop()
    await stop()

    expect(integration.core!.shutdown).toHaveBeenCalledTimes(1)
    expect(adapter.close).toHaveBeenCalledTimes(1)
  })
})

describe('MailService.close', () => {
  it('should delegate to the adapter close when there is one', async () => {
    const adapter = createMailAdapter(async () => undefined)

    await createMailService(adapter).close()

    expect(adapter.close).toHaveBeenCalledTimes(1)
  })

  it('should be a no-op for an adapter that holds nothing', async () => {
    const service = createMailService(createMailAdapter())

    await expect(service.close()).resolves.toBeUndefined()
  })

  it('should surface an adapter that fails to close', async () => {
    const service = createMailService(
      createMailAdapter(async () => {
        throw new Error('transport already gone')
      })
    )

    await expect(service.close()).rejects.toThrow('transport already gone')
  })
})
