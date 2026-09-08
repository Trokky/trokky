import { SchemaRegistry } from '../schema/registry.js'
import { SecurityValidator } from '../security/validation.js'
import { RateLimiter } from '../security/rate-limiter.js'
import { IdGenerator } from '../utils/id-generator.js'
import type { TrokkyLogger } from '../utils/logger.js'
import { TrokkyEventBus } from '../events/index.js'
import {
  documentCreated,
  documentUpdated,
  documentDeleted,
  extractDocumentChanges
} from '../events/index.js'
import {
  SchemaNotFoundError,
  DocumentNotFoundError,
  ValidationError
} from '../errors/index.js'
import {
  DataStorageAdapter,
  Document,
  DocumentData,
  ListOptions,
  ValidationResult,
  AuditContext,
  AuditLog,
  AUDIT_OPERATIONS
} from '../types/index.js'

/** System fields that clients may send back but must never overwrite storage-managed values */
const PRESERVED_SYSTEM_FIELDS = new Set(['_status', '_type'])

/**
 * Remove client-sent system fields (keys starting with "_") from document data.
 * _status and _type are content-level fields and are preserved.
 */
function stripSystemFields(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('_') && !PRESERVED_SYSTEM_FIELDS.has(key)) {
      continue
    }
    result[key] = value
  }
  return result
}

export interface DocumentServiceDependencies {
  logger: TrokkyLogger
  auditLog: TrokkyLogger
  dataStorage: DataStorageAdapter
  schemas: SchemaRegistry
  idGenerator: IdGenerator
  rateLimiter?: RateLimiter
  securityEnabled: boolean
  eventBus: TrokkyEventBus
  eventsEnabled: boolean
  validateDocument: (collection: string, data: unknown) => ValidationResult
}

/**
 * Document CRUD, document audit logging and audit log queries.
 */
export class DocumentService {
  constructor(private readonly deps: DocumentServiceDependencies) {}

  // Helper method to create audit logs
  public async createAuditLog(
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
    if (!this.deps.dataStorage.createAuditLog || !auditContext) {
      return
    }

    try {
      await this.deps.dataStorage.createAuditLog({
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

      this.deps.auditLog.info('Audit log created', {
        documentId,
        collection,
        operation: AUDIT_OPERATIONS[operation],
        actorId: auditContext.userId,
        actorType: auditContext.userType
      })
    } catch (error) {
      this.deps.logger.warn('Failed to create audit log', {
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
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('getDocument')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)
    }

    if (!this.deps.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    const document = await this.deps.dataStorage.getDocument(collection, id)
    return document as (Document & T) | null
  }

  public async saveDocument<T extends Record<string, unknown> = Record<string, unknown>>(
    collection: string,
    data: DocumentData & T & { id?: string },
    auditContext?: AuditContext
  ): Promise<Document & T> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('saveDocument')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentData(data)

      if (data.id) {
        SecurityValidator.validateDocumentId(data.id)
      }
    }

    if (!this.deps.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    // Validate document against schema
    const validation = this.deps.validateDocument(collection, data)
    if (!validation.valid) {
      throw new ValidationError('Document validation failed', validation.errors)
    }

    // Generate ID if not provided
    const id = data.id || this.deps.idGenerator.generate({ prefix: collection })
    const { id: _, ...rest } = data
    const documentData = stripSystemFields(rest as Record<string, unknown>)

    // Check if document already exists (for event emission)
    const existingDocument = await this.deps.dataStorage.getDocument(collection, id).catch(() => null)

    const savedDocument = await this.deps.dataStorage.saveDocument(collection, id, documentData, auditContext)

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
    if (this.deps.eventsEnabled) {
      try {
        if (existingDocument) {
          // Document updated
          const changes = extractDocumentChanges(savedDocument, existingDocument)
          await this.deps.eventBus.emitEvent(documentUpdated(
            collection,
            savedDocument,
            existingDocument,
            changes
          ))
        } else {
          // Document created
          await this.deps.eventBus.emitEvent(documentCreated(
            collection,
            savedDocument
          ))
        }
      } catch (error) {
        this.deps.logger.warn('Failed to emit document event', {
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
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('listDocuments')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
    }

    if (!this.deps.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    const sanitizedOptions = this.deps.securityEnabled
      ? SecurityValidator.sanitizeListOptions(options)
      : options

    const documents = await this.deps.dataStorage.listDocuments(collection, sanitizedOptions)
    return documents as (Document & T)[]
  }

  public async countDocuments(collection: string, filter?: Record<string, unknown>): Promise<number> {
    if (this.deps.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
    }

    if (!this.deps.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    if (this.deps.dataStorage.countDocuments) {
      return this.deps.dataStorage.countDocuments(collection, filter)
    }

    // Fallback: list and count
    const documents = await this.deps.dataStorage.listDocuments(collection, { filter })
    return documents.length
  }

  public async deleteDocument(collection: string, id: string, auditContext?: AuditContext): Promise<void> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('deleteDocument')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)
    }

    if (!this.deps.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    // Check if document exists
    const existingDocument = await this.deps.dataStorage.getDocument(collection, id)
    if (!existingDocument) {
      throw new DocumentNotFoundError(collection, id)
    }

    await this.deps.dataStorage.deleteDocument(collection, id)

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
    if (this.deps.eventsEnabled) {
      try {
        await this.deps.eventBus.emitEvent(documentDeleted(
          collection,
          id,
          existingDocument
        ))
      } catch (error) {
        this.deps.logger.warn('Failed to emit document deleted event', {
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
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('getDocumentAuditLogs')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateDocumentId(documentId)
    }

    // Only allow access if adapter supports audit logs
    if (!this.deps.dataStorage.getDocumentAuditLogs) {
      throw new Error('Audit logs not supported by storage adapter')
    }

    return await this.deps.dataStorage.getDocumentAuditLogs(documentId, options)
  }

  /**
   * Get audit logs for a collection
   */
  public async getCollectionAuditLogs(collection: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('getCollectionAuditLogs')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateCollectionName(collection)
    }

    if (!this.deps.schemas.hasSchema(collection)) {
      throw new SchemaNotFoundError(collection)
    }

    // Only allow access if adapter supports audit logs
    if (!this.deps.dataStorage.getCollectionAuditLogs) {
      throw new Error('Audit logs not supported by storage adapter')
    }

    return await this.deps.dataStorage.getCollectionAuditLogs(collection, options)
  }

  /**
   * Get audit logs for a specific actor
   */
  public async getActorAuditLogs(actorId: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]> {
    if (this.deps.rateLimiter) {
      await this.deps.rateLimiter.checkRateLimit('getActorAuditLogs')
    }

    if (this.deps.securityEnabled) {
      SecurityValidator.validateDocumentId(actorId) // Reuse document ID validation for actor ID
    }

    // Only allow access if adapter supports audit logs
    if (!this.deps.dataStorage.getActorAuditLogs) {
      throw new Error('Audit logs not supported by storage adapter')
    }

    return await this.deps.dataStorage.getActorAuditLogs(actorId, options)
  }
}
