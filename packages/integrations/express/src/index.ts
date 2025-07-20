// Main exports for @trokky/express package
export { TrokkyExpress } from './integration.js'
export { ExpressAdapter } from './adapter.js'
export { TrokkyExpressMiddleware } from './middleware.js'

// Type exports
export type {
  ExpressIntegrationConfig,
  ExpressRequestWithFiles,
  ExpressMiddleware,
  ExpressRouteHandler,
  ExpressIntegration
} from './types.js'

// Re-export commonly used types from dependencies
export type { Router, Request, Response, NextFunction } from 'express'