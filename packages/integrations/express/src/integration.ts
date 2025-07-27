import { Router } from 'express'
import { TrokkyRoutes } from '@trokky/routes'
import { ExpressAdapter } from './adapter.js'
import { TrokkyExpressMiddleware } from './middleware.js'
import { createLogger, TrokkyCore, type TrokkyConfig } from '@trokky/core'
import type { ExpressIntegrationConfig, ExpressIntegration, UltimateExpressConfig } from './types.js'

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

    try {
      // Import createStudio dynamically to avoid circular dependencies
      const { createStudio } = await import('@trokky/studio')
      
      // Create Studio configuration
      const studioConfig = {
        apiRouter: this.createRouter(), // Pass the API router
        mount: this.config.studio.mount || '/studio',
        auth: this.config.studio.auth ?? true,
        branding: this.config.studio.branding,
        structure: this.config.studio.structure,
        customFields: this.config.studio.customFields,
        config: this.config.studio.config,
        sessionConfig: this.config.studio.config?.session // Pass session config
      }

      this.logger.info('Creating Studio router', { mount: studioConfig.mount })
      const studio = await createStudio(studioConfig)
      
      return studio.router
    } catch (error) {
      this.logger.error('Failed to create Studio router', error)
      throw new Error(`Studio integration failed: ${error.message}`)
    }
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
   * 🔥 UNIFIED SETUP - Everything in one call! (Default method)
   * 
   * Eliminates all boilerplate:
   * - Auto creates and initializes TrokkyCore
   * - Auto creates storage adapter
   * - Auto creates admin user
   * - Auto sets up Express integration
   * - Auto sets up Studio
   * 
   * @example
   * ```typescript
   * const trokky = await TrokkyExpress.setup({
   *   schemas: blogSchemas,
   *   storage: { adapter: 'filesystem', contentDir: './content', mediaDir: './media' },
   *   adminUser: { username: 'admin', email: 'admin@demo.com', password: 'demo123' },
   *   studio: { branding: { title: 'My CMS' } }
   * });
   * 
   * trokky.mount(app);
   * ```
   */
  public static async setup(config: UltimateExpressConfig): Promise<ExpressIntegration> {
    const logger = createLogger('express', 'UnifiedSetup')
    logger.info('🚀 Starting unified Trokky setup')

    try {
      // 1. Create storage adapter based on config
      const storageAdapter = await this.createStorageAdapter(config.storage)
      
      // 2. Create TrokkyConfig for core
      const coreConfig: TrokkyConfig = {
        storage: {
          adapter: config.storage.adapter,
          options: config.storage.options || {}
        },
        schemas: config.schemas,
        media: config.media,
        security: config.validation
      }
      
      // 3. Create and initialize TrokkyCore
      const coreOptions = {
        enableSecurity: config.enableSecurity ?? true,
        jwtSecret: config.jwtSecret || process.env.TROKKY_JWT_SECRET || this.generateSecureSecret()
      }
      
      const core = new TrokkyCore(coreConfig, storageAdapter, coreOptions)
      await core.init()
      logger.info('✅ TrokkyCore initialized')
      
      // 4. Create admin user if specified
      if (config.adminUser) {
        try {
          await core.createUser({
            username: config.adminUser.username,
            email: config.adminUser.email,
            password: config.adminUser.password,
            firstName: config.adminUser.firstName,
            lastName: config.adminUser.lastName,
            role: config.adminUser.role || 'admin'
          })
          logger.info('✅ Admin user created')
        } catch (error: any) {
          if (error.message.includes('already exists')) {
            logger.info('✅ Admin user already exists')
          } else {
            logger.warn('⚠️ Failed to create admin user', error)
          }
        }
      }
      
      // 5. Create Express integration config
      const expressConfig: ExpressIntegrationConfig = {
        core,
        basePath: config.basePath || '',
        corsOptions: config.corsOptions,
        authentication: config.authentication,
        rateLimiting: config.rateLimiting,
        staticRoutes: config.staticRoutes,
        fileUpload: config.fileUpload,
        bodyParser: config.bodyParser,
        security: config.security,
        studio: config.studio
      }
      
      // 6. Create final integration
      const integration = new TrokkyExpress(expressConfig)
      const result = await integration.createIntegration()
      
      logger.info('🎉 Unified setup complete!')
      return result
      
    } catch (error) {
      logger.error('❌ Unified setup failed', error)
      throw new Error(`Unified setup failed: ${error.message}`)
    }
  }

  /**
   * Legacy setup method for when you already have a TrokkyCore instance
   */
  public static async withCore(config: ExpressIntegrationConfig): Promise<ExpressIntegration> {
    const integration = new TrokkyExpress(config)
    return await integration.createIntegration()
  }

  /**
   * Legacy setup method that handles common mounting patterns (when you have existing TrokkyCore)
   * 
   * @param config - Configuration without basePath (will be set to empty)
   * @param mountPath - Path where routes will be mounted (e.g., '/api', '/api/v1')
   * @returns Integration ready to mount on the specified path
   */
  public static async setupForMount(config: Omit<ExpressIntegrationConfig, 'basePath'>, mountPath: string): Promise<{ integration: ExpressIntegration, mountPath: string }> {
    const integration = new TrokkyExpress({
      ...config,
      basePath: ''  // Always use empty basePath for mounting
    })
    
    return {
      integration: await integration.createIntegration(),
      mountPath
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
   * 🔥 ULTIMATE UNIFIED SETUP - Everything in one call!
   * 
   * Eliminates all boilerplate:
   * - Auto creates and initializes TrokkyCore
   * - Auto creates storage adapter
   * - Auto creates admin user
   * - Auto sets up Express integration
   * - Auto sets up Studio
   * 
   * @example
   * ```typescript
   * const trokky = await TrokkyExpress.ultimate({
   *   schemas: blogSchemas,
   *   storage: { adapter: 'filesystem', contentDir: './content', mediaDir: './media' },
   *   adminUser: { username: 'admin', email: 'admin@demo.com', password: 'demo123' },
   *   studio: { branding: { title: 'My CMS' } }
   * });
   * 
   * trokky.mount(app);
   * ```
   */
  public static async ultimate(config: UltimateExpressConfig): Promise<ExpressIntegration> {
    const logger = createLogger('express', 'UltimateSetup')
    logger.info('🚀 Starting ultimate Trokky setup')

    try {
      // 1. Create storage adapter based on config
      const storageAdapter = await this.createStorageAdapter(config.storage)
      
      // 2. Create TrokkyConfig for core
      const coreConfig: TrokkyConfig = {
        storage: {
          adapter: config.storage.adapter,
          options: config.storage.options || {}
        },
        schemas: config.schemas,
        media: config.media,
        security: config.validation
      }
      
      // 3. Create and initialize TrokkyCore
      const coreOptions = {
        enableSecurity: config.enableSecurity ?? true,
        jwtSecret: config.jwtSecret || process.env.TROKKY_JWT_SECRET || this.generateSecureSecret()
      }
      
      const core = new TrokkyCore(coreConfig, storageAdapter, coreOptions)
      await core.init()
      logger.info('✅ TrokkyCore initialized')
      
      // 4. Create admin user if specified
      if (config.adminUser) {
        try {
          await core.createUser({
            username: config.adminUser.username,
            email: config.adminUser.email,
            password: config.adminUser.password,
            firstName: config.adminUser.firstName,
            lastName: config.adminUser.lastName,
            role: config.adminUser.role || 'admin'
          })
          logger.info('✅ Admin user created')
        } catch (error: any) {
          if (error.message.includes('already exists')) {
            logger.info('✅ Admin user already exists')
          } else {
            logger.warn('⚠️ Failed to create admin user', error)
          }
        }
      }
      
      // 5. Create Express integration config
      const expressConfig: ExpressIntegrationConfig = {
        core,
        basePath: config.basePath || '',
        corsOptions: config.corsOptions,
        authentication: config.authentication,
        rateLimiting: config.rateLimiting,
        staticRoutes: config.staticRoutes,
        fileUpload: config.fileUpload,
        bodyParser: config.bodyParser,
        security: config.security,
        studio: config.studio
      }
      
      // 6. Create final integration
      const integration = new TrokkyExpress(expressConfig)
      const result = await integration.createIntegration()
      
      logger.info('🎉 Ultimate setup complete!')
      return result
      
    } catch (error) {
      logger.error('❌ Ultimate setup failed', error)
      throw new Error(`Ultimate setup failed: ${error.message}`)
    }
  }

  /**
   * Create storage adapter based on unified config
   */
  private static async createStorageAdapter(config: UltimateExpressConfig['storage']) {
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
        const { CloudflareAdapter } = await import('@trokky/adapter-cloudflare')
        return new CloudflareAdapter(config.options || {})
      }
      case 's3': {
        const { S3Adapter } = await import('@trokky/adapter-s3')
        return new S3Adapter(config.options || {})
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