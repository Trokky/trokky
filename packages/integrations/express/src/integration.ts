import { Router } from 'express'
import { TrokkyRoutes } from '@trokky/routes'
import { ExpressAdapter } from './adapter.js'
import { TrokkyExpressMiddleware } from './middleware.js'
import type { ExpressIntegrationConfig, ExpressIntegration } from './types.js'

/**
 * Main Express integration class for Trokky CMS
 * 
 * Creates an Express router with all Trokky routes and middleware
 */
export class TrokkyExpress {
  private routes: TrokkyRoutes
  private adapter: ExpressAdapter
  private middleware: TrokkyExpressMiddleware
  private config: ExpressIntegrationConfig

  constructor(config: ExpressIntegrationConfig) {
    this.config = config
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

    // Add each route to Express router
    for (const routeDef of routeDefinitions) {
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
          console.warn(`Unsupported HTTP method: ${routeDef.method}`)
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