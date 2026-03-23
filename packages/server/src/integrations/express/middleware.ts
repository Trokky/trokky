import express, { type Request, type Response, type NextFunction } from 'express'
// Removed multer import - using edge-compatible busboy in adapter instead
import { createLogger } from '../../core/index.js'
import type { ExpressIntegrationConfig, ExpressMiddleware, ExpressErrorHandler } from './types.js'

/**
 * Creates Express middleware stack for Trokky integration
 */
export class TrokkyExpressMiddleware {
  private config: ExpressIntegrationConfig

  constructor(config: ExpressIntegrationConfig) {
    this.config = config
  }

  /**
   * Get all required middleware in correct order
   */
  public getMiddleware(): ExpressMiddleware[] {
    const middleware: ExpressMiddleware[] = []

    // Security headers
    if (this.config.security?.customHeaders) {
      middleware.push(this.createSecurityHeaders())
    }

    // Body parsing middleware
    middleware.push(...this.createBodyParsers())

    // Note: File upload is now handled directly in the adapter using busboy
    // No middleware needed for edge-compatible upload handling

    // Error handling should be added by the user as the last middleware

    return middleware
  }

  /**
   * Create security headers middleware
   */
  private createSecurityHeaders(): ExpressMiddleware {
    const headers = this.config.security?.customHeaders || {}
    
    return (req: Request, res: Response, next: NextFunction) => {
      // Apply custom security headers
      for (const [header, value] of Object.entries(headers)) {
        res.setHeader(header, value)
      }
      
      // Basic security headers if not already set
      if (!res.getHeader('X-Content-Type-Options')) {
        res.setHeader('X-Content-Type-Options', 'nosniff')
      }
      
      if (!res.getHeader('X-Frame-Options')) {
        res.setHeader('X-Frame-Options', 'DENY')
      }
      
      if (!res.getHeader('X-XSS-Protection')) {
        res.setHeader('X-XSS-Protection', '1; mode=block')
      }
      
      next()
    }
  }

  /**
   * Create body parsing middleware with conditional parsing optimization
   */
  private createBodyParsers(): ExpressMiddleware[] {
    const middleware: ExpressMiddleware[] = []
    
    // Get limits from config, with reasonable defaults
    const jsonConfig = this.config.bodyParser?.json || {}
    const urlencodedConfig = this.config.bodyParser?.urlencoded || {}
    const jsonLimit = jsonConfig.limit || '10mb'
    const urlencodedLimit = urlencodedConfig.limit || '10mb'
    
    // Conditional body parsing middleware - skip multipart requests for efficiency
    const conditionalBodyParser: ExpressMiddleware = (req, res, next) => {
      // Skip body parsing for multipart/form-data requests - they're handled by busboy in the adapter
      const contentType = req.get('content-type') || '';
      if (contentType.includes('multipart/form-data')) {
        return next();
      }
      
      // Apply JSON parsing first
      express.json({
        limit: jsonLimit,
        strict: jsonConfig.strict !== false,
        ...jsonConfig
      })(req, res, (err) => {
        if (err) return next(err);
        
        // Then apply URL-encoded parsing
        express.urlencoded({
          limit: urlencodedLimit,
          extended: urlencodedConfig.extended !== false,
          ...urlencodedConfig
        })(req, res, next);
      });
    }
    
    middleware.push(conditionalBodyParser)
    return middleware
  }

  // File upload is now handled directly in the adapter using busboy for edge compatibility

  /**
   * Create error handling middleware
   */
  public static createErrorHandler(): ExpressErrorHandler {
    const logger = createLogger('express', 'ErrorHandler')
    
    return (err: Error, req: Request, res: Response, next: NextFunction) => {
      // Log error for debugging (skip in test environment)
      if (process.env.NODE_ENV !== 'test') {
        logger.error('Express middleware error', err)
      }
      
      // Don't handle if response already sent
      if (res.headersSent) {
        return next(err)
      }
      
      // Determine error status and message
      let status = 500
      let message = err.message || 'Internal Server Error'
      
      if (err.message.includes('not allowed') || err.message.includes('Invalid')) {
        status = 400
        message = err.message
      } else if (err.message.includes('too large') || err.message.includes('Too many')) {
        status = 413
        message = err.message
      } else if (err.message.includes('not found')) {
        status = 404
        message = err.message
      }
      
      // Send error response
      res.status(status).json({
        success: false,
        error: {
          code: status === 400 ? 'BAD_REQUEST' : 
                status === 404 ? 'NOT_FOUND' :
                status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR',
          message
        }
      })
    }
  }
}