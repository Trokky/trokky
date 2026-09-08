import { detectCryptoAdapter, type CryptoAdapter, type CryptoAdapterOptions } from '../crypto/adapter.js'
import { SchemaRegistry } from '../schema/registry.js'
import { DocumentValidator } from '../validation/validator.js'
import { RateLimiter, RateLimitConfig } from '../security/rate-limiter.js'
import { IdGenerator } from '../utils/id-generator.js'
import { createLogger } from '../utils/logger.js'
import { createImageProcessor, type ImageProcessor, type ImageProcessorConfig } from '../media/image-processor.js'
import { TrokkyEventBus, type EventBusConfig, MemoryEventStorage } from '../events/index.js'
import { 
  mediaUpdated,
  userCreated,
  userUpdated,
  userDeleted,
  userLogin,
  userLogout,
  appTokenCreated,
  systemStartup,
  systemShutdown,
  systemError,
  actorFromUser,
  actorFromAppToken
} from '../events/index.js'
import {
  TrokkyConfig,
  StorageAdapter,
  DataStorageAdapter,
  MediaStorageAdapter,
  TrokkyStorageAdapters,
  Document,
  DocumentData,
  ListOptions,
  MediaFile,
  ContentSchema,
  ValidationResult,
  User,
  CreateUserData,
  UpdateUserData,
  UserListOptions,
  Permission,
  UserSession,
  AppToken,
  AppTokenListOptions,
  CreateAppTokenData,
  AuditContext,
  AUDIT_ACTOR_TYPES,
  AuditLog,
  OAuthProvider,
  OAuthProviderType,
  // MFA types
  MFAConfig,
  MFAMethod,
  MFAMethodType,
  TrustedDevice,
  SettingsConfig,
  MediaListResult,
  // Authentication result types
  AuthenticationResult,
  AuthenticationSuccessResult
} from '../types/index.js'
import type { AppTokenCreationResult } from '../security/auth.js'
import {
  TOTPService,
  EmailOTPService,
  type TOTPSecretResult,
  type StoredEmailOTP
} from '../security/mfa/index.js'
import {
  type CaptchaProvider,
  type CaptchaProviderType,
  type CaptchaProtectedEndpoint,
  type CaptchaVerificationResult
} from '../security/captcha/index.js'
import {
  OAuth2AuthorizationServer,
  type OAuth2ServerConfig
} from '../security/oauth2/index.js'
import type { OAuth2Scope, TokenResponse } from '../types/oauth2.js'
import { AuthService } from '../services/auth-service.js'
import { MFAService, generateSecureSecret } from '../services/mfa-service.js'
import { TrustedDeviceService } from '../services/trusted-device-service.js'
import { OAuthService } from '../services/oauth-service.js'
import { PasskeyService } from '../services/passkey-service.js'
import { UserService } from '../services/user-service.js'
import { TokenService } from '../services/token-service.js'
import { DocumentService } from '../services/document-service.js'
import { MediaService } from '../services/media-service.js'
import { CaptchaService } from '../services/captcha-service.js'
import { OAuth2ServerService } from '../services/oauth2-server-service.js'

export interface TrokkyCoreOptions {
  schemaRegistry?: SchemaRegistry
  validator?: DocumentValidator
  idGenerator?: IdGenerator
  rateLimiter?: RateLimiter
  enableSecurity?: boolean
  setupAdminFromEnv?: boolean // Automatically create admin user from env vars on startup
  jwtSecret?: string // JWT signing secret for token authentication
  auditLogger?: (event: AuditEvent) => void // Optional audit logging function
  cryptoAdapter?: CryptoAdapter // Custom crypto adapter (auto-detected if not provided)
  cryptoOptions?: CryptoAdapterOptions // Options for crypto adapter
  imageProcessor?: ImageProcessor // Custom image processor (auto-created if not provided)
  imageProcessorConfig?: ImageProcessorConfig // Image processor configuration
  
  // Storage adapter validation options
  validateAdapters?: boolean // Validate that adapters have required methods (default: true)
  allowPartialAdapters?: boolean // Allow adapters with optional methods missing (default: false)
  
  // Event system configuration
  eventBus?: TrokkyEventBus // Custom event bus instance
  eventBusConfig?: EventBusConfig // Event bus configuration (used if eventBus is not provided)
  enableEvents?: boolean // Enable event emission (default: true)

  // OAuth2 Authorization Server configuration
  oauth2?: {
    enabled?: boolean // Enable OAuth2 authorization server (default: false)
    issuer?: string // Base URL for the OAuth2 server (required if enabled)
    accessTokenTtl?: number // Access token lifetime in seconds (default: 3600)
    refreshTokenTtl?: number // Refresh token lifetime in seconds (default: 2592000)
    deviceCodeTtl?: number // Device code lifetime in seconds (default: 600)
    authCodeTtl?: number // Authorization code lifetime in seconds (default: 600)
    pollingInterval?: number // Minimum polling interval in seconds (default: 5)
    clients?: Array<{
      id: string
      name: string
      description?: string
      type?: 'public' | 'confidential'
      secret?: string
      redirectUris: string[]
      allowedScopes?: string[]
      grantTypes?: string[]
    }>
  }
}

export interface AuditEvent {
  type: 'user_created' | 'user_updated' | 'user_deleted' | 'user_login' | 'user_logout' | 'admin_access' | 'app_token_deleted'
  userId?: string
  targetUserId?: string
  targetTokenId?: string
  username?: string
  tokenName?: string
  action: string
  timestamp: string
  ipAddress?: string
  userAgent?: string
  success: boolean
  details?: Record<string, unknown>
}

export class TrokkyCore {
  // Split storage adapters (new architecture)
  private dataStorage: DataStorageAdapter
  private mediaStorage: MediaStorageAdapter
  
  // Legacy unified storage adapter (for backward compatibility)
  private storage?: StorageAdapter
  
  private schemas: SchemaRegistry
  private validator: DocumentValidator
  private idGenerator: IdGenerator
  private rateLimiter?: RateLimiter
  private securityEnabled: boolean
  private options: TrokkyCoreOptions
  private jwtSecret: string
  private config: TrokkyConfig
  private auditLogger?: (event: AuditEvent) => void
  private cryptoAdapter: CryptoAdapter
  private imageProcessor!: ImageProcessor // Initialized in init() method
  private imageProcessorConfig: ImageProcessorConfig
  private logger = createLogger('core', 'TrokkyCore')
  private auditLog = createLogger('core', 'Audit')
  
  // Event system
  private eventBus: TrokkyEventBus
  private eventsEnabled: boolean

  // OAuth2 Authorization Server (enables CLI login and external SSO)
  private oauth2Server: OAuth2AuthorizationServer | null = null

  // Secure callbacks for sensitive operations (not logged in events)
  private userCreatedWithPasswordCallback?: (user: User, temporaryPassword: string) => Promise<void>

  // Extracted domain services (authentication, MFA, trusted devices, OAuth, passkeys)
  private authService: AuthService
  private mfaService: MFAService
  private trustedDeviceService: TrustedDeviceService
  private oauthService: OAuthService
  private passkeyService: PasskeyService
  private userService: UserService
  private tokenService: TokenService
  private documentService: DocumentService
  private mediaService: MediaService
  private captchaService: CaptchaService
  private oauth2ServerService: OAuth2ServerService

  // Constructor overloads for both unified and split adapters
  constructor(
    config: TrokkyConfig, 
    storageAdapter: StorageAdapter,
    options?: TrokkyCoreOptions
  )
  constructor(
    config: TrokkyConfig, 
    storageAdapters: TrokkyStorageAdapters,
    options?: TrokkyCoreOptions
  )
  constructor(
    config: TrokkyConfig, 
    storageAdapterOrAdapters: StorageAdapter | TrokkyStorageAdapters,
    options: TrokkyCoreOptions = {}
  ) {
    // Determine if we're using unified or split adapters
    if (this.isTrokkyStorageAdapters(storageAdapterOrAdapters)) {
      // Split adapters (new architecture)
      this.dataStorage = storageAdapterOrAdapters.data
      this.mediaStorage = storageAdapterOrAdapters.media
      this.storage = undefined
      this.logger.info('TrokkyCore initialized with split storage adapters', {
        dataAdapter: this.dataStorage.constructor?.name || 'DataStorageAdapter',
        mediaAdapter: this.mediaStorage.constructor?.name || 'MediaStorageAdapter'
      })
      
      // Validate split adapters have required methods
      this.validateStorageAdapters()
    } else {
      // Unified adapter (legacy support)
      this.storage = storageAdapterOrAdapters
      // Create adapter wrappers for backward compatibility
      this.dataStorage = this.createDataAdapterWrapper(storageAdapterOrAdapters)
      this.mediaStorage = this.createMediaAdapterWrapper(storageAdapterOrAdapters)
      this.logger.warn('TrokkyCore using legacy unified storage adapter - consider migrating to split adapters', {
        adapter: storageAdapterOrAdapters.constructor?.name || 'StorageAdapter'
      })
    }
    this.options = options
    this.config = config
    this.schemas = options.schemaRegistry || new SchemaRegistry(config.schemas, config.features)
    this.validator = options.validator || new DocumentValidator(this.schemas)
    this.idGenerator = options.idGenerator || new IdGenerator()
    this.securityEnabled = options.enableSecurity ?? config.security?.validateInput ?? true
    
    // Initialize JWT secret (use provided secret, environment variable if available, or generate one)
    const envJwt = (typeof process !== 'undefined' && process.env?.TROKKY_JWT_SECRET)
      ? process.env.TROKKY_JWT_SECRET
      : undefined
    this.jwtSecret = options.jwtSecret || envJwt || this.generateSecureSecret()
    
    // Initialize audit logger
    this.auditLogger = options.auditLogger
    
    // Initialize crypto adapter
    this.cryptoAdapter = options.cryptoAdapter || detectCryptoAdapter({
      ...options.cryptoOptions,
      adapterType: options.cryptoOptions?.adapterType || 'auto'
    })
    
    // Image processor will be initialized in init() method
    // Store config for async initialization
    this.imageProcessorConfig = options.imageProcessorConfig || {
      type: config.media?.imageProcessor || 'none',
      variants: config.media?.imageVariants || [],
      options: config.media?.imageProcessorOptions || {}
    }
    
    if (config.security?.rateLimitEnabled || config.api?.rateLimit) {
      const rateLimitConfig: RateLimitConfig = {
        windowMs: config.api?.rateLimit?.windowMs || 60 * 1000,
        maxRequests: config.api?.rateLimit?.maxRequests || 1000
      }
      this.rateLimiter = options.rateLimiter || new RateLimiter(rateLimitConfig)
    }

    // Initialize event system
    this.eventsEnabled = options.enableEvents ?? true
    if (options.eventBus) {
      this.eventBus = options.eventBus
    } else {
      // Create default event bus with memory storage
      const eventStorage = new MemoryEventStorage({
        maxEvents: 1000,
        autoCleanup: true
      })
      
      const eventBusConfig: EventBusConfig = {
        maxHistorySize: 1000,
        enablePersistence: true,
        storage: eventStorage,
        enableWebhooks: true,
        maxConcurrentWebhooks: 5,
        dataStorage: this.dataStorage?.saveWebhook && this.dataStorage?.listWebhooks && this.dataStorage?.deleteWebhook
          ? this.dataStorage as import('../events/types.js').WebhookStorage
          : undefined,
        ...options.eventBusConfig
      }
      
      this.eventBus = new TrokkyEventBus(eventBusConfig)
    }
    
    // Initialize extracted domain services
    this.authService = new AuthService({
      cryptoAdapter: this.cryptoAdapter,
      jwtSecret: this.jwtSecret,
      config: this.config,
      logger: this.logger,
      getUser: (id) => this.getUser(id),
      getUserByUsername: (username) => this.getUserByUsername(username),
      updateUser: (id, userData) => this.updateUser(id, userData),
      validateAppToken: (token) => this.validateAppToken(token),
      logAuditEvent: (event) => this.logAuditEvent(event),
      checkMFARequired: (userId) => this.mfaService.checkMFARequired(userId),
      isDeviceTrusted: (userId, deviceId) => this.trustedDeviceService.isDeviceTrusted(userId, deviceId),
      trustDevice: (userId, deviceId, deviceName, deviceOptions) =>
        this.trustedDeviceService.trustDevice(userId, deviceId, deviceName, deviceOptions),
      getTOTPService: (issuer) => this.mfaService.getTOTPService(issuer)
    })

    this.mfaService = new MFAService({
      logger: this.logger,
      eventBus: this.eventBus,
      eventsEnabled: this.eventsEnabled,
      getUser: (id) => this.getUser(id),
      updateUser: (id, userData) => this.updateUser(id, userData),
      getSettings: () => this.getSettings(),
      verifyPassword: (plainPassword, hashedPassword) => this.authService.verifyPassword(plainPassword, hashedPassword),
      logAuditEvent: (event) => this.logAuditEvent(event)
    })

    this.trustedDeviceService = new TrustedDeviceService({
      logger: this.logger,
      getUser: (id) => this.getUser(id),
      updateUser: (id, userData) => this.updateUser(id, userData),
      getSettings: () => this.getSettings()
    })

    this.oauthService = new OAuthService({
      config: this.config,
      logger: this.logger,
      dataStorage: this.dataStorage,
      getUser: (id) => this.getUser(id),
      updateUser: (id, userData) => this.updateUser(id, userData),
      listUsers: (listOptions) => this.listUsers(listOptions),
      logAuditEvent: (event) => this.logAuditEvent(event),
      checkMFARequired: (userId) => this.mfaService.checkMFARequired(userId),
      isDeviceTrusted: (userId, deviceId) => this.trustedDeviceService.isDeviceTrusted(userId, deviceId),
      issueFullTokens: (user, tokenOptions) => this.authService.issueFullTokens(user, tokenOptions),
      generateMFAPendingToken: (user, methods) => this.authService.generateMFAPendingToken(user, methods),
      generateMFASetupToken: (user, allowedMethods) => this.authService.generateMFASetupToken(user, allowedMethods),
      generateAuthToken: (user, expiresIn, rememberMe) => this.authService.generateAuthToken(user, expiresIn, rememberMe),
      verifyAuthToken: (token) => this.authService.verifyAuthToken(token)
    })

    this.passkeyService = new PasskeyService({
      config: this.config,
      logger: this.logger,
      dataStorage: this.dataStorage,
      getUser: (id) => this.getUser(id),
      updateUser: (id, userData) => this.updateUser(id, userData),
      listUsers: (listOptions) => this.listUsers(listOptions),
      logAuditEvent: (event) => this.logAuditEvent(event),
      checkMFARequired: (userId) => this.mfaService.checkMFARequired(userId),
      isDeviceTrusted: (userId, deviceId) => this.trustedDeviceService.isDeviceTrusted(userId, deviceId),
      issueFullTokens: (user, tokenOptions) => this.authService.issueFullTokens(user, tokenOptions),
      generateMFAPendingToken: (user, methods) => this.authService.generateMFAPendingToken(user, methods),
      generateMFASetupToken: (user, allowedMethods) => this.authService.generateMFASetupToken(user, allowedMethods)
    })

    this.userService = new UserService({
      logger: this.logger,
      dataStorage: this.dataStorage,
      idGenerator: this.idGenerator,
      rateLimiter: this.rateLimiter,
      securityEnabled: this.securityEnabled,
      eventBus: this.eventBus,
      hashPassword: (password) => this.hashPassword(password),
      checkWeakPassword: (password) => this.checkWeakPassword(password),
      logAuditEvent: (event) => this.logAuditEvent(event),
      getUserCreatedWithPasswordCallback: () => this.userCreatedWithPasswordCallback
    })

    this.tokenService = new TokenService({
      dataStorage: this.dataStorage,
      idGenerator: this.idGenerator,
      cryptoAdapter: this.cryptoAdapter,
      rateLimiter: this.rateLimiter,
      securityEnabled: this.securityEnabled,
      logAuditEvent: (event) => this.logAuditEvent(event)
    })

    this.documentService = new DocumentService({
      logger: this.logger,
      auditLog: this.auditLog,
      dataStorage: this.dataStorage,
      schemas: this.schemas,
      idGenerator: this.idGenerator,
      rateLimiter: this.rateLimiter,
      securityEnabled: this.securityEnabled,
      eventBus: this.eventBus,
      eventsEnabled: this.eventsEnabled,
      validateDocument: (collection, data) => this.validateDocument(collection, data)
    })

    this.mediaService = new MediaService({
      config: this.config,
      logger: this.logger,
      mediaStorage: this.mediaStorage,
      idGenerator: this.idGenerator,
      rateLimiter: this.rateLimiter,
      securityEnabled: this.securityEnabled,
      eventBus: this.eventBus,
      eventsEnabled: this.eventsEnabled,
      getImageProcessor: () => this.imageProcessor
    })

    this.captchaService = new CaptchaService({
      config: this.config,
      logger: this.logger
    })

    this.oauth2ServerService = new OAuth2ServerService({
      logger: this.logger,
      cryptoAdapter: this.cryptoAdapter,
      jwtSecret: this.jwtSecret,
      getOAuth2Server: () => this.oauth2Server,
      getOAuth2Options: () => this.options.oauth2,
      getUser: (id) => this.getUser(id),
      updateUser: (id, userData) => this.updateUser(id, userData)
    })

    // Emit system startup event
    if (this.eventsEnabled) {
      this.eventBus.emitEvent(systemStartup('TrokkyCore')).catch(error => {
        this.logger.warn('Failed to emit system startup event', error)
      })
    }
  }

  // Public getters for external access
  /**
   * Get the event bus instance for emitting custom events
   */
  public get events(): TrokkyEventBus {
    return this.eventBus
  }

  /**
   * Get the configuration
   */
  public get configuration(): TrokkyConfig {
    return this.config
  }

  /**
   * Register a secure callback for when users are created with temporary passwords
   * This callback is NOT part of the event system and does not get logged
   * Used by mail services to send welcome emails with credentials
   */
  public onUserCreatedWithPassword(callback: (user: User, temporaryPassword: string) => Promise<void>): void {
    this.userCreatedWithPasswordCallback = callback
    this.logger.debug('Registered secure callback for user creation with password')
  }

  /**
   * Check rate limit for a specific operation
   * Allows routes and external code to use the rate limiter
   */
  public async checkRateLimit(operation: string, context?: Record<string, unknown>): Promise<void> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit(operation, context)
    }
  }

  // Helper methods for adapter management
  private isTrokkyStorageAdapters(adapter: any): adapter is TrokkyStorageAdapters {
    return adapter && 
           typeof adapter === 'object' && 
           'data' in adapter && 
           'media' in adapter &&
           typeof adapter.data === 'object' &&
           typeof adapter.media === 'object'
  }

  private createDataAdapterWrapper(storage: StorageAdapter): DataStorageAdapter {
    return {
      // Document operations
      getDocument: storage.getDocument.bind(storage),
      saveDocument: storage.saveDocument.bind(storage),
      listDocuments: storage.listDocuments.bind(storage),
      deleteDocument: storage.deleteDocument.bind(storage),
      
      // User operations (with fallback if not implemented)
      getUser: storage.getUser?.bind(storage) || (() => { throw new Error('User operations not supported by unified adapter') }),
      saveUser: storage.saveUser?.bind(storage) || (() => { throw new Error('User operations not supported by unified adapter') }),
      listUsers: storage.listUsers?.bind(storage) || (() => { throw new Error('User operations not supported by unified adapter') }),
      deleteUser: storage.deleteUser?.bind(storage) || (() => { throw new Error('User operations not supported by unified adapter') }),
      getUserByUsername: storage.getUserByUsername?.bind(storage) || (() => { throw new Error('User operations not supported by unified adapter') }),
      getUserByEmail: storage.getUserByEmail?.bind(storage) || (() => { throw new Error('User operations not supported by unified adapter') }),
      
      // App token operations (with fallback if not implemented)
      getAppToken: storage.getAppToken?.bind(storage) || (() => { throw new Error('App token operations not supported by unified adapter') }),
      saveAppToken: storage.saveAppToken?.bind(storage) || (() => { throw new Error('App token operations not supported by unified adapter') }),
      listAppTokens: storage.listAppTokens?.bind(storage) || (() => { throw new Error('App token operations not supported by unified adapter') }),
      deleteAppToken: storage.deleteAppToken?.bind(storage) || (() => { throw new Error('App token operations not supported by unified adapter') }),
      getAppTokenByHash: storage.getAppTokenByHash?.bind(storage) || (() => { throw new Error('App token operations not supported by unified adapter') }),
      
      // Utility operations
      healthCheck: storage.healthCheck.bind(storage),
      migrate: storage.migrate?.bind(storage)
    }
  }

  private createMediaAdapterWrapper(storage: StorageAdapter): MediaStorageAdapter {
    return {
      // File operations
      uploadFile: storage.uploadFile.bind(storage),
      getFile: storage.getFile.bind(storage),
      updateFile: storage.updateFile?.bind(storage) || (() => { throw new Error('File update not supported by unified adapter') }),
      getFileContent: storage.getFileContent.bind(storage),
      listMedia: storage.listMedia?.bind(storage) || (() => { throw new Error('Media listing not supported by unified adapter') }),
      deleteFile: storage.deleteFile.bind(storage),
      
      // Variant operations (with fallback if not implemented)
      saveVariantFile: storage.saveVariantFile?.bind(storage) || (() => { throw new Error('Variant operations not supported by unified adapter') }),
      getVariantContent: storage.getVariantContent?.bind(storage) || (() => { throw new Error('Variant operations not supported by unified adapter') }),
      deleteVariantFiles: storage.deleteVariantFiles?.bind(storage) || (() => { throw new Error('Variant operations not supported by unified adapter') }),
      
      // Utility operations
      healthCheck: storage.healthCheck.bind(storage)
    }
  }

  // Adapter validation
  private validateStorageAdapters(): void {
    // Validate DataStorageAdapter has required methods
    const requiredDataMethods = [
      'getDocument', 'saveDocument', 'listDocuments', 'deleteDocument',
      'getUser', 'saveUser', 'listUsers', 'deleteUser', 'getUserByUsername', 'getUserByEmail',
      'getAppToken', 'saveAppToken', 'listAppTokens', 'deleteAppToken', 'getAppTokenByHash',
      'healthCheck'
    ]
    
    for (const method of requiredDataMethods) {
      if (typeof (this.dataStorage as any)[method] !== 'function') {
        throw new Error(`DataStorageAdapter missing required method: ${method}`)
      }
    }

    // Validate MediaStorageAdapter has required methods
    const requiredMediaMethods = [
      'uploadFile', 'getFile', 'getFileContent', 'deleteFile', 'healthCheck'
    ]
    
    for (const method of requiredMediaMethods) {
      if (typeof (this.mediaStorage as any)[method] !== 'function') {
        throw new Error(`MediaStorageAdapter missing required method: ${method}`)
      }
    }

    this.logger.debug('Storage adapters validation passed', {
      dataMethodCount: requiredDataMethods.length,
      mediaMethodCount: requiredMediaMethods.length
    })
  }

  // Public getters
  public getEventBus(): TrokkyEventBus {
    return this.eventBus
  }

  // Initialization
  public async init(): Promise<void> {
    // Initialize image processor asynchronously
    if (!this.options.imageProcessor) {
      this.imageProcessor = await createImageProcessor(this.imageProcessorConfig)
    } else {
      this.imageProcessor = this.options.imageProcessor
    }

    // Initialize OAuth2 Authorization Server if enabled
    if (this.options.oauth2?.enabled) {
      const oauth2Config = this.options.oauth2
      if (!oauth2Config.issuer) {
        this.logger.warn('OAuth2 enabled but no issuer configured - using default localhost')
      }

      this.oauth2Server = new OAuth2AuthorizationServer({
        issuer: oauth2Config.issuer || 'http://localhost:3000',
        jwtSecret: this.jwtSecret,
        accessTokenTtl: oauth2Config.accessTokenTtl,
        refreshTokenTtl: oauth2Config.refreshTokenTtl,
        deviceCodeTtl: oauth2Config.deviceCodeTtl,
        authCodeTtl: oauth2Config.authCodeTtl,
        pollingInterval: oauth2Config.pollingInterval,
        clients: oauth2Config.clients
      })

      this.logger.info('OAuth2 Authorization Server initialized', {
        issuer: oauth2Config.issuer || 'http://localhost:3000',
        clients: oauth2Config.clients?.length || 0
      })
    }

    // Setup admin user from environment variables if configured
    if (this.options.setupAdminFromEnv) {
      await this.setupAdminFromEnv()
    }
  }

  // Document operations
  public async getDocument<T extends Record<string, unknown> = Record<string, unknown>>(
    collection: string,
    id: string
  ): Promise<(Document & T) | null> {
    return this.documentService.getDocument<T>(collection, id)
  }

  public async saveDocument<T extends Record<string, unknown> = Record<string, unknown>>(
    collection: string,
    data: DocumentData & T & { id?: string },
    auditContext?: AuditContext
  ): Promise<Document & T> {
    return this.documentService.saveDocument<T>(collection, data, auditContext)
  }

  public async listDocuments<T extends Record<string, unknown> = Record<string, unknown>>(
    collection: string,
    options?: ListOptions
  ): Promise<(Document & T)[]> {
    return this.documentService.listDocuments<T>(collection, options)
  }

  public async countDocuments(collection: string, filter?: Record<string, unknown>): Promise<number> {
    return this.documentService.countDocuments(collection, filter)
  }

  public async deleteDocument(collection: string, id: string, auditContext?: AuditContext): Promise<void> {
    return this.documentService.deleteDocument(collection, id, auditContext)
  }

  // ==========================================================================
  // AUDIT LOG OPERATIONS
  // ==========================================================================

  /**
   * Get audit logs for a specific document
   */
  public async getDocumentAuditLogs(documentId: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]> {
    return this.documentService.getDocumentAuditLogs(documentId, options)
  }

  /**
   * Get audit logs for a collection
   */
  public async getCollectionAuditLogs(collection: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]> {
    return this.documentService.getCollectionAuditLogs(collection, options)
  }

  /**
   * Get audit logs for a specific actor
   */
  public async getActorAuditLogs(actorId: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]> {
    return this.documentService.getActorAuditLogs(actorId, options)
  }

  // Media operations
  public async uploadMedia(file: File): Promise<MediaFile> {
    return this.mediaService.uploadMedia(file)
  }

  public async getMedia(id: string): Promise<MediaFile | null> {
    return this.mediaService.getMedia(id)
  }

  public async updateMedia(id: string, metadata: Record<string, any>): Promise<MediaFile> {
    return this.mediaService.updateMedia(id, metadata)
  }

  public async getMediaContent(id: string): Promise<ArrayBuffer | null> {
    return this.mediaService.getMediaContent(id)
  }

  public async listMedia(options?: { limit?: number; offset?: number }): Promise<MediaListResult> {
    return this.mediaService.listMedia(options)
  }

  public async deleteMedia(id: string): Promise<void> {
    return this.mediaService.deleteMedia(id)
  }

  public async regenerateMediaVariants(id: string): Promise<MediaFile> {
    return this.mediaService.regenerateMediaVariants(id)
  }

  // Schema operations
  public getSchema(name: string): ContentSchema | null {
    return this.schemas.getSchema(name)
  }

  public getAllSchemas(): ContentSchema[] {
    return this.schemas.getAllSchemas()
  }

  public validateDocument(collection: string, data: unknown): ValidationResult {
    return this.validator.validateDocument(collection, data)
  }

  // Image processing operations
  public getImageUrl(imageId: string, variantName?: string): string {
    return this.mediaService.getImageUrl(imageId, variantName)
  }

  public async getImageProcessor(): Promise<ImageProcessor> {
    return this.mediaService.getImageProcessor()
  }

  /**
   * Get storage adapter (legacy unified adapter)
   * @deprecated Use getDataStorageAdapter() and getMediaStorageAdapter() instead
   */
  public getStorageAdapter(): StorageAdapter | null {
    return this.storage || null
  }

  /**
   * Get data storage adapter
   */
  public getDataStorageAdapter(): DataStorageAdapter {
    return this.dataStorage
  }

  /**
   * Get media storage adapter
   */
  public getMediaStorageAdapter(): MediaStorageAdapter {
    return this.mediaStorage
  }

  /**
   * Get both storage adapters
   */
  public getStorageAdapters(): TrokkyStorageAdapters {
    return {
      data: this.dataStorage,
      media: this.mediaStorage
    }
  }

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      // Check health of both storage adapters
      const dataStorageHealthy = await this.dataStorage.healthCheck()
      const mediaStorageHealthy = await this.mediaStorage.healthCheck()
      const storageHealthy = dataStorageHealthy && mediaStorageHealthy
      const schemasLoaded = this.schemas.getAllSchemas().length > 0
      const imageProcessorHealthy = await this.imageProcessor.healthCheck()
      
      return storageHealthy && schemasLoaded && imageProcessorHealthy
    } catch {
      return false
    }
  }

  // Utility methods
  private validateAndSanitizeMediaFile(file: File): string {
    return this.mediaService.validateAndSanitizeMediaFile(file)
  }

  private sanitizeFilename(filename: string): string {
    return this.mediaService.sanitizeFilename(filename)
  }

  private getFileExtension(filename: string): string {
    return this.mediaService.getFileExtension(filename)
  }

  // User management operations (system entities)
  public async createUser(userData: CreateUserData): Promise<User> {
    return this.userService.createUser(userData)
  }

  public async getUser(id: string): Promise<User | null> {
    return this.userService.getUser(id)
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    return this.userService.getUserByUsername(username)
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    return this.userService.getUserByEmail(email)
  }

  public async updateUser(id: string, userData: UpdateUserData): Promise<User> {
    return this.userService.updateUser(id, userData)
  }

  public async listUsers(options?: UserListOptions): Promise<User[]> {
    return this.userService.listUsers(options)
  }

  public async deleteUser(id: string): Promise<void> {
    return this.userService.deleteUser(id)
  }

  // App Token management operations
  public async listAppTokens(options?: AppTokenListOptions): Promise<AppToken[]> {
    return this.tokenService.listAppTokens(options)
  }

  public async createAppToken(tokenData: CreateAppTokenData, createdBy: string): Promise<AppTokenCreationResult> {
    return this.tokenService.createAppToken(tokenData, createdBy)
  }

  public async getAppToken(id: string): Promise<AppToken | null> {
    return this.tokenService.getAppToken(id)
  }

  public async validateAppToken(token: string): Promise<{ valid: boolean; appToken?: AppToken; error?: string }> {
    return this.tokenService.validateAppToken(token)
  }

  public async deleteAppToken(id: string): Promise<void> {
    return this.tokenService.deleteAppToken(id)
  }

  // Authentication utilities
  public async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return this.authService.verifyPassword(plainPassword, hashedPassword)
  }

  /**
   * Hash a password using the configured crypto adapter
   * Exposed publicly to ensure consistent hashing across all password operations
   */
  public async hashPassword(password: string): Promise<string> {
    return this.authService.hashPassword(password)
  }

  private getDefaultPermissions(role: string): Permission[] {
    return this.userService.getDefaultPermissions(role)
  }

  private checkWeakPassword(password: string): { isWeak: boolean; reason?: string } {
    return this.authService.checkWeakPassword(password)
  }

  // JWT Token Management
  public async generateAuthToken(user: User, expiresIn: string = '24h', rememberMe?: boolean): Promise<string> {
    return this.authService.generateAuthToken(user, expiresIn, rememberMe)
  }

  public async verifyAuthToken(token: string): Promise<UserSession | null> {
    return this.authService.verifyAuthToken(token)
  }

  /**
   * Unified token validation that handles both JWT and API tokens
   * Returns a consistent UserSession interface for both token types
   */
  public async verifyAnyToken(token: string): Promise<UserSession | null> {
    return this.authService.verifyAnyToken(token)
  }

  /**
   * Authentication result types for MFA support
   */
  public async authenticateUser(
    username: string,
    password: string,
    options: { rememberMe?: boolean; deviceId?: string } = {}
  ): Promise<AuthenticationResult | null> {
    return this.authService.authenticateUser(username, password, options)
  }

  /**
   * Issue full authentication tokens after successful login (including MFA if required)
   */
  private async issueFullTokens(
    user: User,
    options: { rememberMe?: boolean } = {}
  ): Promise<AuthenticationSuccessResult> {
    return this.authService.issueFullTokens(user, options)
  }

  /**
   * Generate MFA pending token (used when MFA verification is needed)
   */
  private async generateMFAPendingToken(user: User, methods: MFAMethodType[]): Promise<string> {
    return this.authService.generateMFAPendingToken(user, methods)
  }

  /**
   * Generate MFA setup token (used when org requires MFA but user hasn't set it up)
   */
  private async generateMFASetupToken(user: User, allowedMethods: MFAMethodType[]): Promise<string> {
    return this.authService.generateMFASetupToken(user, allowedMethods)
  }

  /**
   * Complete MFA verification and issue full tokens
   * Call this after verifyMFACode returns true
   */
  public async completeMFAAuthentication(
    mfaToken: string,
    options: { rememberMe?: boolean; trustDevice?: boolean; deviceId?: string; deviceName?: string } = {}
  ): Promise<AuthenticationSuccessResult | null> {
    return this.authService.completeMFAAuthentication(mfaToken, options)
  }

  /**
   * Verify MFA setup token and return user info
   */
  public async verifyMFASetupToken(setupToken: string): Promise<{
    userId: string
    username: string
    allowedMethods: MFAMethodType[]
  } | null> {
    return this.authService.verifyMFASetupToken(setupToken)
  }

  /**
   * Verify any MFA token (pending or setup) and return payload
   */
  public async verifyMFAToken(token: string): Promise<{
    type: 'mfa_pending' | 'mfa_setup'
    userId: string
    username: string
    mfaMethods?: MFAMethodType[]
    allowedMethods?: MFAMethodType[]
  } | null> {
    return this.authService.verifyMFAToken(token)
  }

  /**
   * Complete MFA setup and issue full authentication tokens
   * Used when a user sets up MFA during the login flow (when org requires MFA)
   */
  public async completeMFASetupAndLogin(
    setupToken: string,
    options: { rememberMe?: boolean } = {}
  ): Promise<AuthenticationSuccessResult | null> {
    return this.authService.completeMFASetupAndLogin(setupToken, options)
  }

  /**
   * Verify a backup code for a user
   * Returns result with remaining codes if valid
   */
  public async verifyBackupCode(userId: string, code: string): Promise<{
    valid: boolean
    remainingCodes: string[]
  }> {
    return this.authService.verifyBackupCode(userId, code)
  }

  public async refreshAuthToken(refreshToken: string): Promise<{ token: string; refreshToken: string; user: User; expiresAt: string } | null> {
    return this.authService.refreshAuthToken(refreshToken)
  }

  // ==========================================================================
  // OAuth Methods
  // ==========================================================================

  /**
   * Link an OAuth provider to an existing user
   */
  public async linkOAuthProvider(
    userId: string,
    provider: OAuthProvider
  ): Promise<User> {
    return this.oauthService.linkOAuthProvider(userId, provider)
  }

  /**
   * Unlink an OAuth provider from a user
   */
  public async unlinkOAuthProvider(
    userId: string,
    providerName: OAuthProviderType
  ): Promise<User> {
    return this.oauthService.unlinkOAuthProvider(userId, providerName)
  }

  /**
   * Authenticate a user via OAuth provider
   * Returns null if no user is linked to this provider
   * Returns AuthenticationResult which may require MFA verification or setup
   */
  public async authenticateWithOAuth(
    providerName: OAuthProviderType,
    providerId: string,
    options?: { deviceId?: string }
  ): Promise<AuthenticationResult | null> {
    return this.oauthService.authenticateWithOAuth(providerName, providerId, options)
  }

  /**
   * Find a user by OAuth provider
   */
  public async getUserByOAuthProvider(
    providerName: OAuthProviderType,
    providerId: string
  ): Promise<User | null> {
    return this.oauthService.getUserByOAuthProvider(providerName, providerId)
  }

  /**
   * Check if OAuth is configured for a provider
   */
  public isOAuthConfigured(providerName: OAuthProviderType): boolean {
    return this.oauthService.isOAuthConfigured(providerName)
  }

  /**
   * Get OAuth configuration for a provider
   */
  public getOAuthConfig(providerName: OAuthProviderType): Record<string, string> | null {
    return this.oauthService.getOAuthConfig(providerName)
  }

  // ==========================================================================
  // Passkey/WebAuthn Methods
  // ==========================================================================

  /**
   * Check if passkey authentication is configured
   */
  public isPasskeyConfigured(): boolean {
    return this.passkeyService.isPasskeyConfigured()
  }

  /**
   * Get passkey configuration
   */
  public getPasskeyConfig(): import('../../types/index.js').PasskeyConfig | null {
    return this.passkeyService.getPasskeyConfig()
  }

  /**
   * Find a user by passkey credential ID
   */
  public async getUserByPasskeyCredentialId(credentialId: string): Promise<User | null> {
    return this.passkeyService.getUserByPasskeyCredentialId(credentialId)
  }

  /**
   * Add a passkey credential to a user
   */
  public async addPasskeyToUser(
    userId: string,
    credential: import('../../types/index.js').PasskeyCredential
  ): Promise<User> {
    return this.passkeyService.addPasskeyToUser(userId, credential)
  }

  /**
   * Remove a passkey credential from a user
   */
  public async removePasskeyFromUser(userId: string, credentialId: string): Promise<User> {
    return this.passkeyService.removePasskeyFromUser(userId, credentialId)
  }

  /**
   * Update a passkey credential (counter, lastUsedAt, friendlyName)
   */
  public async updateUserPasskey(
    userId: string,
    credentialId: string,
    updates: Partial<import('../../types/index.js').PasskeyCredential>
  ): Promise<User> {
    return this.passkeyService.updateUserPasskey(userId, credentialId, updates)
  }

  /**
   * Authenticate with passkey (after WebAuthn verification)
   * Similar to authenticateWithOAuth but for passkeys
   */
  public async authenticateWithPasskey(
    userId: string,
    credentialId: string,
    options?: { deviceId?: string }
  ): Promise<AuthenticationResult | null> {
    return this.passkeyService.authenticateWithPasskey(userId, credentialId, options)
  }

  // ==========================================================================
  // CAPTCHA Methods
  // ==========================================================================

  /**
   * Get or create the CAPTCHA provider instance
   * @private
   */
  private getCaptchaProvider(): CaptchaProvider | null {
    return this.captchaService.getCaptchaProvider()
  }

  /**
   * Check if CAPTCHA is configured
   */
  public isCaptchaConfigured(): boolean {
    return this.captchaService.isCaptchaConfigured()
  }

  /**
   * Check if CAPTCHA is required for a specific endpoint
   * @param endpoint - The endpoint to check ('login', 'passwordResetRequest', 'passwordResetVerify')
   */
  public isCaptchaRequiredFor(endpoint: CaptchaProtectedEndpoint): boolean {
    return this.captchaService.isCaptchaRequiredFor(endpoint)
  }

  /**
   * Get CAPTCHA configuration for frontend use
   * Returns public config (site key, provider, options) - never the secret key
   */
  public getCaptchaConfig(): { provider: CaptchaProviderType; siteKey: string; options?: Record<string, unknown> } | null {
    return this.captchaService.getCaptchaConfig()
  }

  /**
   * Verify a CAPTCHA token
   * @param token - The CAPTCHA token from the frontend widget
   * @param remoteIp - Optional client IP address for verification
   */
  public async verifyCaptcha(token: string, remoteIp?: string): Promise<CaptchaVerificationResult> {
    return this.captchaService.verifyCaptcha(token, remoteIp)
  }

  // ==========================================================================
  // MFA (Multi-Factor Authentication) Methods
  // ==========================================================================

  /**
   * Get the TOTP service instance
   * Creates one with a default issuer (can be overridden via settings)
   */
  private getTOTPService(issuer?: string): TOTPService {
    return this.mfaService.getTOTPService(issuer)
  }

  /**
   * Get the Email OTP service instance
   */
  private getEmailOTPService(): EmailOTPService {
    return this.mfaService.getEmailOTPService()
  }

  /**
   * Check if MFA is required for a user
   * Returns whether MFA is required and available methods
   */
  public async checkMFARequired(userId: string): Promise<{
    required: boolean
    methods: MFAMethodType[]
    reason: 'user_enabled' | 'org_required' | 'role_required' | 'not_required'
    userHasMFA: boolean
  }> {
    return this.mfaService.checkMFARequired(userId)
  }

  /**
   * Get project settings
   */
  public async getSettings(): Promise<SettingsConfig | null> {
    if (!this.dataStorage.getSettings) {
      return null
    }
    return this.dataStorage.getSettings()
  }

  /**
   * Initialize TOTP setup for a user
   * Returns QR code and secret for authenticator app
   */
  public async initializeTOTPSetup(userId: string): Promise<TOTPSecretResult> {
    return this.mfaService.initializeTOTPSetup(userId)
  }

  /**
   * Verify and enable TOTP for a user
   * Must be called after initializeTOTPSetup with a valid code from authenticator
   */
  public async verifyAndEnableTOTP(userId: string, code: string): Promise<{
    enabled: boolean
    backupCodes?: string[]
  }> {
    return this.mfaService.verifyAndEnableTOTP(userId, code)
  }

  /**
   * Initialize Email OTP setup for a user
   * Sends verification code to user's email
   */
  public async initializeEmailOTPSetup(userId: string): Promise<{ expiresIn: number }> {
    return this.mfaService.initializeEmailOTPSetup(userId)
  }

  /**
   * Verify and enable Email OTP for a user
   */
  public async verifyAndEnableEmailOTP(userId: string, code: string): Promise<{
    enabled: boolean
    backupCodes?: string[]
  }> {
    return this.mfaService.verifyAndEnableEmailOTP(userId, code)
  }

  /**
   * Verify MFA code during login
   * Supports TOTP, email, and backup codes
   */
  public async verifyMFACode(
    userId: string,
    code: string,
    method: 'totp' | 'email' | 'backup'
  ): Promise<boolean> {
    return this.mfaService.verifyMFACode(userId, code, method)
  }

  /**
   * Send Email OTP for MFA verification during login
   */
  public async sendMFAEmailOTP(userId: string): Promise<{ expiresIn: number }> {
    return this.mfaService.sendMFAEmailOTP(userId)
  }

  /**
   * Disable MFA method for a user
   * Requires password verification
   */
  public async disableMFAMethod(
    userId: string,
    method: MFAMethodType,
    password: string
  ): Promise<void> {
    return this.mfaService.disableMFAMethod(userId, method, password)
  }

  /**
   * Disable all MFA for a user (removes all methods and backup codes)
   * Requires password verification
   */
  public async disableAllMFA(userId: string, password: string): Promise<void> {
    return this.mfaService.disableAllMFA(userId, password)
  }

  /**
   * Regenerate backup codes for a user
   * Requires password verification
   */
  public async regenerateBackupCodes(userId: string, password: string): Promise<string[]> {
    return this.mfaService.regenerateBackupCodes(userId, password)
  }

  /**
   * Trust a device to skip MFA
   */
  public async trustDevice(
    userId: string,
    deviceId: string,
    deviceName: string,
    options?: { ipAddress?: string; userAgent?: string }
  ): Promise<TrustedDevice> {
    return this.trustedDeviceService.trustDevice(userId, deviceId, deviceName, options)
  }

  /**
   * Check if a device is trusted for MFA bypass
   */
  public async isDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
    return this.trustedDeviceService.isDeviceTrusted(userId, deviceId)
  }

  /**
   * Revoke trust for a specific device
   */
  public async revokeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    return this.trustedDeviceService.revokeTrustedDevice(userId, deviceId)
  }

  /**
   * Revoke trust for all devices
   */
  public async revokeAllTrustedDevices(userId: string): Promise<void> {
    return this.trustedDeviceService.revokeAllTrustedDevices(userId)
  }

  /**
   * Get list of trusted devices for a user
   */
  public async getTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    return this.trustedDeviceService.getTrustedDevices(userId)
  }

  /**
   * Admin: Reset MFA for a user (emergency recovery)
   * Removes all MFA configuration
   */
  public async adminResetUserMFA(adminUserId: string, targetUserId: string): Promise<void> {
    return this.mfaService.adminResetUserMFA(adminUserId, targetUserId)
  }

  /**
   * Get MFA status for a user
   */
  public async getMFAStatus(userId: string): Promise<{
    enabled: boolean
    methods: Array<{ type: MFAMethodType; enabled: boolean; verified: boolean; verifiedAt?: string }>
    backupCodesRemaining: number
    backupCodesGeneratedAt?: string
    trustedDevicesCount: number
  }> {
    return this.mfaService.getMFAStatus(userId)
  }

  private generateSecureSecret(): string {
    return generateSecureSecret()
  }

  public logAuditEvent(event: AuditEvent): void {
    // Always call custom audit logger if provided
    if (this.auditLogger) {
      this.auditLogger(event)
    }
    
    // Log through our structured logger system
    const logData = {
      type: event.type,
      action: event.action,
      user: event.username,
      target: event.targetUserId,
      timestamp: event.timestamp,
      ...event.details
    }
    
    if (event.success) {
      this.auditLog.info(`${event.type}: ${event.action}`, logData)
    } else {
      this.auditLog.warn(`${event.type}: ${event.action} - FAILED`, logData)
    }
  }

  // Development utility: Setup admin user from environment variables
  public async setupAdminFromEnv(): Promise<User | null> {
    return this.userService.setupAdminFromEnv()
  }

  // ============================================
  // OAuth2 Authorization Server Methods
  // ============================================

  /**
   * Get the OAuth2 Authorization Server instance
   * Returns null if OAuth2 is not enabled
   */
  public getOAuth2Server(): OAuth2AuthorizationServer | null {
    return this.oauth2ServerService.getOAuth2Server()
  }

  /**
   * Generate OAuth2 tokens for a user
   * Used by the OAuth2 routes to create access and refresh tokens
   */
  public async generateOAuth2Tokens(
    user: User,
    scopes: OAuth2Scope[],
    clientId: string
  ): Promise<{
    accessToken: string
    refreshToken?: string
    expiresIn: number
  }> {
    return this.oauth2ServerService.generateOAuth2Tokens(user, scopes, clientId)
  }

  /**
   * Refresh an OAuth2 access token using a refresh token
   * Returns new tokens if the refresh token is valid
   */
  public async refreshOAuth2Token(
    refreshToken: string,
    clientId: string,
    requestedScope?: string
  ): Promise<TokenResponse | null> {
    return this.oauth2ServerService.refreshOAuth2Token(refreshToken, clientId, requestedScope)
  }

  // ============================================
  // OAuth2 Consent Management
  // ============================================

  /**
   * Check if a user has an existing consent for a client with the given scopes
   * Returns the consent if all requested scopes are already consented, null otherwise
   */
  public async getUserConsent(
    userId: string,
    clientId: string,
    requestedScopes: OAuth2Scope[]
  ): Promise<{ hasConsent: boolean; consentedScopes: OAuth2Scope[] }> {
    return this.oauth2ServerService.getUserConsent(userId, clientId, requestedScopes)
  }

  /**
   * Save user consent for a client
   * Stores in user preferences for persistence
   */
  public async saveUserConsent(
    userId: string,
    clientId: string,
    scopes: OAuth2Scope[],
    expiresInDays?: number
  ): Promise<boolean> {
    return this.oauth2ServerService.saveUserConsent(userId, clientId, scopes, expiresInDays)
  }

  /**
   * Revoke user consent for a client
   */
  public async revokeUserConsent(userId: string, clientId: string): Promise<boolean> {
    return this.oauth2ServerService.revokeUserConsent(userId, clientId)
  }

  // Rate limiter cleanup (call periodically)
  public cleanup(): void {
    if (this.rateLimiter) {
      this.rateLimiter.cleanup()
    }

    // Stop OAuth2 server cleanup interval
    if (this.oauth2Server) {
      this.oauth2Server.stopCleanup()
    }
  }
}
