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
  public createIntegration(): ExpressIntegration {
    const router = this.createRouter()
    const middleware = this.middleware.getMiddleware()

    return {
      router,
      middleware,
      config: this.config
    }
  }

  /**
   * Create Express router with all Trokky routes
   */
  public createRouter(): Router {
    const router = Router()

    // Get all routes from TrokkyRoutes
    const routeDefinitions = this.routes.getRoutes()
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
  public static setup(config: ExpressIntegrationConfig): ExpressIntegration {
    const integration = new TrokkyExpress(config)
    return integration.createIntegration()
  }

  /**
   * Recommended setup method that handles common mounting patterns
   * 
   * @param config - Configuration without basePath (will be set to empty)
   * @param mountPath - Path where routes will be mounted (e.g., '/api', '/api/v1')
   * @returns Integration ready to mount on the specified path
   */
  public static setupForMount(config: Omit<ExpressIntegrationConfig, 'basePath'>, mountPath: string): { integration: ExpressIntegration, mountPath: string } {
    const integration = new TrokkyExpress({
      ...config,
      basePath: ''  // Always use empty basePath for mounting
    })
    
    return {
      integration: integration.createIntegration(),
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