import { Hono } from 'hono'
import { TrokkyRoutes } from '@trokky/routes'
import { HonoAdapter } from './adapter.js'
import { TrokkyHonoMiddleware } from './middleware.js'
import { createLogger, TrokkyCore, type TrokkyConfig, type TrokkyStorageAdapters, type DataStorageAdapter as StorageAdapter, type MediaStorageAdapter as MediaAdapter } from '@trokky/core'
import type { HonoIntegrationConfig, HonoIntegration, CloudflareEnv } from './types.js'
import type { TrokkyConfig as NewTrokkyConfig, StorageConfig } from './config.js'
import { withDefaults } from './config.js'

/**
 * Main Hono integration class for Trokky CMS
 * 
 * Creates a Hono app with all Trokky routes and middleware
 * Follows the same pattern as TrokkyExpress
 */
export class TrokkyHono {
  public routes: TrokkyRoutes  // Make public for debugging
  private adapter: HonoAdapter
  private middleware: TrokkyHonoMiddleware
  private config: HonoIntegrationConfig
  private logger = createLogger('hono', 'TrokkyHono')

  constructor(config: HonoIntegrationConfig) {
    this.config = config
    
    // Validate configuration to prevent common mounting issues
    if (config.basePath && config.basePath.startsWith('/api')) {
      this.logger.warn(
        'basePath starts with "/api" but routes will be mounted on a path. ' +
        'This may cause double paths like "/api/api/v1/*". ' +
        'Consider using basePath: "" and mounting the app on your desired path.',
        { basePath: config.basePath }
      )
    }
    
    this.routes = new TrokkyRoutes({ 
      core: config.core,
      basePath: config.basePath
      // Remove corsOptions - let Hono middleware handle CORS
    })
    this.adapter = new HonoAdapter()
    this.middleware = new TrokkyHonoMiddleware(config)
  }

  /**
   * Create complete Hono integration with app and middleware
   */
  public async createIntegration(env?: CloudflareEnv): Promise<HonoIntegration> {
    const app = this.createApp(env)
    const staticApp = this.createStaticApp(env)
    const middleware = this.middleware.getMiddleware(env)
    
    // Create Studio app if enabled
    let studioApp: Hono<{ Bindings: CloudflareEnv }> | undefined
    if (this.config.studio?.enabled !== false) {
      studioApp = await this.createStudioApp(env)
    }

    // Create auto-mount function
    const mount = (baseApp: Hono, options?: { apiPath?: string; studioPath?: string }) => {
      const apiPath = options?.apiPath ?? '/api'
      const studioPath = options?.studioPath ?? '/studio'
      
      this.logger.info('Auto-mounting Trokky apps', { apiPath, studioPath, hasStudio: !!studioApp })
      
      // Mount API routes
      baseApp.route(apiPath, app)
      
      // Mount static routes at root level (no authentication)
      baseApp.route('/', staticApp)
      
      // Mount Studio if enabled
      if (studioApp) {
        baseApp.route(studioPath, studioApp)
      }
    }

    // Create fetch handler for Cloudflare Workers
    const fetch = async (request: Request, env: CloudflareEnv, ctx: ExecutionContext) => {
      try {
        // Initialize storage adapters with Cloudflare bindings
        if (this.config.dataAdapter && this.config.mediaAdapter) {
          const dataAdapter = await this.config.dataAdapter(env)
          const mediaAdapter = await this.config.mediaAdapter(env)
          // Note: Routes don't support dynamic adapter setting in this architecture
          // Storage is handled at the core level during initialization
        }

        // Create and return app with env context
        const currentApp = this.createApp(env)
        return currentApp.fetch(request, env, ctx)

      } catch (error) {
        this.logger.error('Worker fetch handler error', error)
        return new Response(`Worker Error: ${error instanceof Error ? error.message : String(error)}`, { 
          status: 500,
          headers: { 'Content-Type': 'text/plain' }
        })
      }
    }

    return {
      app,
      staticApp,
      studioApp,
      middleware,
      config: this.config,
      mount,
      fetch
    }
  }

  /**
   * Create Hono app with API routes only (excludes static routes)
   */
  public createApp(env?: CloudflareEnv): Hono<{ Bindings: CloudflareEnv }> {
    const app = new Hono<{ Bindings: CloudflareEnv }>()

    // Apply middleware to app first
    const middleware = this.middleware.getMiddleware(env)
    for (const middlewareFn of middleware) {
      app.use('*', middlewareFn)
    }

    // Get only API routes from TrokkyRoutes (not static routes)
    const routeDefinitions = this.routes.getApiRoutes()
    this.logger.info('Creating Hono app', { routeCount: routeDefinitions.length })
    
    // Add each route to Hono app
    for (const routeDef of routeDefinitions) {
      // Only log route registration in very verbose mode (not in normal debug)
      // this.logger.debug('Registering route', { method: routeDef.method, path: routeDef.path })
      const honoHandler = this.adapter.handleRoute(routeDef.handler)
      
      // Map HTTP methods to Hono app methods
      switch (routeDef.method) {
        case 'GET':
          app.get(routeDef.path, honoHandler)
          break
        case 'POST':
          app.post(routeDef.path, honoHandler)
          break
        case 'PUT':
          app.put(routeDef.path, honoHandler)
          break
        case 'DELETE':
          app.delete(routeDef.path, honoHandler)
          break
        case 'PATCH':
          app.patch(routeDef.path, honoHandler)
          break
        case 'OPTIONS':
          app.options(routeDef.path, honoHandler)
          break
        default:
          this.logger.warn('Unsupported HTTP method', { method: routeDef.method })
      }
    }

    return app
  }

  /**
   * Create Hono app with static routes only (excludes API routes)
   */
  public createStaticApp(env?: CloudflareEnv): Hono<{ Bindings: CloudflareEnv }> {
    const app = new Hono<{ Bindings: CloudflareEnv }>()

    // Get only static routes from TrokkyRoutes
    const staticRoutes = this.routes.getStaticRoutes()
    this.logger.info('Creating static app', { routeCount: staticRoutes.length })
    
    // Add each static route to Hono app
    for (const routeDef of staticRoutes) {
      // Only log route registration in very verbose mode (not in normal debug)
      // this.logger.debug('Registering static route', { method: routeDef.method, path: routeDef.path })
      const honoHandler = this.adapter.handleRoute(routeDef.handler)
      
      // Static routes are typically GET only
      app.get(routeDef.path, honoHandler)
    }

    return app
  }

  /**
   * Create Studio app if Studio integration is enabled
   */
  public async createStudioApp(env?: CloudflareEnv): Promise<Hono<{ Bindings: CloudflareEnv }> | undefined> {
    if (!this.config.studio) {
      return undefined
    }

    const studioApp = new Hono<{ Bindings: CloudflareEnv }>()
    
    // Studio routes are typically static/spa routes, use static routes or implement studio-specific handler
    studioApp.get('/*', (c) => {
      // Basic Studio SPA handler - serve Studio files
      return c.text('Studio app placeholder - integrate with @trokky/studio when available')
    })

    this.logger.info('Studio app created successfully')
    return studioApp
  }

  /**
   * Get just the middleware array
   */
  public getMiddleware(env?: CloudflareEnv) {
    return this.middleware.getMiddleware(env)
  }

  /**
   * 🎯 PROFESSIONAL SETUP - Clean, type-safe configuration
   * 
   * Uses the new professional configuration system with:
   * - Organized config sections (storage, media, security, server, studio)
   * - Environment-aware defaults
   * - Better TypeScript auto-completion
   * - Integration with trokky.config.ts
   */
  public static async create(config: NewTrokkyConfig): Promise<HonoIntegration> {
    const logger = createLogger('hono', 'ProfessionalSetup')
    logger.info('🎯 Starting professional Trokky Hono setup')

    try {
      // Apply smart defaults based on environment
      const fullConfig = withDefaults(config)
      
      // 1. Create split storage adapters
      const storageAdapters = await this.createStorageAdaptersFromConfig(fullConfig.storage)
      
      // 2. Create TrokkyCore config (legacy format)
      const coreConfig: TrokkyConfig = {
        storage: {
          adapter: 'split',
          options: {}
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
      
      // 3. Create and initialize TrokkyCore with split adapters
      const coreOptions = {
        enableSecurity: fullConfig.security.enabled,
        jwtSecret: fullConfig.security.jwtSecret
      }
      
      const core = new TrokkyCore(coreConfig, storageAdapters, coreOptions)
      await core.init()
      logger.info('✅ TrokkyCore initialized with professional config')
      
      // Set global studio config for API endpoint access
      if (fullConfig.studio?.enabled) {
        (global as any).__TROKKY_STUDIO_CONFIG__ = fullConfig.studio
        logger.debug('✅ Studio configuration registered globally')
        
        // Also register structure separately for structure service access
        if (fullConfig.studio.structure) {
          (global as any).__TROKKY_STRUCTURE__ = fullConfig.studio.structure
          logger.debug('✅ Structure configuration registered globally')
        }
      }
      
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
      
      // 5. Map professional config to Hono integration config
      const honoConfig: HonoIntegrationConfig = {
        core,
        basePath: fullConfig.server.basePath,
        corsOptions: fullConfig.server.cors ? {
          origin: typeof fullConfig.server.cors.origin === 'function' 
            ? ['https://localhost:5173', 'http://localhost:5173'] // Fallback for function origins
            : fullConfig.server.cors.origin,
          credentials: fullConfig.server.cors.credentials,
          allowMethods: fullConfig.server.cors.methods || ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
          allowHeaders: fullConfig.server.cors.allowedHeaders || ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
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
        rateLimiting: fullConfig.security.rateLimit?.enabled ? {
          enabled: fullConfig.security.rateLimit.enabled,
          windowMs: fullConfig.security.rateLimit.windowMs,
          maxRequests: fullConfig.security.rateLimit.maxRequests,
          skipSuccessfulRequests: fullConfig.security.rateLimit.skipSuccessfulRequests
        } : undefined,
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
      const integration = new TrokkyHono(honoConfig)
      const result = await integration.createIntegration()
      
      logger.info('🎉 Professional Hono setup complete!')
      return result
      
    } catch (error) {
      logger.error('❌ Professional Hono setup failed', error)
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
   * Create split storage adapters from configuration
   * Split-first architecture: always creates separate data and media adapters
   */
  private static async createStorageAdaptersFromConfig(config: StorageConfig): Promise<TrokkyStorageAdapters> {
    const logger = createLogger('hono', 'StorageAdapter')
    
    logger.info('🔄 Creating split storage adapters', {
      dataAdapter: config.data.adapter,
      mediaAdapter: config.media.adapter
    })
    
    // Create data adapter
    const dataAdapter = await this.createDataAdapter(config.data) as StorageAdapter
    
    // Create media adapter  
    const mediaAdapter = await this.createMediaAdapter(config.media) as MediaAdapter
    
    // Return split adapters object
    const splitAdapters: TrokkyStorageAdapters = {
      data: dataAdapter,
      media: mediaAdapter
    }
    
    logger.info('✅ Split storage adapters created successfully')
    return splitAdapters
  }

  /**
   * Create data storage adapter using the registry system
   */
  private static async createDataAdapter(config: StorageConfig['data']) {
    const { createAdapter } = await import('@trokky/core')
    
    try {
      return await createAdapter(config.adapter, 'data', {
        // Filesystem data adapter options
        ...(config.adapter === 'filesystem-data' && {
          contentDir: config.options?.contentDir || './content',
          usersDir: config.options?.usersDir || './users', 
          tokensDir: config.options?.tokensDir || './tokens',
          createDirs: config.options?.createDirs ?? true,
          prettyJson: config.options?.prettyJson ?? true,
          jsonSpaces: config.options?.jsonSpaces ?? 2,
          silent: config.options?.silent ?? false
        }),
        // Cloudflare D1 adapter options
        ...(config.adapter === 'cloudflare-d1' && {
          database: config.options?.database,
          databaseName: config.options?.databaseName,
          tablePrefix: config.options?.tablePrefix,
          debug: config.options?.debug ?? false,
          enableFTS: config.options?.enableFTS ?? false,
          enableAuditLog: config.options?.enableAuditLog ?? false,
          migrations: config.options?.migrations
        }),
        // Pass through any other options
        ...config.options
      })
    } catch (error) {
      throw new Error(
        `Failed to create data adapter "${config.adapter}": ${error instanceof Error ? error.message : String(error)}\n\n` +
        `Available data adapters depend on imported packages:\n` +
        `- 'filesystem-data': Requires @trokky/adapter-filesystem-data (Node.js only)\n` +
        `- 'cloudflare-d1': Requires @trokky/adapter-cloudflare-d1 (Edge runtime)\n` +
        `- 'dynamodb': Requires @trokky/adapter-dynamodb\n\n` +
        `Make sure the required adapter package is installed and imported.`
      )
    }
  }
  
  /**
   * Create media storage adapter using the registry system
   */
  private static async createMediaAdapter(config: StorageConfig['media']) {
    const { createAdapter } = await import('@trokky/core')
    
    try {
      return await createAdapter(config.adapter, 'media', {
        // Filesystem media adapter options
        ...(config.adapter === 'filesystem-media' && {
          mediaDir: config.options?.mediaDir || './media',
          createDirs: config.options?.createDirs ?? true,
          prettyJson: config.options?.prettyJson ?? true,
          jsonSpaces: config.options?.jsonSpaces ?? 2,
          mediaBaseUrl: config.options?.mediaBaseUrl || '/media',
          silent: config.options?.silent ?? false
        }),
        // Cloudflare R2 adapter options
        ...(config.adapter === 'cloudflare-r2' && {
          bucket: config.options?.bucket,
          bucketName: config.options?.bucketName,
          keyPrefix: config.options?.keyPrefix,
          debug: config.options?.debug ?? false,
          cacheControl: config.options?.cacheControl,
          defaultMetadata: config.options?.defaultMetadata,
          autoContentType: config.options?.autoContentType ?? true,
          maxFileSize: config.options?.maxFileSize,
          allowPublicUrls: config.options?.allowPublicUrls ?? false,
          customDomain: config.options?.customDomain,
          defaultUrlExpiry: config.options?.defaultUrlExpiry ?? 3600,
          maxUrlExpiry: config.options?.maxUrlExpiry ?? 86400,
          accountId: config.options?.accountId,
          accessKeyId: config.options?.accessKeyId,
          secretAccessKey: config.options?.secretAccessKey,
          cspConfig: config.options?.cspConfig
        }),
        // Pass through any other options
        ...config.options
      })
    } catch (error) {
      throw new Error(
        `Failed to create media adapter "${config.adapter}": ${error instanceof Error ? error.message : String(error)}\n\n` +
        `Available media adapters depend on imported packages:\n` +
        `- 'filesystem-media': Requires @trokky/adapter-filesystem-media (Node.js only)\n` +
        `- 'cloudflare-r2': Requires @trokky/adapter-cloudflare-r2 (Edge runtime)\n` +
        `- 's3': Requires @trokky/adapter-s3\n\n` +
        `Make sure the required adapter package is installed and imported.`
      )
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