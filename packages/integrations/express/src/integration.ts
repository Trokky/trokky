import { Router } from 'express'
import cors from 'cors'
import { TrokkyRoutes } from '@trokky/routes'
import { ExpressAdapter } from './adapter.js'
import { TrokkyExpressMiddleware } from './middleware.js'
import {
  createLogger,
  TrokkyCore,
  type TrokkyConfig,
  type TrokkyStorageAdapters,
  type DataStorageAdapter,
  type MediaStorageAdapter,
} from '@trokky/core'
import type { ExpressIntegrationConfig, ExpressIntegration } from './types.js'
import type {
  TrokkyConfig as NewTrokkyConfig,
  StorageConfig,
} from './config.js'
import { withDefaults } from './config.js'

/**
 * Main Express integration class for Trokky CMS
 *
 * Creates an Express router with all Trokky routes and middleware
 */
export class TrokkyExpress {
  public routes: TrokkyRoutes // Make public for debugging
  private adapter: ExpressAdapter
  private middleware: TrokkyExpressMiddleware
  private config: ExpressIntegrationConfig
  private logger = createLogger('express', 'TrokkyExpress')
  private mountedApiPath: string | null = null // Track the mounted API path
  private mountedStudioPath: string | null = null // Track the mounted Studio path

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
    this.adapter = new ExpressAdapter({
      maxFileSize: config.fileUpload?.maxFileSize || 50 * 1024 * 1024,
    })
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
    const mount = (
      app: any,
      options?: { apiPath?: string; studioPath?: string }
    ) => {
      const apiPath = options?.apiPath ?? '/api'
      const studioPath = options?.studioPath ?? '/studio'

      // Store the mounted paths for Studio config and external access
      this.mountedApiPath = apiPath
      this.mountedStudioPath = studioPath

      // Update Studio config with correct apiBasePath if Studio is enabled
      if (
        this.config.studio?.enabled &&
        (global as any).__TROKKY_STUDIO_CONFIG__
      ) {
        ;(global as any).__TROKKY_STUDIO_CONFIG__.apiBasePath = apiPath
        this.logger.debug('Updated Studio config with apiBasePath', {
          apiBasePath: apiPath,
        })
      }

      // Apply CORS middleware FIRST (before any routes)
      if (this.config.server?.cors) {
        this.logger.debug('Applying CORS middleware', {
          cors: this.config.server.cors,
        })
        app.use(cors(this.config.server.cors))
      }

      this.logger.info('Auto-mounting Trokky routers', {
        apiPath,
        studioPath,
        hasStudio: !!studioRouter,
      })

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
      mount,
      getMountedApiPath: () => this.getMountedApiPath(),
      getMountedStudioPath: () => this.getMountedStudioPath(),
      getMountedPaths: () => this.getMountedPaths(),
    }
  }

  /**
   * Create Express router with API routes only (excludes static routes)
   */
  public createRouter(): Router {
    const router = Router()

    // Apply middleware to router first
    const middleware = this.middleware.getMiddleware()
    for (const middlewareFn of middleware) {
      router.use(middlewareFn)
    }

    // Get only API routes from TrokkyRoutes (not static routes)
    const routeDefinitions = this.routes.getApiRoutes()
    this.logger.info('Creating Express router', {
      routeCount: routeDefinitions.length,
    })

    // Add each route to Express router
    for (const routeDef of routeDefinitions) {
      this.logger.debug('Registering route', {
        method: routeDef.method,
        path: routeDef.path,
      })
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
          this.logger.warn('Unsupported HTTP method', {
            method: routeDef.method,
          })
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
    this.logger.info('Creating static router', {
      routeCount: staticRoutes.length,
    })

    // Add each static route to Express router
    for (const routeDef of staticRoutes) {
      this.logger.debug('Registering static route', {
        method: routeDef.method,
        path: routeDef.path,
      })
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

    this.logger.info('Creating Studio router with dynamic config injection')
    const router = Router()

    try {
      // Import Studio assets utilities
      const { getStudioHTML, getStudioAsset } = await import(
        '@trokky/studio/dist/server/assets.js'
      )

      // Serve Studio HTML with dynamic config injection
      router.get('/', (req, res) => {
        try {
          const studioConfig = {
            mode: 'production' as const,
            apiBasePath: this.getMountedApiPath(), // Use dynamic API path
            basePath: this.getMountedStudioPath(), // Set the base path for routing
            backendUrl:
              req.protocol + '://' + req.get('host') + this.getMountedApiPath(), // Full backend URL for integrated Studio
            schemas: this.config.core?.getAllSchemas() || [],
            branding: this.config.studio?.branding,
            structure: this.config.studio?.structure,
            config: this.config.studio?.config || {},
            customFields: this.config.studio?.customFields || [],
          }

          const html = getStudioHTML(studioConfig, this.getMountedStudioPath())
          res.setHeader('Content-Type', 'text/html')
          res.send(html)
        } catch (error) {
          this.logger.error('Failed to serve Studio HTML', error)
          res.status(500).send('Studio temporarily unavailable')
        }
      })

      // Serve Studio assets
      router.get('/assets/:filename', (req, res) => {
        try {
          const asset = getStudioAsset(req.params.filename)
          if (!asset) {
            return res.status(404).send('Asset not found')
          }

          res.setHeader('Content-Type', asset.contentType)
          res.send(asset.content)
        } catch (error) {
          this.logger.error('Failed to serve Studio asset', error)
          res.status(500).send('Asset unavailable')
        }
      })

      // SPA catch-all route - serve Studio HTML for any unmatched Studio routes
      // This enables client-side routing to work on page refresh
      router.get('*', (req, res) => {
        try {
          const studioConfig = {
            mode: 'production' as const,
            apiBasePath: this.getMountedApiPath(), // Use dynamic API path
            basePath: this.getMountedStudioPath(), // Set the base path for routing
            backendUrl:
              req.protocol + '://' + req.get('host') + this.getMountedApiPath(), // Full backend URL for integrated Studio
            schemas: this.config.core?.getAllSchemas() || [],
            branding: this.config.studio?.branding,
            structure: this.config.studio?.structure,
            config: this.config.studio?.config || {},
            customFields: this.config.studio?.customFields || [],
          }

          const html = getStudioHTML(studioConfig, this.getMountedStudioPath())
          res.setHeader('Content-Type', 'text/html')
          res.send(html)
        } catch (error) {
          this.logger.error('Failed to serve Studio HTML for SPA route', error)
          res.status(500).send('Studio temporarily unavailable')
        }
      })

      return router
    } catch (error) {
      this.logger.error(
        'Failed to create Studio router - Studio assets not available',
        error
      )
      return undefined
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
   * Get the currently mounted API path (useful for dynamic URL construction)
   */
  public getMountedApiPath(): string {
    return this.mountedApiPath || '/api'
  }

  /**
   * Get the currently mounted Studio path
   */
  public getMountedStudioPath(): string {
    return this.mountedStudioPath || '/studio'
  }

  /**
   * Get both mounted paths for easy access
   */
  public getMountedPaths(): { apiPath: string; studioPath: string } {
    return {
      apiPath: this.getMountedApiPath(),
      studioPath: this.getMountedStudioPath(),
    }
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
   *   storage: {
   *     data: { adapter: 'filesystem-data', options: { contentDir: './content' } },
   *     media: { adapter: 'filesystem-media', options: { mediaDir: './media' } }
   *   },
   *   security: { adminUser: { username: 'admin', email: 'admin@demo.com', password: 'demo123' } }
   * })
   *
   * trokky.mount(app)
   * ```
   */
  public static async create(
    config: NewTrokkyConfig
  ): Promise<ExpressIntegration> {
    const logger = createLogger('express', 'ProfessionalSetup')
    logger.info('🎯 Starting professional Trokky setup')

    try {
      // Apply smart defaults based on environment
      const fullConfig = withDefaults(config)

      // 1. Create split storage adapters
      const storageAdapters = await this.createStorageAdaptersFromConfig(
        fullConfig.storage
      )

      // 2. Create TrokkyCore config (legacy format) - simplified since adapters are handled separately
      const coreConfig: TrokkyConfig = {
        storage: {
          adapter: 'split',
          options: {},
        },
        schemas: fullConfig.schemas,
        media: {
          imageProcessor: fullConfig.media.processor,
          imageVariants: fullConfig.media.variants || [],
          validation: {
            maxFileSize: fullConfig.media.upload?.maxFileSize,
            allowedTypes: fullConfig.media.upload?.allowedMimeTypes,
          },
        },
        security: {
          validateInput: fullConfig.security.validation?.input,
          rateLimitEnabled: fullConfig.security.rateLimit?.enabled,
        },
      }

      // 3. Create and initialize TrokkyCore with split adapters
      const coreOptions = {
        enableSecurity: fullConfig.security.enabled,
        jwtSecret: fullConfig.security.jwtSecret,
      }

      const core = new TrokkyCore(coreConfig, storageAdapters, coreOptions)
      await core.init()
      logger.info('✅ TrokkyCore initialized with professional config')

      // Set global studio config for API endpoint access
      if (fullConfig.studio?.enabled) {
        ;(global as any).__TROKKY_STUDIO_CONFIG__ = fullConfig.studio
        logger.debug('✅ Studio configuration registered globally')

        // Also register structure separately for structure service access
        if (fullConfig.studio.structure) {
          ;(global as any).__TROKKY_STRUCTURE__ = fullConfig.studio.structure
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
            role: fullConfig.security.adminUser.role || 'admin',
          })
          logger.info('✅ Admin user created')
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error)
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
        server: fullConfig.server, // Pass the entire server config including CORS
        staticRoutes:
          fullConfig.server.static.media || fullConfig.server.static.assets
            ? {
                ...(fullConfig.server.static.media && {
                  media: {
                    mountPath: fullConfig.server.static.media.path,
                    directory: fullConfig.server.static.media.directory,
                    maxAge: fullConfig.server.static.media.maxAge,
                  },
                }),
                ...(fullConfig.server.static.assets && {
                  assets: {
                    mountPath: fullConfig.server.static.assets.path,
                    directory: fullConfig.server.static.assets.directory,
                    maxAge: fullConfig.server.static.assets.maxAge,
                  },
                }),
              }
            : undefined,
        fileUpload: {
          maxFileSize: fullConfig.media.upload?.maxFileSize,
          maxFiles: fullConfig.media.upload?.maxFiles,
          allowedMimeTypes: fullConfig.media.upload?.allowedMimeTypes,
        },
        bodyParser: fullConfig.server.parsing,
        authentication: fullConfig.security.enabled
          ? {
              enabled: fullConfig.security.enabled,
              publicPaths: [],
              validateToken: async (token: string) => {
                // Check if it's a JWT token (3 parts separated by dots)
                const parts = token.split('.')
                if (parts.length === 3) {
                  try {
                    // Try to decode the header and payload to ensure they're valid base64
                    JSON.parse(Buffer.from(parts[0], 'base64url').toString())
                    JSON.parse(Buffer.from(parts[1], 'base64url').toString())
                    // For now, we'll accept any properly formatted JWT
                    // TODO: Implement proper signature validation with JWT secret
                    return true
                  } catch (error) {
                    return false // Invalid JWT structure
                  }
                }

                // Check if it's an API token (64-character hex string)
                if (token.length === 64 && /^[a-f0-9]{64}$/.test(token)) {
                  try {
                    // Validate API token through core engine
                    const result = await core.validateAppToken(token)
                    return result.valid
                  } catch (error) {
                    return false
                  }
                }

                return false // Neither valid JWT nor valid API token format
              },
            }
          : undefined,
        rateLimiting: fullConfig.security.rateLimit?.enabled
          ? fullConfig.security.rateLimit
          : undefined,
        studio: fullConfig.studio.enabled
          ? {
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
                  inactivityTimeoutMs:
                    fullConfig.studio.session?.inactivityTimeout,
                },
              },
            }
          : undefined,
      }

      // 6. Create final integration
      const integration = new TrokkyExpress(expressConfig)
      const result = await integration.createIntegration()

      logger.info('🎉 Professional setup complete!')
      return result
    } catch (error) {
      logger.error('❌ Professional setup failed', error)
      throw new Error(
        `Professional setup failed: ${error instanceof Error ? error.message : String(error)}`
      )
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
  private static async createStorageAdaptersFromConfig(
    config: StorageConfig
  ): Promise<TrokkyStorageAdapters> {
    const logger = createLogger('express', 'StorageAdapter')

    logger.info('🔄 Creating split storage adapters', {
      dataAdapter: config.data.adapter,
      mediaAdapter: config.media.adapter,
    })

    // Create data adapter
    const dataAdapter = await this.createDataAdapter(config.data)

    // Create media adapter
    const mediaAdapter = await this.createMediaAdapter(config.media)

    // Return split adapters object
    const splitAdapters: TrokkyStorageAdapters = {
      data: dataAdapter,
      media: mediaAdapter,
    }

    logger.info('✅ Split storage adapters created successfully')
    return splitAdapters
  }

  /**
   * Create data storage adapter using the registry system
   */
  private static async createDataAdapter(
    config: StorageConfig['data']
  ): Promise<DataStorageAdapter> {
    const { createAdapter } = await import('@trokky/core')

    try {
      return await createAdapter<DataStorageAdapter>(config.adapter, 'data', {
        // Filesystem data adapter options
        ...(config.adapter === 'filesystem-data' && {
          contentDir: config.options?.contentDir || './content',
          usersDir: config.options?.usersDir || './users',
          tokensDir: config.options?.tokensDir || './tokens',
          webhooksDir: config.options?.webhooksDir || './webhooks',
          settingsDir: config.options?.settingsDir || './settings',
          auditLogsDir: config.options?.auditLogsDir || './audit-logs',
          createDirs: config.options?.createDirs ?? true,
          prettyJson: config.options?.prettyJson ?? true,
          jsonSpaces: config.options?.jsonSpaces ?? 2,
          silent: config.options?.silent ?? false,
        }),
        // Cloudflare D1 adapter options
        ...(config.adapter === 'cloudflare-d1' && {
          database: config.options?.database,
          databaseName: config.options?.databaseName,
          tablePrefix: config.options?.tablePrefix,
          debug: config.options?.debug ?? false,
          enableFTS: config.options?.enableFTS ?? false,
          enableAuditLog: config.options?.enableAuditLog ?? false,
          migrations: config.options?.migrations,
        }),
        // Pass through any other options
        ...config.options,
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
  private static async createMediaAdapter(
    config: StorageConfig['media']
  ): Promise<MediaStorageAdapter> {
    const { createAdapter } = await import('@trokky/core')

    try {
      return await createAdapter<MediaStorageAdapter>(config.adapter, 'media', {
        // Filesystem media adapter options
        ...(config.adapter === 'filesystem-media' && {
          mediaDir: config.options?.mediaDir || './media',
          createDirs: config.options?.createDirs ?? true,
          prettyJson: config.options?.prettyJson ?? true,
          jsonSpaces: config.options?.jsonSpaces ?? 2,
          mediaBaseUrl: config.options?.mediaBaseUrl || '/media',
          silent: config.options?.silent ?? false,
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
          cspConfig: config.options?.cspConfig,
        }),
        // Pass through any other options
        ...config.options,
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
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }
}
