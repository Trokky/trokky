import { SchemaRegistry } from '../schema/registry.js'
import { DocumentValidator } from '../validation/validator.js'
import { SecurityValidator } from '../security/validation.js'
import { RateLimiter, RateLimitConfig } from '../security/rate-limiter.js'
import { IdGenerator } from '../utils/id-generator.js'
import { 
  SchemaNotFoundError, 
  DocumentNotFoundError, 
  ValidationError,
  InvalidInputError
} from '../errors/index.js'
import { 
  TrokkyConfig, 
  StorageAdapter, 
  Document, 
  DocumentData, 
  ListOptions,
  MediaFile,
  MediaMetadata,
  ContentSchema,
  ValidationResult
} from '../types/index.js'

export interface TrokkyCoreOptions {
  schemaRegistry?: SchemaRegistry
  validator?: DocumentValidator
  idGenerator?: IdGenerator
  rateLimiter?: RateLimiter
  enableSecurity?: boolean
}

export class TrokkyCore {
  private storage: StorageAdapter
  private schemas: SchemaRegistry
  private validator: DocumentValidator
  private idGenerator: IdGenerator
  private rateLimiter?: RateLimiter
  private securityEnabled: boolean

  constructor(
    config: TrokkyConfig, 
    storageAdapter: StorageAdapter,
    options: TrokkyCoreOptions = {}
  ) {
    this.storage = storageAdapter
    this.schemas = options.schemaRegistry || new SchemaRegistry(config.schemas)
    this.validator = options.validator || new DocumentValidator(this.schemas)
    this.idGenerator = options.idGenerator || new IdGenerator()
    this.securityEnabled = options.enableSecurity ?? config.security?.validateInput ?? true
    
    if (config.security?.rateLimitEnabled || config.api?.rateLimit) {
      const rateLimitConfig: RateLimitConfig = {
        windowMs: config.api?.rateLimit?.windowMs || 60 * 1000,
        maxRequests: config.api?.rateLimit?.maxRequests || 1000
      }
      this.rateLimiter = options.rateLimiter || new RateLimiter(rateLimitConfig)
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

    const document = await this.storage.getDocument(collection, id)
    return document as (Document & T) | null
  }

  public async saveDocument<T extends Record<string, unknown> = Record<string, unknown>>(
    collection: string, 
    data: DocumentData & T & { id?: string }
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

    const savedDocument = await this.storage.saveDocument(collection, id, documentData)
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

    const documents = await this.storage.listDocuments(collection, sanitizedOptions)
    return documents as (Document & T)[]
  }

  public async deleteDocument(collection: string, id: string): Promise<void> {
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
    const existingDocument = await this.storage.getDocument(collection, id)
    if (!existingDocument) {
      throw new DocumentNotFoundError(collection, id)
    }

    return await this.storage.deleteDocument(collection, id)
  }

  // Media operations
  public async uploadMedia(file: File): Promise<MediaFile> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('uploadMedia')
    }

    if (this.securityEnabled) {
      this.validateMediaFile(file)
    }

    const metadata: MediaMetadata = {
      id: this.idGenerator.generate({ prefix: 'media' }),
      filename: file.name,
      contentType: file.type,
      size: file.size,
      extension: this.getFileExtension(file.name)
    }

    return await this.storage.uploadFile(file, metadata)
  }

  public async getMedia(id: string): Promise<MediaFile | null> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('getMedia')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    return await this.storage.getFile(id)
  }

  public async deleteMedia(id: string): Promise<void> {
    if (this.rateLimiter) {
      await this.rateLimiter.checkRateLimit('deleteMedia')
    }

    if (this.securityEnabled) {
      SecurityValidator.validateDocumentId(id)
    }

    // Check if media exists
    const existingMedia = await this.storage.getFile(id)
    if (!existingMedia) {
      throw new DocumentNotFoundError('media', id)
    }

    return await this.storage.deleteFile(id)
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

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      const storageHealthy = await this.storage.healthCheck()
      const schemasLoaded = this.schemas.getAllSchemas().length > 0
      
      return storageHealthy && schemasLoaded
    } catch {
      return false
    }
  }

  // Utility methods
  private validateMediaFile(file: File): void {
    const maxSize = 100 * 1024 * 1024 // 100MB
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm',
      'audio/mp3', 'audio/wav', 'audio/ogg',
      'application/pdf', 'text/plain'
    ]

    if (file.size > maxSize) {
      throw new InvalidInputError(`File too large (max ${maxSize / 1024 / 1024}MB)`, 'file')
    }

    if (!allowedTypes.includes(file.type)) {
      throw new InvalidInputError(`File type not allowed: ${file.type}`, 'file')
    }

    // Validate filename
    if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
      throw new InvalidInputError('Invalid filename characters', 'file')
    }
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.')
    return parts.length > 1 ? parts.pop()! : ''
  }

  // Rate limiter cleanup (call periodically)
  public cleanup(): void {
    if (this.rateLimiter) {
      this.rateLimiter.cleanup()
    }
  }
}