import type {
  RoutesConfig,
  RouteDefinition,
  RouteHandler,
  HttpRequest,
  HttpResponse,
  ApiResponse,
  ListDocumentsRequest,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  GetDocumentRequest,
  DeleteDocumentRequest,
  UploadMediaRequest,
  GetMediaRequest,
  DeleteMediaRequest
} from './types.js'
import { TrokkyCore, SecurityValidator, InvalidInputError } from '@trokky/core'

export class TrokkyRoutes {
  private core: TrokkyCore
  private config: RoutesConfig
  private routes: Map<string, RouteDefinition> = new Map()

  constructor(config: RoutesConfig) {
    this.core = config.core
    this.config = {
      basePath: '/api/v1',
      // SECURITY: No default CORS configuration - must be explicitly configured
      // The dangerous 'origin: true' default has been removed to prevent CSRF attacks
      ...config
    }

    this.initializeRoutes()
  }

  private initializeRoutes(): void {
    const basePath = this.config.basePath || ''

    // Collection routes
    this.addRoute('GET', `${basePath}/collections/:collection`, this.listDocuments.bind(this))
    this.addRoute('POST', `${basePath}/collections/:collection`, this.createDocument.bind(this))
    this.addRoute('GET', `${basePath}/collections/:collection/:id`, this.getDocument.bind(this))
    this.addRoute('PUT', `${basePath}/collections/:collection/:id`, this.updateDocument.bind(this))
    this.addRoute('DELETE', `${basePath}/collections/:collection/:id`, this.deleteDocument.bind(this))

    // Media routes
    this.addRoute('POST', `${basePath}/media/upload`, this.uploadMedia.bind(this))
    this.addRoute('GET', `${basePath}/media/:id`, this.getMedia.bind(this))
    this.addRoute('DELETE', `${basePath}/media/:id`, this.deleteMedia.bind(this))

    // Health check route
    this.addRoute('GET', `${basePath}/health`, this.healthCheck.bind(this))

    // CORS preflight route
    this.addRoute('OPTIONS', `${basePath}/*`, this.handleCors.bind(this))
  }

  private addRoute(method: string, path: string, handler: RouteHandler): void {
    const key = `${method}:${path}`
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
    const authHeader = request.headers[headerName]
    
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
}