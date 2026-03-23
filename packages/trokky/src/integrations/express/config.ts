/**
 * Professional Trokky Express Configuration System
 *
 * This provides a clean, type-safe configuration interface that can be used
 * both directly in TrokkyExpress.setup() and via trokky.config.ts files.
 */

import type { ContentSchema, UserRole, TrokkyStorageAdapters, DataStorageAdapter, MediaStorageAdapter, PasskeyConfig } from '../../core/index.js'
import type { MailAdapter, TemplateRenderer } from '../../mail/index.js'
import type { Request, Response, NextFunction, Express } from 'express'

// Environment-aware configuration
export type TrokkyEnvironment = 'development' | 'production' | 'test'

// Storage configuration (SPLIT-FIRST ARCHITECTURE)
export interface StorageConfig {
  /** Data storage adapter configuration */
  data: {
    adapter: 'filesystem-data' | 'cloudflare-d1' | 'dynamodb' | 'postgres-data'
    options?: {
      // Filesystem data options
      contentDir?: string
      usersDir?: string
      tokensDir?: string
      webhooksDir?: string
      settingsDir?: string
      auditLogsDir?: string
      createDirs?: boolean
      prettyJson?: boolean
      jsonSpaces?: number
      silent?: boolean
      // Cloudflare D1 options
      database?: any // D1Database binding
      databaseName?: string
      tablePrefix?: string
      debug?: boolean
      enableFTS?: boolean
      enableAuditLog?: boolean
      migrations?: string[]
      // DynamoDB options
      region?: string
      accessKeyId?: string
      secretAccessKey?: string
      // PostgreSQL data options
      connection?: string
      schema?: string
      pool?: {
        max?: number
        idleTimeoutMillis?: number
        connectionTimeoutMillis?: number
      }
      useMigrations?: boolean
      dropExisting?: boolean
    }
  }
  /** Media storage adapter configuration */
  media: {
    adapter: 'filesystem-media' | 'cloudflare-r2' | 's3'
    options?: {
      // Filesystem media options
      mediaDir?: string
      createDirs?: boolean
      prettyJson?: boolean
      jsonSpaces?: number
      mediaBaseUrl?: string
      silent?: boolean
      // Cloudflare R2 options
      bucket?: any // R2Bucket binding
      bucketName?: string
      keyPrefix?: string
      debug?: boolean
      cacheControl?: string
      defaultMetadata?: Record<string, string>
      autoContentType?: boolean
      maxFileSize?: number
      allowPublicUrls?: boolean
      customDomain?: string
      defaultUrlExpiry?: number
      maxUrlExpiry?: number
      accountId?: string
      accessKeyId?: string
      secretAccessKey?: string
      cspConfig?: {
        enabled?: boolean
        defaultPolicy?: string
        policies?: Record<string, string>
        additionalDirectives?: string[]
        reportUri?: string
      }
      // S3 options
      region?: string
    }
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
  /** Media serving configuration */
  serving?: {
    mode?: 'api' | 'static'
    staticBasePath?: string
    customDomain?: string
  }
  /**
   * Custom media URL generator.
   * Can be either a function or a configuration object for Studio.
   */
  mediaUrlGenerator?:
    | ((media: { _id: string; filename?: string; mimeType?: string }) => string)
    | {
        options?: {
          apiBasePath?: string
          mediaConfig?: {
            serving?: {
              mode?: 'api' | 'static'
              baseUrl?: string
            }
          }
        }
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
  /** Crypto adapter options for password hashing */
  cryptoOptions?: {
    /** Force a specific adapter type: 'node' for bcrypt, 'webcrypto' for PBKDF2, 'auto' for auto-detect */
    adapterType?: 'node' | 'webcrypto' | 'auto'
    /** Salt rounds for password hashing (default: 12) */
    saltRounds?: number
  }
  /** Passkey/WebAuthn configuration for passwordless authentication */
  passkey?: PasskeyConfig
}

// =============================================================================
// SERVER LIFECYCLE CONFIGURATION
// =============================================================================

/**
 * Server lifecycle hooks for custom initialization and cleanup
 */
export interface ServerLifecycle {
  /**
   * Called before the server starts, after Express app is created
   * Use this to add custom middleware or configuration
   */
  beforeStart?: (app: Express) => Promise<void> | void
  /**
   * Called after the server starts listening
   * Use this for logging, health checks, or external service registration
   */
  afterStart?: (app: Express, port: number) => Promise<void> | void
  /**
   * Called before the server shuts down
   * Use this for cleanup, closing connections, etc.
   */
  beforeShutdown?: () => Promise<void> | void
  /**
   * Called on uncaught exceptions
   * Use this for error reporting/logging
   */
  onError?: (error: Error) => Promise<void> | void
}

// HTTP server configuration
export interface ServerConfig {
  /** API base path */
  basePath?: string
  /** Port number (development only) */
  port?: number
  /** CORS configuration */
  cors?: {
    origin?: boolean | string | string[] | ((origin: string) => boolean) | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => void)
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
  /** Server lifecycle hooks */
  lifecycle?: ServerLifecycle
  /** Trust proxy setting for Express (for reverse proxies) */
  trustProxy?: boolean | number | string
}

// Studio integration configuration
export interface StudioConfig {
  /** Enable Studio integration */
  enabled?: boolean
  /** Studio mount path */
  path?: string
  /** API URL for Studio to connect to (for external Studio deployments) */
  apiUrl?: string
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

// =============================================================================
// MAIL CONFIGURATION
// =============================================================================

/**
 * Mail service configuration for system emails
 * Handles password reset, user invitations, notifications, etc.
 */
export interface MailConfig {
  /** Mail adapter instance (Resend, SMTP, SES, etc.) */
  adapter: MailAdapter
  /** Custom template renderer for email templates */
  templateRenderer?: TemplateRenderer
  /** Default sender email address */
  defaultFrom?: string
  /** Default sender display name */
  defaultFromName?: string
  /** Enable/disable specific notification types */
  notifications?: {
    /** Send email on password reset request */
    passwordReset?: boolean
    /** Send email when password is changed */
    passwordChanged?: boolean
    /** Send welcome email when user is created */
    userCreated?: boolean
    /** Send invitation email when user is invited */
    userInvited?: boolean
    /** Send security alerts (suspicious login, etc.) */
    securityAlerts?: boolean
  }
  /** Enable debug logging for mail operations */
  debug?: boolean
}

// =============================================================================
// HOOKS & EVENTS CONFIGURATION
// =============================================================================

/**
 * Event payload for document-related events
 */
export interface DocumentEvent {
  /** Event type identifier */
  type: string
  /** Schema/collection name */
  collection: string
  /** The document data */
  document: Record<string, unknown>
  /** Previous document state (for updates) */
  previousDocument?: Record<string, unknown>
  /** User who triggered the event */
  user?: {
    id: string
    username: string
    email: string
  }
  /** Event timestamp */
  timestamp: Date
}

/**
 * Event payload for user-related events
 */
export interface UserEvent {
  /** Event type identifier */
  type: string
  /** User data */
  user: {
    id: string
    username: string
    email: string
    firstName?: string
    lastName?: string
    role: string
  }
  /** Additional event metadata */
  metadata?: Record<string, unknown>
  /** Event timestamp */
  timestamp: Date
}

/**
 * Webhook configuration for external integrations
 */
export interface WebhookConfig {
  /** Webhook endpoint URL */
  url: string
  /** Events to trigger this webhook */
  events: string[]
  /** Secret for webhook signature verification */
  secret?: string
  /** Custom headers to include in webhook requests */
  headers?: Record<string, string>
  /** Retry configuration */
  retry?: {
    /** Maximum retry attempts */
    maxAttempts?: number
    /** Initial delay in milliseconds */
    initialDelay?: number
    /** Backoff multiplier */
    backoffMultiplier?: number
  }
}

/**
 * Event hook handler type
 */
export type EventHookHandler<T = DocumentEvent | UserEvent> = (event: T) => Promise<void> | void

/**
 * Hooks configuration for event handling
 */
export interface HooksConfig {
  // Document lifecycle events
  'document.created'?: EventHookHandler<DocumentEvent>
  'document.updated'?: EventHookHandler<DocumentEvent>
  'document.deleted'?: EventHookHandler<DocumentEvent>
  'document.published'?: EventHookHandler<DocumentEvent>
  'document.unpublished'?: EventHookHandler<DocumentEvent>

  // User lifecycle events
  'user.created'?: EventHookHandler<UserEvent>
  'user.updated'?: EventHookHandler<UserEvent>
  'user.deleted'?: EventHookHandler<UserEvent>
  'user.login'?: EventHookHandler<UserEvent>
  'user.logout'?: EventHookHandler<UserEvent>

  // Media events
  'media.uploaded'?: EventHookHandler<DocumentEvent>
  'media.deleted'?: EventHookHandler<DocumentEvent>

  // External webhooks (outbound HTTP calls)
  webhooks?: WebhookConfig[]
}

// =============================================================================
// CUSTOM ROUTES CONFIGURATION
// =============================================================================

/**
 * Route handler function type
 */
export type RouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void

/**
 * Middleware function type
 */
export type MiddlewareHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void> | void

/**
 * Custom route definition
 */
export interface CustomRoute {
  /** Route path (Express-style, e.g., '/api/forms/contact') */
  path: string
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  /** Route handler function */
  handler: RouteHandler
  /** Middleware to apply to this route */
  middleware?: MiddlewareHandler[]
  /**
   * Authentication requirement:
   * - true: Requires any authenticated user
   * - 'admin': Requires admin role
   * - 'public': No authentication required (default)
   */
  auth?: boolean | 'admin' | 'public'
  /** Route description (for documentation) */
  description?: string
}

/**
 * Route group for organizing related routes
 */
export interface RouteGroup {
  /** Base path prefix for all routes in this group */
  prefix: string
  /** Middleware to apply to all routes in this group */
  middleware?: MiddlewareHandler[]
  /** Authentication requirement for all routes in this group */
  auth?: boolean | 'admin' | 'public'
  /** Routes in this group */
  routes: CustomRoute[]
}

// Main configuration interface
/** OAuth provider configuration */
export interface OAuthConfig {
  google?: {
    clientId: string
    clientSecret: string
    redirectUri: string
  }
}

/** CAPTCHA provider configuration */
export interface CaptchaConfig {
  provider: 'turnstile' | 'hcaptcha' | 'recaptcha'
  siteKey: string
  secretKey: string
  options?: {
    theme?: 'light' | 'dark' | 'auto'
    size?: 'normal' | 'compact' | 'invisible'
    /** Language code for CAPTCHA widget (e.g., 'fr', 'en'). Defaults to i18n.defaultLocale or 'auto' */
    language?: string
  }
  protectedEndpoints?: {
    login?: boolean
    passwordResetRequest?: boolean
    passwordResetVerify?: boolean
  }
}

/** Features configuration for enhanced content management */
export interface FeaturesConfig {
  /** Auto-generate thumbnails for documents */
  autoThumbnail?: {
    enabled?: boolean
    fieldName?: string
    skipSingletons?: boolean
    skipSchemas?: string[]
    maxFileSize?: number
    allowedTypes?: string[]
  }
  /** Auto-generate slugs for documents */
  autoSlug?: {
    enabled?: boolean
    sourceFields?: string[]
    unique?: boolean
  }
}

/** Internationalization (i18n) configuration */
export interface I18nConfig {
  /** Default locale for the CMS (default: 'en') */
  defaultLocale?: string
  /** Supported locales for content and UI (default: ['en', 'fr']) */
  supportedLocales?: string[]
  /** Fallback locale when translation is missing (default: 'en') */
  fallbackLocale?: string
  /** Detect browser language automatically (default: true) */
  detectBrowserLanguage?: boolean
  /** Enable debug logging for missing translations (default: false in production) */
  debug?: boolean
}

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
  /** OAuth configuration */
  oauth?: OAuthConfig
  /** CAPTCHA configuration */
  captcha?: CaptchaConfig
  /** OAuth2 Authorization Server configuration (for CLI login and SSO) */
  oauth2?: {
    enabled?: boolean
    issuer?: string
    accessTokenTtl?: number
    refreshTokenTtl?: number
    deviceCodeTtl?: number
    authCodeTtl?: number
    pollingInterval?: number
    /** External OAuth2 clients for SSO */
    clients?: Array<{
      /** Unique client identifier */
      id: string
      /** Human-readable client name */
      name: string
      /** Client description */
      description?: string
      /** Client type: 'public' for SPAs/native apps, 'confidential' for server-side apps */
      type?: 'public' | 'confidential'
      /** Client secret (required for confidential clients) */
      secret?: string
      /** Allowed redirect URIs */
      redirectUris: string[]
      /** Allowed scopes */
      allowedScopes?: string[]
      /** Allowed grant types */
      grantTypes?: string[]
    }>
  }
  /** Features configuration */
  features?: FeaturesConfig
  /** Internationalization (i18n) configuration */
  i18n?: I18nConfig
  /** HTTP server settings */
  server?: ServerConfig
  /** Studio integration */
  studio?: StudioConfig
  /** Mail service configuration */
  mail?: MailConfig
  /** Event hooks and webhooks */
  hooks?: HooksConfig
  /** Custom API routes */
  routes?: (CustomRoute | RouteGroup)[]
}

// Configuration with smart defaults
export interface TrokkyConfigWithDefaults extends TrokkyConfig {
  env: TrokkyEnvironment
  media: Required<Omit<MediaConfig, 'mediaUrlGenerator'>> & {
    mediaUrlGenerator?: MediaConfig['mediaUrlGenerator']
  }
  security: Required<Omit<SecurityConfig, 'jwtSecret' | 'adminUser' | 'passkey'>> & {
    jwtSecret?: string
    adminUser?: SecurityConfig['adminUser']
    passkey?: SecurityConfig['passkey']
  }
  server: Required<Omit<ServerConfig, 'port' | 'lifecycle' | 'trustProxy'>> & {
    port?: number
    lifecycle?: ServerLifecycle
    trustProxy?: boolean | number | string
  }
  studio: Required<Omit<StudioConfig, 'apiUrl'>> & {
    apiUrl?: string
  }
  /** i18n configuration with defaults applied */
  i18n: Required<I18nConfig>
  // These remain optional as they're truly opt-in features
  mail?: MailConfig
  hooks?: HooksConfig
  routes?: (CustomRoute | RouteGroup)[]
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
      serving: {
        mode: 'api',
        staticBasePath: '/media'
      },
      ...config.media
    },
    
    security: {
      enabled: config.security?.enabled ?? true, // Secure by default - explicit opt-out required
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
        permissions: true, // Secure by default - enable permissions everywhere
        ...config.security?.validation
      },
      rateLimit: {
        enabled: config.security?.rateLimit?.enabled ?? true, // Rate limiting on by default
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: isDev ? 1000 : 100, // More lenient in dev, but still protected
        skipSuccessfulRequests: false,
        ...config.security?.rateLimit
      },
      cryptoOptions: {
        adapterType: 'auto', // Auto-detect best crypto adapter (webcrypto in modern Node, bcrypt fallback)
        saltRounds: 12,
        ...config.security?.cryptoOptions
      },
      adminUser: config.security?.adminUser,
      passkey: config.security?.passkey
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
    },

    i18n: {
      defaultLocale: 'en',
      supportedLocales: ['en', 'fr'],
      fallbackLocale: 'en',
      detectBrowserLanguage: true,
      debug: isDev,
      ...config.i18n
    },

    // Pass through optional features (no defaults needed)
    mail: config.mail,
    hooks: config.hooks,
    routes: config.routes,
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
  
  if (!config.storage) {
    throw new Error('Storage configuration must be specified')
  }
  
  // Validate split storage configuration
  if (!config.storage.data?.adapter) {
    throw new Error('Data adapter must be specified')
  }
  if (!config.storage.media?.adapter) {
    throw new Error('Media adapter must be specified')
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

