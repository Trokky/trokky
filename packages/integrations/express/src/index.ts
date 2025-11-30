// Main exports for @trokky/express package
export { TrokkyExpress } from './integration.js'
export { ExpressAdapter } from './adapter.js'
export { TrokkyExpressMiddleware } from './middleware.js'

// Server exports (recommended entry point)
export { startServer, createServer } from './server.js'

// Configuration exports
export { defineConfig, withDefaults, loadConfig } from './config.js'

// Type exports - server
export type { TrokkyServerInstance, ServerInfo } from './server.js'

// Type exports - integration
export type {
  ExpressIntegrationConfig,
  ExpressRequestWithFiles,
  ExpressMiddleware,
  ExpressRouteHandler,
  ExpressIntegration
} from './types.js'

// Type exports - configuration
export type {
  TrokkyConfig,
  TrokkyConfigWithDefaults,
  TrokkyEnvironment,
  StorageConfig,
  MediaConfig,
  ImageVariant,
  SecurityConfig,
  ServerConfig,
  ServerLifecycle,
  StudioConfig,
  OAuthConfig,
  CaptchaConfig,
  // New config types
  MailConfig,
  HooksConfig,
  DocumentEvent,
  UserEvent,
  WebhookConfig,
  EventHookHandler,
  CustomRoute,
  RouteGroup,
  RouteHandler,
  MiddlewareHandler,
} from './config.js'

// Re-export commonly used types from dependencies
export type { Router, Request, Response, NextFunction } from 'express'