/**
 * Trokky Express Server
 *
 * High-level server creation and lifecycle management.
 * This is the recommended entry point for Trokky applications.
 *
 * @example
 * ```typescript
 * import config from './trokky.config.js'
 * import { startServer } from '@trokky/express'
 *
 * await startServer(config)
 * ```
 */

import express, { Express, Router } from 'express'
import { createLogger } from '@trokky/core'
import { MailService, MailNotificationService } from '@trokky/mail'
import { TrokkyExpress } from './integration.js'
import { withDefaults } from './config.js'
import type {
  TrokkyConfig,
  TrokkyConfigWithDefaults,
  CustomRoute,
  RouteGroup,
  HooksConfig,
  DocumentEvent,
  UserEvent,
  MiddlewareHandler,
} from './config.js'
import type { ExpressIntegration } from './types.js'
import type { Server } from 'http'

// =============================================================================
// SERVER RESULT INTERFACE
// =============================================================================

/**
 * Result of starting the Trokky server
 */
export interface TrokkyServerInstance {
  /** The Express application instance */
  app: Express
  /** The HTTP server instance */
  server: Server
  /** The Trokky Express integration */
  integration: ExpressIntegration
  /** Mail service instance (if configured) */
  mailService?: MailService
  /** Mail notification service instance (if configured) */
  mailNotificationService?: MailNotificationService
  /** Gracefully stop the server */
  stop: () => Promise<void>
  /** Get server info */
  getInfo: () => ServerInfo
}

export interface ServerInfo {
  port: number
  env: string
  apiPath: string
  studioPath: string
  studioEnabled: boolean
  mailEnabled: boolean
  customRoutesCount: number
  hooksCount: number
}

// =============================================================================
// MAIN SERVER FUNCTION
// =============================================================================

const logger = createLogger('express', 'Server')

/**
 * Start a Trokky server with the provided configuration.
 *
 * This is the recommended way to create a Trokky application.
 * It handles all initialization, including:
 * - Express app creation
 * - Trokky core initialization
 * - Mail service setup (if configured)
 * - Event hooks registration
 * - Custom routes mounting
 * - Server lifecycle management
 *
 * @param config - Trokky configuration object
 * @returns Server instance with control methods
 *
 * @example
 * ```typescript
 * const server = await startServer({
 *   schemas: mySchemas,
 *   storage: { data: {...}, media: {...} },
 *   security: { adminUser: {...} },
 *   mail: { adapter: resendAdapter },
 *   routes: [
 *     { path: '/api/contact', method: 'POST', handler: contactHandler }
 *   ]
 * })
 *
 * // Later, gracefully stop
 * await server.stop()
 * ```
 */
export async function startServer(
  config: TrokkyConfig
): Promise<TrokkyServerInstance> {
  logger.info('🚀 Starting Trokky server...')

  // Apply defaults
  const fullConfig = withDefaults(config)
  const env = fullConfig.env

  // Create Express app
  const app: Express = express()

  // Trust proxy if configured
  if (fullConfig.server.trustProxy) {
    app.set('trust proxy', fullConfig.server.trustProxy)
    logger.debug('Trust proxy enabled', { value: fullConfig.server.trustProxy })
  }

  // Call beforeStart lifecycle hook
  if (fullConfig.server.lifecycle?.beforeStart) {
    logger.debug('Calling beforeStart lifecycle hook')
    await fullConfig.server.lifecycle.beforeStart(app)
  }

  // Create Trokky integration
  logger.info('Initializing Trokky core...')
  const integration = await TrokkyExpress.create(fullConfig)

  // Mount Trokky routes
  const apiPath = fullConfig.server.basePath || '/api'
  const studioPath = fullConfig.studio.path || '/studio'

  integration.mount(app, { apiPath, studioPath })
  logger.info('Trokky routes mounted', { apiPath, studioPath })

  // Initialize mail service if configured
  let mailService: MailService | undefined
  let mailNotificationService: MailNotificationService | undefined

  if (fullConfig.mail?.adapter) {
    const mailResult = await initializeMailService(fullConfig, integration)
    mailService = mailResult.mailService
    mailNotificationService = mailResult.mailNotificationService
  }

  // Register event hooks if configured
  if (fullConfig.hooks) {
    await registerHooks(fullConfig.hooks, integration)
  }

  // Mount custom routes if configured
  if (fullConfig.routes && fullConfig.routes.length > 0) {
    mountCustomRoutes(app, fullConfig.routes, integration)
  }

  // Add health endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      env: fullConfig.env,
      version: '1.0.0',
    })
  })

  // Determine port
  const port = fullConfig.server.port || Number(process.env.PORT) || 3000

  // Start server
  const server = await new Promise<Server>((resolve, reject) => {
    const httpServer = app.listen(port, '0.0.0.0', () => {
      resolve(httpServer)
    })
    httpServer.on('error', reject)
  })

  logger.info(`✅ Trokky server started on port ${port}`)

  // Call afterStart lifecycle hook
  if (fullConfig.server.lifecycle?.afterStart) {
    logger.debug('Calling afterStart lifecycle hook')
    await fullConfig.server.lifecycle.afterStart(app, port)
  }

  // Setup graceful shutdown
  const stop = createShutdownHandler(server, fullConfig, mailService)

  // Register process handlers
  setupProcessHandlers(stop, fullConfig)

  // Create server instance
  const instance: TrokkyServerInstance = {
    app,
    server,
    integration,
    mailService,
    mailNotificationService,
    stop,
    getInfo: () => ({
      port,
      env: fullConfig.env,
      apiPath,
      studioPath,
      studioEnabled: fullConfig.studio.enabled ?? true,
      mailEnabled: !!mailService,
      customRoutesCount: fullConfig.routes?.length ?? 0,
      hooksCount: countHooks(fullConfig.hooks),
    }),
  }

  // Log startup summary
  logStartupSummary(instance.getInfo())

  return instance
}

// =============================================================================
// MAIL SERVICE INITIALIZATION
// =============================================================================

async function initializeMailService(
  config: TrokkyConfigWithDefaults,
  integration: ExpressIntegration
): Promise<{
  mailService: MailService
  mailNotificationService?: MailNotificationService
}> {
  logger.info('Initializing mail service...')

  const mailConfig = config.mail!

  // Create mail service
  const mailService = new MailService({
    adapter: mailConfig.adapter,
    templateRenderer: mailConfig.templateRenderer!,
    defaultFrom: mailConfig.defaultFrom || 'noreply@localhost',
    defaultFromName: mailConfig.defaultFromName,
    debug: mailConfig.debug ?? config.env === 'development',
  })

  await mailService.initialize()
  logger.info('✅ Mail service initialized')

  // Setup mail notification service if core is available
  let mailNotificationService: MailNotificationService | undefined

  const core = integration.core
  if (core?.events) {
    const baseUrl = process.env.STUDIO_URL || `http://localhost:${config.server.port || 3000}`

    mailNotificationService = new MailNotificationService(core.events, {
      mailService,
      baseUrl,
      core,
      enabled: mailConfig.notifications,
      debug: mailConfig.debug ?? config.env === 'development',
    })

    await mailNotificationService.initialize()
    logger.info('✅ Mail notification service initialized')
  } else {
    logger.warn('Core event bus not available - mail notifications disabled')
  }

  return { mailService, mailNotificationService }
}

// =============================================================================
// HOOKS REGISTRATION
// =============================================================================

async function registerHooks(
  hooks: HooksConfig,
  integration: ExpressIntegration
): Promise<void> {
  const core = integration.core
  if (!core?.events) {
    logger.warn('Core event bus not available - hooks will not be registered')
    return
  }

  const eventBus = core.events
  let registeredCount = 0

  // Document events
  const documentEvents = [
    'document.created',
    'document.updated',
    'document.deleted',
    'document.published',
    'document.unpublished',
  ] as const

  for (const eventName of documentEvents) {
    const handler = hooks[eventName]
    if (handler) {
      eventBus.on(eventName, async (data: any) => {
        const event: DocumentEvent = {
          type: eventName,
          collection: data.collection || data.schemaType,
          document: data.document || data,
          previousDocument: data.previousDocument,
          user: data.user,
          timestamp: new Date(),
        }
        await handler(event)
      })
      registeredCount++
      logger.debug(`Registered hook: ${eventName}`)
    }
  }

  // User events
  const userEvents = [
    'user.created',
    'user.updated',
    'user.deleted',
    'user.login',
    'user.logout',
  ] as const

  for (const eventName of userEvents) {
    const handler = hooks[eventName]
    if (handler) {
      eventBus.on(eventName, async (data: any) => {
        const event: UserEvent = {
          type: eventName,
          user: data.user || data,
          metadata: data.metadata,
          timestamp: new Date(),
        }
        await handler(event)
      })
      registeredCount++
      logger.debug(`Registered hook: ${eventName}`)
    }
  }

  // Media events
  const mediaEvents = ['media.uploaded', 'media.deleted'] as const

  for (const eventName of mediaEvents) {
    const handler = hooks[eventName]
    if (handler) {
      eventBus.on(eventName, async (data: any) => {
        const event: DocumentEvent = {
          type: eventName,
          collection: 'media',
          document: data.media || data,
          timestamp: new Date(),
        }
        await handler(event)
      })
      registeredCount++
      logger.debug(`Registered hook: ${eventName}`)
    }
  }

  // External webhooks
  if (hooks.webhooks && hooks.webhooks.length > 0) {
    for (const webhook of hooks.webhooks) {
      for (const eventName of webhook.events) {
        eventBus.on(eventName, async (data: any) => {
          await dispatchWebhook(webhook, eventName, data)
        })
        registeredCount++
      }
      logger.debug(`Registered webhook: ${webhook.url} for ${webhook.events.join(', ')}`)
    }
  }

  logger.info(`✅ Registered ${registeredCount} event hooks`)
}

async function dispatchWebhook(
  webhook: NonNullable<HooksConfig['webhooks']>[number],
  eventName: string,
  data: any
): Promise<void> {
  const { url, secret, headers, retry } = webhook

  const payload = {
    event: eventName,
    data,
    timestamp: new Date().toISOString(),
  }

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Trokky-Event': eventName,
    ...headers,
  }

  // Add signature if secret is provided
  if (secret) {
    const crypto = await import('crypto')
    const signature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex')
    requestHeaders['X-Trokky-Signature'] = `sha256=${signature}`
  }

  const maxAttempts = retry?.maxAttempts ?? 3
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        logger.debug(`Webhook delivered: ${url}`, { eventName, attempt })
        return
      }

      lastError = new Error(`Webhook failed with status ${response.status}`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }

    if (attempt < maxAttempts) {
      const delay = (retry?.initialDelay ?? 1000) * Math.pow(retry?.backoffMultiplier ?? 2, attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  logger.error(`Webhook delivery failed after ${maxAttempts} attempts: ${url}`, lastError)
}

// =============================================================================
// CUSTOM ROUTES MOUNTING
// =============================================================================

function mountCustomRoutes(
  app: Express,
  routes: (CustomRoute | RouteGroup)[],
  integration: ExpressIntegration
): void {
  let mountedCount = 0

  for (const routeOrGroup of routes) {
    if (isRouteGroup(routeOrGroup)) {
      // Handle route group
      const router = Router()

      // Apply group middleware
      if (routeOrGroup.middleware) {
        for (const mw of routeOrGroup.middleware) {
          router.use(mw)
        }
      }

      // Mount routes in group
      for (const route of routeOrGroup.routes) {
        mountRoute(router, route, integration, routeOrGroup.auth)
        mountedCount++
      }

      app.use(routeOrGroup.prefix, router)
      logger.debug(`Mounted route group: ${routeOrGroup.prefix}`)
    } else {
      // Handle individual route
      mountRoute(app, routeOrGroup, integration)
      mountedCount++
    }
  }

  logger.info(`✅ Mounted ${mountedCount} custom routes`)
}

function mountRoute(
  target: Express | Router,
  route: CustomRoute,
  integration: ExpressIntegration,
  groupAuth?: boolean | 'admin' | 'public'
): void {
  const { path, method, handler, middleware = [], auth } = route

  // Determine auth requirement (route-level overrides group-level)
  const authRequirement = auth ?? groupAuth ?? 'public'

  // Build middleware chain
  const middlewareChain = [...middleware]

  // Add auth middleware if required
  if (authRequirement === true || authRequirement === 'admin') {
    // TODO: Import auth middleware from integration
    // For now, we'll add a placeholder that checks for authorization header
    const authMiddleware: MiddlewareHandler = (req, res, next) => {
      const authHeader = req.headers.authorization
      if (!authHeader) {
        res.status(401).json({ error: 'Authentication required' })
        return
      }
      // TODO: Validate token using integration.core
      next()
    }
    middlewareChain.unshift(authMiddleware)
  }

  // Add the handler
  const handlers = [...middlewareChain, handler]

  // Mount based on method
  const lowerMethod = method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch'
  ;(target as any)[lowerMethod](path, ...handlers)

  logger.debug(`Mounted route: ${method} ${path}`, { auth: authRequirement })
}

function isRouteGroup(route: CustomRoute | RouteGroup): route is RouteGroup {
  return 'prefix' in route && 'routes' in route
}

// =============================================================================
// SHUTDOWN HANDLING
// =============================================================================

function createShutdownHandler(
  server: Server,
  config: TrokkyConfigWithDefaults,
  mailService?: MailService
): () => Promise<void> {
  let isShuttingDown = false

  return async () => {
    if (isShuttingDown) {
      logger.warn('Shutdown already in progress')
      return
    }
    isShuttingDown = true

    logger.info('Shutting down Trokky server...')

    // Call beforeShutdown lifecycle hook
    if (config.server.lifecycle?.beforeShutdown) {
      try {
        await config.server.lifecycle.beforeShutdown()
      } catch (error) {
        logger.error('Error in beforeShutdown hook', error)
      }
    }

    // Close HTTP server
    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed')
        resolve()
      })
    })

    logger.info('✅ Trokky server stopped')
  }
}

function setupProcessHandlers(
  stop: () => Promise<void>,
  config: TrokkyConfigWithDefaults
): void {
  const handleSignal = async (signal: string) => {
    logger.info(`Received ${signal}, initiating graceful shutdown...`)
    await stop()
    process.exit(0)
  }

  process.on('SIGTERM', () => handleSignal('SIGTERM'))
  process.on('SIGINT', () => handleSignal('SIGINT'))

  // Handle uncaught errors
  if (config.server.lifecycle?.onError) {
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception', error)
      await config.server.lifecycle!.onError!(error)
    })

    process.on('unhandledRejection', async (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason))
      logger.error('Unhandled rejection', error)
      await config.server.lifecycle!.onError!(error)
    })
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

function countHooks(hooks?: HooksConfig): number {
  if (!hooks) return 0

  let count = 0
  const hookKeys = [
    'document.created',
    'document.updated',
    'document.deleted',
    'document.published',
    'document.unpublished',
    'user.created',
    'user.updated',
    'user.deleted',
    'user.login',
    'user.logout',
    'media.uploaded',
    'media.deleted',
  ] as const

  for (const key of hookKeys) {
    if (hooks[key]) count++
  }

  if (hooks.webhooks) {
    count += hooks.webhooks.length
  }

  return count
}

function logStartupSummary(info: ServerInfo): void {
  console.log('')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║                    🚀 Trokky Server                        ║')
  console.log('╠════════════════════════════════════════════════════════════╣')
  console.log(`║  Environment:    ${info.env.padEnd(42)}║`)
  console.log(`║  Port:           ${String(info.port).padEnd(42)}║`)
  console.log(`║  API:            http://localhost:${info.port}${info.apiPath.padEnd(22)}║`)
  if (info.studioEnabled) {
    console.log(`║  Studio:         http://localhost:${info.port}${info.studioPath.padEnd(22)}║`)
  }
  console.log(`║  Health:         http://localhost:${info.port}/health${' '.repeat(17)}║`)
  console.log('╠════════════════════════════════════════════════════════════╣')
  console.log(`║  Mail:           ${(info.mailEnabled ? '✅ Enabled' : '❌ Disabled').padEnd(42)}║`)
  console.log(`║  Custom Routes:  ${String(info.customRoutesCount).padEnd(42)}║`)
  console.log(`║  Event Hooks:    ${String(info.hooksCount).padEnd(42)}║`)
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')
}

// =============================================================================
// ALTERNATIVE: CREATE WITHOUT STARTING
// =============================================================================

/**
 * Create a Trokky server without starting it.
 * Useful for testing or custom server management.
 *
 * @param config - Trokky configuration object
 * @returns Object with app, integration, and start function
 */
export async function createServer(config: TrokkyConfig): Promise<{
  app: Express
  integration: ExpressIntegration
  start: (port?: number) => Promise<TrokkyServerInstance>
}> {
  const fullConfig = withDefaults(config)

  // Create Express app
  const app: Express = express()

  if (fullConfig.server.trustProxy) {
    app.set('trust proxy', fullConfig.server.trustProxy)
  }

  // Call beforeStart lifecycle hook
  if (fullConfig.server.lifecycle?.beforeStart) {
    await fullConfig.server.lifecycle.beforeStart(app)
  }

  // Create Trokky integration
  const integration = await TrokkyExpress.create(fullConfig)

  return {
    app,
    integration,
    start: async (port?: number) => {
      const actualPort = port || fullConfig.server.port || Number(process.env.PORT) || 3000

      // Mount routes
      integration.mount(app, {
        apiPath: fullConfig.server.basePath || '/api',
        studioPath: fullConfig.studio.path || '/studio',
      })

      // Initialize mail, hooks, routes...
      // (Similar to startServer but allows custom port)

      const server = await new Promise<Server>((resolve, reject) => {
        const httpServer = app.listen(actualPort, '0.0.0.0', () => {
          resolve(httpServer)
        })
        httpServer.on('error', reject)
      })

      const stop = createShutdownHandler(server, fullConfig)

      return {
        app,
        server,
        integration,
        stop,
        getInfo: () => ({
          port: actualPort,
          env: fullConfig.env,
          apiPath: fullConfig.server.basePath || '/api',
          studioPath: fullConfig.studio.path || '/studio',
          studioEnabled: fullConfig.studio.enabled ?? true,
          mailEnabled: false,
          customRoutesCount: 0,
          hooksCount: 0,
        }),
      }
    },
  }
}
