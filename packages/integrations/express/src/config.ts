/**
 * Professional Trokky Express Configuration System
 * 
 * This provides a clean, type-safe configuration interface that can be used
 * both directly in TrokkyExpress.setup() and via trokky.config.ts files.
 */

import type { ContentSchema, UserRole } from '@trokky/core'

// Environment-aware configuration
export type TrokkyEnvironment = 'development' | 'production' | 'test'

// Storage configuration with strict typing
export interface StorageConfig {
  /** Storage adapter type */
  adapter: 'filesystem' | 'cloudflare' | 's3'
  /** Content directory path (filesystem adapter) */
  contentDir?: string
  /** Media directory path (filesystem adapter) */
  mediaDir?: string
  /** Auto-create directories if they don't exist */
  createDirs?: boolean
  /** Base URL for serving media files */
  mediaBaseUrl?: string
  /** Adapter-specific configuration */
  options?: {
    // Filesystem options
    encoding?: 'utf8' | 'utf16le'
    filePermissions?: string
    // Cloudflare options
    accountId?: string
    databaseId?: string
    // S3 and Cloudflare options (both use buckets)
    bucketName?: string
    region?: string
    accessKeyId?: string
    secretAccessKey?: string
  }
}

// Media processing configuration
export interface MediaConfig {
  /** Image processing engine */
  processor: 'none' | 'sharp' | 'cloudflare-images' | 'imagekit' | 'imgix'
  /** Auto-generated image variants */
  variants?: ImageVariant[]
  /** Upload limits */
  upload?: {
    maxFileSize?: number // bytes
    maxFiles?: number
    allowedMimeTypes?: string[]
  }
}

export interface ImageVariant {
  name: string
  width?: number
  height?: number
  format?: 'jpeg' | 'png' | 'webp' | 'avif'
  quality?: number
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
}

// Security configuration with environment awareness
export interface SecurityConfig {
  /** Enable JWT authentication (auto-enabled in production) */
  enabled?: boolean
  /** JWT secret key (required in production) */
  jwtSecret?: string
  /** Token expiration settings */
  tokens?: {
    accessTokenTtl?: string // e.g., '2h', '15m'
    refreshTokenTtl?: string // e.g., '7d', '30d'
    rememberMeTtl?: string // e.g., '30d', '90d'
  }
  /** Request validation */
  validation?: {
    input?: boolean
    schemas?: boolean
    permissions?: boolean
  }
  /** Rate limiting */
  rateLimit?: {
    enabled?: boolean
    windowMs?: number
    maxRequests?: number
    skipSuccessfulRequests?: boolean
  }
  /** Admin user auto-creation */
  adminUser?: {
    username: string
    email: string
    password: string
    firstName: string
    lastName: string
    role?: UserRole
  }
}

// HTTP server configuration
export interface ServerConfig {
  /** API base path */
  basePath?: string
  /** Port number (development only) */
  port?: number
  /** CORS configuration */
  cors?: {
    origin?: boolean | string | string[] | ((origin: string) => boolean)
    methods?: string[]
    allowedHeaders?: string[]
    credentials?: boolean
    maxAge?: number
  }
  /** Static file serving */
  static?: {
    /** Serve media files */
    media?: {
      path: string
      directory: string
      maxAge?: number
    }
    /** Serve Studio assets */
    assets?: {
      path: string
      directory: string
      maxAge?: number
    }
    /** Custom static routes */
    custom?: Array<{
      path: string
      directory: string
      maxAge?: number
    }>
  }
  /** Request body parsing */
  parsing?: {
    json?: {
      limit?: string
      strict?: boolean
    }
    urlencoded?: {
      limit?: string
      extended?: boolean
    }
  }
}

// Studio integration configuration
export interface StudioConfig {
  /** Enable Studio integration */
  enabled?: boolean
  /** Studio mount path */
  path?: string
  /** Authentication requirement */
  requireAuth?: boolean
  /** Studio branding */
  branding?: {
    title?: string
    logo?: string
    theme?: 'light' | 'dark' | 'system'
    colors?: {
      primary?: string
      accent?: string
    }
  }
  /** Content structure definition */
  structure?: any // TODO: Type this properly when structure system is finalized
  /** Custom field types */
  fields?: any[]
  /** Studio behavior settings */
  settings?: {
    pageSize?: number
    enableDrafts?: boolean
    enableVersioning?: boolean
    autoSave?: boolean
    autosaveInterval?: number // milliseconds
  }
  /** Session management */
  session?: {
    refreshBuffer?: number // milliseconds before expiry to auto-refresh
    warningBuffer?: number // milliseconds before expiry to show warning
    checkInterval?: number // check session validity every N milliseconds
    inactivityTimeout?: number // logout after N milliseconds of inactivity
  }
}

// Main configuration interface
export interface TrokkyConfig {
  /** Environment mode */
  env?: TrokkyEnvironment
  /** Content schemas */
  schemas: ContentSchema[]
  /** Storage configuration */
  storage: StorageConfig
  /** Media processing */
  media?: MediaConfig
  /** Security and authentication */
  security?: SecurityConfig
  /** HTTP server settings */
  server?: ServerConfig
  /** Studio integration */
  studio?: StudioConfig
}

// Configuration with smart defaults
export interface TrokkyConfigWithDefaults extends TrokkyConfig {
  env: TrokkyEnvironment
  media: Required<MediaConfig>
  security: Required<Omit<SecurityConfig, 'jwtSecret' | 'adminUser'>> & { 
    jwtSecret?: string
    adminUser?: SecurityConfig['adminUser']
  }
  server: Required<Omit<ServerConfig, 'port'>> & { port?: number }
  studio: Required<StudioConfig>
}

/**
 * Apply environment-aware defaults to configuration
 */
export function withDefaults(config: TrokkyConfig): TrokkyConfigWithDefaults {
  const env = config.env || (process.env.NODE_ENV as TrokkyEnvironment) || 'development'
  const isDev = env === 'development'
  const isProd = env === 'production'

  return {
    ...config,
    env,
    
    media: {
      processor: 'sharp',
      variants: [],
      upload: {
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxFiles: 10,
        allowedMimeTypes: [
          'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml',
          'video/mp4', 'video/webm',
          'application/pdf', 'text/plain'
        ]
      },
      ...config.media
    },
    
    security: {
      enabled: isProd, // Auto-enable in production
      jwtSecret: config.security?.jwtSecret || (isDev ? 'dev-secret-change-in-production' : undefined),
      tokens: {
        accessTokenTtl: '2h',
        refreshTokenTtl: '7d',
        rememberMeTtl: '30d',
        ...config.security?.tokens
      },
      validation: {
        input: true,
        schemas: true,
        permissions: isProd,
        ...config.security?.validation
      },
      rateLimit: {
        enabled: isProd,
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: isProd ? 100 : 1000,
        skipSuccessfulRequests: false,
        ...config.security?.rateLimit
      },
      adminUser: config.security?.adminUser
    },
    
    server: {
      basePath: '',
      port: isDev ? 3000 : undefined,
      cors: {
        origin: isDev ? ['http://localhost:5173', 'http://localhost:3000'] : false,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
      },
      static: {
        media: undefined, // Use API-based serving by default
        assets: undefined,
        custom: []
      },
      parsing: {
        json: { limit: '50mb', strict: false },
        urlencoded: { limit: '50mb', extended: true }
      },
      ...config.server
    },
    
    studio: {
      enabled: true,
      path: '/studio',
      requireAuth: true,
      branding: {
        title: 'Trokky CMS',
        theme: 'system'
      },
      structure: undefined,
      fields: [],
      settings: {
        pageSize: 20,
        enableDrafts: true,
        enableVersioning: false,
        autoSave: true,
        autosaveInterval: 30000 // 30 seconds
      },
      session: {
        refreshBuffer: 5 * 60 * 1000,    // 5 minutes
        warningBuffer: 10 * 60 * 1000,   // 10 minutes  
        checkInterval: 30 * 1000,        // 30 seconds
        inactivityTimeout: 30 * 60 * 1000 // 30 minutes
      },
      ...config.studio
    }
  }
}

/**
 * Define configuration with type safety and validation
 */
export function defineConfig(config: TrokkyConfig): TrokkyConfig {
  // Validate configuration
  if (!config.schemas || config.schemas.length === 0) {
    throw new Error('At least one schema must be defined')
  }
  
  if (!config.storage?.adapter) {
    throw new Error('Storage adapter must be specified')
  }
  
  const env = config.env || process.env.NODE_ENV || 'development'
  if (env === 'production' && !config.security?.jwtSecret) {
    throw new Error('JWT secret is required in production')
  }
  
  return config
}

/**
 * Load configuration from a TypeScript config file
 */
export async function loadConfig(configPath: string): Promise<TrokkyConfig> {
  try {
    // Dynamic import to load the config file
    const configModule = await import(configPath)
    const config = configModule.default || configModule
    
    if (!config) {
      throw new Error(`No default export found in ${configPath}`)
    }
    
    return config
  } catch (error) {
    throw new Error(`Failed to load config from ${configPath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

