/**
 * Type definitions for Trokky Hono integration
 */

import type { Context } from 'hono'
import type { TrokkyCore, DataStorageAdapter, MediaStorageAdapter } from '@trokky/core'
import type { RoutesConfig } from '@trokky/routes'
import type { Hono } from 'hono'

/**
 * Cloudflare Worker environment bindings
 */
export interface CloudflareEnv {
  // D1 Database binding
  DB?: D1Database
  
  // R2 Bucket binding
  R2?: R2Bucket
  
  // Environment variables
  NODE_ENV?: string
  TROKKY_JWT_SECRET?: string
  TROKKY_ADMIN_EMAIL?: string
  TROKKY_ADMIN_PASSWORD?: string
  CLOUDFLARE_ACCOUNT_ID?: string
  CLOUDFLARE_R2_ACCESS_KEY_ID?: string
  CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string
}

/**
 * Configuration for Trokky Hono integration
 * Mirrors ExpressIntegrationConfig structure
 */
export interface HonoIntegrationConfig {
  // Core Trokky instance
  core: TrokkyCore
  
  // Base path for API routes
  basePath?: string
  
  // CORS configuration
  corsOptions?: {
    origin?: boolean | string | string[] | ((origin: string) => string | undefined | null)
    credentials?: boolean
    allowMethods?: string[]
    allowHeaders?: string[]
    exposeHeaders?: string[]
    maxAge?: number
  }
  
  // Static file serving configuration
  staticRoutes?: {
    media?: {
      mountPath: string
      directory: string
      maxAge?: number
    }
    assets?: {
      mountPath: string
      directory: string
      maxAge?: number
    }
    custom?: Array<{
      mountPath: string
      directory: string
      maxAge?: number
    }>
  }
  
  // File upload configuration
  fileUpload?: {
    maxFileSize?: number
    maxFiles?: number
    allowedMimeTypes?: string[]
  }
  
  // Body parsing configuration
  bodyParser?: {
    json?: {
      limit?: string
      strict?: boolean
    }
    urlencoded?: {
      limit?: string
      extended?: boolean
    }
  }
  
  // Authentication configuration
  authentication?: {
    enabled: boolean
    publicPaths?: string[]
  }
  
  // Rate limiting configuration
  rateLimiting?: {
    enabled: boolean
    windowMs?: number
    maxRequests?: number
    skipSuccessfulRequests?: boolean
  }
  
  // Studio integration configuration
  studio?: {
    enabled: boolean
    mount?: string
    auth?: boolean
    branding?: {
      title?: string
      logo?: string
      theme?: 'light' | 'dark' | 'system'
      colors?: {
        primary?: string
        accent?: string
      }
    }
    structure?: any
    customFields?: any[]
    config?: {
      pageSize?: number
      enableDrafts?: boolean
      enableVersioning?: boolean
      session?: {
        refreshBufferMs?: number
        warningBufferMs?: number
        checkIntervalMs?: number
        inactivityTimeoutMs?: number
      }
    }
  }
  
  // Optional adapter factories for Cloudflare Workers
  dataAdapter?: (env: CloudflareEnv) => Promise<DataStorageAdapter> | DataStorageAdapter
  mediaAdapter?: (env: CloudflareEnv) => Promise<MediaStorageAdapter> | MediaStorageAdapter
}

/**
 * Hono context with Cloudflare bindings
 */
export type HonoContext = Context<{ Bindings: CloudflareEnv }>

/**
 * Hono middleware function type
 */
export type HonoMiddleware = (c: HonoContext, next: () => Promise<void>) => Promise<void | Response>

/**
 * Hono route handler type
 */
export type HonoRouteHandler = (c: HonoContext) => Promise<Response>

/**
 * Complete Hono integration result
 * Mirrors ExpressIntegration structure
 */
export interface HonoIntegration {
  app: Hono<{ Bindings: CloudflareEnv }>
  staticApp: Hono<{ Bindings: CloudflareEnv }>
  studioApp?: Hono<{ Bindings: CloudflareEnv }>
  middleware: HonoMiddleware[]
  config: HonoIntegrationConfig
  mount: (baseApp: Hono, options?: { apiPath?: string; studioPath?: string }) => void
  fetch: (request: Request, env: CloudflareEnv, ctx: ExecutionContext) => Promise<Response>
}