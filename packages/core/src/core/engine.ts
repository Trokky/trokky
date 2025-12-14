import { detectCryptoAdapter, type CryptoAdapter, type CryptoAdapterOptions } from '../crypto/adapter.js'
import { createHash, timingSafeEqual } from 'crypto'
import { SchemaRegistry } from '../schema/registry.js'
import { DocumentValidator } from '../validation/validator.js'
import { SecurityValidator } from '../security/validation.js'
import { RateLimiter, RateLimitConfig } from '../security/rate-limiter.js'
import { IdGenerator } from '../utils/id-generator.js'
import { createLogger } from '../utils/logger.js'
import { createImageProcessor, type ImageProcessor, type ImageProcessorConfig, type ProcessedImageVariant } from '../media/image-processor.js'
import { TrokkyEventBus, type EventBusConfig, MemoryEventStorage } from '../events/index.js'
import { 
  documentCreated,
  documentUpdated, 
  documentDeleted,
  mediaUploaded,
  mediaUpdated,
  mediaDeleted,
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
  actorFromAppToken,
  extractDocumentChanges
} from '../events/index.js'
import { 
  SchemaNotFoundError, 
  DocumentNotFoundError, 
  ValidationError,
  InvalidInputError
} from '../errors/index.js'
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
  MediaMetadata,
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
  AUDIT_OPERATIONS,
  OAuthProvider,
  OAuthProviderType,
  // MFA types
  MFAConfig,
  MFAMethod,
  MFAMethodType,
  TrustedDevice,
  SettingsConfig,
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
  createCaptchaProvider,
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
  private captchaProvider: CaptchaProvider | null = null
  private logger = createLogger('core', 'TrokkyCore')
  private auditLog = createLogger('core', 'Audit')
  
  // Event system
  private eventBus: TrokkyEventBus
  private eventsEnabled: boolean

  // OAuth2 Authorization Server (enables CLI login and external SSO)
  private oauth2Server: OAuth2AuthorizationServer | null = null

  // Secure callbacks for sensitive operations (not logged in events)
  private userCreatedWithPasswordCallback?: (user: User, temporaryPassword: string) => Promise<void>

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
        dataStorage: this.dataStorage, // Pass data storage adapter for webhook persistence
        ...options.eventBusConfig
      }
      
      this.eventBus = new TrokkyEventBus(eventBusConfig)
    }
    
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

  // Helper method to create audit logs
  private async createAuditLog(
    documentId: string,
    collection: string,
    operation: keyof typeof AUDIT_OPERATIONS,
    auditContext?: AuditContext,
    changes?: {
      before?: Record<string, unknown>
      after?: Record<string, unknown>
      fields?: string[]
    },
    revision?: number
  ): Promise<void> {
    // Only create audit logs if the adapter supports it and we have audit context
    if (!this.dataStorage.createAuditLog || !auditContext) {
      return
    }

    try {
      await this.dataStorage.createAuditLog({
        documentId,
        collection,
        operation: AUDIT_OPERATIONS[operation],
        actorId: auditContext.userId,
        actorType: auditContext.userType,
        actorUsername: auditContext.username,
        changes,
        timestamp: new Date(),
        revision: revision || 1,
        ipAddress: auditContext.ipAddress,
        userAgent: auditContext.userAgent,
        sessionId: undefined, // Could be added later if needed
        metadata: undefined // Could be added later for additional context
      })

      this.auditLog.info('Audit log created', {
        documentId,
        collection,
        operation: AUDIT_OPERATIONS[operation],
        actorId: auditContext.userId,
        actorType: auditContext.userType
      })
    } catch (error) {
      this.logger.warn('Failed to create audit log', { 
        error, 
        documentId, 
        collection, 
        operation 
      })
    }
  }

  // Document operations
  public async getDocument<T extends Record<string, unknown> = Record<string, unknown>>(
    collection: string, 
    id: string
  ): Promise<(Document & T) | null> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getDocument')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)
    }

    if (!this.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    const document = await this.dataStorage.getDocument(collection, id)
    return document as (Document & T) | null
  }

  public async saveDocument<T extends Record<string, unknown> = Record<string, unknown>>(
    collection: string, 
    data: DocumentData & T & { id?: string },
    auditContext?: AuditContext
  ): Promise<Document & T> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('saveDocument')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentData(data)
      
      if (data.id) {
        SecurityValidator.validateDocumentId(data.id)
      }
    }

    if (!this.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    // Validate document against schema
    const validation = this.validateDocument(collection, data)
    if (!validation.valid) {
      throw new ValidationError('Document validation failed', validation.errors)
    }

    // Generate ID if not provided
    const id = data.id || this.idGenerator.generate({ prefix: collection })
    const { id: _, ...documentData } = data

    // Check if document already exists (for event emission)
    const existingDocument = await this.dataStorage.getDocument(collection, id).catch(() => null)
    
    const savedDocument = await this.dataStorage.saveDocument(collection, id, documentData, auditContext)
    
    // Create audit log entry
    if (existingDocument) {
      // Document was updated
      const changes = extractDocumentChanges(savedDocument, existingDocument)
      await this.createAuditLog(
        id,
        collection,
        'UPDATE',
        auditContext,
        {
          before: existingDocument as unknown as Record<string, unknown>,
          after: savedDocument as unknown as Record<string, unknown>,
          fields: changes
        },
        savedDocument._revision
      )
    } else {
      // Document was created
      await this.createAuditLog(
        id,
        collection,
        'CREATE',
        auditContext,
        {
          after: savedDocument as unknown as Record<string, unknown>
        },
        savedDocument._revision
      )
    }
    
    // Emit document event
    if (this.eventsEnabled) {
      try {
        if (existingDocument) {
          // Document updated
          const changes = extractDocumentChanges(savedDocument, existingDocument)
          await this.eventBus.emitEvent(documentUpdated(
            collection,
            savedDocument,
            existingDocument,
            changes
          ))
        } else {
          // Document created
          await this.eventBus.emitEvent(documentCreated(
            collection,
            savedDocument
          ))
        }
      } catch (error) {
        this.logger.warn('Failed to emit document event', { 
          error, 
          collection,
          documentId: id,
          operation: existingDocument ? 'update' : 'create'
        })
      }
    }
    
    return savedDocument as Document & T
  }

  public async listDocuments<T extends Record<string, unknown> = Record<string, unknown>>(
    collection: string, 
    options?: ListOptions
  ): Promise<(Document & T)[]> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('listDocuments')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
    }

    if (!this.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    const sanitizedOptions = this.securityEnabled 
      ? SecurityValidator.sanitizeListOptions(options)
      : options

    const documents = await this.dataStorage.listDocuments(collection, sanitizedOptions)
    return documents as (Document & T)[]
  }

  public async deleteDocument(collection: string, id: string, auditContext?: AuditContext): Promise<void> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('deleteDocument')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)
    }

    if (!this.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    // Check if document exists
    const existingDocument = await this.dataStorage.getDocument(collection, id)
    if (!existingDocument) {
      throw new DocumentNotFoundError(collection, id)
    }

    await this.dataStorage.deleteDocument(collection, id)
    
    // Create audit log entry
    await this.createAuditLog(
      id,
      collection,
      'DELETE',
      auditContext,
      {
        before: existingDocument as unknown as Record<string, unknown>
      },
      existingDocument._revision
    )
    
    // Emit document deleted event
    if (this.eventsEnabled) {
      try {
        await this.eventBus.emitEvent(documentDeleted(
          collection,
          id,
          existingDocument
        ))
      } catch (error) {
        this.logger.warn('Failed to emit document deleted event', { 
          error, 
          collection,
          documentId: id
        })
      }
    }
  }

  // ==========================================================================
  // AUDIT LOG OPERATIONS
  // ==========================================================================

  /**
   * Get audit logs for a specific document
   */
  public async getDocumentAuditLogs(documentId: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getDocumentAuditLogs')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(documentId)
    }

    // Only allow access if adapter supports audit logs
    if (!this.dataStorage.getDocumentAuditLogs) {
      throw new Error('Audit logs not supported by storage adapter')
    }

    return await this.dataStorage.getDocumentAuditLogs(documentId, options)
  }

  /**
   * Get audit logs for a collection
   */
  public async getCollectionAuditLogs(collection: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getCollectionAuditLogs')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
    }

    if (!this.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    // Only allow access if adapter supports audit logs
    if (!this.dataStorage.getCollectionAuditLogs) {
      throw new Error('Audit logs not supported by storage adapter')
    }

    return await this.dataStorage.getCollectionAuditLogs(collection, options)
  }

  /**
   * Get audit logs for a specific actor
   */
  public async getActorAuditLogs(actorId: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getActorAuditLogs')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(actorId) // Reuse document ID validation for actor ID
    }

    // Only allow access if adapter supports audit logs
    if (!this.dataStorage.getActorAuditLogs) {
      throw new Error('Audit logs not supported by storage adapter')
    }

    return await this.dataStorage.getActorAuditLogs(actorId, options)
  }

  // Media operations
  public async uploadMedia(file: File): Promise<MediaFile> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('uploadMedia')
    }

    let sanitizedFilename = file.name
    if (this.securityEnabled) {
      sanitizedFilename = this.validateAndSanitizeMediaFile(file)
    }

    const metadata: MediaMetadata = {
      id: this.idGenerator.generate({ prefix: 'media' }),
      filename: sanitizedFilename,
      contentType: file.type,
      size: file.size,
      extension: this.getFileExtension(sanitizedFilename)
    }

    // Upload to storage first
    const mediaFile = await this.mediaStorage.uploadFile(file, metadata)

    // Process image if it's an image file
    if (file.type.startsWith('image/')) {
      try {
        const processedImage = await this.imageProcessor.processImage(file, {
          id: metadata.id,
          filename: metadata.filename,
          path: metadata.filename // Use filename as fallback since we don't have the full path here
        })

        // Save variant files directly to storage without creating separate MediaFile records
        const savedVariants: Record<string, any> = {}
        for (const [variantName, variantData] of Object.entries(processedImage.variants) as [string, ProcessedImageVariant][]) {
          if (variantData.buffer) {
            try {
              // Save variant file directly using storage adapter's variant support
              if (this.mediaStorage.saveVariantFile) {
                const variantPath = await this.mediaStorage.saveVariantFile(
                  metadata.id, 
                  variantName, 
                  variantData.buffer, 
                  variantData.format
                )
                
                // Store variant info without URL - let frontend handle URL construction
                savedVariants[variantName] = {
                  width: variantData.width,
                  height: variantData.height,
                  format: variantData.format,
                  size: variantData.size
                }

                this.logger.info('Variant file saved directly', { 
                  parentId: metadata.id, 
                  variantName,
                  path: variantPath
                })
              } else {
                // Fallback: just store metadata without physical files for now
                savedVariants[variantName] = {
                  url: variantData.url,
                  width: variantData.width,
                  height: variantData.height,
                  format: variantData.format,
                  size: variantData.size
                }
                this.logger.warn('Storage adapter does not support variant files - storing metadata only', {
                  parentId: metadata.id,
                  variantName
                })
              }
            } catch (variantError) {
              this.logger.warn('Failed to save variant file', {
                parentId: metadata.id,
                variantName,
                error: variantError instanceof Error ? variantError.message : 'Unknown error'
              })
            }
          }
        }

        // Store processed image metadata in the media file
        mediaFile.metadata = {
          ...mediaFile.metadata,
          imageVariants: savedVariants,
          originalDimensions: {
            width: processedImage.original.width,
            height: processedImage.original.height
          }
        }

        // Save the updated metadata back to storage
        try {
          if (this.mediaStorage.updateFile) {
            await this.mediaStorage.updateFile(mediaFile.id, mediaFile.metadata)
          }
          this.logger.info('Image variants metadata saved', { 
            fileId: metadata.id, 
            variantCount: Object.keys(processedImage.variants).length 
          })
        } catch (updateError) {
          this.logger.warn('Failed to save image variants metadata', { 
            fileId: metadata.id, 
            error: updateError instanceof Error ? updateError.message : 'Unknown error' 
          })
        }
      } catch (error) {
        // Log error but don't fail the upload - image processing is optional
        this.logger.warn('Image processing failed', { 
          fileId: metadata.id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    // Emit media uploaded event
    if (this.eventsEnabled) {
      try {
        await this.eventBus.emitEvent(mediaUploaded(mediaFile))
      } catch (error) {
        this.logger.warn('Failed to emit media uploaded event', { 
          error, 
          fileId: mediaFile.id
        })
      }
    }

    return mediaFile
  }

  public async getMedia(id: string): Promise<MediaFile | null> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getMedia')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    return await this.mediaStorage.getFile(id)
  }

  public async updateMedia(id: string, metadata: Record<string, any>): Promise<MediaFile> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('updateMedia')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    // Check if media exists first
    const existingMedia = await this.mediaStorage.getFile(id)
    if (!existingMedia) {
      throw new DocumentNotFoundError('media', id)
    }

    // Use the storage adapter's updateFile method if available
    if (!this.mediaStorage.updateFile) {
      throw new Error('Media update not supported by storage adapter')
    }
    
    return await this.mediaStorage.updateFile(id, metadata)
  }

  public async getMediaContent(id: string): Promise<ArrayBuffer | null> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getMediaContent')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    return await this.mediaStorage.getFileContent(id)
  }

  public async listMedia(options?: { limit?: number; offset?: number }): Promise<MediaFile[]> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('listMedia')
    }

    // Use the storage adapter's listMedia method if available
    if (!this.mediaStorage.listMedia) {
      throw new Error('Media listing not supported by storage adapter')
    }
    
    return await this.mediaStorage.listMedia(options || {})
  }

  public async deleteMedia(id: string): Promise<void> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('deleteMedia')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    // Check if media exists
    const existingMedia = await this.mediaStorage.getFile(id)
    if (!existingMedia) {
      throw new DocumentNotFoundError('media', id)
    }

    // Delete image variants if it's an image
    if (existingMedia.contentType.startsWith('image/')) {
      try {
        await this.imageProcessor.deleteImage(id)
      } catch (error) {
        // Log error but don't fail the deletion - variants cleanup is optional
        this.logger.warn('Image variants cleanup failed', { 
          fileId: id, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    await this.mediaStorage.deleteFile(id)
    
    // Emit media deleted event
    if (this.eventsEnabled) {
      try {
        await this.eventBus.emitEvent(mediaDeleted(id, existingMedia))
      } catch (error) {
        this.logger.warn('Failed to emit media deleted event', { 
          error, 
          fileId: id
        })
      }
    }
  }

  public async regenerateMediaVariants(id: string): Promise<MediaFile> {
    try {
      await this.rateLimiter?.checkRateLimit('regenerateMediaVariants')

      // Get the existing media file
      const mediaFile = await this.mediaStorage.getFile(id)
      if (!mediaFile) {
        throw new Error(`Media file with id ${id} not found`)
      }

      // Check if it's an image file
      if (!mediaFile.contentType.startsWith('image/')) {
        throw new InvalidInputError('Variant regeneration is only supported for image files', 'contentType')
      }

      this.logger.info('Starting variant regeneration', { id, filename: mediaFile.filename })

      // Get the original file content
      const fileContent = await this.mediaStorage.getFileContent(id)
      if (!fileContent) {
        throw new Error('Unable to read original file content')
      }

      // Convert ArrayBuffer to File object for image processing
      const file = new File([new Uint8Array(fileContent)], mediaFile.filename, {
        type: mediaFile.contentType
      })

      // Process the image to generate new variants
      const processedImage = await this.imageProcessor.processImage(file, {
        id: mediaFile.id,
        filename: mediaFile.filename,
        path: (mediaFile.metadata as any)?.path || mediaFile.filename
      })

      // Delete existing variants first
      if (this.mediaStorage.deleteVariantFiles) {
        try {
          await this.mediaStorage.deleteVariantFiles(id)
          this.logger.info('Existing variants deleted', { id })
        } catch (deleteError) {
          this.logger.warn('Failed to delete existing variants', { id, error: deleteError })
        }
      }

      // Save new variant files
      const savedVariants: Record<string, any> = {}
      for (const [variantName, variantData] of Object.entries(processedImage.variants) as [string, ProcessedImageVariant][]) {
        if (variantData.buffer) {
          try {
            if (this.mediaStorage.saveVariantFile) {
              const variantPath = await this.mediaStorage.saveVariantFile(
                id, 
                variantName, 
                variantData.buffer, 
                variantData.format
              )
              
              // Store variant info without URL - let frontend handle URL construction
              savedVariants[variantName] = {
                width: variantData.width,
                height: variantData.height,
                format: variantData.format,
                size: variantData.size
              }

              this.logger.info('New variant saved', { 
                parentId: id, 
                variantName,
                path: variantPath
              })
            }
          } catch (variantError) {
            this.logger.warn('Failed to save new variant', {
              parentId: id,
              variantName,
              error: variantError instanceof Error ? variantError.message : 'Unknown error'
            })
          }
        }
      }

      // Update metadata with new variants
      const updatedMetadata = {
        ...mediaFile.metadata,
        imageVariants: savedVariants,
        originalDimensions: {
          width: processedImage.original.width,
          height: processedImage.original.height
        }
      }

      // Save updated metadata
      const updatedMediaFile = await this.mediaStorage.updateFile?.(id, updatedMetadata)
      if (!updatedMediaFile) {
        throw new Error('Failed to update media file metadata')
      }
      
      this.logger.info('Variants regenerated successfully', { 
        id, 
        variantCount: Object.keys(savedVariants).length 
      })

      return updatedMediaFile
    } catch (error) {
      this.logger.error('Failed to regenerate variants', { 
        id, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      })
      throw error
    }
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
    return this.imageProcessor.getImageUrl(imageId, variantName)
  }

  public async getImageProcessor(): Promise<ImageProcessor> {
    return this.imageProcessor
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
    // Use configuration or fall back to defaults
    const mediaValidation = this.config.media?.validation
    const maxSize = mediaValidation?.maxFileSize || (100 * 1024 * 1024) // 100MB default
    const allowedTypes = mediaValidation?.allowedTypes || [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Video
      'video/mp4', 'video/webm', 'video/mov', 'video/avi',
      // Audio - comprehensive list to match AudioField and Routes
      'audio/mpeg',       // MP3 (primary MIME type)
      'audio/mp3',        // MP3 (alternative MIME type)
      'audio/wav',        // WAV
      'audio/wave',       // WAV (alternative MIME type)
      'audio/ogg',        // OGG
      'audio/aac',        // AAC
      'audio/mp4',        // M4A (MP4 audio)
      'audio/x-m4a',      // M4A (alternative MIME type)
      'audio/flac',       // FLAC
      'audio/webm',       // WebM audio
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Text
      'text/plain', 'text/csv',
      'application/json'
    ]

    if (file.size > maxSize) {
      throw new InvalidInputError(`File too large (max ${maxSize / 1024 / 1024}MB)`, 'file')
    }

    if (!allowedTypes.includes(file.type)) {
      throw new InvalidInputError(`File type not allowed: ${file.type}`, 'file')
    }

    // Sanitize filename instead of rejecting it
    const sanitizedName = this.sanitizeFilename(file.name)
    if (sanitizedName !== file.name) {
      this.logger.debug('Filename sanitized', { 
        original: file.name, 
        sanitized: sanitizedName 
      })
    }
    
    return sanitizedName
  }

  private sanitizeFilename(filename: string): string {
    // Extract extension first
    const lastDot = filename.lastIndexOf('.')
    const name = lastDot > 0 ? filename.substring(0, lastDot) : filename
    const extension = lastDot > 0 ? filename.substring(lastDot) : ''
    
    // Sanitize the name part
    let sanitized = name
      // Replace accented characters with ASCII equivalents
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Replace spaces and special characters with hyphens
      .replace(/[^a-zA-Z0-9._-]/g, '-')
      // Remove multiple consecutive hyphens
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Ensure it's not empty
      || 'file'
    
    // Sanitize extension (keep dots, letters, numbers only)
    const sanitizedExtension = extension.replace(/[^.a-zA-Z0-9]/g, '')
    
    // Limit total length to 255 characters (filesystem limit)
    const maxNameLength = 255 - sanitizedExtension.length
    if (sanitized.length > maxNameLength) {
      sanitized = sanitized.substring(0, maxNameLength)
    }
    
    return sanitized + sanitizedExtension
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.')
    return parts.length > 1 ? parts.pop()! : ''
  }

  // User management operations (system entities)
  public async createUser(userData: CreateUserData): Promise<User> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('createUser')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateEmail(userData.email)
      SecurityValidator.validateUsername(userData.username)
    }

    // User operations are handled by data storage adapter

    // Check if user already exists (use generic error message to prevent enumeration)
    const existingUserByEmail = await this.getUserByEmail(userData.email)
    if (existingUserByEmail) {
      throw new Error('User registration failed. Please check your details.')
    }

    const existingUserByUsername = await this.getUserByUsername(userData.username)
    if (existingUserByUsername) {
      throw new Error('User registration failed. Please check your details.')
    }

    // Hash password before saving
    const passwordHash = await this.hashPassword(userData.password)
    
    const userId = this.idGenerator.generate({ prefix: 'user' })
    const now = new Date().toISOString()
    
    const userToSave: Partial<User> = {
      username: userData.username,
      email: userData.email,
      passwordHash,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
      permissions: userData.permissions || this.getDefaultPermissions(userData.role),
      isActive: userData.isActive ?? true,
      profileImage: userData.profileImage,
      preferences: userData.preferences || {},
      createdAt: now,
      updatedAt: now
    }

    const createdUser = await this.dataStorage.saveUser(userId, userToSave)
    
    // Log audit event
    this.logAuditEvent({
      type: 'user_created',
      targetUserId: userId,
      username: userData.username,
      action: `User created with role: ${userData.role}`,
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        email: userData.email,
        role: userData.role,
        permissions: userData.permissions || this.getDefaultPermissions(userData.role)
      }
    })

    // Emit user.created event (WITHOUT password for security)
    await this.events.emitEvent({
      type: 'user.created',
      source: 'api',
      data: {
        user: createdUser,
        userId: createdUser.id,
      },
    })

    // Securely send password via callback (not logged in events)
    if (this.userCreatedWithPasswordCallback) {
      try {
        await this.userCreatedWithPasswordCallback(createdUser, userData.password)
      } catch (error) {
        this.logger.warn('User created callback failed (non-blocking)', error)
      }
    }

    return createdUser
  }

  public async getUser(id: string): Promise<User | null> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getUser')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    // User operations are handled by data storage adapter
    return await this.dataStorage.getUser(id)
  }

  public async getUserByUsername(username: string): Promise<User | null> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getUserByUsername')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateUsername(username)
    }

    // User operations are handled by data storage adapter
    return await this.dataStorage.getUserByUsername(username)
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getUserByEmail')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateEmail(email)
    }

    // User operations are handled by data storage adapter
    return await this.dataStorage.getUserByEmail(email)
  }

  public async updateUser(id: string, userData: UpdateUserData): Promise<User> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('updateUser')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
      if (userData.email) SecurityValidator.validateEmail(userData.email)
      if (userData.username) SecurityValidator.validateUsername(userData.username)
    }

    // User operations are handled by data storage adapter

    const existingUser = await this.getUser(id)
    if (!existingUser) {
      throw new DocumentNotFoundError('users', id)
    }

    const updatedUserData: Partial<User> = {
      ...userData,
      updatedAt: new Date().toISOString()
    }

    const updatedUser = await this.dataStorage.saveUser(id, updatedUserData)
    
    // Log audit event
    this.logAuditEvent({
      type: 'user_updated',
      targetUserId: id,
      username: existingUser.username,
      action: `User updated`,
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        updatedFields: Object.keys(userData),
        previousRole: existingUser.role,
        newRole: userData.role || existingUser.role
      }
    })
    
    return updatedUser
  }

  public async listUsers(options?: UserListOptions): Promise<User[]> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('listUsers')
    }

    // User operations are handled by data storage adapter
    return await this.dataStorage.listUsers(options)
  }

  public async deleteUser(id: string): Promise<void> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('deleteUser')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    // User operations are handled by data storage adapter

    const existingUser = await this.getUser(id)
    if (!existingUser) {
      throw new DocumentNotFoundError('users', id)
    }

    await this.dataStorage.deleteUser(id)
    
    // Log audit event
    this.logAuditEvent({
      type: 'user_deleted',
      targetUserId: id,
      username: existingUser.username,
      action: `User deleted`,
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        email: existingUser.email,
        role: existingUser.role
      }
    })
  }

  // App Token management operations
  public async listAppTokens(options?: AppTokenListOptions): Promise<AppToken[]> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('listAppTokens')
    }

    // App token operations are handled by data storage adapter
    return await this.dataStorage.listAppTokens(options)
  }

  public async createAppToken(tokenData: CreateAppTokenData, createdBy: string): Promise<AppTokenCreationResult> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('createAppToken')
    }

    // App token operations are handled by data storage adapter

    try {
      // Generate token and hash using SHA256 (fast) - bcrypt is unnecessary for API tokens
      // API tokens are long random strings, not user-chosen passwords, so SHA256 is secure
      const token = this.cryptoAdapter.generateSecureRandom(32)
      const tokenHash = createHash('sha256').update(token).digest('hex')
      
      const now = new Date().toISOString()
      const tokenId = this.idGenerator.generate()
      
      const appToken: AppToken = {
        id: tokenId,
        name: tokenData.name,
        description: tokenData.description,
        tokenHash,
        permissions: tokenData.permissions,
        isActive: true,
        createdAt: now,
        updatedAt: now,
        createdBy,
        lastUsedAt: undefined,
        expiresAt: tokenData.expiresAt
      }

      const savedToken = await this.dataStorage.saveAppToken(tokenId, appToken)
      
      return {
        success: true,
        token, // Plain text token (only returned once)
        appToken: savedToken
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create app token'
      }
    }
  }

  public async getAppToken(id: string): Promise<AppToken | null> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getAppToken')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    // App token operations are handled by data storage adapter
    return await this.dataStorage.getAppToken(id)
  }

  public async validateAppToken(token: string): Promise<{ valid: boolean; appToken?: AppToken; error?: string }> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('validateAppToken')
    }

    try {
      // Hash the provided token with SHA256 for comparison
      const providedHash = createHash('sha256').update(token).digest('hex')

      // Get all active app tokens and check if any match the hash
      const tokens = await this.dataStorage.listAppTokens({ isActive: true })

      for (const appToken of tokens) {
        // Use constant-time comparison to prevent timing attacks
        if (appToken.tokenHash && appToken.tokenHash.length === providedHash.length) {
          const storedBuffer = Buffer.from(appToken.tokenHash, 'hex')
          const providedBuffer = Buffer.from(providedHash, 'hex')
          if (timingSafeEqual(storedBuffer, providedBuffer)) {
            // Update last used timestamp and usage count
            const updatedToken: AppToken = {
              ...appToken,
              lastUsedAt: new Date().toISOString(),
              usageCount: (appToken.usageCount || 0) + 1
            }

            await this.dataStorage.saveAppToken(appToken.id, updatedToken)

            return { valid: true, appToken: updatedToken }
          }
        }
      }
      
      return { valid: false, error: 'Invalid app token' }
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'App token validation failed' 
      }
    }
  }

  public async deleteAppToken(id: string): Promise<void> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('deleteAppToken')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    // App token operations are handled by data storage adapter

    const existingToken = await this.getAppToken(id)
    if (!existingToken) {
      throw new DocumentNotFoundError('tokens', id)
    }

    await this.dataStorage.deleteAppToken(id)
    
    // Log audit event
    this.logAuditEvent({
      type: 'app_token_deleted',
      targetTokenId: id,
      tokenName: existingToken.name,
      action: `App token deleted`,
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        permissions: existingToken.permissions,
        createdBy: existingToken.createdBy
      }
    })
  }

  // Authentication utilities
  public async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await this.cryptoAdapter.verifyPassword(plainPassword, hashedPassword)
  }

  /**
   * Hash a password using the configured crypto adapter
   * Exposed publicly to ensure consistent hashing across all password operations
   */
  public async hashPassword(password: string): Promise<string> {
    return await this.cryptoAdapter.hashPassword(password)
  }

  private getDefaultPermissions(role: string): Permission[] {
    switch (role) {
      case 'admin':
        return ['content:read', 'content:write', 'content:delete', 'users:read', 'users:write', 'settings:read', 'settings:write', 'media:upload', 'media:delete', 'studio:access']
      case 'editor':
        return ['content:read', 'content:write', 'media:upload', 'studio:access']
      case 'viewer':
        return ['content:read', 'studio:access']
      default:
        return ['content:read', 'studio:access']
    }
  }

  private checkWeakPassword(password: string): { isWeak: boolean; reason?: string } {
    // Common weak passwords
    const commonPasswords = [
      'password', 'admin', 'changeme', 'changeme123', '123456', 
      'qwerty', 'abc123', 'password123', 'admin123', 'letmein',
      'welcome', 'monkey', 'dragon', 'master', 'secret'
    ]

    // Check if password is too short
    if (password.length < 8) {
      return { isWeak: true, reason: 'Password is too short (minimum 8 characters)' }
    }

    // Check for common weak passwords
    if (commonPasswords.includes(password.toLowerCase())) {
      return { isWeak: true, reason: 'Password is a common weak password' }
    }

    // Check for simple patterns
    if (/^(.)\1+$/.test(password)) {
      return { isWeak: true, reason: 'Password contains only repeated characters' }
    }

    if (/^(012|123|234|345|456|567|678|789|890|abc|def|qwe|asd|zxc)/i.test(password)) {
      return { isWeak: true, reason: 'Password contains sequential characters' }
    }

    // Warn if password is short (8-11 characters) even if not technically weak
    if (password.length < 12) {
      return { isWeak: true, reason: 'Password is shorter than recommended (12+ characters)' }
    }

    // Check password complexity
    const hasLower = /[a-z]/.test(password)
    const hasUpper = /[A-Z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)

    const complexityCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length

    if (complexityCount < 3) {
      return { isWeak: true, reason: 'Password lacks complexity (needs lowercase, uppercase, numbers, and/or symbols)' }
    }

    return { isWeak: false }
  }

  // JWT Token Management
  public async generateAuthToken(user: User, expiresIn: string = '24h', rememberMe?: boolean): Promise<string> {
    const payload: Omit<UserSession, 'loginAt' | 'expiresAt'> & { rememberMe?: boolean } = {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      rememberMe: rememberMe // Store rememberMe flag in JWT payload
    }

    return await this.cryptoAdapter.generateJWT(payload, this.jwtSecret, { expiresIn })
  }

  public async verifyAuthToken(token: string): Promise<UserSession | null> {
    const decoded = await this.cryptoAdapter.verifyJWT(token, this.jwtSecret)

    // Handle both standard 'userId' claim and OAuth2 'sub' claim
    const userId = decoded?.userId || decoded?.sub
    const username = decoded?.username

    if (!decoded || !userId || !username) {
      return null
    }

    // Fetch fresh user data from storage to get current permissions
    try {
      const currentUser = await this.getUser(userId)
      if (!currentUser || !currentUser.isActive) {
        return null // User no longer exists or is inactive
      }

      return {
        userId,
        username,
        role: currentUser.role, // Use fresh role from storage
        permissions: currentUser.permissions, // Use fresh permissions from storage
        loginAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : new Date().toISOString(),
        expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : undefined
      }
    } catch (error) {
      // If we can't fetch user data, fall back to JWT payload for backwards compatibility
      if (!decoded.role || !decoded.permissions) {
        return null
      }

      return {
        userId,
        username,
        role: decoded.role,
        permissions: decoded.permissions,
        loginAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : new Date().toISOString(),
        expiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : undefined
      }
    }
  }

  /**
   * Unified token validation that handles both JWT and API tokens
   * Returns a consistent UserSession interface for both token types
   */
  public async verifyAnyToken(token: string): Promise<UserSession | null> {
    // Check if it's a JWT token (3 parts separated by dots)
    const parts = token.split('.')
    if (parts.length === 3) {
      // JWT token - use existing verification
      return await this.verifyAuthToken(token)
    } else if (token.length === 64 && /^[a-f0-9]{64}$/.test(token)) {
      // API token - validate and get permissions
      const result = await this.validateAppToken(token)
      if (result.valid && result.appToken) {
        // Create a session-like object for API tokens
        return {
          userId: result.appToken.createdBy,
          username: `api-token-${result.appToken.name}`,
          role: 'api', // Special role for API tokens
          permissions: result.appToken.permissions,
          loginAt: new Date().toISOString(),
          expiresAt: result.appToken.expiresAt
        }
      }
    }
    
    return null
  }

  /**
   * Authentication result types for MFA support
   */
  public async authenticateUser(
    username: string,
    password: string,
    options: { rememberMe?: boolean; deviceId?: string } = {}
  ): Promise<AuthenticationResult | null> {
    try {
      // Get user by username
      const user = await this.getUserByUsername(username)
      if (!user || !user.isActive) {
        return null
      }

      // Verify password
      const isPasswordValid = await this.verifyPassword(password, user.passwordHash)
      if (!isPasswordValid) {
        return null
      }

      // Update last login time
      await this.updateUser(user.id, { lastLoginAt: new Date().toISOString() })

      // Check MFA requirements
      const mfaStatus = await this.checkMFARequired(user.id)

      // If MFA is required
      if (mfaStatus.required) {
        // Check if device is trusted (can skip MFA)
        if (options.deviceId && mfaStatus.userHasMFA) {
          const isTrusted = await this.isDeviceTrusted(user.id, options.deviceId)
          if (isTrusted) {
            // Device is trusted, issue full tokens
            return this.issueFullTokens(user, options)
          }
        }

        // User has MFA set up - require verification
        if (mfaStatus.userHasMFA) {
          // Generate MFA pending token (short-lived)
          const mfaToken = await this.generateMFAPendingToken(user, mfaStatus.methods)

          this.logAuditEvent({
            type: 'user_login',
            userId: user.id,
            username: user.username,
            action: 'MFA verification required',
            timestamp: new Date().toISOString(),
            success: true,
            details: {
              mfaRequired: true,
              methods: mfaStatus.methods
            }
          })

          return {
            type: 'mfa_required',
            requiresMFA: true,
            mfaToken,
            methods: mfaStatus.methods,
            expiresIn: 300 // 5 minutes
          }
        }

        // Org or role requires MFA but user hasn't set it up
        if (mfaStatus.reason === 'org_required' || mfaStatus.reason === 'role_required') {
          const setupToken = await this.generateMFASetupToken(user, mfaStatus.methods)

          const message = mfaStatus.reason === 'role_required'
            ? `Your role (${user.role}) requires MFA. Please set up multi-factor authentication.`
            : 'Your organization requires MFA. Please set up multi-factor authentication.'

          this.logAuditEvent({
            type: 'user_login',
            userId: user.id,
            username: user.username,
            action: 'MFA setup required',
            timestamp: new Date().toISOString(),
            success: true,
            details: {
              mfaSetupRequired: true,
              allowedMethods: mfaStatus.methods,
              reason: mfaStatus.reason
            }
          })

          return {
            type: 'mfa_setup_required',
            requiresMFASetup: true,
            setupToken,
            allowedMethods: mfaStatus.methods,
            message,
            expiresIn: 900 // 15 minutes
          }
        }
      }

      // No MFA required - issue full tokens
      return this.issueFullTokens(user, options)
    } catch (error) {
      console.error('Authentication failed:', error instanceof Error ? error.message : 'Unknown error')
      return null
    }
  }

  /**
   * Issue full authentication tokens after successful login (including MFA if required)
   */
  private async issueFullTokens(
    user: User,
    options: { rememberMe?: boolean } = {}
  ): Promise<AuthenticationSuccessResult> {
    const securityConfig = this.config.security?.tokens
    const tokenExpiresIn = options.rememberMe
      ? (securityConfig?.rememberMeTtl || '7d')
      : (securityConfig?.accessTokenTtl || '2h')
    const refreshTokenExpiresIn = options.rememberMe
      ? '30d'
      : (securityConfig?.refreshTokenTtl || '7d')

    const token = await this.generateAuthToken(user, tokenExpiresIn, options.rememberMe)
    const refreshToken = await this.generateAuthToken(user, refreshTokenExpiresIn, options.rememberMe)

    // Log successful login
    this.logAuditEvent({
      type: 'user_login',
      userId: user.id,
      username: user.username,
      action: 'User authenticated successfully',
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        role: user.role,
        lastLoginAt: new Date().toISOString(),
        rememberMe: options.rememberMe
      }
    })

    // Get token expiration time
    const session = await this.verifyAuthToken(token)
    const expiresAt = session?.expiresAt || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

    // Return user without password hash
    const { passwordHash, ...safeUser } = user
    return {
      type: 'success',
      user: { ...safeUser, passwordHash: '' } as User,
      token,
      refreshToken,
      expiresAt
    }
  }

  /**
   * Generate MFA pending token (used when MFA verification is needed)
   */
  private async generateMFAPendingToken(user: User, methods: MFAMethodType[]): Promise<string> {
    const payload = {
      type: 'mfa_pending',
      userId: user.id,
      username: user.username,
      mfaMethods: methods
    }
    return this.cryptoAdapter.generateJWT(payload, this.jwtSecret, { expiresIn: '5m' })
  }

  /**
   * Generate MFA setup token (used when org requires MFA but user hasn't set it up)
   */
  private async generateMFASetupToken(user: User, allowedMethods: MFAMethodType[]): Promise<string> {
    const payload = {
      type: 'mfa_setup',
      userId: user.id,
      username: user.username,
      allowedMethods
    }
    return this.cryptoAdapter.generateJWT(payload, this.jwtSecret, { expiresIn: '15m' })
  }

  /**
   * Complete MFA verification and issue full tokens
   * Call this after verifyMFACode returns true
   */
  public async completeMFAAuthentication(
    mfaToken: string,
    options: { rememberMe?: boolean; trustDevice?: boolean; deviceId?: string; deviceName?: string } = {}
  ): Promise<AuthenticationSuccessResult | null> {
    try {
      // Verify MFA pending token
      const payload = await this.cryptoAdapter.verifyJWT(mfaToken, this.jwtSecret) as {
        type: string
        userId: string
        username: string
      } | null

      if (!payload || payload.type !== 'mfa_pending') {
        return null
      }

      // Get user
      const user = await this.getUser(payload.userId)
      if (!user || !user.isActive) {
        return null
      }

      // Trust device if requested
      if (options.trustDevice && options.deviceId) {
        await this.trustDevice(
          user.id,
          options.deviceId,
          options.deviceName || 'Unknown Device'
        )
      }

      // Issue full tokens
      return this.issueFullTokens(user, options)
    } catch (error) {
      this.logger.error('MFA authentication completion failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * Verify MFA setup token and return user info
   */
  public async verifyMFASetupToken(setupToken: string): Promise<{
    userId: string
    username: string
    allowedMethods: MFAMethodType[]
  } | null> {
    try {
      const payload = await this.cryptoAdapter.verifyJWT(setupToken, this.jwtSecret) as {
        type: string
        userId: string
        username: string
        allowedMethods: MFAMethodType[]
      } | null

      if (!payload || payload.type !== 'mfa_setup') {
        return null
      }

      return {
        userId: payload.userId,
        username: payload.username,
        allowedMethods: payload.allowedMethods
      }
    } catch {
      return null
    }
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
    try {
      const payload = await this.cryptoAdapter.verifyJWT(token, this.jwtSecret) as {
        type: string
        userId: string
        username: string
        mfaMethods?: MFAMethodType[]
        allowedMethods?: MFAMethodType[]
      } | null

      if (!payload) {
        return null
      }

      // Validate it's an MFA token type
      if (payload.type !== 'mfa_pending' && payload.type !== 'mfa_setup') {
        return null
      }

      return {
        type: payload.type as 'mfa_pending' | 'mfa_setup',
        userId: payload.userId,
        username: payload.username,
        mfaMethods: payload.mfaMethods,
        allowedMethods: payload.allowedMethods
      }
    } catch {
      return null
    }
  }

  /**
   * Complete MFA setup and issue full authentication tokens
   * Used when a user sets up MFA during the login flow (when org requires MFA)
   */
  public async completeMFASetupAndLogin(
    setupToken: string,
    options: { rememberMe?: boolean } = {}
  ): Promise<AuthenticationSuccessResult | null> {
    try {
      // Verify MFA setup token
      const payload = await this.cryptoAdapter.verifyJWT(setupToken, this.jwtSecret) as {
        type: string
        userId: string
        username: string
      } | null

      if (!payload || payload.type !== 'mfa_setup') {
        return null
      }

      // Get user
      const user = await this.getUser(payload.userId)
      if (!user || !user.isActive) {
        return null
      }

      // Verify user now has MFA enabled
      if (!user.mfa?.enabled || !user.mfa.methods?.some(m => m.enabled && m.verified)) {
        this.logger.warn('MFA setup completion attempted but MFA not enabled', {
          userId: user.id
        })
        return null
      }

      this.logger.info('MFA setup completed, issuing auth tokens', {
        userId: user.id,
        username: user.username
      })

      // Issue full tokens
      return this.issueFullTokens(user, options)
    } catch (error) {
      this.logger.error('MFA setup completion failed', {
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * Verify a backup code for a user
   * Returns result with remaining codes if valid
   */
  public async verifyBackupCode(userId: string, code: string): Promise<{
    valid: boolean
    remainingCodes: string[]
  }> {
    const user = await this.getUser(userId)
    if (!user || !user.mfa?.backupCodes) {
      return { valid: false, remainingCodes: [] }
    }

    const totpService = this.getTOTPService()
    const result = totpService.verifyBackupCode(user.mfa.backupCodes, code)

    if (result.valid) {
      // Update user with remaining codes
      await this.updateUser(userId, {
        mfa: {
          ...user.mfa,
          backupCodes: result.remainingCodes
        }
      } as UpdateUserData)

      this.logger.info('Backup code used', {
        userId,
        remainingCodes: result.remainingCodes.length
      })
    }

    return result
  }

  public async refreshAuthToken(refreshToken: string): Promise<{ token: string; refreshToken: string; user: User; expiresAt: string } | null> {
    try {
      // Verify the refresh token
      const session = await this.verifyAuthToken(refreshToken)
      if (!session) {
        return null
      }

      // Get the user
      const user = await this.getUser(session.userId)
      if (!user || !user.isActive) {
        return null
      }

      // Extract rememberMe flag from the refresh token payload
      const decoded = await this.cryptoAdapter.verifyJWT(refreshToken, this.jwtSecret)
      const rememberMe = decoded?.rememberMe === true

      // Generate new tokens preserving the rememberMe state
      const securityConfig = this.config.security?.tokens
      const tokenExpiresIn = rememberMe
        ? (securityConfig?.rememberMeTtl || '7d')
        : (securityConfig?.accessTokenTtl || '2h')
      const refreshTokenExpiresIn = rememberMe
        ? '30d'
        : (securityConfig?.refreshTokenTtl || '7d')

      const newToken = await this.generateAuthToken(user, tokenExpiresIn, rememberMe)
      const newRefreshToken = await this.generateAuthToken(user, refreshTokenExpiresIn, rememberMe)

      // Get the new token's expiration time
      const newSession = await this.verifyAuthToken(newToken)
      const expiresAt = newSession?.expiresAt || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

      return {
        token: newToken,
        refreshToken: newRefreshToken,
        user,
        expiresAt
      }
    } catch (error) {
      this.logger.error('Failed to refresh auth token', { error: error instanceof Error ? error.message : String(error) })
      return null
    }
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
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found')
    }

    // Check if this provider is already linked to another user
    const existingUser = await this.getUserByOAuthProvider(
      provider.provider,
      provider.providerId
    )
    if (existingUser && existingUser.id !== userId) {
      throw new InvalidInputError(
        'This account is already linked to another user'
      )
    }

    // Check if user already has this provider linked
    const existingProviders = user.oauthProviders || []
    const alreadyLinked = existingProviders.some(
      (p) => p.provider === provider.provider
    )
    if (alreadyLinked) {
      throw new InvalidInputError(
        `${provider.provider} account is already linked`
      )
    }

    // Add the provider
    const updatedProviders = [...existingProviders, provider]
    const updatedUser = await this.updateUser(userId, {
      oauthProviders: updatedProviders,
    } as any)

    this.logAuditEvent({
      type: 'user_updated',
      userId: user.id,
      username: user.username,
      action: `Linked ${provider.provider} OAuth account`,
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        provider: provider.provider,
        providerEmail: provider.email,
      },
    })

    return updatedUser
  }

  /**
   * Unlink an OAuth provider from a user
   */
  public async unlinkOAuthProvider(
    userId: string,
    providerName: OAuthProviderType
  ): Promise<User> {
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found')
    }

    const existingProviders = user.oauthProviders || []
    const providerToRemove = existingProviders.find(
      (p) => p.provider === providerName
    )

    if (!providerToRemove) {
      throw new InvalidInputError(`${providerName} account is not linked`)
    }

    // Remove the provider
    const updatedProviders = existingProviders.filter(
      (p) => p.provider !== providerName
    )
    const updatedUser = await this.updateUser(userId, {
      oauthProviders: updatedProviders,
    } as any)

    this.logAuditEvent({
      type: 'user_updated',
      userId: user.id,
      username: user.username,
      action: `Unlinked ${providerName} OAuth account`,
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        provider: providerName,
      },
    })

    return updatedUser
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
    try {
      // Find user by OAuth provider
      const user = await this.getUserByOAuthProvider(providerName, providerId)
      if (!user || !user.isActive) {
        return null
      }

      // Update last login time and lastUsedAt for the OAuth provider
      const now = new Date().toISOString()
      const updatedProviders = (user.oauthProviders || []).map((p) =>
        p.provider === providerName && p.providerId === providerId
          ? { ...p, lastUsedAt: now }
          : p
      )

      await this.updateUser(user.id, {
        lastLoginAt: now,
        oauthProviders: updatedProviders,
      } as any)

      // Check MFA requirements (same as regular login)
      const mfaStatus = await this.checkMFARequired(user.id)

      if (mfaStatus.required) {
        // User has MFA set up - check if device is trusted first
        if (mfaStatus.userHasMFA) {
          // Check if device is trusted (can skip MFA)
          if (options?.deviceId) {
            const isTrusted = await this.isDeviceTrusted(user.id, options.deviceId)
            if (isTrusted) {
              this.logger.info('OAuth login - skipping MFA for trusted device', {
                userId: user.id,
                provider: providerName,
                deviceId: options.deviceId.substring(0, 8) + '...',
              })
              // Device is trusted, issue full tokens (skip MFA)
              return this.issueFullTokens(user, {})
            }
          }

          const mfaToken = await this.generateMFAPendingToken(user, mfaStatus.methods)

          this.logAuditEvent({
            type: 'user_login',
            userId: user.id,
            username: user.username,
            action: `OAuth login - MFA verification required`,
            timestamp: now,
            success: true,
            details: {
              mfaRequired: true,
              methods: mfaStatus.methods,
              provider: providerName,
            },
          })

          return {
            type: 'mfa_required',
            requiresMFA: true,
            mfaToken,
            methods: mfaStatus.methods,
            expiresIn: 300, // 5 minutes
          }
        }

        // Org/role requires MFA but user hasn't set it up
        if (mfaStatus.reason === 'org_required' || mfaStatus.reason === 'role_required') {
          const setupToken = await this.generateMFASetupToken(user, mfaStatus.methods)

          const message = mfaStatus.reason === 'role_required'
            ? `Your role (${user.role}) requires MFA. Please set up multi-factor authentication.`
            : 'Your organization requires MFA. Please set up multi-factor authentication.'

          this.logAuditEvent({
            type: 'user_login',
            userId: user.id,
            username: user.username,
            action: `OAuth login - MFA setup required`,
            timestamp: now,
            success: true,
            details: {
              mfaSetupRequired: true,
              allowedMethods: mfaStatus.methods,
              reason: mfaStatus.reason,
              provider: providerName,
            },
          })

          return {
            type: 'mfa_setup_required',
            requiresMFASetup: true,
            setupToken,
            allowedMethods: mfaStatus.methods,
            message,
            expiresIn: 900, // 15 minutes
          }
        }
      }

      // No MFA required - generate full tokens
      const securityConfig = this.config.security?.tokens
      const tokenExpiresIn = securityConfig?.accessTokenTtl || '2h'
      const refreshTokenExpiresIn = securityConfig?.refreshTokenTtl || '7d'

      const token = await this.generateAuthToken(user, tokenExpiresIn, false)
      const refreshToken = await this.generateAuthToken(
        user,
        refreshTokenExpiresIn,
        false
      )

      // Log successful login
      this.logAuditEvent({
        type: 'user_login',
        userId: user.id,
        username: user.username,
        action: `User authenticated via ${providerName} OAuth`,
        timestamp: now,
        success: true,
        details: {
          role: user.role,
          provider: providerName,
        },
      })

      // Return user without password hash
      const { passwordHash, ...safeUser } = user

      // Get token expiration time
      const session = await this.verifyAuthToken(token)

      return {
        type: 'success',
        user: { ...safeUser, passwordHash: '' } as User,
        token,
        refreshToken,
        expiresAt: session?.expiresAt || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      }
    } catch (error) {
      this.logger.error('OAuth authentication failed', {
        error: error instanceof Error ? error.message : String(error),
        provider: providerName,
      })
      return null
    }
  }

  /**
   * Find a user by OAuth provider
   */
  public async getUserByOAuthProvider(
    providerName: OAuthProviderType,
    providerId: string
  ): Promise<User | null> {
    // First try storage adapter method if available
    if (this.dataStorage.getUserByOAuthProvider) {
      return this.dataStorage.getUserByOAuthProvider(providerName, providerId)
    }

    // Fallback: list all users and search (inefficient, but works as fallback)
    this.logger.warn(
      'getUserByOAuthProvider not implemented in storage adapter, using fallback'
    )
    const users = await this.listUsers({ limit: 10000 })
    for (const user of users) {
      const provider = (user.oauthProviders || []).find(
        (p) => p.provider === providerName && p.providerId === providerId
      )
      if (provider) {
        return user
      }
    }
    return null
  }

  /**
   * Check if OAuth is configured for a provider
   */
  public isOAuthConfigured(providerName: OAuthProviderType): boolean {
    if (providerName === 'google') {
      const config = this.config.oauth?.google
      return !!(config?.clientId && config?.clientSecret && config?.redirectUri)
    }
    return false
  }

  /**
   * Get OAuth configuration for a provider
   */
  public getOAuthConfig(providerName: OAuthProviderType): Record<string, string> | null {
    if (providerName === 'google' && this.isOAuthConfigured('google')) {
      const config = this.config.oauth!.google!
      return {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
      }
    }
    return null
  }

  // ==========================================================================
  // Passkey/WebAuthn Methods
  // ==========================================================================

  /**
   * Check if passkey authentication is configured
   */
  public isPasskeyConfigured(): boolean {
    const config = this.config.security?.passkey
    // Debug logging
    this.logger.debug('isPasskeyConfigured check', {
      hasSecurityConfig: !!this.config.security,
      hasPasskeyConfig: !!config,
      passkeyEnabled: config?.enabled,
      passkeyRpId: config?.rpId,
      passkeyOrigin: config?.origin,
    })
    return !!(config?.enabled && config?.rpId && config?.origin)
  }

  /**
   * Get passkey configuration
   */
  public getPasskeyConfig(): import('@trokky/types').PasskeyConfig | null {
    if (!this.isPasskeyConfigured()) return null
    return this.config.security!.passkey!
  }

  /**
   * Find a user by passkey credential ID
   */
  public async getUserByPasskeyCredentialId(credentialId: string): Promise<User | null> {
    // First try storage adapter method if available
    if ((this.dataStorage as any).getUserByPasskeyCredentialId) {
      return (this.dataStorage as any).getUserByPasskeyCredentialId(credentialId)
    }

    // Fallback: list all users and search (inefficient, but works as fallback)
    this.logger.warn(
      'getUserByPasskeyCredentialId not implemented in storage adapter, using fallback'
    )
    const users = await this.listUsers({ limit: 10000 })
    for (const user of users) {
      const credential = (user.passkeys || []).find(
        (p) => p.id === credentialId
      )
      if (credential) {
        return user
      }
    }
    return null
  }

  /**
   * Add a passkey credential to a user
   */
  public async addPasskeyToUser(
    userId: string,
    credential: import('@trokky/types').PasskeyCredential
  ): Promise<User> {
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found')
    }

    // Check if credential ID already exists for this user
    const existingPasskeys = user.passkeys || []
    const alreadyExists = existingPasskeys.some((p) => p.id === credential.id)
    if (alreadyExists) {
      throw new InvalidInputError('Passkey credential already registered')
    }

    // Add the credential
    const updatedPasskeys = [...existingPasskeys, credential]
    const updatedUser = await this.updateUser(userId, {
      passkeys: updatedPasskeys,
    } as any)

    this.logAuditEvent({
      type: 'user_updated',
      targetUserId: userId,
      username: user.username,
      action: 'Passkey credential added',
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        credentialId: credential.id,
        friendlyName: credential.friendlyName,
        deviceType: credential.deviceType,
      },
    })

    return updatedUser
  }

  /**
   * Remove a passkey credential from a user
   */
  public async removePasskeyFromUser(userId: string, credentialId: string): Promise<User> {
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found')
    }

    const existingPasskeys = user.passkeys || []
    const credentialToRemove = existingPasskeys.find((p) => p.id === credentialId)

    if (!credentialToRemove) {
      throw new InvalidInputError('Passkey credential not found')
    }

    const updatedPasskeys = existingPasskeys.filter((p) => p.id !== credentialId)
    const updatedUser = await this.updateUser(userId, {
      passkeys: updatedPasskeys,
    } as any)

    this.logAuditEvent({
      type: 'user_updated',
      targetUserId: userId,
      username: user.username,
      action: 'Passkey credential removed',
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        credentialId,
        friendlyName: credentialToRemove.friendlyName,
      },
    })

    return updatedUser
  }

  /**
   * Update a passkey credential (counter, lastUsedAt, friendlyName)
   */
  public async updateUserPasskey(
    userId: string,
    credentialId: string,
    updates: Partial<import('@trokky/types').PasskeyCredential>
  ): Promise<User> {
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found')
    }

    const existingPasskeys = user.passkeys || []
    const credentialIndex = existingPasskeys.findIndex((p) => p.id === credentialId)

    if (credentialIndex === -1) {
      throw new InvalidInputError('Passkey credential not found')
    }

    // Update the credential
    const updatedCredential = {
      ...existingPasskeys[credentialIndex],
      ...updates,
    }
    const updatedPasskeys = [...existingPasskeys]
    updatedPasskeys[credentialIndex] = updatedCredential

    const updatedUser = await this.updateUser(userId, {
      passkeys: updatedPasskeys,
    } as any)

    return updatedUser
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
    try {
      const user = await this.getUser(userId)
      if (!user || !user.isActive) {
        return null
      }

      // Update last login time and lastUsedAt for the passkey
      const now = new Date().toISOString()
      const updatedPasskeys = (user.passkeys || []).map((p) =>
        p.id === credentialId ? { ...p, lastUsedAt: now } : p
      )

      await this.updateUser(user.id, {
        lastLoginAt: now,
        passkeys: updatedPasskeys,
      } as any)

      // Check MFA requirements (same as regular login)
      const mfaStatus = await this.checkMFARequired(user.id)

      if (mfaStatus.required) {
        // User has MFA set up - check if device is trusted first
        if (mfaStatus.userHasMFA) {
          // Check if device is trusted (can skip MFA)
          if (options?.deviceId) {
            const isTrusted = await this.isDeviceTrusted(user.id, options.deviceId)
            if (isTrusted) {
              this.logger.info('Passkey login - skipping MFA for trusted device', {
                userId: user.id,
                credentialId: credentialId.substring(0, 8) + '...',
                deviceId: options.deviceId.substring(0, 8) + '...',
              })
              // Device is trusted, issue full tokens (skip MFA)
              return this.issueFullTokens(user, {})
            }
          }

          const mfaToken = await this.generateMFAPendingToken(user, mfaStatus.methods)

          this.logAuditEvent({
            type: 'user_login',
            userId: user.id,
            username: user.username,
            action: 'Passkey login - MFA verification required',
            timestamp: now,
            success: true,
            details: {
              mfaRequired: true,
              methods: mfaStatus.methods,
              authMethod: 'passkey',
            },
          })

          return {
            type: 'mfa_required',
            requiresMFA: true,
            mfaToken,
            methods: mfaStatus.methods,
            expiresIn: 300, // 5 minutes
          }
        }

        // Org/role requires MFA but user hasn't set it up
        if (mfaStatus.reason === 'org_required' || mfaStatus.reason === 'role_required') {
          const setupToken = await this.generateMFASetupToken(user, mfaStatus.methods)

          const message = mfaStatus.reason === 'role_required'
            ? `Your role (${user.role}) requires MFA. Please set up multi-factor authentication.`
            : 'Your organization requires MFA. Please set up multi-factor authentication.'

          this.logAuditEvent({
            type: 'user_login',
            userId: user.id,
            username: user.username,
            action: 'Passkey login - MFA setup required',
            timestamp: now,
            success: true,
            details: {
              mfaSetupRequired: true,
              allowedMethods: mfaStatus.methods,
              reason: mfaStatus.reason,
              authMethod: 'passkey',
            },
          })

          return {
            type: 'mfa_setup_required',
            requiresMFASetup: true,
            setupToken,
            allowedMethods: mfaStatus.methods,
            message,
            expiresIn: 900, // 15 minutes
          }
        }
      }

      // No MFA required - issue full tokens
      return this.issueFullTokens(user, {})
    } catch (error) {
      this.logger.error('Passkey authentication failed', error)
      return null
    }
  }

  // ==========================================================================
  // CAPTCHA Methods
  // ==========================================================================

  /**
   * Get or create the CAPTCHA provider instance
   * @private
   */
  private getCaptchaProvider(): CaptchaProvider | null {
    if (this.captchaProvider) return this.captchaProvider

    const config = this.config.captcha
    if (!config?.siteKey || !config?.secretKey) return null

    try {
      this.captchaProvider = createCaptchaProvider(config.provider, {
        siteKey: config.siteKey,
        secretKey: config.secretKey,
        options: config.options,
      })
      return this.captchaProvider
    } catch (error) {
      this.logger.error('Failed to create CAPTCHA provider', error)
      return null
    }
  }

  /**
   * Check if CAPTCHA is configured
   */
  public isCaptchaConfigured(): boolean {
    const config = this.config.captcha
    return !!(config?.siteKey && config?.secretKey && config?.provider)
  }

  /**
   * Check if CAPTCHA is required for a specific endpoint
   * @param endpoint - The endpoint to check ('login', 'passwordResetRequest', 'passwordResetVerify')
   */
  public isCaptchaRequiredFor(endpoint: CaptchaProtectedEndpoint): boolean {
    if (!this.isCaptchaConfigured()) return false
    const protectedEndpoints = this.config.captcha?.protectedEndpoints
    // Default: all endpoints are protected if no specific config
    if (!protectedEndpoints) return true
    return protectedEndpoints[endpoint] ?? true
  }

  /**
   * Get CAPTCHA configuration for frontend use
   * Returns public config (site key, provider, options) - never the secret key
   */
  public getCaptchaConfig(): { provider: CaptchaProviderType; siteKey: string; options?: Record<string, unknown> } | null {
    if (!this.isCaptchaConfigured()) return null
    const config = this.config.captcha!
    return {
      provider: config.provider,
      siteKey: config.siteKey,
      options: config.options,
    }
  }

  /**
   * Verify a CAPTCHA token
   * @param token - The CAPTCHA token from the frontend widget
   * @param remoteIp - Optional client IP address for verification
   */
  public async verifyCaptcha(token: string, remoteIp?: string): Promise<CaptchaVerificationResult> {
    const provider = this.getCaptchaProvider()
    if (!provider) {
      this.logger.warn('CAPTCHA verification called but no provider configured')
      // Fail open if not configured - allows systems without CAPTCHA to work
      return { success: true }
    }
    return provider.verify(token, remoteIp)
  }

  // ==========================================================================
  // MFA (Multi-Factor Authentication) Methods
  // ==========================================================================

  /**
   * Get the TOTP service instance
   * Creates one with a default issuer (can be overridden via settings)
   */
  private getTOTPService(issuer?: string): TOTPService {
    // Default issuer - can be configured via settings
    return new TOTPService({ issuer: issuer || 'Trokky' })
  }

  /**
   * Get the Email OTP service instance
   */
  private getEmailOTPService(): EmailOTPService {
    return new EmailOTPService({
      codeLength: 6,
      expiryMinutes: 10,
      maxAttempts: 5
    })
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
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Check if user has MFA enabled
    const userHasMFA = user.mfa?.enabled === true && (user.mfa.methods?.length ?? 0) > 0
    const userMethods = user.mfa?.methods?.filter(m => m.enabled && m.verified).map(m => m.type) || []

    // Check organization-level MFA requirement
    const settings = await this.getSettings()
    const orgRequiresMFA = settings?.mfaRequired === true

    // Check role-based MFA enforcement
    const enforcedRoles = settings?.mfaEnforcedRoles || []
    const roleRequiresMFA = user.role !== 'api' && enforcedRoles.includes(user.role as any)

    if (userHasMFA) {
      return {
        required: true,
        methods: userMethods,
        reason: 'user_enabled',
        userHasMFA: true
      }
    }

    if (orgRequiresMFA) {
      // Org requires MFA but user hasn't set it up yet
      const allowedMethods = settings?.mfaAllowedMethods || ['totp', 'email']
      return {
        required: true,
        methods: allowedMethods,
        reason: 'org_required',
        userHasMFA: false
      }
    }

    if (roleRequiresMFA) {
      // User's role requires MFA but user hasn't set it up yet
      const allowedMethods = settings?.mfaAllowedMethods || ['totp', 'email']
      return {
        required: true,
        methods: allowedMethods,
        reason: 'role_required',
        userHasMFA: false
      }
    }

    return {
      required: false,
      methods: [],
      reason: 'not_required',
      userHasMFA: false
    }
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
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Get issuer from settings or use default
    const settings = await this.getSettings()
    const issuer = settings?.studioTitle || settings?.organizationName || 'Trokky'
    const totpService = this.getTOTPService(issuer)
    const result = await totpService.generateSecret(user.email || user.username)

    // Store the secret temporarily in user preferences (unverified)
    const pendingTOTP: MFAMethod = {
      type: 'totp',
      enabled: false,
      verified: false,
      secret: result.secret // Will be encrypted by storage adapter
    }

    // Update user with pending TOTP setup
    const currentMFA = user.mfa || { enabled: false, methods: [] }
    const existingMethods = (currentMFA.methods || []).filter(m => m.type !== 'totp')

    await this.updateUser(userId, {
      mfa: {
        ...currentMFA,
        methods: [...existingMethods, pendingTOTP]
      }
    } as UpdateUserData)

    this.logger.info('TOTP setup initialized', { userId })

    return result
  }

  /**
   * Verify and enable TOTP for a user
   * Must be called after initializeTOTPSetup with a valid code from authenticator
   */
  public async verifyAndEnableTOTP(userId: string, code: string): Promise<{
    enabled: boolean
    backupCodes?: string[]
  }> {
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Find pending TOTP method
    const pendingTOTP = user.mfa?.methods?.find(m => m.type === 'totp' && !m.verified)
    if (!pendingTOTP || !pendingTOTP.secret) {
      throw new InvalidInputError('No pending TOTP setup found. Call initializeTOTPSetup first.', 'totp')
    }

    // Verify the code
    const totpService = this.getTOTPService()
    const isValid = totpService.verifyCode(pendingTOTP.secret, code)

    if (!isValid) {
      throw new InvalidInputError('Invalid TOTP code', 'code')
    }

    // Update TOTP method as verified and enabled
    const verifiedTOTP: MFAMethod = {
      ...pendingTOTP,
      enabled: true,
      verified: true,
      verifiedAt: new Date().toISOString()
    }

    const currentMFA = user.mfa || { enabled: false, methods: [] }
    const otherMethods = (currentMFA.methods || []).filter(m => m.type !== 'totp')

    // Generate backup codes only if this is the first MFA method
    let backupCodes: string[] | undefined
    let hashedBackupCodes = currentMFA.backupCodes
    let backupCodesGeneratedAt = currentMFA.backupCodesGeneratedAt

    if (!hashedBackupCodes || hashedBackupCodes.length === 0) {
      backupCodes = totpService.generateBackupCodes(10)
      hashedBackupCodes = backupCodes.map(c => totpService.hashBackupCode(c))
      backupCodesGeneratedAt = new Date().toISOString()
    }

    await this.updateUser(userId, {
      mfa: {
        enabled: true,
        methods: [...otherMethods, verifiedTOTP],
        backupCodes: hashedBackupCodes,
        backupCodesGeneratedAt,
        trustedDevices: currentMFA.trustedDevices || []
      }
    } as UpdateUserData)

    this.logger.info('TOTP enabled for user', { userId })

    // Log audit event
    this.logAuditEvent({
      type: 'user_updated',
      userId,
      username: user.username,
      action: 'MFA TOTP enabled',
      timestamp: new Date().toISOString(),
      success: true,
      details: { mfaMethod: 'totp' }
    })

    return {
      enabled: true,
      backupCodes // Return plain codes - user must save them
    }
  }

  /**
   * Initialize Email OTP setup for a user
   * Sends verification code to user's email
   */
  public async initializeEmailOTPSetup(userId: string): Promise<{ expiresIn: number }> {
    const user = await this.getUser(userId)
    if (!user || !user.email) {
      throw new InvalidInputError('User not found or has no email', 'userId')
    }

    const emailService = this.getEmailOTPService()
    const result = emailService.generateCode()

    // Store the OTP in user preferences
    const storedOTP: StoredEmailOTP = emailService.createStoredOTP(result)

    // Store in user preferences for later verification
    const currentPreferences = user.preferences || {}
    await this.updateUser(userId, {
      preferences: {
        ...currentPreferences,
        _pendingEmailOTP: storedOTP
      }
    } as UpdateUserData)

    // Emit event for email notification
    if (this.eventsEnabled) {
      this.eventBus.emitEvent({
        type: 'user.mfa_otp_requested',
        source: 'trokky-core',
        data: {
          userId,
          email: user.email,
          firstName: user.firstName,
          otpCode: result.code,
          expiryMinutes: 10,
          purpose: 'MFA setup',
        },
      }).catch(error => {
        this.logger.warn('Failed to emit MFA OTP event', error)
      })
    }

    this.logger.info('Email OTP generated for MFA setup', {
      userId,
      email: user.email,
      expiresAt: result.expiresAt
    })

    return { expiresIn: 10 * 60 } // 10 minutes in seconds
  }

  /**
   * Verify and enable Email OTP for a user
   */
  public async verifyAndEnableEmailOTP(userId: string, code: string): Promise<{
    enabled: boolean
    backupCodes?: string[]
  }> {
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Get stored OTP from preferences
    const storedOTP = user.preferences?._pendingEmailOTP as StoredEmailOTP | undefined
    if (!storedOTP) {
      throw new InvalidInputError('No pending email OTP found. Call initializeEmailOTPSetup first.', 'emailOtp')
    }

    // Verify the code
    const emailService = this.getEmailOTPService()
    const verificationResult = emailService.verifyCode(code, storedOTP)

    if (!verificationResult.valid) {
      if (verificationResult.expired) {
        throw new InvalidInputError('Email OTP has expired', 'code')
      }
      if (verificationResult.maxAttemptsExceeded) {
        throw new InvalidInputError('Maximum verification attempts exceeded', 'code')
      }

      // Update attempt count
      const updatedOTP = emailService.incrementAttempts(storedOTP)
      await this.updateUser(userId, {
        preferences: {
          ...user.preferences,
          _pendingEmailOTP: updatedOTP
        }
      } as UpdateUserData)

      throw new InvalidInputError(
        `Invalid code. ${verificationResult.attemptsRemaining} attempts remaining.`,
        'code'
      )
    }

    // Create verified email MFA method
    const emailMethod: MFAMethod = {
      type: 'email',
      enabled: true,
      verified: true,
      verifiedAt: new Date().toISOString()
    }

    const currentMFA = user.mfa || { enabled: false, methods: [] }
    const otherMethods = (currentMFA.methods || []).filter(m => m.type !== 'email')

    // Generate backup codes if this is the first MFA method
    let backupCodes: string[] | undefined
    let hashedBackupCodes = currentMFA.backupCodes
    let backupCodesGeneratedAt = currentMFA.backupCodesGeneratedAt

    if (!hashedBackupCodes || hashedBackupCodes.length === 0) {
      const totpService = this.getTOTPService()
      backupCodes = totpService.generateBackupCodes(10)
      hashedBackupCodes = backupCodes.map(c => totpService.hashBackupCode(c))
      backupCodesGeneratedAt = new Date().toISOString()
    }

    // Remove pending OTP and update MFA config
    const { _pendingEmailOTP, ...cleanPreferences } = user.preferences || {}

    await this.updateUser(userId, {
      preferences: cleanPreferences,
      mfa: {
        enabled: true,
        methods: [...otherMethods, emailMethod],
        backupCodes: hashedBackupCodes,
        backupCodesGeneratedAt,
        trustedDevices: currentMFA.trustedDevices || []
      }
    } as UpdateUserData)

    this.logger.info('Email OTP enabled for user', { userId })

    return { enabled: true, backupCodes }
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
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    if (method === 'totp') {
      const totpMethod = user.mfa?.methods?.find(m => m.type === 'totp' && m.enabled && m.verified)
      if (!totpMethod?.secret) {
        throw new InvalidInputError('TOTP not configured for this user', 'method')
      }

      const totpService = this.getTOTPService()
      return totpService.verifyCode(totpMethod.secret, code)
    }

    if (method === 'backup') {
      const hashedCodes = user.mfa?.backupCodes || []
      if (hashedCodes.length === 0) {
        throw new InvalidInputError('No backup codes available', 'method')
      }

      const totpService = this.getTOTPService()
      const result = totpService.verifyBackupCode(hashedCodes, code)

      if (result.valid) {
        // Update user with remaining backup codes
        await this.updateUser(userId, {
          mfa: {
            ...user.mfa!,
            backupCodes: result.remainingCodes
          }
        } as UpdateUserData)

        this.logger.info('Backup code used', {
          userId,
          remainingCodes: result.remainingCodes.length
        })
      }

      return result.valid
    }

    if (method === 'email') {
      // Email OTP verification during login
      const storedOTP = user.preferences?._loginEmailOTP as StoredEmailOTP | undefined
      if (!storedOTP) {
        throw new InvalidInputError('No email OTP sent. Call sendMFAEmailOTP first.', 'method')
      }

      const emailService = this.getEmailOTPService()
      const result = emailService.verifyCode(code, storedOTP)

      if (result.valid) {
        // Clear the OTP
        const { _loginEmailOTP, ...cleanPreferences } = user.preferences || {}
        await this.updateUser(userId, {
          preferences: cleanPreferences
        } as UpdateUserData)
      } else if (!result.expired && !result.maxAttemptsExceeded) {
        // Update attempt count
        const updatedOTP = emailService.incrementAttempts(storedOTP)
        await this.updateUser(userId, {
          preferences: {
            ...user.preferences,
            _loginEmailOTP: updatedOTP
          }
        } as UpdateUserData)
      }

      return result.valid
    }

    return false
  }

  /**
   * Send Email OTP for MFA verification during login
   */
  public async sendMFAEmailOTP(userId: string): Promise<{ expiresIn: number }> {
    const user = await this.getUser(userId)
    if (!user || !user.email) {
      throw new InvalidInputError('User not found or has no email', 'userId')
    }

    // Check if email MFA is enabled for this user
    const emailMethod = user.mfa?.methods?.find(m => m.type === 'email' && m.enabled && m.verified)
    if (!emailMethod) {
      throw new InvalidInputError('Email MFA not enabled for this user', 'method')
    }

    const emailService = this.getEmailOTPService()
    const result = emailService.generateCode()
    const storedOTP = emailService.createStoredOTP(result)

    // Store for verification
    await this.updateUser(userId, {
      preferences: {
        ...user.preferences,
        _loginEmailOTP: storedOTP
      }
    } as UpdateUserData)

    // Emit event for email notification
    if (this.eventsEnabled) {
      this.eventBus.emitEvent({
        type: 'user.mfa_otp_requested',
        source: 'trokky-core',
        data: {
          userId,
          email: user.email,
          firstName: user.firstName,
          otpCode: result.code,
          expiryMinutes: 10,
          purpose: 'login verification',
        },
      }).catch(error => {
        this.logger.warn('Failed to emit MFA OTP event', error)
      })
    }

    this.logger.info('Login email OTP generated', {
      userId,
      email: user.email,
      expiresAt: result.expiresAt
    })

    return { expiresIn: 10 * 60 }
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
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.passwordHash)
    if (!isPasswordValid) {
      throw new InvalidInputError('Invalid password', 'password')
    }

    // Check if this is the last MFA method
    const enabledMethods = user.mfa?.methods?.filter(m => m.enabled && m.verified) || []
    if (enabledMethods.length <= 1 && enabledMethods[0]?.type === method) {
      // Check if org requires MFA
      const settings = await this.getSettings()
      if (settings?.mfaRequired) {
        throw new InvalidInputError(
          'Cannot disable last MFA method when organization requires MFA',
          'method'
        )
      }
    }

    // Remove the method
    const updatedMethods = (user.mfa?.methods || []).filter(m => m.type !== method)
    const stillHasMFA = updatedMethods.some(m => m.enabled && m.verified)

    await this.updateUser(userId, {
      mfa: {
        ...user.mfa!,
        enabled: stillHasMFA,
        methods: updatedMethods
      }
    } as UpdateUserData)

    this.logger.info('MFA method disabled', { userId, method })

    this.logAuditEvent({
      type: 'user_updated',
      userId,
      username: user.username,
      action: `MFA ${method} disabled`,
      timestamp: new Date().toISOString(),
      success: true,
      details: { mfaMethod: method }
    })
  }

  /**
   * Disable all MFA for a user (removes all methods and backup codes)
   * Requires password verification
   */
  public async disableAllMFA(userId: string, password: string): Promise<void> {
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.passwordHash)
    if (!isPasswordValid) {
      throw new InvalidInputError('Invalid password', 'password')
    }

    // Check if org requires MFA
    const settings = await this.getSettings()
    if (settings?.mfaRequired) {
      throw new InvalidInputError(
        'Cannot disable MFA when organization requires MFA',
        'mfa'
      )
    }

    // Completely reset MFA
    await this.updateUser(userId, {
      mfa: {
        enabled: false,
        methods: [],
        backupCodes: [],
        backupCodesGeneratedAt: undefined,
        trustedDevices: []
      }
    } as UpdateUserData)

    this.logger.info('All MFA disabled for user', { userId })

    this.logAuditEvent({
      type: 'user_updated',
      userId,
      username: user.username,
      action: 'All MFA disabled',
      timestamp: new Date().toISOString(),
      success: true,
      details: { mfaDisabled: true }
    })
  }

  /**
   * Regenerate backup codes for a user
   * Requires password verification
   */
  public async regenerateBackupCodes(userId: string, password: string): Promise<string[]> {
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, user.passwordHash)
    if (!isPasswordValid) {
      throw new InvalidInputError('Invalid password', 'password')
    }

    // Check if user has MFA enabled
    if (!user.mfa?.enabled) {
      throw new InvalidInputError('MFA is not enabled', 'mfa')
    }

    const totpService = this.getTOTPService()
    const backupCodes = totpService.generateBackupCodes(10)
    const hashedBackupCodes = backupCodes.map(c => totpService.hashBackupCode(c))

    await this.updateUser(userId, {
      mfa: {
        ...user.mfa,
        backupCodes: hashedBackupCodes,
        backupCodesGeneratedAt: new Date().toISOString()
      }
    } as UpdateUserData)

    this.logger.info('Backup codes regenerated', { userId })

    return backupCodes
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
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Get trust duration from settings
    const settings = await this.getSettings()
    const trustDays = settings?.mfaTrustDeviceDays ?? 30

    const trustedDevice: TrustedDevice = {
      id: deviceId,
      name: deviceName,
      trustedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + trustDays * 24 * 60 * 60 * 1000).toISOString(),
      lastUsedAt: new Date().toISOString(),
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent
    }

    const currentDevices = user.mfa?.trustedDevices || []
    // Remove existing device with same ID if present
    const otherDevices = currentDevices.filter(d => d.id !== deviceId)

    await this.updateUser(userId, {
      mfa: {
        ...user.mfa!,
        trustedDevices: [...otherDevices, trustedDevice]
      }
    } as UpdateUserData)

    this.logger.info('Device trusted', { userId, deviceId, deviceName })

    return trustedDevice
  }

  /**
   * Check if a device is trusted for MFA bypass
   */
  public async isDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
    const user = await this.getUser(userId)
    if (!user) {
      return false
    }

    const device = user.mfa?.trustedDevices?.find(d => d.id === deviceId)
    if (!device) {
      return false
    }

    // Check if trust has expired
    if (new Date(device.expiresAt) < new Date()) {
      // Clean up expired device
      const updatedDevices = (user.mfa?.trustedDevices || []).filter(d => d.id !== deviceId)
      await this.updateUser(userId, {
        mfa: {
          ...user.mfa!,
          trustedDevices: updatedDevices
        }
      } as UpdateUserData)
      return false
    }

    // Update last used time
    const updatedDevices = (user.mfa?.trustedDevices || []).map(d =>
      d.id === deviceId ? { ...d, lastUsedAt: new Date().toISOString() } : d
    )
    await this.updateUser(userId, {
      mfa: {
        ...user.mfa!,
        trustedDevices: updatedDevices
      }
    } as UpdateUserData)

    return true
  }

  /**
   * Revoke trust for a specific device
   */
  public async revokeTrustedDevice(userId: string, deviceId: string): Promise<void> {
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    const updatedDevices = (user.mfa?.trustedDevices || []).filter(d => d.id !== deviceId)

    await this.updateUser(userId, {
      mfa: {
        ...user.mfa!,
        trustedDevices: updatedDevices
      }
    } as UpdateUserData)

    this.logger.info('Device trust revoked', { userId, deviceId })
  }

  /**
   * Revoke trust for all devices
   */
  public async revokeAllTrustedDevices(userId: string): Promise<void> {
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    await this.updateUser(userId, {
      mfa: {
        ...user.mfa!,
        trustedDevices: []
      }
    } as UpdateUserData)

    this.logger.info('All device trust revoked', { userId })
  }

  /**
   * Get list of trusted devices for a user
   */
  public async getTrustedDevices(userId: string): Promise<TrustedDevice[]> {
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    // Filter out expired devices
    const now = new Date()
    const validDevices = (user.mfa?.trustedDevices || []).filter(
      d => new Date(d.expiresAt) > now
    )

    return validDevices
  }

  /**
   * Admin: Reset MFA for a user (emergency recovery)
   * Removes all MFA configuration
   */
  public async adminResetUserMFA(adminUserId: string, targetUserId: string): Promise<void> {
    // Verify admin has permission
    const admin = await this.getUser(adminUserId)
    if (!admin || admin.role !== 'admin') {
      throw new InvalidInputError('Unauthorized: Admin access required', 'adminUserId')
    }

    const targetUser = await this.getUser(targetUserId)
    if (!targetUser) {
      throw new InvalidInputError('Target user not found', 'targetUserId')
    }

    // Reset MFA configuration
    await this.updateUser(targetUserId, {
      mfa: {
        enabled: false,
        methods: [],
        backupCodes: [],
        trustedDevices: []
      }
    } as UpdateUserData)

    this.logger.warn('Admin reset MFA for user', {
      adminUserId,
      adminUsername: admin.username,
      targetUserId,
      targetUsername: targetUser.username
    })

    this.logAuditEvent({
      type: 'admin_access',
      userId: adminUserId,
      targetUserId,
      username: admin.username,
      action: 'Admin reset MFA for user',
      timestamp: new Date().toISOString(),
      success: true,
      details: {
        targetUsername: targetUser.username
      }
    })
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
    const user = await this.getUser(userId)
    if (!user) {
      throw new InvalidInputError('User not found', 'userId')
    }

    const mfa = user.mfa || { enabled: false, methods: [] }

    return {
      enabled: mfa.enabled,
      methods: (mfa.methods || []).map(m => ({
        type: m.type,
        enabled: m.enabled,
        verified: m.verified,
        verifiedAt: m.verifiedAt
      })),
      backupCodesRemaining: (mfa.backupCodes || []).length,
      backupCodesGeneratedAt: mfa.backupCodesGeneratedAt,
      trustedDevicesCount: (mfa.trustedDevices || []).filter(
        d => new Date(d.expiresAt) > new Date()
      ).length
    }
  }

  private generateSecureSecret(): string {
    // Generate a cryptographically secure random secret using crypto adapter
    // This will be called during initialization, but we need to create a temporary adapter
    const tempAdapter = detectCryptoAdapter()
    const secret = tempAdapter.generateSecureRandom(64)
    
    // Warn if using generated secret (should use environment variable in production)
    const isTestEnv = (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')
    if (!isTestEnv) {
      console.warn('⚠️  Using auto-generated JWT secret. Set TROKKY_JWT_SECRET environment variable for production.')
    }
    
    return secret
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
    const adminEmail = (typeof process !== 'undefined' ? process.env?.TROKKY_ADMIN_EMAIL : undefined)
    const adminPassword = (typeof process !== 'undefined' ? process.env?.TROKKY_ADMIN_PASSWORD : undefined)
    
    // Only proceed if environment variables are set
    if (!adminEmail || !adminPassword) {
      return null
    }

    // Check if any users exist
    try {
      const existingUsers = await this.listUsers({ limit: 1 })
      if (existingUsers.length > 0) {
        // Users already exist, don't create admin
        return null
      }
    } catch (error) {
      // If user operations aren't supported, skip
      if (error instanceof Error && error.message.includes('not supported by storage adapter')) {
        return null
      }
      throw error
    }

    // Create admin user from environment variables
    const adminUser = await this.createUser({
      username: 'admin',
      email: adminEmail,
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      permissions: ['content:read', 'content:write', 'content:delete', 'users:read', 'users:write', 'settings:read', 'settings:write', 'media:upload', 'media:delete', 'studio:access'],
      isActive: true,
      preferences: {
        theme: 'dark',
        language: 'en'
      }
    })

    // Log admin creation with security warning
    const envName = (typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined)
    if (envName !== 'test') {
      console.log('🔧 Admin user created from environment variables')
      console.log(`   Email: ${adminEmail}`)
      console.log('   Username: admin')
      
      // Enhanced password strength warnings
      const isWeakPassword = this.checkWeakPassword(adminPassword)
      if (isWeakPassword.isWeak) {
        console.warn('')
        console.warn('🚨 SECURITY WARNING: Weak admin password detected!')
        console.warn(`   Reason: ${isWeakPassword.reason}`)
        console.warn('   Please use a strong password with:')
        console.warn('   • At least 12 characters')
        console.warn('   • Mixed case letters (A-z)')
        console.warn('   • Numbers (0-9)')
        console.warn('   • Special characters (!@#$%^&*)')
        console.warn('   • No common words or patterns')
        if (envName === 'production') {
          console.warn('🔥 CRITICAL: Change this password immediately in production!')
        }
      } else {
        console.log('✅ Password strength check passed')
      }
      console.log('')
    }

    return adminUser
  }

  // ============================================
  // OAuth2 Authorization Server Methods
  // ============================================

  /**
   * Get the OAuth2 Authorization Server instance
   * Returns null if OAuth2 is not enabled
   */
  public getOAuth2Server(): OAuth2AuthorizationServer | null {
    return this.oauth2Server
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
    const accessTokenTtl = this.options.oauth2?.accessTokenTtl ?? 3600
    const refreshTokenTtl = this.options.oauth2?.refreshTokenTtl ?? 2592000
    const includeRefreshToken = scopes.includes('offline_access')

    // Convert OAuth2 scopes to permissions for the token payload
    const permissions = this.oauth2Server?.scopesToPermissions(scopes) || []

    // Generate access token
    const accessTokenPayload = {
      sub: user.id,
      type: 'oauth2_access',
      clientId,
      scopes,
      permissions,
      username: user.username,
      email: user.email,
      role: user.role
    }

    const accessToken = await this.cryptoAdapter.generateJWT(accessTokenPayload, this.jwtSecret, {
      expiresIn: accessTokenTtl
    })

    let refreshToken: string | undefined
    if (includeRefreshToken) {
      const refreshTokenPayload = {
        sub: user.id,
        type: 'oauth2_refresh',
        clientId,
        scopes
      }

      refreshToken = await this.cryptoAdapter.generateJWT(refreshTokenPayload, this.jwtSecret, {
        expiresIn: refreshTokenTtl
      })
    }

    this.logger.info('OAuth2 tokens generated', {
      userId: user.id,
      clientId,
      scopes,
      includeRefreshToken
    })

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTokenTtl
    }
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
    try {
      // Verify refresh token
      const payload = await this.cryptoAdapter.verifyJWT(refreshToken, this.jwtSecret) as {
        sub: string
        type: string
        clientId: string
        scopes: OAuth2Scope[]
      } | null

      if (!payload) {
        this.logger.warn('Invalid refresh token')
        return null
      }

      // Validate token type and client
      if (payload.type !== 'oauth2_refresh') {
        this.logger.warn('Invalid token type for refresh', { type: payload.type })
        return null
      }

      if (payload.clientId !== clientId) {
        this.logger.warn('Client ID mismatch for refresh', {
          expected: payload.clientId,
          received: clientId
        })
        return null
      }

      // Get user to ensure they still exist and are active
      const user = await this.getUser(payload.sub)
      if (!user || !user.isActive) {
        this.logger.warn('User not found or inactive for refresh', { userId: payload.sub })
        return null
      }

      // Determine scopes - can only narrow, not expand
      let scopes = payload.scopes
      if (requestedScope) {
        const requestedScopes = requestedScope.split(' ').filter(Boolean) as OAuth2Scope[]
        scopes = requestedScopes.filter(s => payload.scopes.includes(s))
      }

      // Generate new tokens
      const tokens = await this.generateOAuth2Tokens(user, scopes, clientId)

      this.logger.info('OAuth2 token refreshed', {
        userId: user.id,
        clientId,
        scopes
      })

      return {
        access_token: tokens.accessToken,
        token_type: 'Bearer',
        expires_in: tokens.expiresIn,
        refresh_token: tokens.refreshToken,
        scope: scopes.join(' ')
      }
    } catch (error) {
      this.logger.warn('OAuth2 token refresh failed', { error })
      return null
    }
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
    try {
      const user = await this.getUser(userId)
      if (!user) {
        this.logger.debug('getUserConsent: user not found', { userId })
        return { hasConsent: false, consentedScopes: [] }
      }

      this.logger.debug('getUserConsent: checking consent', {
        userId,
        clientId,
        requestedScopes,
        userPreferences: user.preferences
      })

      // Get consents from user preferences
      const consents = (user.preferences?._oauth2Consents || {}) as Record<string, {
        scopes: OAuth2Scope[]
        grantedAt: string
        expiresAt?: string
      }>

      const consent = consents[clientId]
      if (!consent) {
        this.logger.debug('getUserConsent: no consent found for client', { clientId, consents })
        return { hasConsent: false, consentedScopes: [] }
      }

      // Check if consent has expired
      if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) {
        this.logger.debug('getUserConsent: consent expired', { consent })
        return { hasConsent: false, consentedScopes: [] }
      }

      // Check if all requested scopes are already consented
      const consentedScopes = consent.scopes || []
      const hasAllScopes = requestedScopes.every(scope => consentedScopes.includes(scope))

      this.logger.debug('getUserConsent: result', {
        hasAllScopes,
        consentedScopes,
        requestedScopes
      })

      return {
        hasConsent: hasAllScopes,
        consentedScopes
      }
    } catch (error) {
      this.logger.warn('Failed to check user consent', { error, userId, clientId })
      return { hasConsent: false, consentedScopes: [] }
    }
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
    try {
      this.logger.info('saveUserConsent: starting', { userId, clientId, scopes })

      const user = await this.getUser(userId)
      if (!user) {
        this.logger.warn('Cannot save consent - user not found', { userId })
        return false
      }

      // Get existing consents
      const currentPreferences = user.preferences || {}
      const existingConsents = (currentPreferences._oauth2Consents || {}) as Record<string, {
        scopes: OAuth2Scope[]
        grantedAt: string
        expiresAt?: string
      }>

      this.logger.debug('saveUserConsent: existing state', {
        currentPreferences,
        existingConsents
      })

      // Merge scopes if consent already exists
      const existingConsent = existingConsents[clientId]
      const mergedScopes = existingConsent
        ? [...new Set([...existingConsent.scopes, ...scopes])] as OAuth2Scope[]
        : scopes

      // Calculate expiry (default: 365 days, or never if not specified)
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined

      // Update consents
      const updatedConsents = {
        ...existingConsents,
        [clientId]: {
          scopes: mergedScopes,
          grantedAt: new Date().toISOString(),
          expiresAt
        }
      }

      const newPreferences = {
        ...currentPreferences,
        _oauth2Consents: updatedConsents
      }

      this.logger.debug('saveUserConsent: saving new preferences', { newPreferences })

      // Save to user preferences
      await this.updateUser(userId, {
        preferences: newPreferences
      })

      this.logger.info('User consent saved successfully', {
        userId,
        clientId,
        scopes: mergedScopes
      })

      return true
    } catch (error) {
      this.logger.error('Failed to save user consent', { error, userId, clientId })
      return false
    }
  }

  /**
   * Revoke user consent for a client
   */
  public async revokeUserConsent(userId: string, clientId: string): Promise<boolean> {
    try {
      const user = await this.getUser(userId)
      if (!user) {
        return false
      }

      const currentPreferences = user.preferences || {}
      const existingConsents = (currentPreferences._oauth2Consents || {}) as Record<string, unknown>

      if (!existingConsents[clientId]) {
        return true // Already revoked
      }

      // Remove the consent for this client
      const { [clientId]: _removed, ...remainingConsents } = existingConsents

      await this.updateUser(userId, {
        preferences: {
          ...currentPreferences,
          _oauth2Consents: remainingConsents
        }
      })

      this.logger.info('User consent revoked', { userId, clientId })
      return true
    } catch (error) {
      this.logger.error('Failed to revoke user consent', { error, userId, clientId })
      return false
    }
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
