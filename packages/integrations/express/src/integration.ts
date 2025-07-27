import { Router } from 'express'
import { TrokkyRoutes } from '@trokky/routes'
import { ExpressAdapter } from './adapter.js'
import { TrokkyExpressMiddleware } from './middleware.js'
import { createLogger } from '@trokky/core'
import type { ExpressIntegrationConfig, ExpressIntegration } from './types.js'

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

    return {
      router,
      staticRouter,
      studioRouter,
      middleware,
      config: this.config
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
        config: this.config.studio.config
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
   * Quick setup method for common Express integration
   */
  public static async setup(config: ExpressIntegrationConfig): Promise<ExpressIntegration> {
    const integration = new TrokkyExpress(config)
    return await integration.createIntegration()
  }

  /**
   * Recommended setup method that handles common mounting patterns
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
}