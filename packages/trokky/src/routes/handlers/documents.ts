/**
 * DocumentRoutes - Collection and document route handlers
 */

import { SecurityValidator, InvalidInputError, expandDocumentReferences, parseExpandParam } from '../../core/index.js'
import type { HttpRequest, HttpResponse, RouteDefinition, CreateDocumentRequest, UpdateDocumentRequest } from '../types.js'
import { processSlugFields } from '../slug-processor.js'
import { isSingletonSchema, collectStructureSingletons } from '../../core/schema/singleton.js'
import { BaseRoutes } from './base.js'

/** System fields that clients may send back but must never overwrite storage-managed values */
const PRESERVED_SYSTEM_FIELDS = new Set(['_status', '_type'])

/**
 * Remove client-sent system fields (keys starting with "_") from document data.
 * _status and _type are content-level fields and are preserved.
 */
function stripSystemFields<T extends Record<string, unknown>>(data: T): T {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('_') && !PRESERVED_SYSTEM_FIELDS.has(key)) {
      continue
    }
    result[key] = value
  }
  return result as T
}

export class DocumentRoutes extends BaseRoutes {
  public getRoutes(): RouteDefinition[] {
    const basePath = this.config.basePath || ''
    return this.defineRoutes([
      ['GET', `${basePath}/collections`, this.listCollections.bind(this)],
      ['GET', `${basePath}/collections/:collection`, this.listDocuments.bind(this)],
      ['POST', `${basePath}/collections/:collection`, this.createDocument.bind(this)],
      ['GET', `${basePath}/collections/:collection/:id`, this.getDocument.bind(this)],
      ['PUT', `${basePath}/collections/:collection/:id`, this.updateDocument.bind(this)],
      ['DELETE', `${basePath}/collections/:collection/:id`, this.deleteDocument.bind(this)],
      ['GET', `${basePath}/stats/:collection`, this.getCollectionStats.bind(this)],
      ['GET', `${basePath}/slugs/check-unique`, this.checkSlugUniqueness.bind(this)]
    ])
  }

  // Route handlers
  private async listCollections(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)

      // Get all schemas from the core engine
      const schemas = this.core.getAllSchemas()
      
      this.logger.debug('Collections listed', { 
        count: schemas.length,
        collections: schemas.map(s => s.name)
      })

      return {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          ...this.buildCorsHeaders()
        },
        body: JSON.stringify({
          success: true,
          data: {
            collections: schemas
          }
        })
      }
    } catch (error) {
      this.logger.error('Failed to list collections', { error: error instanceof Error ? error.message : String(error) })
      
      if (error instanceof InvalidInputError) {
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: {
              code: error.code || 'INVALID_INPUT',
              message: error.message,
              details: error.details
            }
          })
        }
      }

      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to list collections'
          }
        })
      }
    }
  }

  private async listDocuments(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and schema read permissions
      await this.validateAuthentication(request)
      const { collection } = request.params
      await this.validateSchemaAccess(request, collection, 'read')
      const { limit, offset, filter, sort, page, search } = request.query

      // Validate collection name
      SecurityValidator.validateCollectionName(collection)

      // Build list options - handle both offset and page-based pagination
      const options: any = {}

      // Handle pagination (page-based or offset-based)
      if (page && limit) {
        const pageNum = parseInt(String(page), 10)
        const limitNum = parseInt(String(limit), 10)
        options.limit = limitNum
        options.offset = (pageNum - 1) * limitNum
      } else {
        if (limit) options.limit = parseInt(String(limit), 10)
        if (offset) options.offset = parseInt(String(offset), 10)
      }

      // Handle filters - parse bracket notation from query params
      // Studio sends filter[field]=value which Express parses as nested object
      if (filter) {
        try {
          if (typeof filter === 'string') {
            // Try parsing as JSON string
            options.filter = JSON.parse(filter)
          } else if (typeof filter === 'object' && filter !== null) {
            // Already parsed by Express query parser
            options.filter = filter
          }
        } catch {
          throw new InvalidInputError('Invalid filter format', 'filter')
        }
      }

      // Handle sorting - convert prefix notation to field.direction
      // Studio sends "-field" for desc, "field" for asc
      if (sort) {
        if (typeof sort === 'string' && sort.startsWith('-')) {
          options.sort = `${sort.substring(1)}.desc`
        } else if (typeof sort === 'string' && !sort.includes('.') && !sort.includes(':')) {
          options.sort = `${sort}.asc`
        } else {
          options.sort = sort
        }
      }

      let documents = await this.core.listDocuments(collection, options)

      // Get total count BEFORE search filtering (but after listDocuments)
      // Call dataStorage directly since countDocuments is optional and not on core
      const dataStorage = (this.core as any).dataStorage
      let totalCount: number
      if (dataStorage && dataStorage.countDocuments) {
        // Use adapter's count method with the same filter
        totalCount = await dataStorage.countDocuments(collection, options.filter || {})
      } else {
        // Fallback to document length if countDocuments not available
        totalCount = documents.length
      }

      // Handle search filtering - simple client-side text search
      if (search && typeof search === 'string' && search.trim()) {
        const searchLower = search.trim().toLowerCase()
        documents = documents.filter(doc => {
          // Search across common text fields
          const searchableText = [
            doc.name,
            doc.title,
            doc.description,
            doc.excerpt,
            doc.bio,
            doc.slug,
            doc._id
          ].filter(Boolean).join(' ').toLowerCase()

          return searchableText.includes(searchLower)
        })
      }

      // Handle reference expansion if requested
      const { expand } = request.query
      if (expand && documents.length > 0) {
        const schema = this.core.getSchema(collection)
        const expandFields = parseExpandParam(expand as string | string[], schema || undefined)

        if (expandFields.length > 0) {
          // Create a document fetcher that uses the core
          const fetchDocument = async (refCollection: string, refId: string) => {
            return this.core.getDocument(refCollection, refId)
          }

          // Expand references in all documents
          documents = await Promise.all(
            documents.map(doc =>
              expandDocumentReferences(
                doc as Record<string, unknown>,
                { fields: expandFields },
                fetchDocument
              )
            )
          ) as typeof documents
        }
      }

      // Use actual database count, not filtered result length
      const total = totalCount

      // Calculate pagination metadata
      const currentPage = page ? parseInt(String(page), 10) : 1
      const pageSize = options.limit || 25
      const totalPages = Math.ceil(total / pageSize)

      return this.successResponse({
        documents,
        pagination: {
          page: currentPage,
          limit: pageSize,
          total,
          pages: totalPages
        },
        // Legacy meta for backward compatibility
        meta: {
          total,
          limit: options.limit,
          offset: options.offset
        }
      })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async createDocument(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and schema write permissions
      await this.validateAuthentication(request)
      const { collection } = request.params
      await this.validateSchemaAccess(request, collection, 'write')
      
      // Get current user for audit context
      const currentUser = await this.getCurrentUser(request)
      const auditContext: any | undefined = currentUser ? {
        userId: currentUser.id,
        userType: 'USER',
        username: currentUser.username,
        ipAddress: request.headers['x-forwarded-for'] as string || request.headers['x-real-ip'] as string,
        userAgent: request.headers['user-agent'] as string
      } : undefined
      
      // SECURITY: Validate request body structure before type assertion
      if (!request.body || typeof request.body !== 'object') {
        throw new InvalidInputError('Request body is required', 'body')
      }
      
      const body = request.body as Record<string, unknown>
      if (!('data' in body) || !body.data || typeof body.data !== 'object') {
        throw new InvalidInputError('Document data is required', 'data')
      }
      
      const { data, id } = body as unknown as CreateDocumentRequest

      // Validate inputs
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentData(data)

      this.logger.debug('Creating document', { collection, data, id })

      // SINGLETON VALIDATION: Check if this collection is a singleton and prevent duplicate creation
      await this.validateSingletonCreation(collection, id)

      // Strip client-sent system fields so they cannot shadow storage-managed values
      const cleanData = stripSystemFields(data as Record<string, any>)

      // Process slug fields - auto-generate slugs from source fields if not provided
      const processedData = await processSlugFields(this.core, collection, cleanData)

      const document = await this.core.saveDocument(collection, { ...processedData, id }, auditContext)
      return this.successResponse({ document }, 201)
    } catch (error) {
      this.logger.error('Failed to create document', { 
        collection: request.params.collection, 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        requestBody: request.body
      })
      return this.errorResponse(error)
    }
  }

  private async getDocument(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and schema read permissions
      await this.validateAuthentication(request)
      const { collection, id } = request.params
      await this.validateSchemaAccess(request, collection, 'read')

      // Validate inputs
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)

      let document = await this.core.getDocument(collection, id)

      // If document not found, check if this is a singleton that should be auto-created
      if (!document) {
        const singletonDocument = await this.tryAutoCreateSingleton(collection, id)
        if (singletonDocument) {
          document = singletonDocument
        } else {
          return this.errorResponse(new Error(`Document ${collection}/${id} not found`), 404)
        }
      }

      // Handle reference expansion if requested
      const { expand } = request.query
      if (expand && document) {
        const schema = this.core.getSchema(collection)
        const expandFields = parseExpandParam(expand as string | string[], schema || undefined)

        if (expandFields.length > 0) {
          // Create a document fetcher that uses the core
          const fetchDocument = async (refCollection: string, refId: string) => {
            return this.core.getDocument(refCollection, refId)
          }

          document = await expandDocumentReferences(
            document as Record<string, unknown>,
            { fields: expandFields },
            fetchDocument
          ) as typeof document
        }
      }

      return this.successResponse({ document })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async updateDocument(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and schema write permissions
      await this.validateAuthentication(request)
      const { collection, id } = request.params
      await this.validateSchemaAccess(request, collection, 'write')

      // Get current user for audit context
      const currentUser = await this.getCurrentUser(request)
      const auditContext: any | undefined = currentUser ? {
        userId: currentUser.id,
        userType: 'USER',
        username: currentUser.username,
        ipAddress: request.headers['x-forwarded-for'] as string || request.headers['x-real-ip'] as string,
        userAgent: request.headers['user-agent'] as string
      } : undefined

      // SECURITY: Validate request body structure before type assertion
      if (!request.body || typeof request.body !== 'object') {
        throw new InvalidInputError('Request body is required', 'body')
      }

      const body = request.body as Record<string, unknown>
      if (!('data' in body) || !body.data || typeof body.data !== 'object') {
        throw new InvalidInputError('Document data is required', 'data')
      }

      const { data } = body as unknown as UpdateDocumentRequest

      // Validate inputs
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)
      SecurityValidator.validateDocumentData(data)

      // Strip client-sent system fields so they cannot shadow storage-managed values
      const cleanData = stripSystemFields(data as Record<string, any>)

      // Get existing document to merge with updates
      // For singletons, allow upsert (create if doesn't exist)
      const schema = this.core.getSchema(collection)
      const isSingleton = isSingletonSchema(schema)

      const existingDoc = await this.core.getDocument(collection, id)
      if (!existingDoc && !isSingleton) {
        return this.errorResponse(new Error(`Document ${collection}/${id} not found`), 404)
      }

      // SECURITY: Check publish permission if status is being changed to/from 'published'
      // This enforces the content:publish permission for publishing/unpublishing actions
      const newStatus = cleanData._status as string | undefined
      const currentStatus = existingDoc?._status as string | undefined

      const isPublishing = newStatus === 'published' && currentStatus !== 'published'
      const isUnpublishing = newStatus !== 'published' && currentStatus === 'published' && newStatus !== undefined

      if (isPublishing || isUnpublishing) {
        await this.validateSchemaAccess(request, collection, 'publish')
      }

      // Merge data (excluding system fields including audit fields, but preserve _status)
      let mergedData
      if (existingDoc) {
        const { _id, _collection, _createdAt, _updatedAt, _revision, _createdBy, _updatedBy, _createdByType, _updatedByType, ...existingData } = existingDoc
        // Preserve _status from existing document if not explicitly provided in update data
        if (!('_status' in cleanData) && existingDoc._status) {
          mergedData = { ...existingData, ...cleanData, _status: existingDoc._status }
        } else {
          mergedData = { ...existingData, ...cleanData }
        }
      } else {
        // Singleton doesn't exist yet - create with provided data
        mergedData = cleanData
      }

      // Process slug fields - auto-generate slugs from source fields if not provided
      // Pass the document ID to exclude it from uniqueness checks during updates
      const processedData = await processSlugFields(this.core, collection, mergedData as Record<string, any>, id)

      const document = await this.core.saveDocument(collection, { ...processedData, id }, auditContext)
      return this.successResponse({ document })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async deleteDocument(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication
      await this.validateAuthentication(request)
      const { collection, id } = request.params

      // Validate inputs
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)

      // Get current user for ownership check
      const currentUser = await this.getCurrentUser(request)

      // Check if user has general delete permission
      let hasDeletePermission = false
      try {
        await this.validateSchemaAccess(request, collection, 'delete')
        hasDeletePermission = true
      } catch {
        // User doesn't have general delete permission, check ownership
        hasDeletePermission = false
      }

      // If no delete permission, check if user owns the document
      if (!hasDeletePermission) {
        if (!currentUser) {
          throw new InvalidInputError('Insufficient permissions to delete this document', 'permissions')
        }

        // Fetch the document to check ownership
        const document = await this.core.getDocument(collection, id)
        if (!document) {
          throw new InvalidInputError('Document not found', 'id')
        }

        // Check if user is the document creator
        const isOwner = document._createdBy === currentUser.id ||
                       document._createdBy === currentUser.username

        if (!isOwner) {
          throw new InvalidInputError('Insufficient permissions to delete this document. You can only delete documents you created.', 'permissions')
        }
      }

      // Get audit context from current user
      const auditContext: any | undefined = currentUser ? {
        userId: currentUser.id,
        userType: 'USER',
        username: currentUser.username,
        ipAddress: request.headers['x-forwarded-for'] as string || request.headers['x-real-ip'] as string,
        userAgent: request.headers['user-agent'] as string
      } : undefined

      await this.core.deleteDocument(collection, id, auditContext)
      return this.successResponse({ message: 'Document deleted successfully' })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async getCollectionStats(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)
      const { collection } = request.params

      // Validate collection name
      SecurityValidator.validateCollectionName(collection)

      // Use countDocuments to avoid loading all documents into memory
      const [totalDocuments, publishedDocuments] = await Promise.all([
        this.core.countDocuments(collection),
        this.core.countDocuments(collection, { _status: 'published' })
      ])
      const draftDocuments = totalDocuments - publishedDocuments

      const stats = {
        collection,
        totalDocuments,
        publishedDocuments,
        draftDocuments
      }

      this.logger.debug('Collection stats calculated', { collection, stats })

      return this.successResponse({ stats })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async checkSlugUniqueness(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)
      
      const { slug, collection, excludeId } = request.query
      
      if (!slug || typeof slug !== 'string') {
        throw new InvalidInputError('Slug parameter is required', 'slug')
      }
      
      if (!collection || typeof collection !== 'string') {
        throw new InvalidInputError('Collection parameter is required', 'collection')
      }

      // Validate collection name and slug format
      SecurityValidator.validateCollectionName(collection)

      // Removed overly restrictive slug format validation
      // Slug format should be validated by the schema field definition, not here
      // This allows slugs to respect schema-level options like allowSlashes, preserveCase, allowedChars
      // Basic check: just ensure it's not empty
      if (!slug || slug.trim() === '') {
        return this.successResponse({
          unique: false,
          reason: 'Slug cannot be empty'
        })
      }

      // Check if slug exists in the collection
      const documents = await this.core.listDocuments(collection, {
        filter: { slug: slug }
      })

      // If excludeId is provided, filter out that document (for updates)
      const conflictingDocs = excludeId
        ? documents.filter(doc => doc._id !== excludeId)
        : documents

      const isUnique = conflictingDocs.length === 0

      const responseData = { 
        unique: isUnique,
        slug: slug,
        collection: collection,
        ...(isUnique ? {} : { reason: 'Slug already exists in collection' })
      };

      return this.successResponse(responseData)
    } catch (error) {
      this.logger.error('Error in checkSlugUniqueness', error)
      return this.errorResponse(error)
    }
  }

  /**
   * Auto-create a singleton document the first time it is read.
   *
   * The schema decides whether the collection is a singleton. The structure only decides
   * which document id that singleton lives under, and whether auto-creation is wanted at
   * all; without a structure entry the id defaults to the collection name.
   */
  private async tryAutoCreateSingleton(collection: string, documentId: string): Promise<any | null> {
    try {
      if (!isSingletonSchema(this.core.getSchema(collection))) {
        return null
      }

      // A structure may carry more than one entry for a collection; prefer the one that names
      // the requested id so each entry's own document stays reachable.
      const entries = (await this.resolveStructureSingletons()).filter(
        candidate => candidate.collection === collection
      )
      const entry = entries.find(candidate => candidate.documentId === documentId) ?? entries[0]

      // Only the singleton's own document is conjured up; any other id stays a 404.
      const singletonId = entry?.documentId ?? collection
      if (documentId !== singletonId) {
        return null
      }

      if (entry && !entry.autoCreate) {
        this.logger.debug('Singleton auto-creation disabled by structure', { collection, documentId })
        return null
      }

      // Never conjure up a second document. A singleton whose stored document sits under a
      // different id than the structure asks for would otherwise gain an empty duplicate on
      // the first read, which is the invariant the create guard exists to protect.
      const existingDocuments = await this.core.listDocuments(collection, { limit: 1 })
      if (existingDocuments && existingDocuments.length > 0) {
        this.logger.warn('Not auto-creating singleton: the collection already holds a document', {
          collection,
          documentId,
          existingDocument: existingDocuments[0].id
        })
        return null
      }

      this.logger.info('Auto-creating singleton document', { collection, documentId })

      // Create the singleton document with sensible defaults
      const singletonData = {
        id: documentId,
        _type: collection,
        title: this.formatSchemaTitle(collection),
        slug: documentId, // Use documentId as slug for singletons
        ...this.getDefaultSingletonData(collection, documentId)
      }

      // Auto-created singleton uses system context
      const systemContext: any = {
        userId: 'system',
        userType: 'SYSTEM',
        username: 'system'
      }
      const document = await this.core.saveDocument(collection, singletonData, systemContext)
      this.logger.info('Singleton document auto-created', { collection, documentId })

      return document
    } catch (error) {
      this.logger.error('Failed to auto-create singleton', { collection, documentId, error })
      return null
    }
  }

  /**
   * Resolve the project's structure and collect its singleton entries.
   *
   * The structure is only consulted for presentation details — which id a singleton lives
   * under and whether to auto-create it — never to decide whether a collection is one.
   * A structure that cannot be resolved yields no entries rather than an error, so reads
   * keep working on the schema alone.
   */
  private async resolveStructureSingletons(): Promise<ReturnType<typeof collectStructureSingletons>> {
    try {
      const customStructure = this.getCustomStructureFunction()
      if (!customStructure) return []

      if (typeof customStructure === 'function') {
        const context = {
          user: null,
          schemas: this.core.getAllSchemas(),
          core: this.core,
          config: this.config
        }
        return collectStructureSingletons(await Promise.resolve(customStructure(context)))
      }

      return collectStructureSingletons(customStructure)
    } catch (error) {
      this.logger.warn('Failed to resolve structure for singleton lookup', {
        error: error instanceof Error ? error.message : String(error)
      })
      return []
    }
  }

  /**
   * Validate singleton creation to prevent duplicates
   */
  private async validateSingletonCreation(collection: string, requestedId?: string): Promise<void> {
    try {
      if (!isSingletonSchema(this.core.getSchema(collection))) {
        return
      }

      // Check if a singleton document already exists for this collection
      const existingDocuments = await this.core.listDocuments(collection, { limit: 1 })

      if (existingDocuments && existingDocuments.length > 0) {
        this.logger.warn('Attempted to create duplicate singleton document', {
          collection,
          requestedId,
          existingDocument: existingDocuments[0].id
        })

        throw new InvalidInputError(
          `Singleton document already exists for collection '${collection}'. Only one document is allowed.`,
          'singleton_duplicate'
        )
      }
    } catch (error) {
      // Re-throw InvalidInputError as-is, wrap other errors
      if (error instanceof InvalidInputError) {
        throw error
      }
      
      this.logger.error('Failed to validate singleton creation', { 
        collection, 
        requestedId, 
        error: error instanceof Error ? error.message : String(error) 
      })
      
      // Don't fail the creation if validation fails, just log the error
      // This ensures backward compatibility
      return
    }
  }

  /**
   * Get default data for specific singleton types
   */
  private getDefaultSingletonData(collection: string, documentId: string): Record<string, any> {
    // Get schema to generate proper defaults
    const schema = this.core.getSchema(collection);
    if (schema) {
      return this.generateSchemaDefaults(schema);
    }

    // Fallback to hardcoded defaults
    switch (collection) {
      case 'homePage':
        return {
          title: 'Home Page',
          description: 'Welcome to our website',
          content: '<p>Welcome to our website! This is the homepage content.</p>',
          slug: 'home'
        }
      case 'settings':
        return {
          title: 'Site Settings',
          siteName: 'My Website',
          description: 'A website built with Trokky'
        }
      default:
        return {}
    }
  }

  /**
   * Generate default values based on schema definition
   */
  private generateSchemaDefaults(schema: any): Record<string, any> {
    const defaults: Record<string, any> = {};

    if (schema.fields) {
      for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
        const field = fieldDef as any;

        // Skip fields that start with underscore (system fields)
        if (fieldName.startsWith('_')) {
          continue;
        }

        if (field.default !== undefined) {
          defaults[fieldName] = field.default;
        } else {
          const defaultValue = this.getFieldTypeDefault(field);
          // Only include fields that have non-null/non-undefined defaults
          // This prevents validation errors for optional fields like media, references, etc.
          if (defaultValue !== null && defaultValue !== undefined) {
            defaults[fieldName] = defaultValue;
          }
        }
      }
    }

    return defaults;
  }

  /**
   * Get default value for a field type
   */
  private getFieldTypeDefault(field: any): any {
    switch (field.type) {
      case 'string':
        return '';
      case 'slug':
        // Slug fields are auto-generated from title, don't provide a default
        return undefined;
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'date':
        return new Date().toISOString();
      case 'array':
        // Create empty array - items will be added through UI with proper _type
        return [];
      case 'object':
        // Set _type to the field's name — this identifies the object type
        // in polymorphic contexts (e.g., array items of different types).
        // Matches Studio's ArrayField behavior which uses itemDefinition.name.
        const baseObject: any = {};
        if (field.name) {
          baseObject._type = field.name;
        }
        return baseObject;
      case 'reference':
        return undefined;
      case 'media':
        // Media fields are optional, don't provide a default
        return undefined;
      default:
        return null;
    }
  }
}
