// Main exports for @trokky/hono package
export { TrokkyHono } from './integration.js'
export { HonoAdapter } from './adapter.js'
export { TrokkyHonoMiddleware } from './middleware.js'

// Configuration exports
export type { TrokkyConfig } from './config.js'
export { defineConfig, withDefaults, loadConfig } from './config.js'

// Type exports
export type {
  HonoIntegrationConfig,
  CloudflareEnv,
  HonoIntegration
} from './types.js'

// Re-export commonly used types from dependencies
export type { Context } from 'hono'