import { detectCryptoAdapter, type CryptoAdapter, type CryptoAdapterOptions } from '../crypto/adapter.js'
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
  AUDIT_OPERATIONS
} from '../types/index.js'
import type { AppTokenCreationResult } from '../security/auth.js'

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
      // Generate token and hash using crypto adapter
      const token = this.cryptoAdapter.generateSecureRandom(32)
      const tokenHash = await this.cryptoAdapter.hashPassword(token)
      
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
      // Get all active app tokens and check if any match the hash
      const tokens = await this.dataStorage.listAppTokens({ isActive: true })
      
      for (const appToken of tokens) {
        if (appToken.tokenHash && await this.cryptoAdapter.verifyPassword(token, appToken.tokenHash)) {
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

  private async hashPassword(password: string): Promise<string> {
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
  public async generateAuthToken(user: User, expiresIn: string = '24h'): Promise<string> {
    const payload: Omit<UserSession, 'loginAt' | 'expiresAt'> = {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions
    }
    
    return await this.cryptoAdapter.generateJWT(payload, this.jwtSecret, { expiresIn })
  }

  public async verifyAuthToken(token: string): Promise<UserSession | null> {
    const decoded = await this.cryptoAdapter.verifyJWT(token, this.jwtSecret)
    
    if (!decoded || !decoded.userId || !decoded.username) {
      return null
    }

    // Fetch fresh user data from storage to get current permissions
    try {
      const currentUser = await this.getUser(decoded.userId)
      if (!currentUser || !currentUser.isActive) {
        return null // User no longer exists or is inactive
      }

      return {
        userId: decoded.userId,
        username: decoded.username,
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
        userId: decoded.userId,
        username: decoded.username,
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

  public async authenticateUser(username: string, password: string, options: { rememberMe?: boolean } = {}): Promise<{ user: User; token: string; refreshToken: string } | null> {
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

      // Generate tokens - different expiry times based on rememberMe
      const tokenExpiresIn = options.rememberMe ? '7d' : '2h' // 2 hours for normal sessions
      const refreshTokenExpiresIn = options.rememberMe ? '30d' : '7d' // 7 days for refresh tokens
      
      const token = await this.generateAuthToken(user, tokenExpiresIn)
      const refreshToken = await this.generateAuthToken(user, refreshTokenExpiresIn)

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

      // Return user without password hash
      const { passwordHash, ...safeUser } = user
      return { 
        user: { ...safeUser, passwordHash: '' } as User, // Keep type but empty the hash
        token,
        refreshToken
      }
    } catch (error) {
      console.error('Authentication failed:', error instanceof Error ? error.message : 'Unknown error')
      return null
    }
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

      // Generate new tokens with consistent expiration times
      const newToken = await this.generateAuthToken(user, '2h') // Match login token expiry
      const newRefreshToken = await this.generateAuthToken(user, '7d') // Match refresh token expiry
      
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

  // Rate limiter cleanup (call periodically)
  public cleanup(): void {
    if (this.rateLimiter) {
      this.rateLimiter.cleanup()
    }
  }
}
