import type { Request, Response, NextFunction, Router } from 'express'
import type { TrokkyCore } from '@trokky/core'
import type { RoutesConfig, HttpRequest, HttpResponse } from '@trokky/routes'

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
  }
}

// Express-specific configuration
export interface ExpressIntegrationConfig extends RoutesConfig {
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
}

// Express request with file upload support
export interface ExpressRequestWithFiles extends Request {
  files?: Express.Multer.File[]
}

// Middleware function type
export type ExpressMiddleware = (req: Request, res: Response, next: NextFunction) => void | Promise<void>

// Error handler middleware type (4 parameters)
export type ExpressErrorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => void

// Route handler adapter - use Express's built-in RequestHandler type
export type ExpressRouteHandler = (req: ExpressRequestWithFiles, res: Response, next: NextFunction) => Promise<void>

// Express integration result
export interface ExpressIntegration {
  router: Router
  staticRouter: Router
  studioRouter?: Router
  middleware: ExpressMiddleware[]
  config: ExpressIntegrationConfig
  
  /** Auto-mount all routers to the Express app */
  mount: (app: any, options?: {
    apiPath?: string
    studioPath?: string
  }) => void
}