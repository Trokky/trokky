import type { Request, Response, NextFunction, Router } from 'express'
import type { TrokkyCore, ContentSchema, UserRole } from '@trokky/core'
import type { RoutesConfig, HttpRequest, HttpResponse } from '@trokky/routes'

// Auto admin user creation
export interface AutoAdminUser {
  username: string
  email: string
  password: string
  firstName: string
  lastName: string
  role?: UserRole
}

// Studio configuration (matches Studio's StudioConfig interface)
export interface StudioIntegrationConfig {
  /** Enable Studio integration */
  enabled?: boolean

  /** Mount point for Studio (default: '/studio') */
  mount?: string

  /** Enable authentication */
  auth?: boolean

  /** Studio branding configuration */
  branding?: {
    title?: string
    logo?: string
    theme?: 'light' | 'dark' | 'system'
  }

  /** Custom structure configuration */
  structure?: any

  /** Custom field types to register */
  customFields?: any[]

  /** Additional Studio configuration */
  config?: {
    pageSize?: number
    enableDrafts?: boolean
    enableVersioning?: boolean

    /** Session management configuration */
    session?: {
      /** Auto-refresh token buffer in milliseconds (default: 30000) */
      refreshBufferMs?: number
      /** Warning display buffer in milliseconds (default: 90000) */
      warningBufferMs?: number
      /** Session check interval in milliseconds (default: 5000) */
      checkIntervalMs?: number
      /** Default session timeout in milliseconds (default: 2 hours) */
      defaultTimeoutMs?: number
      /** Extended session timeout for "Remember Me" in milliseconds (default: 7 days) */
      extendedTimeoutMs?: number
      /** Inactivity timeout in milliseconds (default: 30 minutes) */
      inactivityTimeoutMs?: number
    }
  }
}

// Express integration configuration
export interface ExpressIntegrationConfig extends RoutesConfig {
  // Core configuration
  core?: TrokkyCore

  // Base path for API routes
  basePath?: string

  // Server configuration (includes CORS)
  server?: any
  // File upload configuration
  fileUpload?: {
    maxFileSize?: number
    maxFiles?: number
    allowedMimeTypes?: string[]
    uploadPath?: string
  }

  // Request parsing configuration
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

  // Security headers
  security?: {
    enableHelmet?: boolean
    customHeaders?: Record<string, string>
  }

  // Studio integration
  studio?: StudioIntegrationConfig

  // Static routes configuration
  staticRoutes?: any
}

// Express request with file upload support
export interface ExpressRequestWithFiles extends Request {
  files?: any[] // Using any[] to avoid Multer type dependency
}

// Middleware function type
export type ExpressMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>

// Error handler middleware type (4 parameters)
export type ExpressErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => void

// Route handler adapter - use Express's built-in RequestHandler type
export type ExpressRouteHandler = (
  req: ExpressRequestWithFiles,
  res: Response,
  next: NextFunction
) => Promise<void>

// Express integration result
export interface ExpressIntegration {
  router: Router
  staticRouter: Router
  studioRouter?: Router
  middleware: ExpressMiddleware[]
  config: ExpressIntegrationConfig
  core?: TrokkyCore

  /** Auto-mount all routers to the Express app */
  mount: (
    app: any,
    options?: {
      apiPath?: string
      studioPath?: string
    }
  ) => void

  /** Get the currently mounted API path */
  getMountedApiPath: () => string

  /** Get the currently mounted Studio path */
  getMountedStudioPath: () => string

  /** Get both mounted paths */
  getMountedPaths: () => { apiPath: string; studioPath: string }
}
