import type {
  RoutesConfig,
  RouteDefinition,
  RouteHandler,
  HttpRequest,
  HttpResponse,
  ApiResponse,
  StaticRouteConfig,
  ListDocumentsRequest,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  GetDocumentRequest,
  DeleteDocumentRequest,
  UploadMediaRequest,
  GetMediaRequest,
  DeleteMediaRequest,
  ListUsersRequest,
  CreateUserRequest,
  UpdateUserRequest,
  GetUserRequest,
  DeleteUserRequest,
  GetUserByUsernameRequest,
  GetUserByEmailRequest,
  LoginRequest,
  LoginResponse,
  CheckSlugUniquenessRequest,
  CheckSlugUniquenessResponse
} from './types.js'
import { TrokkyCore, SecurityValidator, InvalidInputError, createLogger } from '@trokky/core'

export class TrokkyRoutes {
  private core: TrokkyCore
  private config: RoutesConfig
  private routes: Map<string, RouteDefinition> = new Map()
  private logger = createLogger('routes', 'TrokkyRoutes')

  constructor(config: RoutesConfig) {
    this.core = config.core
    this.config = {
      basePath: '',  // Empty by default - let integration layer handle mounting
      // SECURITY: No default CORS configuration - must be explicitly configured
      // The dangerous 'origin: true' default has been removed to prevent CSRF attacks
      ...config
    }

    this.initializeRoutes()
  }

  private initializeRoutes(): void {
    const basePath = this.config.basePath || ''
    this.logger.debug('Initializing routes', { basePath })

    // Collection routes
    this.addRoute('GET', `${basePath}/collections`, this.listCollections.bind(this))
    this.addRoute('GET', `${basePath}/collections/:collection`, this.listDocuments.bind(this))
    this.addRoute('POST', `${basePath}/collections/:collection`, this.createDocument.bind(this))
    this.addRoute('GET', `${basePath}/collections/:collection/:id`, this.getDocument.bind(this))
    this.addRoute('PUT', `${basePath}/collections/:collection/:id`, this.updateDocument.bind(this))
    this.addRoute('DELETE', `${basePath}/collections/:collection/:id`, this.deleteDocument.bind(this))

    // Media routes
    this.addRoute('GET', `${basePath}/media`, this.listMedia.bind(this))
    this.addRoute('POST', `${basePath}/media/upload`, this.uploadMedia.bind(this))
    this.addRoute('GET', `${basePath}/media/:id`, this.getMedia.bind(this))
    this.addRoute('PUT', `${basePath}/media/:id`, this.updateMedia.bind(this))
    this.addRoute('GET', `${basePath}/media/:id/file`, this.serveMediaFile.bind(this))
    this.addRoute('GET', `${basePath}/media/:id/variants/:variant`, this.serveMediaVariant.bind(this))
    this.addRoute('POST', `${basePath}/media/:id/regenerate-variants`, this.regenerateVariants.bind(this))
    this.addRoute('DELETE', `${basePath}/media/:id`, this.deleteMedia.bind(this))

    // User management routes (admin only)
    this.addRoute('GET', `${basePath}/users`, this.listUsers.bind(this))
    this.addRoute('POST', `${basePath}/users`, this.createUser.bind(this))
    this.addRoute('GET', `${basePath}/users/:id`, this.getUser.bind(this))
    this.addRoute('PUT', `${basePath}/users/:id`, this.updateUser.bind(this))
    this.addRoute('DELETE', `${basePath}/users/:id`, this.deleteUser.bind(this))
    this.addRoute('GET', `${basePath}/users/by-username/:username`, this.getUserByUsername.bind(this))
    this.addRoute('GET', `${basePath}/users/by-email/:email`, this.getUserByEmail.bind(this))

    // Authentication routes (public)
    this.addRoute('POST', `${basePath}/auth/login`, this.login.bind(this))
    this.addRoute('POST', `${basePath}/auth/logout`, this.logout.bind(this))
    this.addRoute('POST', `${basePath}/auth/validate`, this.validateToken.bind(this))
    this.addRoute('POST', `${basePath}/auth/refresh`, this.refreshToken.bind(this))

    // Token management routes (admin/user)
    this.addRoute('GET', `${basePath}/tokens`, this.listTokens.bind(this))
    this.addRoute('POST', `${basePath}/tokens`, this.createToken.bind(this))
    this.addRoute('GET', `${basePath}/tokens/:id`, this.getToken.bind(this))
    this.addRoute('PUT', `${basePath}/tokens/:id`, this.updateToken.bind(this))
    this.addRoute('DELETE', `${basePath}/tokens/:id`, this.deleteToken.bind(this))

    // Schema routes
    this.addRoute('GET', `${basePath}/schemas/:schemaName`, this.getSchema.bind(this))

    // Slug validation routes
    this.addRoute('GET', `${basePath}/slugs/check-unique`, this.checkSlugUniqueness.bind(this))

    // Health check route
    this.addRoute('GET', `${basePath}/health`, this.healthCheck.bind(this))

    // CORS preflight route
    this.addRoute('OPTIONS', `${basePath}/*`, this.handleCors.bind(this))

    // Initialize static routes if configured
    this.initializeStaticRoutes()

    this.logger.info('Routes initialized', { count: this.routes.size })
  }

  private addRoute(method: string, path: string, handler: RouteHandler): void {
    const key = `${method}:${path}`
    this.logger.debug('Adding route', { method, path })
    this.routes.set(key, {
      method: method as any,
      path,
      handler,
      description: `${method} ${path}`
    })
  }

  public getRoutes(): RouteDefinition[] {
    return Array.from(this.routes.values())
  }

  public getApiRoutes(): RouteDefinition[] {
    return Array.from(this.routes.values()).filter(route => 
      !this.isStaticRoute(route.path)
    )
  }

  public getStaticRoutes(): RouteDefinition[] {
    return Array.from(this.routes.values()).filter(route => 
      this.isStaticRoute(route.path)
    )
  }

  private isStaticRoute(path: string): boolean {
    if (!this.config.staticRoutes) return false
    
    for (const staticConfig of Object.values(this.config.staticRoutes)) {
      if (staticConfig && path === `${staticConfig.mountPath}/*`) {
        return true
      }
    }
    return false
  }

  public findRoute(method: string, path: string): RouteDefinition | undefined {
    // First try exact match
    const exactKey = `${method}:${path}`
    if (this.routes.has(exactKey)) {
      return this.routes.get(exactKey)
    }

    // Then try pattern matching for parameterized routes
    for (const [key, route] of this.routes.entries()) {
      if (key.startsWith(`${method}:`)) {
        const routePath = route.path
        if (this.matchesPattern(routePath, path)) {
          return route
        }
      }
    }

    return undefined
  }

  private matchesPattern(pattern: string, path: string): boolean {
    const patternParts = pattern.split('/')
    const pathParts = path.split('/')

    if (patternParts.length !== pathParts.length) {
      // Handle wildcard patterns
      if (pattern.endsWith('/*')) {
        const basePattern = pattern.slice(0, -2)
        return path.startsWith(basePattern)
      }
      return false
    }

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i]
      const pathPart = pathParts[i]

      // Skip parameter parts (starting with :)
      if (patternPart.startsWith(':')) {
        continue
      }

      // Exact match required for non-parameter parts
      if (patternPart !== pathPart) {
        return false
      }
    }

    return true
  }

  public extractParams(pattern: string, path: string): Record<string, string> {
    const params: Record<string, string> = {}
    const patternParts = pattern.split('/')
    const pathParts = path.split('/')

    for (let i = 0; i < patternParts.length; i++) {
      const patternPart = patternParts[i]
      const pathPart = pathParts[i]

      if (patternPart.startsWith(':')) {
        const paramName = patternPart.slice(1)
        const decodedValue = decodeURIComponent(pathPart || '')
        
        // SECURITY: Validate decoded parameters to prevent path traversal attacks
        if (paramName === 'id') {
          SecurityValidator.validateDocumentId(decodedValue)
        } else if (paramName === 'collection') {
          SecurityValidator.validateCollectionName(decodedValue)
        }
        
        params[paramName] = decodedValue
      }
    }

    return params
  }

  // Authentication middleware
  private async validateAuthentication(request: HttpRequest): Promise<void> {
    const auth = this.config.authentication
    if (!auth?.enabled) {
      return // Authentication disabled
    }

    // Check if path is public
    const publicPaths = auth.publicPaths || ['/health']
    if (publicPaths.some(path => request.path.endsWith(path))) {
      return
    }

    const headerName = auth.headerName || 'Authorization'
    // Case-insensitive header lookup for framework compatibility
    const authHeader = request.headers[headerName] || 
                      request.headers[headerName.toLowerCase()] ||
                      request.headers['authorization']
    
    if (!authHeader) {
      throw new InvalidInputError('Missing authentication token', 'authorization')
    }

    const token = Array.isArray(authHeader) ? authHeader[0] : authHeader
    if (!token) {
      throw new InvalidInputError('Invalid authentication token', 'authorization')
    }

    // Extract token from Bearer format
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token
    
    if (auth.validateToken) {
      const isValid = await auth.validateToken(cleanToken)
      if (!isValid) {
        throw new InvalidInputError('Invalid authentication credentials', 'authorization')
      }
    }
  }

  // Media validation helper
  private validateMediaFiles(files: File[]): void {
    const maxFileSize = 50 * 1024 * 1024 // 50MB
    const maxFiles = 10
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm',
      'audio/mp3', 'audio/wav', 'audio/ogg',
      'application/pdf',
      'text/plain', 'text/csv',
      'application/json'
    ]
    const forbiddenExtensions = [
      '.exe', '.bat', '.cmd', '.com', '.scr', '.pif', '.vbs', '.js', '.jar',
      '.ps1', '.sh', '.php', '.jsp', '.asp', '.aspx', '.msi', '.dll', '.sys',
      '.bin', '.app', '.deb', '.rpm', '.dmg', '.pkg', '.run', '.out'
    ]

    if (files.length > maxFiles) {
      throw new InvalidInputError(`Too many files. Maximum ${maxFiles} files allowed`, 'files')
    }

    for (const file of files) {
      // File size validation
      if (file.size > maxFileSize) {
        throw new InvalidInputError(`File ${file.name} is too large. Maximum size is ${maxFileSize / 1024 / 1024}MB`, 'file_size')
      }

      // Content type validation
      if (!allowedTypes.includes(file.type)) {
        throw new InvalidInputError(`File type ${file.type} is not allowed`, 'file_type')
      }

      // Extension validation (check all extensions, not just the last one)
      const getAllExtensions = (filename: string): string[] => {
        const parts = filename.toLowerCase().split('.')
        if (parts.length <= 1) return []
        return parts.slice(1).map(ext => `.${ext}`)
      }
      
      const fileExtensions = getAllExtensions(file.name)
      const hasForbiddenExtension = fileExtensions.some(ext => forbiddenExtensions.includes(ext))
      
      if (hasForbiddenExtension) {
        const foundForbiddenExt = fileExtensions.find(ext => forbiddenExtensions.includes(ext))
        throw new InvalidInputError(`File extension ${foundForbiddenExt} is not allowed`, 'file_extension')
      }

      // Filename validation (prevent path traversal)
      if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
        throw new InvalidInputError('Invalid filename. Path separators not allowed', 'filename')
      }
    }
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
        headers: { 'Content-Type': 'application/json' },
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
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)
      const { collection } = request.params
      const { limit, offset, filter, sort } = request.query

      // Validate collection name
      SecurityValidator.validateCollectionName(collection)

      // Build list options
      const options: any = {}
      if (limit) options.limit = parseInt(String(limit), 10)
      if (offset) options.offset = parseInt(String(offset), 10)
      if (filter) {
        try {
          options.filter = typeof filter === 'string' ? JSON.parse(filter) : filter
        } catch {
          throw new InvalidInputError('Invalid filter format', 'filter')
        }
      }
      if (sort) options.sort = sort

      const documents = await this.core.listDocuments(collection, options)
      const total = documents.length // Note: This is post-filter count, not total collection count

      return this.successResponse({
        documents,
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
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)
      const { collection } = request.params
      
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

      const document = await this.core.saveDocument(collection, { ...data, id })
      return this.successResponse({ document }, 201)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async getDocument(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)
      const { collection, id } = request.params

      // Validate inputs
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)

      const document = await this.core.getDocument(collection, id)
      if (!document) {
        return this.errorResponse(new Error(`Document ${collection}/${id} not found`), 404)
      }

      return this.successResponse({ document })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async updateDocument(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)
      const { collection, id } = request.params
      
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

      // Get existing document to merge with updates
      const existingDoc = await this.core.getDocument(collection, id)
      if (!existingDoc) {
        return this.errorResponse(new Error(`Document ${collection}/${id} not found`), 404)
      }

      // Merge data (excluding system fields)
      const { _id, _collection, _createdAt, _updatedAt, _revision, _status, ...existingData } = existingDoc
      const mergedData = { ...existingData, ...data }

      const document = await this.core.saveDocument(collection, { ...mergedData, id })
      return this.successResponse({ document })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async deleteDocument(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)
      const { collection, id } = request.params

      // Validate inputs
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)

      await this.core.deleteDocument(collection, id)
      return this.successResponse({ message: 'Document deleted successfully' })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async listMedia(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)

      // Get query parameters
      const url = new URL(request.url || '', 'http://localhost')
      const limit = parseInt(url.searchParams.get('limit') || '50', 10)
      const offset = parseInt(url.searchParams.get('offset') || '0', 10)

      // Get media files from the core engine
      const mediaFiles = await this.core.listMedia({ limit, offset })
      
      this.logger.debug('Media files listed', { 
        count: mediaFiles.length,
        limit,
        offset
      })

      return {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          data: mediaFiles,
          meta: {
            count: mediaFiles.length,
            limit,
            offset,
            hasMore: mediaFiles.length === limit
          }
        })
      }
    } catch (error) {
      this.logger.error('Failed to list media', { error: error instanceof Error ? error.message : String(error) })
      
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
            message: 'Failed to list media'
          }
        })
      }
    }
  }

  private async uploadMedia(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)
      const files = request.files || []
      if (files.length === 0) {
        throw new InvalidInputError('No files provided', 'files')
      }

      // SECURITY: Validate file upload constraints
      this.validateMediaFiles(files)

      const uploadedFiles = []
      for (const file of files) {
        const mediaFile = await this.core.uploadMedia(file)
        uploadedFiles.push(mediaFile)
      }

      return this.successResponse({ 
        files: uploadedFiles,
        meta: { count: uploadedFiles.length }
      }, 201)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async getMedia(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)
      const { id } = request.params

      SecurityValidator.validateDocumentId(id)

      const mediaFile = await this.core.getMedia(id)
      if (!mediaFile) {
        return this.errorResponse(new Error(`Media file ${id} not found`), 404)
      }

      return this.successResponse({ file: mediaFile })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async deleteMedia(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)
      const { id } = request.params

      SecurityValidator.validateDocumentId(id)

      await this.core.deleteMedia(id)
      return this.successResponse({ message: 'Media file deleted successfully' })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async regenerateVariants(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)

      const { id } = request.params
      SecurityValidator.validateDocumentId(id)

      // Get the media file to check if it exists and is an image
      const mediaFile = await this.core.getMedia(id)
      if (!mediaFile) {
        return this.errorResponse(new Error('Media file not found'), 404)
      }

      // Check if it's an image file
      if (!mediaFile.contentType.startsWith('image/')) {
        return this.errorResponse(new Error('Variant generation is only supported for image files'), 400)
      }

      this.logger.info('Regenerating variants for media file', { id, filename: mediaFile.filename })

      // Regenerate variants
      const updatedMediaFile = await this.core.regenerateMediaVariants(id)
      
      return this.successResponse({ 
        message: 'Variants regenerated successfully',
        file: updatedMediaFile 
      })
    } catch (error) {
      this.logger.error('Failed to regenerate variants', { error: error instanceof Error ? error.message : 'Unknown error' })
      return this.errorResponse(error)
    }
  }

  private async serveMediaFile(request: HttpRequest): Promise<HttpResponse> {
    try {
      // Media files can be served without strict authentication in many cases
      // but we still validate the request
      const { id } = request.params

      SecurityValidator.validateDocumentId(id)

      // Get media metadata first
      const mediaFile = await this.core.getMedia(id)
      if (!mediaFile) {
        return this.errorResponse(new Error(`Media file ${id} not found`), 404)
      }

      // Get file content
      const content = await this.core.getMediaContent(id)
      if (!content) {
        return this.errorResponse(new Error(`Media file content ${id} not found`), 404)
      }

      // Convert ArrayBuffer to Buffer for HTTP response
      const buffer = Buffer.from(content)

      return {
        status: 200,
        headers: {
          'Content-Type': mediaFile.contentType,
          'Content-Length': buffer.length.toString(),
          'Content-Disposition': `inline; filename="${mediaFile.filename}"`,
          'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
          'ETag': `"${id}"`,
          ...this.buildCorsHeaders()
        },
        body: buffer
      }
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async serveMediaVariant(request: HttpRequest): Promise<HttpResponse> {
    try {
      const { id, variant } = request.params

      SecurityValidator.validateDocumentId(id)

      if (!variant || !/^[a-zA-Z0-9_-]+$/.test(variant)) {
        return this.errorResponse(new Error('Invalid variant name'), 400)
      }

      // Get media metadata first
      const mediaFile = await this.core.getMedia(id)
      if (!mediaFile) {
        return this.errorResponse(new Error(`Media file ${id} not found`), 404)
      }

      // Check if variant exists in metadata
      const variants = mediaFile.metadata?.imageVariants as Record<string, any>
      if (!variants || !variants[variant]) {
        return this.errorResponse(new Error(`Variant ${variant} not found for media ${id}`), 404)
      }

      const variantInfo = variants[variant]
      
      // Use storage adapter to get variant file content
      const storage = this.core.getStorageAdapter()
      
      if (storage.getVariantContent) {
        // If storage adapter supports variant content retrieval
        try {
          const variantContent = await storage.getVariantContent(id, variant)
          if (!variantContent) {
            return this.errorResponse(new Error(`Variant file ${variant} not found for media ${id}`), 404)
          }

          const buffer = Buffer.from(variantContent)

          return {
            status: 200,
            headers: {
              'Content-Type': `image/${variantInfo.format || 'webp'}`,
              'Content-Length': buffer.length.toString(),
              'Content-Disposition': `inline; filename="${id}-${variant}.${variantInfo.format || 'webp'}"`,
              'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
              'ETag': `"${id}-${variant}"`,
              ...this.buildCorsHeaders()
            },
            body: buffer
          }
        } catch (storageError) {
          this.logger.error('Failed to read variant from storage adapter', { id, variant, error: storageError })
        }
      }

      // Fallback: try filesystem approach for FilesystemAdapter
      try {
        const { createRequire } = await import('module')
        const require = createRequire(import.meta.url)
        const fs = require('fs')
        const path = require('path')

        // Build variant file path - variants are stored in media/variants/parentId/variantName.format
        const variantFilename = `${variant}.${variantInfo.format || 'webp'}`
        const variantDir = path.join(process.cwd(), 'examples/blog-integrated/media/variants', id)
        const variantPath = path.join(variantDir, variantFilename)
        
        // Security check: ensure the resolved path is still within the media directory
        const resolvedPath = path.resolve(variantPath)
        const mediaBaseDir = path.resolve(process.cwd(), 'examples/blog-integrated/media')
        if (!resolvedPath.startsWith(mediaBaseDir)) {
          return this.errorResponse(new Error('Access denied'), 403)
        }

        // Check if variant file exists
        if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
          return this.errorResponse(new Error(`Variant file ${variant} not found for media ${id}`), 404)
        }

        // Read variant file
        const variantBuffer = fs.readFileSync(resolvedPath)

        return {
          status: 200,
          headers: {
            'Content-Type': `image/${variantInfo.format || 'webp'}`,
            'Content-Length': variantBuffer.length.toString(),
            'Content-Disposition': `inline; filename="${id}-${variant}.${variantInfo.format || 'webp'}"`,
            'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
            'ETag': `"${id}-${variant}"`,
            ...this.buildCorsHeaders()
          },
          body: variantBuffer
        }
      } catch (fsError) {
        this.logger.error('Failed to read variant file from filesystem', { id, variant, error: fsError })
        return this.errorResponse(new Error(`Variant file ${variant} not accessible for media ${id}`), 404)
      }
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
      
      if (!slug.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)) {
        return this.successResponse({ 
          unique: false,
          reason: 'Invalid slug format'
        })
      }

      // Check if slug exists in the collection
      console.log('🔍 Checking for documents with slug:', slug, 'in collection:', collection);
      const documents = await this.core.listDocuments(collection, {
        filter: { slug: slug }
      })
      console.log('📄 Found documents:', documents.length, documents);

      // If excludeId is provided, filter out that document (for updates)
      const conflictingDocs = excludeId 
        ? documents.filter(doc => doc._id !== excludeId)
        : documents
      console.log('⚡ Conflicting docs after exclusion:', conflictingDocs.length);

      const isUnique = conflictingDocs.length === 0

      const responseData = { 
        unique: isUnique,
        slug: slug,
        collection: collection,
        ...(isUnique ? {} : { reason: 'Slug already exists in collection' })
      };
      console.log('📤 Sending response:', responseData);

      return this.successResponse(responseData)
    } catch (error) {
      console.error('❌ Error in checkSlugUniqueness:', error);
      return this.errorResponse(error)
    }
  }

  private async healthCheck(request: HttpRequest): Promise<HttpResponse> {
    try {
      const health = await this.core.healthCheck()
      return this.successResponse({ 
        status: health ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async handleCors(request: HttpRequest): Promise<HttpResponse> {
    const corsHeaders = this.buildCorsHeaders()
    return {
      status: 200,
      headers: corsHeaders,
      body: null
    }
  }

  // Static file serving initialization
  private initializeStaticRoutes(): void {
    if (!this.config.staticRoutes) {
      return
    }

    for (const [routeName, routeConfig] of Object.entries(this.config.staticRoutes)) {
      if (!routeConfig) continue
      
      this.logger.debug('Adding static route', { 
        name: routeName, 
        mountPath: routeConfig.mountPath, 
        directory: routeConfig.directory 
      })
      
      // Add the static file route with wildcard to catch all files
      this.addRoute('GET', `${routeConfig.mountPath}/*`, this.createStaticHandler(routeConfig))
    }
  }

  // Create a static file handler for a specific configuration
  private createStaticHandler(config: StaticRouteConfig): RouteHandler {
    return async (request: HttpRequest): Promise<HttpResponse> => {
      try {
        // Extract the file path from the URL
        const filePath = request.path.replace(config.mountPath, '')
        if (!filePath || filePath === '/' || filePath.includes('..')) {
          return {
            status: 404,
            headers: { 'Content-Type': 'text/plain' },
            body: 'File not found'
          }
        }

        // Node.js specific implementation for file serving
        const { createRequire } = await import('module')
        const require = createRequire(import.meta.url)
        const fs = require('fs')
        const path = require('path')

        const fullPath = path.join(config.directory, filePath)
        
        // Security check: ensure the resolved path is still within the directory
        const resolvedPath = path.resolve(fullPath)
        const resolvedDir = path.resolve(config.directory)
        if (!resolvedPath.startsWith(resolvedDir)) {
          return {
            status: 403,
            headers: { 'Content-Type': 'text/plain' },
            body: 'Access denied'
          }
        }

        // Check if file exists
        if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
          return {
            status: 404,
            headers: { 'Content-Type': 'text/plain' },
            body: 'File not found'
          }
        }

        // Read file and determine content type
        const fileContent = fs.readFileSync(resolvedPath)
        const contentType = this.getContentType(path.extname(resolvedPath))
        
        // Set cache headers if maxAge is configured
        const headers: Record<string, string> = {
          'Content-Type': contentType,
          'Content-Length': fileContent.length.toString()
        }
        
        if (config.maxAge) {
          headers['Cache-Control'] = `public, max-age=${config.maxAge}`
        }

        return {
          status: 200,
          headers,
          body: fileContent
        }
      } catch (error) {
        this.logger.error('Static file serving error', error)
        return {
          status: 500,
          headers: { 'Content-Type': 'text/plain' },
          body: 'Internal server error'
        }
      }
    }
  }

  // Helper method to determine content type from file extension
  private getContentType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.xml': 'application/xml',
      '.zip': 'application/zip',
      '.ico': 'image/x-icon'
    }
    
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream'
  }

  // User management handlers
  private async listUsers(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      const { role, isActive, limit, offset } = request.query

      // Build list options
      const options: any = {}
      if (role && typeof role === 'string') options.role = role
      if (isActive !== undefined) options.isActive = isActive === 'true'
      if (limit) options.limit = parseInt(String(limit), 10)
      if (offset) options.offset = parseInt(String(offset), 10)

      const users = await this.core.listUsers(options)
      
      // Remove password hashes from response
      const safeUsers = users.map(user => {
        const { passwordHash, ...safeUser } = user
        return safeUser
      })

      return this.successResponse({
        users: safeUsers,
        meta: {
          total: safeUsers.length,
          limit: options.limit,
          offset: options.offset
        }
      })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async createUser(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      // SECURITY: Validate request body structure
      if (!request.body || typeof request.body !== 'object') {
        throw new InvalidInputError('Request body is required', 'body')
      }

      const body = request.body as Record<string, unknown>
      if (!('userData' in body) || !body.userData || typeof body.userData !== 'object') {
        throw new InvalidInputError('User data is required', 'userData')
      }

      const { userData } = body as unknown as CreateUserRequest

      const user = await this.core.createUser(userData)
      
      // Remove password hash from response
      const { passwordHash, ...safeUser } = user
      
      return this.successResponse({ user: safeUser }, 201)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async getUser(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      const { id } = request.params
      SecurityValidator.validateDocumentId(id)

      const user = await this.core.getUser(id)
      if (!user) {
        return this.errorResponse(new Error(`User ${id} not found`), 404)
      }

      // Remove password hash from response
      const { passwordHash, ...safeUser } = user
      
      return this.successResponse({ user: safeUser })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async updateUser(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      const { id } = request.params
      SecurityValidator.validateDocumentId(id)

      // SECURITY: Validate request body structure
      if (!request.body || typeof request.body !== 'object') {
        throw new InvalidInputError('User data is required', 'body')
      }

      let userData = request.body as Record<string, unknown>

      // Transform fullName to firstName and lastName if present
      if (userData.fullName && typeof userData.fullName === 'string') {
        const fullName = userData.fullName.trim()
        const nameParts = fullName.split(' ')
        userData = {
          ...userData,
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || ''
        }
        delete userData.fullName
      }

      // Debug: Log what data we're receiving
      this.logger.debug('Updating user with transformed data:', { id, userData })

      const user = await this.core.updateUser(id, userData)
      
      // Remove password hash from response
      const { passwordHash, ...safeUser } = user
      
      return this.successResponse({ user: safeUser })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async deleteUser(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      const { id } = request.params
      SecurityValidator.validateDocumentId(id)

      await this.core.deleteUser(id)
      return this.successResponse({ message: 'User deleted successfully' })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async getUserByUsername(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      const { username } = request.params
      SecurityValidator.validateUsername(username)

      const user = await this.core.getUserByUsername(username)
      if (!user) {
        return this.errorResponse(new Error(`User with username ${username} not found`), 404)
      }

      // Remove password hash from response
      const { passwordHash, ...safeUser } = user
      
      return this.successResponse({ user: safeUser })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async getUserByEmail(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      const { email } = request.params
      SecurityValidator.validateEmail(decodeURIComponent(email))

      const user = await this.core.getUserByEmail(decodeURIComponent(email))
      if (!user) {
        return this.errorResponse(new Error(`User with email ${email} not found`), 404)
      }

      // Remove password hash from response
      const { passwordHash, ...safeUser } = user
      
      return this.successResponse({ user: safeUser })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  // Authentication handlers
  private async login(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate request body structure
      if (!request.body || typeof request.body !== 'object') {
        throw new InvalidInputError('Request body is required', 'body')
      }

      const body = request.body as Record<string, unknown>
      if (!('credentials' in body) || !body.credentials || typeof body.credentials !== 'object') {
        throw new InvalidInputError('Login credentials are required', 'credentials')
      }

      const { credentials } = body as unknown as LoginRequest
      const { rememberMe } = body as { rememberMe?: boolean }
      
      // Validate credentials format
      if (!credentials.username || !credentials.password) {
        throw new InvalidInputError('Username and password are required', 'credentials')
      }

      SecurityValidator.validateUsername(credentials.username)

      // Use core engine's authentication method (handles all validation internally)
      const authResult = await this.core.authenticateUser(credentials.username, credentials.password, { rememberMe })
      if (!authResult) {
        throw new InvalidInputError('Invalid credentials', 'credentials')
      }

      console.log('🔍 Auth result from core:', {
        hasUser: !!authResult.user,
        hasToken: !!authResult.token,
        hasRefreshToken: !!authResult.refreshToken,
        refreshTokenLength: authResult.refreshToken?.length || 0,
        tokenLength: authResult.token?.length || 0
      });

      const { user: authenticatedUser, token, refreshToken } = authResult
      
      // Get token expiration time
      const session = await this.core.verifyAuthToken(token)

      const response: LoginResponse = {
        success: true,
        token,
        refreshToken,
        user: authenticatedUser,
        expiresAt: session?.expiresAt
      }

      console.log('🚀 Final login response:', {
        success: response.success,
        hasToken: !!response.token,
        hasRefreshToken: !!response.refreshToken,
        hasUser: !!response.user,
        hasExpiresAt: !!response.expiresAt,
        refreshTokenLength: response.refreshToken?.length || 0
      });

      return this.successResponse(response)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async logout(request: HttpRequest): Promise<HttpResponse> {
    try {
      // For now, logout is client-side token removal
      // In a full implementation, we'd invalidate the token server-side
      return this.successResponse({ message: 'Logged out successfully' })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async validateToken(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate request body structure
      if (!request.body || typeof request.body !== 'object') {
        throw new InvalidInputError('Request body is required', 'body')
      }

      const body = request.body as Record<string, unknown>
      if (!('token' in body) || !body.token || typeof body.token !== 'string') {
        throw new InvalidInputError('Token is required', 'token')
      }

      const { token } = body as { token: string }

      // Validate token using core engine's JWT verification
      const session = await this.core.verifyAuthToken(token)
      const isValid = session !== null
      
      return this.successResponse({ 
        valid: isValid,
        message: isValid ? 'Token is valid' : 'Token is invalid',
        session: isValid ? session : undefined
      })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  // Helper methods for user management
  private async validateAdminAccess(request: HttpRequest): Promise<void> {
    const auth = this.config.authentication
    if (!auth?.enabled) {
      return // Authentication disabled, allow access
    }

    // Extract token from Authorization header
    const authHeader = request.headers['authorization'] || request.headers['Authorization']
    const authHeaderStr = Array.isArray(authHeader) ? authHeader[0] : authHeader
    
    if (!authHeaderStr || !authHeaderStr.startsWith('Bearer ')) {
      throw new InvalidInputError('Missing or invalid authorization header', 'authorization')
    }

    const token = authHeaderStr.slice(7) // Remove 'Bearer ' prefix

    // Verify token using core engine
    const session = await this.core.verifyAuthToken(token)
    if (!session) {
      throw new InvalidInputError('Invalid or expired authentication token', 'authorization')
    }

    // Check if user has admin role or users:write permission
    const hasAdminAccess = session.role === 'admin' || session.permissions.includes('users:write')
    if (!hasAdminAccess) {
      throw new InvalidInputError('Insufficient permissions for admin operations', 'authorization')
    }

    // Log admin access
    this.logAdminAccess(session, request.path, true)
  }

  // Token generation and validation now handled by core engine's JWT implementation

  private logAdminAccess(session: any, path: string, success: boolean): void {
    // Use core engine's audit logging
    this.core.logAuditEvent({
      type: 'admin_access',
      userId: session.userId,
      username: session.username,
      action: `Admin access to ${path}`,
      timestamp: new Date().toISOString(),
      success,
      details: {
        path,
        role: session.role,
        permissions: session.permissions
      }
    })
  }

  // Response helpers
  private successResponse<T>(data: T, status: number = 200): HttpResponse {
    const corsHeaders = this.buildCorsHeaders()
    
    const response: ApiResponse<T> = {
      success: true,
      data
    }

    return {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: response
    }
  }

  private errorResponse(error: unknown, status?: number): HttpResponse {
    const corsHeaders = this.buildCorsHeaders()
    
    let errorCode = 'INTERNAL_ERROR'
    let errorMessage = 'An unexpected error occurred'
    let statusCode = status || 500

    // SECURITY: Enhanced error handling with proper typing and status mapping
    if (error instanceof InvalidInputError) {
      errorCode = 'INVALID_INPUT'
      errorMessage = error.message
      statusCode = 400
      
      // Handle authentication errors specifically
      if ('field' in error && error.field === 'authorization') {
        statusCode = 401
        errorCode = 'UNAUTHORIZED'
      }
    } else if (error instanceof Error) {
      // More robust error detection
      if (error.name === 'DocumentNotFoundError' || error.message.toLowerCase().includes('not found')) {
        statusCode = 404
        errorCode = 'NOT_FOUND'
        errorMessage = error.message
      } else if (error.name === 'ValidationError') {
        statusCode = 400
        errorCode = 'VALIDATION_ERROR'
        errorMessage = error.message
      } else if (error.name === 'RateLimitError') {
        statusCode = 429
        errorCode = 'RATE_LIMIT_EXCEEDED'
        errorMessage = error.message
      } else {
        // Only expose error message in development
        errorMessage = process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred'
      }
    }

    const response: ApiResponse = {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage
      }
    }

    return {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: response
    }
  }

  private buildCorsHeaders(): Record<string, string> {
    const cors = this.config.corsOptions
    if (!cors) return {}

    const headers: Record<string, string> = {}

    if (cors.origin) {
      if (typeof cors.origin === 'boolean' && cors.origin) {
        headers['Access-Control-Allow-Origin'] = '*'
      } else if (typeof cors.origin === 'string') {
        headers['Access-Control-Allow-Origin'] = cors.origin
      } else if (Array.isArray(cors.origin)) {
        headers['Access-Control-Allow-Origin'] = cors.origin.join(', ')
      }
    }

    if (cors.methods) {
      headers['Access-Control-Allow-Methods'] = cors.methods.join(', ')
    }

    if (cors.allowedHeaders) {
      headers['Access-Control-Allow-Headers'] = cors.allowedHeaders.join(', ')
    }

    if (cors.credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true'
    }

    if (cors.maxAge) {
      headers['Access-Control-Max-Age'] = cors.maxAge.toString()
    }

    return headers
  }

  // Additional Media Routes
  private async updateMedia(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)
      
      const { id } = request.params
      if (!id) {
        return this.errorResponse(new InvalidInputError('Media ID is required'))
      }

      if (!request.body || typeof request.body !== 'object') {
        return this.errorResponse(new InvalidInputError('Request body is required'))
      }

      const body = request.body as Record<string, unknown>
      const metadata = body.metadata
      
      if (!metadata || typeof metadata !== 'object') {
        return this.errorResponse(new InvalidInputError('Metadata is required'))
      }

      // Validate media exists
      const existingMedia = await this.core.getMedia(id)
      if (!existingMedia) {
        return this.errorResponse(new Error('Media not found'), 404)
      }

      // Update metadata only (not the file itself)
      const updatedMedia = await this.core.updateMedia(id, metadata as Record<string, unknown>)
      
      return this.successResponse({ file: updatedMedia })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  // Authentication Routes
  private async refreshToken(request: HttpRequest): Promise<HttpResponse> {
    try {
      if (!request.body || typeof request.body !== 'object') {
        return this.errorResponse(new InvalidInputError('Request body is required'))
      }

      const body = request.body as Record<string, unknown>
      const { refreshToken } = body
      
      if (!refreshToken) {
        return this.errorResponse(new InvalidInputError('Refresh token is required'))
      }

      // TODO: Core method exists but may not be implemented yet
      const result = await this.core.refreshAuthToken(refreshToken as string)
      if (!result) {
        return this.errorResponse(new Error('Invalid or expired refresh token'), 401)
      }
      return this.successResponse(result)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  // Token Management Routes
  private async listTokens(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)
      
      const { limit, offset, isActive } = request.query
      const options: any = {}
      if (limit) options.limit = parseInt(String(limit), 10)
      if (offset) options.offset = parseInt(String(offset), 10)
      if (isActive !== undefined) options.isActive = isActive === 'true'
      
      const tokens = await this.core.listAppTokens(options)
      return this.successResponse(tokens)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async createToken(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)
      
      if (!request.body || typeof request.body !== 'object') {
        return this.errorResponse(new InvalidInputError('Token data is required'))
      }

      const tokenData = request.body as Record<string, unknown>
      
      // Validate required fields
      if (!tokenData.name || !tokenData.permissions) {
        return this.errorResponse(new InvalidInputError('Token name and permissions are required'))
      }
      
      // Get user from auth context (placeholder for now)
      const createdBy = 'system' // TODO: Get from authenticated user context
      
      const result = await this.core.createAppToken(tokenData as any, createdBy)
      if (!result.success) {
        return this.errorResponse(new Error(result.error || 'Failed to create token'))
      }
      
      return this.successResponse({ 
        token: result.token, // Plain text token (only returned once)
        appToken: result.appToken 
      }, 201)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async getToken(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)
      
      const { id } = request.params
      if (!id) {
        return this.errorResponse(new InvalidInputError('Token ID is required'))
      }

      // TODO: Implement token management in core
      return this.errorResponse(new Error('Token retrieval not implemented yet'), 501)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async updateToken(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)
      
      const { id } = request.params
      if (!id) {
        return this.errorResponse(new InvalidInputError('Token ID is required'))
      }

      if (!request.body || typeof request.body !== 'object') {
        return this.errorResponse(new InvalidInputError('Update data is required'))
      }

      const updateData = request.body as Record<string, unknown>

      // TODO: Implement token management in core
      return this.errorResponse(new Error('Token update not implemented yet'), 501)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async deleteToken(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)
      
      const { id } = request.params
      if (!id) {
        return this.errorResponse(new InvalidInputError('Token ID is required'))
      }

      await this.core.deleteAppToken(id)
      return this.successResponse(null, 204)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  // Schema Routes
  private async getSchema(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)
      
      const { schemaName } = request.params
      if (!schemaName) {
        return this.errorResponse(new InvalidInputError('Schema name is required'))
      }

      const schema = this.core.getSchema(schemaName)
      if (!schema) {
        return this.errorResponse(new Error('Schema not found'), 404)
      }

      return this.successResponse({ schema })
    } catch (error) {
      return this.errorResponse(error)
    }
  }
}