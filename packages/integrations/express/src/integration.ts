import { Router } from 'express'
import { TrokkyRoutes } from '@trokky/routes'
import { ExpressAdapter } from './adapter.js'
import { TrokkyExpressMiddleware } from './middleware.js'
import { createLogger, TrokkyCore, type TrokkyConfig } from '@trokky/core'
import type { ExpressIntegrationConfig, ExpressIntegration, UltimateExpressConfig } from './types.js'
import type { TrokkyConfig as NewTrokkyConfig, StorageConfig } from './config.js'
import { withDefaults } from './config.js'

/**
 * Main Express integration class for Trokky CMS
 * 
 * Creates an Express router with all Trokky routes and middleware
 */
export class TrokkyExpress {
  public routes: TrokkyRoutes  // Make public for debugging
  private adapter: ExpressAdapter
  private middleware: TrokkyExpressMiddleware
  private config: ExpressIntegrationConfig
  private logger = createLogger('express', 'TrokkyExpress')

  constructor(config: ExpressIntegrationConfig) {
    this.config = config
    
    // Validate configuration to prevent common mounting issues
    if (config.basePath && config.basePath.startsWith('/api')) {
      this.logger.warn(
        'basePath starts with "/api" but routes will be mounted on a path. ' +
        'This may cause double paths like "/api/api/v1/*". ' +
        'Consider using basePath: "" and mounting the router on your desired path.',
        { basePath: config.basePath }
      )
    }
    
    this.routes = new TrokkyRoutes(config)
    this.adapter = new ExpressAdapter()
    this.middleware = new TrokkyExpressMiddleware(config)
  }

  /**
   * Create complete Express integration with router and middleware
   */
  public async createIntegration(): Promise<ExpressIntegration> {
    const router = this.createRouter()
    const staticRouter = this.createStaticRouter()
    const middleware = this.middleware.getMiddleware()
    
    // Create Studio router if enabled
    let studioRouter: Router | undefined
    if (this.config.studio?.enabled !== false) {
      studioRouter = await this.createStudioRouter()
    }

    // Create auto-mount function
    const mount = (app: any, options?: { apiPath?: string; studioPath?: string }) => {
      const apiPath = options?.apiPath ?? '/api'
      const studioPath = options?.studioPath ?? '/studio'
      
      this.logger.info('Auto-mounting Trokky routers', { apiPath, studioPath, hasStudio: !!studioRouter })
      
      // Mount API routes
      app.use(apiPath, router)
      
      // Mount static routes at root level (no authentication)
      app.use('/', staticRouter)
      
      // Mount Studio if enabled
      if (studioRouter) {
        app.use(studioPath, studioRouter)
      }
    }

    return {
      router,
      staticRouter,
      studioRouter,
      middleware,
      config: this.config,
      mount
    }
  }

  /**
   * Create Express router with API routes only (excludes static routes)
   */
  public createRouter(): Router {
    const router = Router()

    // Get only API routes from TrokkyRoutes (not static routes)
    const routeDefinitions = this.routes.getApiRoutes()
    this.logger.info('Creating Express router', { routeCount: routeDefinitions.length })
    
    // Add each route to Express router
    for (const routeDef of routeDefinitions) {
      this.logger.debug('Registering route', { method: routeDef.method, path: routeDef.path })
      const expressHandler = this.adapter.handleRoute(routeDef.handler)
      
      // Map HTTP methods to Express router methods - cast to any to handle type compatibility
      switch (routeDef.method) {
        case 'GET':
          router.get(routeDef.path, expressHandler as any)
          break
        case 'POST':
          router.post(routeDef.path, expressHandler as any)
          break
        case 'PUT':
          router.put(routeDef.path, expressHandler as any)
          break
        case 'DELETE':
          router.delete(routeDef.path, expressHandler as any)
          break
        case 'PATCH':
          router.patch(routeDef.path, expressHandler as any)
          break
        case 'OPTIONS':
          router.options(routeDef.path, expressHandler as any)
          break
        default:
          this.logger.warn('Unsupported HTTP method', { method: routeDef.method })
      }
    }

    return router
  }

  /**
   * Create Express router with static routes only (excludes API routes)
   */
  public createStaticRouter(): Router {
    const router = Router()

    // Get only static routes from TrokkyRoutes
    const staticRoutes = this.routes.getStaticRoutes()
    this.logger.info('Creating static router', { routeCount: staticRoutes.length })
    
    // Add each static route to Express router
    for (const routeDef of staticRoutes) {
      this.logger.debug('Registering static route', { method: routeDef.method, path: routeDef.path })
      const expressHandler = this.adapter.handleRoute(routeDef.handler)
      
      // Static routes are typically GET only
      router.get(routeDef.path, expressHandler as any)
    }

    return router
  }

  /**
   * Create Studio router if Studio integration is enabled
   */
  public async createStudioRouter(): Promise<Router | undefined> {
    if (!this.config.studio) {
      return undefined
    }

    // Studio temporarily disabled during build issues
    this.logger.warn('Studio integration temporarily disabled')
    return undefined
  }

  /**
   * Get just the middleware array
   */
  public getMiddleware() {
    return this.middleware.getMiddleware()
  }

  /**
   * Get the error handler middleware
   */
  public static getErrorHandler() {
    return TrokkyExpressMiddleware.createErrorHandler()
  }


  /**
   * 🎯 PROFESSIONAL SETUP - Clean, type-safe configuration
   * 
   * Uses the new professional configuration system with:
   * - Organized config sections (storage, media, security, server, studio)
   * - Environment-aware defaults
   * - Better TypeScript auto-completion
   * - Integration with trokky.config.ts
   * 
   * @example
   * ```typescript
   * const trokky = await TrokkyExpress.create({
   *   schemas: blogSchemas,
   *   storage: { adapter: 'filesystem', contentDir: './content' },
   *   security: { adminUser: { username: 'admin', email: 'admin@demo.com', password: 'demo123' } }
   * })
   * 
   * trokky.mount(app)
   * ```
   */
  public static async create(config: NewTrokkyConfig): Promise<ExpressIntegration> {
    const logger = createLogger('express', 'ProfessionalSetup')
    logger.info('🎯 Starting professional Trokky setup')

    try {
      // Apply smart defaults based on environment
      const fullConfig = withDefaults(config)
      
      // 1. Create storage adapter
      const storageAdapter = await this.createStorageAdapterFromNewConfig(fullConfig.storage)
      
      // 2. Create TrokkyCore config (legacy format)
      const coreConfig: TrokkyConfig = {
        storage: {
          adapter: fullConfig.storage.adapter,
          options: fullConfig.storage.options || {}
        },
        schemas: fullConfig.schemas,
        media: {
          imageProcessor: fullConfig.media.processor,
          imageVariants: fullConfig.media.variants || []
        },
        security: {
          validateInput: fullConfig.security.validation?.input,
          rateLimitEnabled: fullConfig.security.rateLimit?.enabled
        }
      }
      
      // 3. Create and initialize TrokkyCore
      const coreOptions = {
        enableSecurity: fullConfig.security.enabled,
        jwtSecret: fullConfig.security.jwtSecret
      }
      
      const core = new TrokkyCore(coreConfig, storageAdapter, coreOptions)
      await core.init()
      logger.info('✅ TrokkyCore initialized with professional config')
      
      // 4. Create admin user if specified
      if (fullConfig.security.adminUser) {
        try {
          await core.createUser({
            username: fullConfig.security.adminUser.username,
            email: fullConfig.security.adminUser.email,
            password: fullConfig.security.adminUser.password,
            firstName: fullConfig.security.adminUser.firstName,
            lastName: fullConfig.security.adminUser.lastName,
            role: fullConfig.security.adminUser.role || 'admin'
          })
          logger.info('✅ Admin user created')
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          if (errorMessage.includes('already exists')) {
            logger.info('✅ Admin user already exists')
          } else {
            logger.warn('⚠️ Failed to create admin user', error)
          }
        }
      }
      
      // 5. Map professional config to Express integration config
      const expressConfig: ExpressIntegrationConfig = {
        core,
        basePath: fullConfig.server.basePath,
        corsOptions: fullConfig.server.cors ? {
          origin: typeof fullConfig.server.cors.origin === 'function' 
            ? 'http://localhost:5173' // Fallback for function origins
            : fullConfig.server.cors.origin,
          credentials: fullConfig.server.cors.credentials,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
        } : undefined,
        staticRoutes: fullConfig.server.static.media || fullConfig.server.static.assets ? {
          ...(fullConfig.server.static.media && {
            media: {
              mountPath: fullConfig.server.static.media.path,
              directory: fullConfig.server.static.media.directory,
              maxAge: fullConfig.server.static.media.maxAge
            }
          }),
          ...(fullConfig.server.static.assets && {
            assets: {
              mountPath: fullConfig.server.static.assets.path,
              directory: fullConfig.server.static.assets.directory,
              maxAge: fullConfig.server.static.assets.maxAge
            }
          })
        } : undefined,
        fileUpload: {
          maxFileSize: fullConfig.media.upload?.maxFileSize,
          maxFiles: fullConfig.media.upload?.maxFiles,
          allowedMimeTypes: fullConfig.media.upload?.allowedMimeTypes
        },
        bodyParser: fullConfig.server.parsing,
        authentication: fullConfig.security.enabled ? {
          enabled: fullConfig.security.enabled,
          publicPaths: []
        } : undefined,
        rateLimiting: fullConfig.security.rateLimit?.enabled ? fullConfig.security.rateLimit : undefined,
        studio: fullConfig.studio.enabled ? {
          enabled: fullConfig.studio.enabled,
          mount: fullConfig.studio.path,
          auth: fullConfig.studio.requireAuth,
          branding: fullConfig.studio.branding,
          structure: fullConfig.studio.structure,
          customFields: fullConfig.studio.fields,
          config: {
            pageSize: fullConfig.studio.settings?.pageSize,
            enableDrafts: fullConfig.studio.settings?.enableDrafts,
            enableVersioning: fullConfig.studio.settings?.enableVersioning,
            session: {
              refreshBufferMs: fullConfig.studio.session?.refreshBuffer,
              warningBufferMs: fullConfig.studio.session?.warningBuffer,
              checkIntervalMs: fullConfig.studio.session?.checkInterval,
              inactivityTimeoutMs: fullConfig.studio.session?.inactivityTimeout
            }
          }
        } : undefined
      }
      
      // 6. Create final integration
      const integration = new TrokkyExpress(expressConfig)
      const result = await integration.createIntegration()
      
      logger.info('🎉 Professional setup complete!')
      return result
      
    } catch (error) {
      logger.error('❌ Professional setup failed', error)
      throw new Error(`Professional setup failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }


  /**
   * Helper method to extract route parameters for dynamic routing
   */
  public findRouteForPath(method: string, path: string) {
    return this.routes.findRoute(method, path)
  }

  /**
   * Helper method to extract parameters from a path
   */
  public extractParamsFromPath(routePattern: string, actualPath: string) {
    return this.routes.extractParams(routePattern, actualPath)
  }



  /**
   * Create storage adapter based on new professional config
   */
  private static async createStorageAdapterFromNewConfig(config: StorageConfig) {
    switch (config.adapter) {
      case 'filesystem': {
        const { FilesystemAdapter } = await import('@trokky/adapter-filesystem')
        return new FilesystemAdapter({
          contentDir: config.contentDir || './content',
          mediaDir: config.mediaDir || './media',
          createDirs: config.createDirs ?? true,
          mediaBaseUrl: config.mediaBaseUrl || '/media',
          ...config.options
        })
      }
      case 'cloudflare': {
        throw new Error(`Cloudflare adapter not available. Install @trokky/adapter-cloudflare package.`)
      }
      case 's3': {
        throw new Error(`S3 adapter not available. Install @trokky/adapter-s3 package.`)
      }
      default:
        throw new Error(`Unsupported storage adapter: ${config.adapter}`)
    }
  }

  /**
   * Generate a secure JWT secret if none provided
   */
  private static generateSecureSecret(): string {
    // Simple secure secret generation for demo purposes
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }
}