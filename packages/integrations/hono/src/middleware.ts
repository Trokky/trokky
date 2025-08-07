import { cors } from 'hono/cors'
import { createLogger } from '@trokky/core'
import type { HonoIntegrationConfig, HonoMiddleware, CloudflareEnv, HonoContext } from './types.js'

/**
 * Creates Hono middleware stack for Trokky integration
 * Follows the same pattern as TrokkyExpressMiddleware
 */
export class TrokkyHonoMiddleware {
  private config: HonoIntegrationConfig

  constructor(config: HonoIntegrationConfig) {
    this.config = config
  }

  /**
   * Get all required middleware in correct order
   */
  public getMiddleware(env?: CloudflareEnv): HonoMiddleware[] {
    const middleware: HonoMiddleware[] = []

    // CORS middleware
    if (this.config.corsOptions) {
      middleware.push(this.createCorsMiddleware())
    }

    // Security headers
    if (this.config.authentication?.enabled) {
      middleware.push(this.createSecurityHeaders())
    }

    // Note: Body parsing is handled directly in the adapter
    // File upload is also handled directly in the adapter using FormData

    return middleware
  }

  /**
   * Create CORS middleware
   */
  private createCorsMiddleware(): HonoMiddleware {
    const corsOptions = this.config.corsOptions
    if (!corsOptions) {
      return async (c, next) => next()
    }

    // Convert function-based origin to string array for Hono
    let origin = corsOptions.origin
    if (typeof origin === 'function') {
      // For function-based origins, default to specific values
      origin = ['http://localhost:5173', 'https://localhost:5173']
    }

    return cors({
      origin: origin as any,
      credentials: corsOptions.credentials,
      allowMethods: corsOptions.allowMethods,
      allowHeaders: corsOptions.allowHeaders,
      exposeHeaders: corsOptions.exposeHeaders,
      maxAge: corsOptions.maxAge
    })
  }

  /**
   * Create security headers middleware
   */
  private createSecurityHeaders(): HonoMiddleware {
    return async (c: HonoContext, next: () => Promise<void>) => {
      // Basic security headers
      c.res.headers.set('X-Content-Type-Options', 'nosniff')
      c.res.headers.set('X-Frame-Options', 'DENY')
      c.res.headers.set('X-XSS-Protection', '1; mode=block')
      c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
      
      await next()
    }
  }

  /**
   * Create error handler middleware
   */
  public static createErrorHandler(): HonoMiddleware {
    const logger = createLogger('hono', 'ErrorHandler')
    
    return async (c: HonoContext, next: () => Promise<void>) => {
      try {
        await next()
      } catch (error) {
        logger.error('Unhandled error in Hono middleware', error)
        
        // Check if response was already sent
        if (c.finalized) {
          return
        }
        
        // Create error response
        const isDev = c.env.NODE_ENV === 'development'
        const errorResponse = {
          error: 'Internal Server Error',
          message: isDev && error instanceof Error ? error.message : 'An unexpected error occurred',
          ...(isDev && error instanceof Error && { stack: error.stack })
        }
        
        const response = c.json(errorResponse, 500)
        return response
      }
    }
  }
}