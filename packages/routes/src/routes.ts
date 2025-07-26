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
  DeleteMediaRequest,
  ListUsersRequest,
  CreateUserRequest,
  UpdateUserRequest,
  GetUserRequest,
  DeleteUserRequest,
  GetUserByUsernameRequest,
  GetUserByEmailRequest,
  LoginRequest,
  LoginResponse
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
    this.addRoute('GET', `${basePath}/collections/:collection`, this.listDocuments.bind(this))
    this.addRoute('POST', `${basePath}/collections/:collection`, this.createDocument.bind(this))
    this.addRoute('GET', `${basePath}/collections/:collection/:id`, this.getDocument.bind(this))
    this.addRoute('PUT', `${basePath}/collections/:collection/:id`, this.updateDocument.bind(this))
    this.addRoute('DELETE', `${basePath}/collections/:collection/:id`, this.deleteDocument.bind(this))

    // Media routes
    this.addRoute('POST', `${basePath}/media/upload`, this.uploadMedia.bind(this))
    this.addRoute('GET', `${basePath}/media/:id`, this.getMedia.bind(this))
    this.addRoute('GET', `${basePath}/media/:id/file`, this.serveMediaFile.bind(this))
    this.addRoute('GET', `${basePath}/media/:id/variant/:variant`, this.serveMediaVariant.bind(this))
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

    // Health check route
    this.addRoute('GET', `${basePath}/health`, this.healthCheck.bind(this))

    // CORS preflight route
    this.addRoute('OPTIONS', `${basePath}/*`, this.handleCors.bind(this))

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
      
      // For now, we'll serve the original file since we don't have variant storage implemented
      // In a full implementation, this would serve the processed variant file
      const content = await this.core.getMediaContent(id)
      if (!content) {
        return this.errorResponse(new Error(`Media variant ${variant} content not found`), 404)
      }

      const buffer = Buffer.from(content)

      return {
        status: 200,
        headers: {
          'Content-Type': variantInfo.format ? `image/${variantInfo.format}` : mediaFile.contentType,
          'Content-Length': buffer.length.toString(),
          'Content-Disposition': `inline; filename="${id}-${variant}.${variantInfo.format || 'jpg'}"`,
          'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
          'ETag': `"${id}-${variant}"`,
          ...this.buildCorsHeaders()
        },
        body: buffer
      }
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
        throw new InvalidInputError('Request body is required', 'body')
      }

      const body = request.body as Record<string, unknown>
      if (!('userData' in body) || !body.userData || typeof body.userData !== 'object') {
        throw new InvalidInputError('User data is required', 'userData')
      }

      const { userData } = body as unknown as UpdateUserRequest

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
      
      // Validate credentials format
      if (!credentials.username || !credentials.password) {
        throw new InvalidInputError('Username and password are required', 'credentials')
      }

      SecurityValidator.validateUsername(credentials.username)

      // Use core engine's authentication method (handles all validation internally)
      const authResult = await this.core.authenticateUser(credentials.username, credentials.password)
      if (!authResult) {
        throw new InvalidInputError('Invalid credentials', 'credentials')
      }

      const { user: authenticatedUser, token } = authResult
      
      // Get token expiration time
      const session = await this.core.verifyAuthToken(token)

      const response: LoginResponse = {
        success: true,
        token,
        user: authenticatedUser,
        expiresAt: session?.expiresAt
      }

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
}