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

// Unified storage configuration (eliminates separate adapter creation)
export interface UnifiedStorageConfig {
  adapter: 'filesystem' | 'cloudflare' | 's3'
  contentDir?: string
  mediaDir?: string
  createDirs?: boolean
  mediaBaseUrl?: string
  // Add other adapter-specific options as needed
  options?: Record<string, any>
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

// 🔥 ULTIMATE UNIFIED CONFIG - Everything in one place!
export interface UltimateExpressConfig {
  // Core CMS Configuration (eliminates TrokkyCore setup)
  schemas: ContentSchema[]
  storage: UnifiedStorageConfig
  
  // Media processing
  media?: {
    imageProcessor?: 'none' | 'sharp' | 'cloudflare-images' | 'imagekit' | 'imgix' | 'custom'
    imageVariants?: Array<{
      name: string
      width?: number
      height?: number
      format?: 'jpeg' | 'png' | 'webp' | 'avif'
      quality?: number
      fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
    }>
  }
  
  // Security & Auth (eliminates separate options)
  enableSecurity?: boolean
  jwtSecret?: string
  
  // Auto admin user creation (eliminates manual createUser)
  adminUser?: AutoAdminUser
  
  // Validation
  validation?: {
    validateInput?: boolean
  }
  
  // Express routing configuration
  basePath?: string
  corsOptions?: {
    origin?: boolean | string | string[]
    methods?: string[]
    allowedHeaders?: string[]
    credentials?: boolean
  }
  authentication?: {
    enabled?: boolean
    publicPaths?: string[]
  }
  rateLimiting?: {
    enabled?: boolean
    windowMs?: number
    maxRequests?: number
  }
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
    [key: string]: { mountPath: string; directory: string; maxAge?: number } | undefined
  }
  
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

// Legacy Express configuration (for backward compatibility)
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
  files?: any[] // Using any[] to avoid Multer type dependency
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