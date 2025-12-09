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
  CheckSlugUniquenessResponse,
  ListWebhooksRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  GetWebhookRequest,
  DeleteWebhookRequest,
  GetWebhookDeliveriesRequest,
  TestWebhookRequest
} from './types.js'
import { TrokkyCore, SecurityValidator, InvalidInputError, createLogger, MediaFile, expandDocumentReferences, parseExpandParam } from '@trokky/core'

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

    // Search routes
    this.addRoute('GET', `${basePath}/search`, this.searchContent.bind(this))

    // Removed duplicate document routes - use /collections endpoints instead

    // Statistics routes
    this.addRoute('GET', `${basePath}/stats/:collection`, this.getCollectionStats.bind(this))

    // Media routes
    this.addRoute('GET', `${basePath}/media`, this.listMedia.bind(this))
    this.addRoute('POST', `${basePath}/media/upload`, this.uploadMedia.bind(this))
    this.addRoute('POST', `${basePath}/media/bulk-delete`, this.bulkDeleteMedia.bind(this))
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
    this.addRoute('GET', `${basePath}/auth/me`, this.getMe.bind(this))
    this.addRoute('POST', `${basePath}/auth/validate`, this.validateToken.bind(this))
    this.addRoute('POST', `${basePath}/auth/refresh`, this.refreshToken.bind(this))

    // Password reset routes (public)
    this.addRoute('POST', `${basePath}/auth/request-reset`, this.requestPasswordReset.bind(this))
    this.addRoute('POST', `${basePath}/auth/reset-password`, this.resetPassword.bind(this))
    this.addRoute('POST', `${basePath}/auth/verify-reset-token`, this.verifyResetToken.bind(this))

    // Password change route (authenticated users)
    this.addRoute('POST', `${basePath}/auth/change-password`, this.changePassword.bind(this))

    // OAuth routes
    this.addRoute('POST', `${basePath}/auth/oauth/google/init`, this.initGoogleOAuth.bind(this))
    this.addRoute('POST', `${basePath}/auth/oauth/google/callback`, this.handleGoogleOAuthCallback.bind(this))
    this.addRoute('DELETE', `${basePath}/auth/oauth/google/unlink`, this.unlinkGoogleAccount.bind(this))
    this.addRoute('GET', `${basePath}/auth/oauth/status`, this.getOAuthStatus.bind(this))

    // CAPTCHA routes
    this.addRoute('GET', `${basePath}/auth/captcha/status`, this.getCaptchaStatus.bind(this))

    // MFA (Multi-Factor Authentication) routes
    this.addRoute('POST', `${basePath}/auth/mfa/verify`, this.verifyMFA.bind(this))
    this.addRoute('POST', `${basePath}/auth/mfa/verify-backup`, this.verifyMFABackup.bind(this))
    this.addRoute('POST', `${basePath}/auth/mfa/send-code`, this.sendMFACode.bind(this))
    this.addRoute('POST', `${basePath}/auth/mfa/setup/totp`, this.initTOTPSetup.bind(this))
    this.addRoute('POST', `${basePath}/auth/mfa/setup/totp/verify`, this.verifyTOTPSetup.bind(this))
    this.addRoute('POST', `${basePath}/auth/mfa/setup/email`, this.initEmailOTPSetup.bind(this))
    this.addRoute('POST', `${basePath}/auth/mfa/setup/email/verify`, this.verifyEmailOTPSetup.bind(this))
    this.addRoute('POST', `${basePath}/auth/mfa/disable`, this.disableMFA.bind(this))
    this.addRoute('POST', `${basePath}/auth/mfa/disable-all`, this.disableAllMFA.bind(this))
    this.addRoute('POST', `${basePath}/auth/mfa/backup-codes/regenerate`, this.regenerateBackupCodes.bind(this))
    this.addRoute('GET', `${basePath}/auth/mfa/status`, this.getMFAStatus.bind(this))
    this.addRoute('GET', `${basePath}/auth/mfa/trusted-devices`, this.getTrustedDevices.bind(this))
    this.addRoute('DELETE', `${basePath}/auth/mfa/trusted-devices/:deviceId`, this.revokeTrustedDevice.bind(this))
    this.addRoute('DELETE', `${basePath}/auth/mfa/trusted-devices`, this.revokeAllTrustedDevices.bind(this))
    this.addRoute('POST', `${basePath}/admin/users/:userId/mfa/reset`, this.adminResetUserMFA.bind(this))

    // OAuth2 Authorization Server routes (Device Flow + Authorization Code Flow)
    this.addRoute('POST', `${basePath}/auth/device`, this.startDeviceAuthorization.bind(this))
    this.addRoute('GET', `${basePath}/auth/device/verify`, this.getDeviceCodeInfo.bind(this))
    this.addRoute('POST', `${basePath}/auth/device/verify`, this.verifyDeviceCode.bind(this))
    this.addRoute('POST', `${basePath}/auth/token`, this.handleOAuth2TokenRequest.bind(this))
    this.addRoute('GET', `${basePath}/auth/authorize`, this.validateAuthorizationRequest.bind(this))
    this.addRoute('POST', `${basePath}/auth/authorize`, this.handleAuthorizationDecision.bind(this))

    // Token management routes (admin/user)
    this.addRoute('GET', `${basePath}/tokens`, this.listTokens.bind(this))
    this.addRoute('POST', `${basePath}/tokens`, this.createToken.bind(this))
    this.addRoute('GET', `${basePath}/tokens/:id`, this.getToken.bind(this))
    this.addRoute('PUT', `${basePath}/tokens/:id`, this.updateToken.bind(this))
    this.addRoute('DELETE', `${basePath}/tokens/:id`, this.deleteToken.bind(this))

    // Audit log routes (admin/user - read only)
    this.addRoute('GET', `${basePath}/audit-logs/documents/:documentId`, this.getDocumentAuditLogs.bind(this))
    this.addRoute('GET', `${basePath}/audit-logs/collections/:collection`, this.getCollectionAuditLogs.bind(this))
    this.addRoute('GET', `${basePath}/audit-logs/actors/:actorId`, this.getActorAuditLogs.bind(this))

    // Webhook management routes (admin only)
    this.addRoute('GET', `${basePath}/webhooks`, this.listWebhooks.bind(this))
    this.addRoute('POST', `${basePath}/webhooks`, this.createWebhook.bind(this))
    this.addRoute('GET', `${basePath}/webhooks/:id`, this.getWebhook.bind(this))
    this.addRoute('PUT', `${basePath}/webhooks/:id`, this.updateWebhook.bind(this))
    this.addRoute('DELETE', `${basePath}/webhooks/:id`, this.deleteWebhook.bind(this))
    this.addRoute('GET', `${basePath}/webhooks/:id/deliveries`, this.getWebhookDeliveries.bind(this))
    this.addRoute('POST', `${basePath}/webhooks/:id/test`, this.testWebhook.bind(this))

    // Schema routes
    this.addRoute('GET', `${basePath}/schemas/:schemaName`, this.getSchema.bind(this))

    // Configuration routes
    this.addRoute('GET', `${basePath}/config/structure`, this.getStructure.bind(this))
    this.addRoute('GET', `${basePath}/config/studio`, this.getStudioConfig.bind(this))
    this.addRoute('GET', `${basePath}/config/settings`, this.getSettings.bind(this))
    this.addRoute('PUT', `${basePath}/config/settings`, this.updateSettings.bind(this))

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
    // Only log route registration in very verbose mode (not in normal debug)
    // this.logger.debug('Adding route', { method, path })
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

    // Verify token and get session using TrokkyCore's unified method
    const session = await this.core.verifyAnyToken(cleanToken)
    if (!session) {
      throw new InvalidInputError('Invalid or expired authentication token', 'authorization')
    }

    // Populate request.user for handler compatibility
    // Type assertion: partial user data from session (email/other fields fetched by handler if needed)
    request.user = {
      id: session.userId,
      username: session.username,
      role: session.role
    } as any
  }

  // Media validation helper
  private validateMediaFiles(files: File[]): void {
    const maxFileSize = 100 * 1024 * 1024 // 100MB - matches audio field configuration
    const maxFiles = 10
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      // Video
      'video/mp4', 'video/webm', 'video/mov', 'video/avi',
      // Audio - comprehensive list to match AudioField
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
      
      const document = await this.core.saveDocument(collection, { ...data, id }, auditContext)
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

      // Get existing document to merge with updates
      // For singletons, allow upsert (create if doesn't exist)
      const schema = this.core.getSchema(collection)
      const isSingleton = schema?.singleton === true

      const existingDoc = await this.core.getDocument(collection, id)
      if (!existingDoc && !isSingleton) {
        return this.errorResponse(new Error(`Document ${collection}/${id} not found`), 404)
      }

      // Merge data (excluding system fields including audit fields, but preserve _status)
      let mergedData
      if (existingDoc) {
        const { _id, _collection, _createdAt, _updatedAt, _revision, _createdBy, _updatedBy, _createdByType, _updatedByType, ...existingData } = existingDoc
        // Preserve _status from existing document if not explicitly provided in update data
        if (!('_status' in data) && existingDoc._status) {
          mergedData = { ...existingData, ...data, _status: existingDoc._status }
        } else {
          mergedData = { ...existingData, ...data }
        }
      } else {
        // Singleton doesn't exist yet - create with provided data
        mergedData = data
      }

      const document = await this.core.saveDocument(collection, { ...mergedData, id }, auditContext)
      return this.successResponse({ document })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async deleteDocument(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and schema delete permissions
      await this.validateAuthentication(request)
      const { collection, id } = request.params
      await this.validateSchemaAccess(request, collection, 'delete')

      // Validate inputs
      SecurityValidator.validateCollectionName(collection)
      SecurityValidator.validateDocumentId(id)

      // Get audit context from current user
      const currentUser = await this.getCurrentUser(request)
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

      // Get all documents for basic stats
      const documents = await this.core.listDocuments(collection, {})
      
      // Calculate basic statistics
      const totalDocuments = documents.length
      const publishedDocuments = documents.filter(doc => doc.published === true).length
      const draftDocuments = documents.filter(doc => doc.published === false || doc.published === undefined).length
      
      // Calculate recent activity (documents created/updated in last 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const recentDocuments = documents.filter(doc => {
        const updatedAt = new Date(doc._updatedAt || doc._createdAt)
        return updatedAt > sevenDaysAgo
      }).length

      const stats = {
        collection,
        totalDocuments,
        publishedDocuments,
        draftDocuments,
        recentDocuments,
        lastUpdated: new Date().toISOString()
      }

      this.logger.debug('Collection stats calculated', { collection, stats })

      return this.successResponse({ stats })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async searchContent(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)
      
      // Parse query parameters from URL without relying on hardcoded base URL
      const urlParts = request.url.split('?')
      const searchParams = new URLSearchParams(urlParts[1] || '')
      const query = searchParams.get('q')
      const limit = parseInt(searchParams.get('limit') || '10', 10)
      const offset = parseInt(searchParams.get('offset') || '0', 10)
      
      if (!query || query.length < 2) {
        return this.errorResponse(new InvalidInputError('Search query must be at least 2 characters'))
      }

      this.logger.debug('Searching content', { query, limit, offset })

      const results: any[] = []
      const lowerQuery = query.toLowerCase()

      this.logger.debug('Starting search operation')

      // Get all schemas
      const schemas = this.core.getAllSchemas()
      this.logger.debug('Found schemas', { count: schemas.length, schemas: schemas.map(s => s.name) })
      
      // Search documents in each schema
      for (const schema of schemas) {
        try {
          this.logger.debug('Searching schema', { schemaName: schema.name })
          
          // Get searchable fields for this schema
          const searchableFields = this.getSearchableFields(schema)
          this.logger.debug('Found searchable fields', { schema: schema.name, fields: searchableFields })
          
          // Get documents with limited fields to improve performance
          const documents = await this.core.listDocuments(schema.name, { 
            limit: limit * 2, // Get a bit more to ensure we have enough results after filtering
            offset: 0 
          })

          for (const doc of documents) {
            // Check if any searchable field matches
            let matched = false
            let matchedField = ''
            let excerpt = ''

            for (const field of searchableFields) {
              const value = (doc as any)[field]
              if (value && typeof value === 'string' && value.toLowerCase().includes(lowerQuery)) {
                matched = true
                matchedField = field
                // Create excerpt around the match
                const index = value.toLowerCase().indexOf(lowerQuery)
                const start = Math.max(0, index - 75)
                const end = Math.min(value.length, index + 75)
                excerpt = value.substring(start, end)
                if (start > 0) excerpt = '...' + excerpt
                if (end < value.length) excerpt = excerpt + '...'
                break
              }
            }

            if (matched) {
              results.push({
                id: doc.id,
                type: 'document',
                collection: schema.name,
                title: (doc as any).title || (doc as any).name || (doc as any).slug || 'Untitled',
                url: `/content/${schema.name}/${doc.id}`,
                excerpt: excerpt || '',
                metadata: {
                  schemaType: schema.title || schema.name,
                  createdAt: doc._createdAt,
                  updatedAt: doc._updatedAt,
                  matchedField
                }
              })
            }
          }
        } catch (schemaError) {
          this.logger.warn('Failed to search schema', { schema: schema.name, error: schemaError })
        }
      }

      // Search media files
      try {
        this.logger.debug('Starting media search')
        const mediaFiles = await this.core.listMedia({ limit: limit * 2 })
        this.logger.debug('Found media files', { count: mediaFiles.length })
        
        for (const file of mediaFiles) {
          const title = file.filename || 'Untitled'
          const description = (file.metadata as any)?.description || (file.metadata as any)?.alt || ''
          
          if (title.toLowerCase().includes(lowerQuery) || 
              file.id.toLowerCase().includes(lowerQuery) ||
              description.toLowerCase().includes(lowerQuery)) {
            
            results.push({
              id: file.id,
              type: 'media',
              title,
              url: `/media?file=${file.id}`,
              excerpt: description || '',
              metadata: {
                contentType: file.contentType,
                size: file.size,
                createdAt: file._createdAt
              }
            })
          }
        }
      } catch (mediaError) {
        this.logger.error('Failed to search media', { 
          error: mediaError instanceof Error ? mediaError.message : String(mediaError),
          stack: mediaError instanceof Error ? mediaError.stack : undefined
        })
      }

      // Sort by relevance (exact title matches first, then other matches)
      results.sort((a, b) => {
        const aExactTitle = a.title.toLowerCase() === lowerQuery
        const bExactTitle = b.title.toLowerCase() === lowerQuery
        if (aExactTitle && !bExactTitle) return -1
        if (!aExactTitle && bExactTitle) return 1
        
        // Then by creation date (newest first)
        const aDate = new Date(a.metadata.createdAt || 0)
        const bDate = new Date(b.metadata.createdAt || 0)
        return bDate.getTime() - aDate.getTime()
      })

      // Apply pagination
      const paginatedResults = results.slice(offset, offset + limit)

      return this.successResponse({
        results: paginatedResults,
        total: results.length,
        query,
        limit,
        offset
      })
    } catch (error) {
      this.logger.error('Search failed with error', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
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

      // SECURITY: Sanitize responses to remove sensitive internal paths
      const sanitizedFiles = mediaFiles.map(file => this.sanitizeMediaResponse(file))

      return {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...this.buildCorsHeaders()
        },
        body: JSON.stringify({
          success: true,
          data: sanitizedFiles,
          meta: {
            count: sanitizedFiles.length,
            limit,
            offset,
            hasMore: sanitizedFiles.length === limit
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

      // SECURITY: Sanitize responses to remove sensitive internal paths
      const sanitizedFiles = uploadedFiles.map(file => this.sanitizeMediaResponse(file))

      return this.successResponse({
        files: sanitizedFiles,
        meta: { count: sanitizedFiles.length }
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

      // SECURITY: Sanitize response to remove sensitive internal paths
      const sanitizedFile = this.sanitizeMediaResponse(mediaFile)

      return this.successResponse({ file: sanitizedFile })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  /**
   * Sanitize media file response to remove sensitive internal information
   * This prevents exposing server filesystem paths and internal details
   */
  private sanitizeMediaResponse(mediaFile: MediaFile): Omit<MediaFile, 'metadata'> & { metadata?: Record<string, unknown> } {
    const { metadata, ...rest } = mediaFile

    // Only include safe metadata fields
    const safeMetadata: Record<string, unknown> = {}
    if (metadata) {
      // Include extension and originalFilename (useful for clients)
      if (metadata.extension) safeMetadata.extension = metadata.extension
      if (metadata.originalFilename) safeMetadata.originalFilename = metadata.originalFilename
      // Include image dimensions if available
      if (metadata.width) safeMetadata.width = metadata.width
      if (metadata.height) safeMetadata.height = metadata.height
      // Include any custom metadata that isn't a path
      for (const [key, value] of Object.entries(metadata)) {
        if (!['path', 'storagePath', 'absolutePath', 'relativePath', 'filePath'].includes(key)) {
          if (!safeMetadata[key]) {
            safeMetadata[key] = value
          }
        }
      }
      // Explicitly remove any path-related fields that might have slipped through
      delete safeMetadata.path
      delete safeMetadata.storagePath
      delete safeMetadata.absolutePath
      delete safeMetadata.relativePath
      delete safeMetadata.filePath
    }

    return {
      ...rest,
      metadata: Object.keys(safeMetadata).length > 0 ? safeMetadata : undefined
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

  private async bulkDeleteMedia(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication before processing
      await this.validateAuthentication(request)

      const body = request.body as { ids?: string[] }

      if (!body?.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
        return this.errorResponse(new Error('Invalid request: ids array is required'), 400)
      }

      // Validate all IDs before deleting
      for (const id of body.ids) {
        SecurityValidator.validateDocumentId(id)
      }

      // Limit bulk operations to prevent abuse
      const maxBulkOperations = 100
      if (body.ids.length > maxBulkOperations) {
        return this.errorResponse(
          new Error(`Cannot delete more than ${maxBulkOperations} files at once`),
          400
        )
      }

      const results: { id: string; success: boolean; error?: string }[] = []
      let successCount = 0
      let errorCount = 0

      // Delete each file and track results
      for (const id of body.ids) {
        try {
          await this.core.deleteMedia(id)
          results.push({ id, success: true })
          successCount++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.push({ id, success: false, error: errorMessage })
          errorCount++
          this.logger.warn('Failed to delete media file during bulk operation', { id, error: errorMessage })
        }
      }

      return this.successResponse({
        message: `Bulk delete completed: ${successCount} succeeded, ${errorCount} failed`,
        results,
        successCount,
        errorCount
      })
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

      // Use Uint8Array for edge compatibility (Workers, etc.)
      const buffer = content instanceof Uint8Array ? content : new Uint8Array(content)

      return {
        status: 200,
        headers: {
          'Content-Type': mediaFile.contentType,
          'Content-Length': buffer.byteLength.toString(),
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
      
      // Use media storage adapter to get variant file content
      const mediaStorage = this.core.getMediaStorageAdapter()
      
      if (mediaStorage.getVariantContent) {
        // If storage adapter supports variant content retrieval
        try {
          const variantContent = await mediaStorage.getVariantContent(id, variant)
          if (!variantContent) {
            return this.errorResponse(new Error(`Variant file ${variant} not found for media ${id}`), 404)
          }

          // Ensure Uint8Array body for edge runtimes
          const buffer = variantContent instanceof Uint8Array ? variantContent : new Uint8Array(variantContent)

          return {
            status: 200,
            headers: {
              'Content-Type': `image/${variantInfo.format || 'webp'}`,
              'Content-Length': buffer.byteLength.toString(),
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

      // No filesystem fallback for edge compatibility
      // Edge platforms (Cloudflare Workers, Vercel Edge, etc.) use object storage instead
      this.logger.error('Media storage adapter does not support variant content retrieval', { id, variant })
      return this.errorResponse(new Error(`Variant file ${variant} not found for media ${id}`), 404)
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

        // Edge-compatible static file serving not implemented
        // For edge platforms, static assets should be served by the platform itself
        // (e.g., Cloudflare Workers with R2, Vercel with CDN)
        return {
          status: 501,
          headers: { 'Content-Type': 'text/plain' },
          body: 'Static file serving not available in edge environment. Use platform-native CDN.'
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
      // SECURITY: Validate authentication and read permissions
      await this.validateAuthentication(request)
      await this.validateUserReadAccess(request)

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

      // Transform 'active' to 'isActive' if present
      if ('active' in userData) {
        userData.isActive = userData.active
        delete userData.active
      }

      // Debug: Log what data we're receiving
      this.logger.debug('Creating user with transformed data:', { userData })

      const user = await this.core.createUser(userData as any)

      // Remove password hash from response
      const { passwordHash, ...safeUser } = user

      return this.successResponse({ user: safeUser }, 201)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  private async getUser(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and read permissions
      await this.validateAuthentication(request)
      await this.validateUserReadAccess(request)

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

      const body = request.body as LoginRequest
      
      // Validate required fields
      if (!body.username || !body.password) {
        throw new InvalidInputError('Username and password are required', 'body')
      }

      SecurityValidator.validateUsername(body.username)

      // Validate CAPTCHA if required
      const { validateCaptcha, getClientIp } = await import('./auth/captcha.js')
      await validateCaptcha(this.core, body.captchaToken, getClientIp(request), 'login')

      // Use core engine's authentication method (handles all validation internally)
      const authResult = await this.core.authenticateUser(body.username, body.password, {
        rememberMe: body.rememberMe,
        deviceId: body.deviceId
      })
      if (!authResult) {
        throw new InvalidInputError('Invalid credentials', 'credentials')
      }

      // Handle different authentication result types
      if (authResult.type === 'mfa_required') {
        // User has MFA configured - need to verify
        return this.successResponse({
          success: true,
          requiresMFA: true,
          mfaToken: authResult.mfaToken,
          methods: authResult.methods,
          expiresIn: authResult.expiresIn
        })
      }

      if (authResult.type === 'mfa_setup_required') {
        // Organization requires MFA but user hasn't set it up
        return this.successResponse({
          success: true,
          requiresMFASetup: true,
          setupToken: authResult.setupToken,
          allowedMethods: authResult.allowedMethods,
          message: authResult.message,
          expiresIn: authResult.expiresIn
        })
      }

      // Normal successful authentication (type: 'success')
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

  private async getMe(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and get current user session
      await this.validateAuthentication(request)
      const sessionUser = await this.getCurrentUser(request)
      
      if (!sessionUser) {
        throw new Error('User session not found')
      }
      
      // Fetch full user data from storage using the user ID from session
      const fullUser = await this.core.getUser(sessionUser.id)
      
      if (!fullUser) {
        throw new Error('User not found in database')
      }
      
      // Remove password hash from response for security
      const { passwordHash, ...safeUser } = fullUser
      
      return this.successResponse(safeUser)
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
  private async validateUserReadAccess(request: HttpRequest): Promise<void> {
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

    // Check if user has admin role or users:read permission
    const hasReadAccess = session.role === 'admin' || session.permissions.includes('users:read')
    if (!hasReadAccess) {
      throw new InvalidInputError('Insufficient permissions for user management operations', 'permissions')
    }
  }

  private async validateWebhookReadAccess(request: HttpRequest): Promise<void> {
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

    // Check if user has admin role or webhooks:read permission
    const hasReadAccess = session.role === 'admin' || session.permissions.includes('webhooks:read')
    if (!hasReadAccess) {
      throw new InvalidInputError('Insufficient permissions for webhook management operations', 'permissions')
    }
  }

  private async validateSchemaAccess(request: HttpRequest, schemaName: string, action: 'read' | 'write' | 'delete'): Promise<void> {
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

    // Verify token using unified method that handles both JWT and API tokens
    const session = await this.core.verifyAnyToken(token)
    if (!session) {
      throw new InvalidInputError('Invalid or expired authentication token', 'authorization')
    }

    // Check if user has admin role or schema-specific permission
    const permission = `${schemaName}:${action}`
    const schemaWildcard = `${schemaName}:*`
    const contentWildcard = 'content:*'
    const globalPermission = `content:${action}` // Global content permissions
    
    const hasAccess = session.role === 'admin' || 
                     session.permissions.includes(permission) ||
                     session.permissions.includes(schemaWildcard) ||
                     session.permissions.includes(contentWildcard) ||
                     session.permissions.includes(globalPermission) // Add global content permission check
    
    if (!hasAccess) {
      throw new InvalidInputError(`Insufficient permissions for ${schemaName} ${action} operations`, 'permissions')
    }
  }

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

    // Verify token using unified method that handles both JWT and API tokens
    const session = await this.core.verifyAnyToken(token)
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
      errorMessage = (error as any).message
      statusCode = 400
      
      // Handle authentication errors specifically
      if ((error as any).field === 'authorization') {
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
        // Extract detailed validation errors if available
        if ('validationErrors' in error && Array.isArray(error.validationErrors)) {
          errorMessage = `Document validation failed: ${error.validationErrors.map((e: any) => `${e.field}: ${e.message}`).join(', ')}`
        } else {
          errorMessage = error.message
        }
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
        message: errorMessage,
        // Include validation details for ValidationError
        ...(error instanceof Error && error.name === 'ValidationError' && 'validationErrors' in error && Array.isArray(error.validationErrors)
          ? { details: error.validationErrors } 
          : {})
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
      } else if (typeof cors.origin === 'function') {
        // For function-based CORS checks, use wildcard
        // The function-based check is already handled by Express middleware for access control
        // For static file responses (like media), we need to set actual headers
        headers['Access-Control-Allow-Origin'] = '*'
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

      // SECURITY: Sanitize response to remove sensitive internal paths
      const sanitizedFile = this.sanitizeMediaResponse(updatedMedia)

      return this.successResponse({ file: sanitizedFile })
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

  // Configuration Routes
  private async getStructure(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)
      
      // Get current user for context-aware structure generation
      const user = await this.getCurrentUser(request)
      const schemas = this.core.getAllSchemas()
      
      // Get custom structure function from config if available
      const customStructure = this.getCustomStructureFunction()
      
      let structure: any
      
      if (customStructure && typeof customStructure === 'function') {
        // Execute custom structure function with context
        const context = {
          user,
          schemas,
          core: this.core,
          config: this.config
        }
        
        this.logger.debug('Executing custom structure function', { 
          userId: user?.id,
          userRole: user?.role,
          schemasCount: schemas.length 
        })
        
        structure = await Promise.resolve(customStructure(context))
      } else if (customStructure && typeof customStructure === 'object') {
        // Use static structure
        structure = customStructure
      } else {
        // Fall back to auto-generated structure
        structure = await this.buildDefaultStructure(user, schemas)
      }
      
      this.logger.debug('Generated dynamic structure', {
        title: structure.title,
        itemsCount: structure.items?.length || 0,
        userId: user?.id
      })

      // Enrich structure items with schema titles for better Create menu display
      const enrichedStructure = this.enrichStructureWithSchemaInfo(structure, schemas)

      return this.successResponse({ structure: enrichedStructure })
    } catch (error) {
      this.logger.error('Failed to get structure', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      return this.errorResponse(error)
    }
  }

  /**
   * Enrich structure items with schema information
   * Adds schemaTitle field to documentList items for better Create menu display
   */
  private enrichStructureWithSchemaInfo(structure: any, schemas: any[]): any {
    const schemaMap = new Map(schemas.map(s => [s.name, s]))

    const enrichItems = (items: any[]): any[] => {
      return items.map(item => {
        if (item.type === 'documentList' && item.schemaType) {
          const schema = schemaMap.get(item.schemaType)
          return {
            ...item,
            schemaTitle: schema?.title || item.schemaType
          }
        } else if (item.type === 'group' && item.items) {
          return {
            ...item,
            items: enrichItems(item.items)
          }
        }
        return item
      })
    }

    return {
      ...structure,
      items: enrichItems(structure.items || [])
    }
  }

  /**
   * Get studio configuration from trokky.config
   */
  private async getStudioConfig(request: HttpRequest): Promise<HttpResponse> {
    try {
      // Public endpoint - no authentication required for branding access on login page

      // Get studio configuration from global config or fallback
      const studioConfig = (global as any).__TROKKY_STUDIO_CONFIG__ || {
        branding: { title: 'Trokky Studio' },
        enabled: true,
        path: '/studio',
        requireAuth: true
      }

      // Fetch settings from storage to get branding configuration
      const dataStorage = this.core.getDataStorageAdapter()
      let brandingFromSettings = {}

      if (dataStorage && dataStorage.getSettings) {
        try {
          const settings = await dataStorage.getSettings()
          if (settings) {
            // Merge branding fields from settings
            brandingFromSettings = {
              title: settings.studioTitle || studioConfig.branding?.title,
              organizationName: settings.organizationName,
              primaryColor: settings.primaryColor,
              secondaryColor: settings.secondaryColor,
              logo: settings.logo,
            }
          }
        } catch (error) {
          this.logger.warn('Failed to fetch settings for branding', {
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      // Merge branding from settings with global config
      const mergedBranding = {
        ...studioConfig.branding,
        ...brandingFromSettings
      }

      // Add MediaUrlGenerator configuration for media URL generation
      // Use mediaUrlGenerator from global config if available
      const mediaUrlGenerator = studioConfig.mediaUrlGenerator || {
        options: {
          apiBasePath: studioConfig.apiBasePath || "/api",
          mediaConfig: {
            serving: {
              mode: "api" // Always use API mode for media serving
            }
          }
        }
      }

      // Convert session config to match Studio expectations (camelCase with Ms suffix)
      const sessionConfig = studioConfig.session ? {
        refreshBufferMs: studioConfig.session.refreshBuffer,
        warningBufferMs: studioConfig.session.warningBuffer,
        checkIntervalMs: studioConfig.session.checkInterval,
        inactivityTimeoutMs: studioConfig.session.inactivityTimeout,
      } : undefined

      const configWithMediaGenerator = {
        ...studioConfig,
        branding: mergedBranding,
        mediaUrlGenerator,
        media: studioConfig.media || { variants: [] }, // Include media variants for pre-flight checks
        sessionConfig, // Add session config for Studio's useAuth hook
      }

      this.logger.debug('Serving studio configuration', {
        title: mergedBranding.title,
        organizationName: mergedBranding.organizationName,
        enabled: studioConfig.enabled,
        hasMediaUrlGenerator: true,
        mediaVariantsCount: studioConfig.media?.variants?.length || 0,
        hasSessionConfig: !!sessionConfig
      })

      return this.successResponse({ studioConfig: configWithMediaGenerator })
    } catch (error) {
      this.logger.error('Failed to get studio config', {
        error: error instanceof Error ? error.message : String(error)
      })
      return this.errorResponse(error)
    }
  }

  /**
   * Get studio settings
   */
  private async getSettings(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.validateAuthentication(request)

      // Get settings from storage
      const dataStorage = this.core.getDataStorageAdapter()
      if (!dataStorage || !dataStorage.getSettings) {
        // Return default settings if storage doesn't support settings
        const defaultSettings = {
          publicUrl: 'http://localhost:3000',
          studioTitle: 'Trokky Studio',
          defaultTheme: 'system' as const
        }
        
        this.logger.debug('Returning default settings (storage not available)')
        return this.successResponse({ settings: defaultSettings })
      }

      let settings = await dataStorage.getSettings()
      
      if (!settings) {
        // Create default settings if none exist
        const defaultSettings = {
          id: 'studio-settings',
          publicUrl: 'http://localhost:3000',
          studioTitle: 'Trokky Studio',
          defaultTheme: 'system' as const,
          _createdAt: new Date().toISOString(),
          _updatedAt: new Date().toISOString()
        }
        
        // Save default settings if storage supports it
        if (dataStorage.saveSettings) {
          await dataStorage.saveSettings(defaultSettings)
        }
        settings = defaultSettings
        
        this.logger.info('Created default settings')
      }

      this.logger.debug('Serving settings', { 
        publicUrl: settings.publicUrl,
        studioTitle: settings.studioTitle 
      })

      return this.successResponse({ settings })
    } catch (error) {
      this.logger.error('Failed to get settings', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      return this.errorResponse(error)
    }
  }

  /**
   * Update studio settings (admin only)
   */
  private async updateSettings(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin access
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      // SECURITY: Validate request body
      if (!request.body || typeof request.body !== 'object') {
        throw new InvalidInputError('Request body is required', 'body')
      }

      const body = request.body as Record<string, unknown>
      if (!('settings' in body) || !body.settings || typeof body.settings !== 'object') {
        throw new InvalidInputError('Settings data is required', 'settings')
      }

      const newSettings = body.settings as Record<string, any>

      // DEBUG: Log received settings
      this.logger.info('DEBUG: Received settings update', {
        newSettings,
        brandingFields: {
          organizationName: newSettings.organizationName,
          primaryColor: newSettings.primaryColor,
          secondaryColor: newSettings.secondaryColor,
          logo: newSettings.logo
        }
      })

      // Get data storage
      const dataStorage = this.core.getDataStorageAdapter()

      // DEBUG: Check what methods are available
      this.logger.info('DEBUG: Data storage check', {
        hasDataStorage: !!dataStorage,
        hasGetSettings: !!dataStorage?.getSettings,
        hasSaveSettings: !!dataStorage?.saveSettings,
        adapterType: dataStorage?.constructor?.name
      })

      if (!dataStorage || !dataStorage.getSettings || !dataStorage.saveSettings) {
        return this.errorResponse(new Error('Settings storage not available'), 503)
      }

      // Get current settings
      let currentSettings = await dataStorage.getSettings()
      if (!currentSettings) {
        // Create new settings if none exist
        currentSettings = {
          id: 'studio-settings',
          publicUrl: 'http://localhost:3000',
          studioTitle: 'Trokky Studio',
          defaultTheme: 'system' as const,
          _createdAt: new Date().toISOString()
        }
      }

      // Get current user for audit trail
      const currentUser = await this.getCurrentUser(request)
      
      // Merge settings with metadata, ensuring required fields are present
      const updatedSettings: any = {
        id: 'studio-settings', // Ensure ID is consistent
        publicUrl: newSettings.publicUrl || currentSettings.publicUrl,
        studioTitle: newSettings.studioTitle || currentSettings.studioTitle,
        organizationName: newSettings.organizationName !== undefined ? newSettings.organizationName : currentSettings.organizationName,
        primaryColor: newSettings.primaryColor !== undefined ? newSettings.primaryColor : currentSettings.primaryColor,
        secondaryColor: newSettings.secondaryColor !== undefined ? newSettings.secondaryColor : currentSettings.secondaryColor,
        logo: newSettings.logo !== undefined ? newSettings.logo : currentSettings.logo,
        defaultTheme: newSettings.defaultTheme || currentSettings.defaultTheme,
        // MFA settings
        mfaRequired: newSettings.mfaRequired !== undefined ? newSettings.mfaRequired : currentSettings.mfaRequired,
        mfaEnforcedRoles: newSettings.mfaEnforcedRoles !== undefined ? newSettings.mfaEnforcedRoles : currentSettings.mfaEnforcedRoles,
        mfaAllowedMethods: newSettings.mfaAllowedMethods !== undefined ? newSettings.mfaAllowedMethods : currentSettings.mfaAllowedMethods,
        mfaTrustDeviceDays: newSettings.mfaTrustDeviceDays !== undefined ? newSettings.mfaTrustDeviceDays : currentSettings.mfaTrustDeviceDays,
        mfaGracePeriodDays: newSettings.mfaGracePeriodDays !== undefined ? newSettings.mfaGracePeriodDays : currentSettings.mfaGracePeriodDays,
        _createdAt: currentSettings._createdAt,
        _updatedAt: new Date().toISOString(),
        _updatedBy: currentUser?.username || 'system'
      }

      // DEBUG: Log merged settings being saved
      this.logger.info('DEBUG: Saving merged settings', {
        updatedSettings,
        brandingFields: {
          organizationName: updatedSettings.organizationName,
          primaryColor: updatedSettings.primaryColor,
          secondaryColor: updatedSettings.secondaryColor,
          logo: updatedSettings.logo
        }
      })

      // Save to storage
      await dataStorage.saveSettings(updatedSettings)

      // Get event bus for emitting events
      const eventBus = this.core.getEventBus()
      if (eventBus) {
        // Emit general settings updated event
        await eventBus.emitEvent({
          type: 'settings.updated',
          data: {
            settings: updatedSettings,
            changes: newSettings,
            updatedBy: currentUser?.username || 'system'
          },
          source: 'api'
        })

        // Emit specific events for major changes
        if (newSettings.publicUrl && newSettings.publicUrl !== currentSettings.publicUrl) {
          await eventBus.emitEvent({
            type: 'settings.publicUrl.changed',
            data: {
              oldUrl: currentSettings.publicUrl,
              newUrl: newSettings.publicUrl,
              updatedBy: currentUser?.username || 'system'
            },
            source: 'api'
          })
        }

        if (newSettings.studioTitle && newSettings.studioTitle !== currentSettings.studioTitle) {
          await eventBus.emitEvent({
            type: 'settings.branding.changed',
            data: {
              oldTitle: currentSettings.studioTitle,
              newTitle: newSettings.studioTitle,
              updatedBy: currentUser?.username || 'system'
            },
            source: 'api'
          })
        }

        if (newSettings.defaultTheme && newSettings.defaultTheme !== currentSettings.defaultTheme) {
          await eventBus.emitEvent({
            type: 'settings.theme.changed',
            data: {
              oldTheme: currentSettings.defaultTheme,
              newTheme: newSettings.defaultTheme,
              updatedBy: currentUser?.username || 'system'
            },
            source: 'api'
          })
        }
      }

      this.logger.info('Settings updated', {
        changes: Object.keys(newSettings),
        updatedBy: currentUser?.username || 'system',
        eventsEmitted: !!eventBus
      })

      return this.successResponse({ 
        settings: updatedSettings,
        message: 'Settings updated successfully'
      })
    } catch (error) {
      this.logger.error('Failed to update settings', { 
        error: error instanceof Error ? error.message : String(error) 
      })
      return this.errorResponse(error)
    }
  }

  private getCustomStructureFunction(): any {
    // In Express integration, custom structure is passed through config
    // This will be available via the core config or a separate structure registry
    return (global as any).__TROKKY_STRUCTURE__ || null
  }

  private async getCurrentUser(request: HttpRequest): Promise<any> {
    try {
      // Extract user from validated token using unified token validation
      const authHeader = request.headers.authorization || request.headers['Authorization']
      const authHeaderStr = Array.isArray(authHeader) ? authHeader[0] : authHeader
      
      if (!authHeaderStr || typeof authHeaderStr !== 'string') {
        return null
      }

      const token = authHeaderStr.startsWith('Bearer ') 
        ? authHeaderStr.slice(7) 
        : authHeaderStr
      
      // Use unified token validation that handles both JWT and API tokens
      const session = await this.core.verifyAnyToken(token)
      
      if (session) {
        // Session contains basic user information
        return {
          id: session.userId,
          username: session.username,
          role: session.role,
          permissions: session.permissions
        }
      }
      
      return null
    } catch (error) {
      this.logger.warn('Failed to get current user for structure context', error)
      return null
    }
  }

  private async buildDefaultStructure(user: any, schemas: any[]): Promise<any> {
    const items: any[] = []
    
    // Create basic structure based on schemas and user permissions
    for (const schema of schemas) {
      if (this.shouldIncludeSchemaInStructure(schema, user)) {
        items.push({
          type: 'documentList',
          title: this.formatSchemaTitle(schema.name),
          schemaType: schema.name,
          icon: this.getSchemaIcon(schema),
          defaultOrdering: [{ field: '_updatedAt', direction: 'desc' }],
          options: {
            pageSize: 25,
            searchable: true,
            searchFields: this.getSearchableFields(schema)
          }
        })
      }
    }
    
    // Add admin-only sections
    if (user?.role === 'admin') {
      items.push({
        type: 'divider',
        title: 'Administration'
      })
      
      // Add any admin-specific structure items here
    }

    return {
      title: 'Content Management',
      items,
      metadata: {
        version: '1.0.0',
        description: 'Dynamic structure generated from API endpoint',
        userId: user?.id,
        userRole: user?.role,
        generatedAt: new Date().toISOString()
      }
    }
  }

  private shouldIncludeSchemaInStructure(schema: any, user: any): boolean {
    // Basic permission check - extend as needed
    if (!user) return false
    
    // Admin can see everything
    if (user.role === 'admin') return true
    
    // Other users can see non-internal schemas
    return !schema.name.startsWith('_') && !schema.internal
  }

  private formatSchemaTitle(schemaName: string): string {
    // Convert camelCase/PascalCase to Title Case
    return schemaName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  }

  private getSchemaIcon(schema: any): string {
    // Basic icon mapping based on schema name
    const name = schema.name.toLowerCase()
    
    if (name.includes('post') || name.includes('article')) return 'document-text'
    if (name.includes('page')) return 'document'
    if (name.includes('user') || name.includes('author')) return 'user'
    if (name.includes('category') || name.includes('tag')) return 'tag'
    if (name.includes('media') || name.includes('image')) return 'photo'
    if (name.includes('setting') || name.includes('config')) return 'cog'
    if (name.includes('menu') || name.includes('navigation')) return 'menu'
    
    return 'document-text'
  }

  private getSearchableFields(schema: any): string[] {
    // Basic searchable fields detection
    const searchableFields = ['title', 'name', 'slug']
    
    if (schema.fields) {
      const fieldNames = Object.keys(schema.fields)
      return fieldNames.filter(name => 
        searchableFields.some(searchable => name.toLowerCase().includes(searchable))
      )
    }
    
    return ['title']
  }

  /**
   * Attempt to auto-create a singleton document if it matches known singleton patterns
   */
  private async tryAutoCreateSingleton(collection: string, documentId: string): Promise<any | null> {
    try {
      // Get the custom structure function to check for singletons
      const customStructure = this.getCustomStructureFunction()
      
      let isSingleton = false
      let singletonConfig: any = null
      
      if (customStructure && typeof customStructure === 'function') {
        // Execute structure function to get singleton info
        const user = null // TODO: Get current user from auth context
        const schemas = this.core.getAllSchemas()
        const context = { user, schemas, core: this.core, config: this.config }
        
        const structure = await Promise.resolve(customStructure(context))
        
        // Find if this collection/documentId combo is a singleton
        const findSingleton = (items: any[]): any => {
          for (const item of items) {
            if (item.type === 'singleton' && 
                item.schemaType === collection && 
                (item.documentId === documentId || item.schemaType === documentId)) {
              return item
            } else if (item.items && Array.isArray(item.items)) {
              const found = findSingleton(item.items)
              if (found) return found
            }
          }
          return null
        }
        
        singletonConfig = findSingleton(structure.items || [])
        isSingleton = !!singletonConfig
      } else {
        // Fallback: check common singleton patterns
        const singletonPatterns = [
          { collection: 'homePage', documentId: 'home' },
          { collection: 'settings', documentId: 'site-settings' },
          { collection: 'config', documentId: 'main' },
          { collection: 'siteSettings', documentId: 'main' }
        ]
        
        isSingleton = singletonPatterns.some(pattern => 
          pattern.collection === collection && pattern.documentId === documentId
        )
      }
      
      if (isSingleton) {
        this.logger.info('Auto-creating singleton document', { 
          collection, 
          documentId,
          autoCreate: singletonConfig?.options?.autoCreate !== false
        })
        
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
      }
      
      return null
    } catch (error) {
      this.logger.error('Failed to auto-create singleton', { collection, documentId, error })
      return null
    }
  }

  /**
   * Validate singleton creation to prevent duplicates
   */
  private async validateSingletonCreation(collection: string, requestedId?: string): Promise<void> {
    try {
      // Get the custom structure function to check for singletons
      const customStructure = this.getCustomStructureFunction()
      
      let isSingleton = false
      let singletonDocumentId: string | null = null
      
      if (customStructure && typeof customStructure === 'function') {
        // Execute structure function to get singleton info
        const user = null // TODO: Get current user from auth context
        const schemas = this.core.getAllSchemas()
        const context = { user, schemas, core: this.core, config: this.config }
        
        const structure = await Promise.resolve(customStructure(context))
        
        // Find if this collection is a singleton
        const findSingleton = (items: any[]): any => {
          for (const item of items) {
            if (item.type === 'singleton' && item.schemaType === collection) {
              return item
            } else if (item.items && Array.isArray(item.items)) {
              const found = findSingleton(item.items)
              if (found) return found
            }
          }
          return null
        }
        
        const singletonConfig = findSingleton(structure.items || [])
        if (singletonConfig) {
          isSingleton = true
          singletonDocumentId = singletonConfig.documentId || collection
        }
      } else {
        // Fallback: check common singleton patterns
        const singletonPatterns = [
          { collection: 'homePage', documentId: 'home' },
          { collection: 'settings', documentId: 'site-settings' },
          { collection: 'config', documentId: 'main' },
          { collection: 'siteSettings', documentId: 'main' }
        ]
        
        const pattern = singletonPatterns.find(p => p.collection === collection)
        if (pattern) {
          isSingleton = true
          singletonDocumentId = pattern.documentId
        }
      }
      
      if (isSingleton && singletonDocumentId) {
        // Check if a singleton document already exists for this collection
        const existingDocuments = await this.core.listDocuments(collection, { limit: 1 })
        
        if (existingDocuments && existingDocuments.length > 0) {
          this.logger.warn('Attempted to create duplicate singleton document', {
            collection,
            requestedId,
            singletonDocumentId,
            existingDocument: existingDocuments[0].id || existingDocuments[0]._id
          })
          
          throw new InvalidInputError(
            `Singleton document already exists for collection '${collection}'. Only one document is allowed.`,
            'singleton_duplicate'
          )
        }
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
        // Include _type field for object items if specified
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

  // ==========================================================================
  // WEBHOOK MANAGEMENT ROUTES
  // ==========================================================================

  /**
   * List all registered webhooks
   */
  private async listWebhooks(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and read permissions
      await this.validateAuthentication(request)
      await this.validateWebhookReadAccess(request)

      const { active, limit, offset } = request.query

      // Get webhooks from event bus
      const eventBus = this.core.getEventBus()
      if (!eventBus) {
        return this.errorResponse(new Error('Event system not available'), 503)
      }

      let webhooks = eventBus.getWebhooks()

      // Apply filters
      if (active !== undefined) {
        const isActive = active === 'true'
        webhooks = webhooks.filter(webhook => webhook.active === isActive)
      }

      // Apply pagination
      let paginatedWebhooks = webhooks
      const offsetNum = parseInt(String(offset) || '0', 10)
      const limitNum = parseInt(String(limit) || '50', 10)

      if (offsetNum > 0) {
        paginatedWebhooks = paginatedWebhooks.slice(offsetNum)
      }
      if (limitNum > 0) {
        paginatedWebhooks = paginatedWebhooks.slice(0, limitNum)
      }

      return this.successResponse({
        webhooks: paginatedWebhooks,
        meta: {
          total: webhooks.length,
          limit: limitNum,
          offset: offsetNum,
          hasMore: webhooks.length > offsetNum + limitNum
        }
      })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  /**
   * Create a new webhook
   */
  private async createWebhook(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      // SECURITY: Validate request body structure
      if (!request.body || typeof request.body !== 'object') {
        throw new InvalidInputError('Request body is required', 'body')
      }

      const body = request.body as Record<string, unknown>
      if (!('webhookData' in body) || !body.webhookData || typeof body.webhookData !== 'object') {
        throw new InvalidInputError('Webhook data is required', 'webhookData')
      }

      const { webhookData } = body as unknown as CreateWebhookRequest

      // Validate required fields
      if (!webhookData.name || !webhookData.url || !webhookData.events) {
        throw new InvalidInputError('Name, URL, and events are required', 'webhookData')
      }

      // Validate URL format
      try {
        new URL(webhookData.url)
      } catch {
        throw new InvalidInputError('Invalid webhook URL format', 'url')
      }

      // Validate events array
      if (!Array.isArray(webhookData.events) || webhookData.events.length === 0) {
        throw new InvalidInputError('At least one event pattern is required', 'events')
      }

      // Get event bus and register webhook
      const eventBus = this.core.getEventBus()
      if (!eventBus) {
        return this.errorResponse(new Error('Event system not available'), 503)
      }

      // Generate webhook ID
      const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Get current user from auth context (TODO: implement proper user context)
      const currentUser = await this.getCurrentUser(request)
      const createdBy = currentUser?.id || 'system'

      const webhookConfig = {
        id: webhookId,
        name: webhookData.name,
        url: webhookData.url,
        events: webhookData.events,
        secret: webhookData.secret || `secret_${Math.random().toString(36).substr(2, 16)}`,
        active: webhookData.active !== false,
        headers: webhookData.headers || {},
        createdBy,
        retryPolicy: webhookData.retryPolicy || {
          maxRetries: 3,
          backoffType: 'exponential' as const,
          baseDelay: 1000,
          maxDelay: 30000,
          retryOnStatus: [500, 502, 503, 504, 408, 429]
        }
      }

      eventBus.registerWebhook(webhookConfig)

      this.logger.info('Webhook created successfully', { 
        id: webhookId, 
        name: webhookConfig.name,
        url: webhookConfig.url
      })

      return this.successResponse({ webhook: webhookConfig }, 201)
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  /**
   * Get a specific webhook by ID
   */
  private async getWebhook(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and read permissions
      await this.validateAuthentication(request)
      await this.validateWebhookReadAccess(request)

      const { id } = request.params
      SecurityValidator.validateDocumentId(id)

      // Get event bus and retrieve webhook
      const eventBus = this.core.getEventBus()
      if (!eventBus) {
        return this.errorResponse(new Error('Event system not available'), 503)
      }

      const webhook = eventBus.getWebhook(id)
      if (!webhook) {
        return this.errorResponse(new Error(`Webhook ${id} not found`), 404)
      }

      return this.successResponse({ webhook })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  /**
   * Update an existing webhook
   */
  private async updateWebhook(request: HttpRequest): Promise<HttpResponse> {
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
      if (!('webhookData' in body) || !body.webhookData || typeof body.webhookData !== 'object') {
        throw new InvalidInputError('Webhook data is required', 'webhookData')
      }

      const { webhookData } = body as unknown as UpdateWebhookRequest

      // Validate URL if provided
      if (webhookData.url) {
        try {
          new URL(webhookData.url)
        } catch {
          throw new InvalidInputError('Invalid webhook URL format', 'url')
        }
      }

      // Validate events array if provided
      if (webhookData.events && (!Array.isArray(webhookData.events) || webhookData.events.length === 0)) {
        throw new InvalidInputError('Events must be a non-empty array', 'events')
      }

      // Get event bus and update webhook
      const eventBus = this.core.getEventBus()
      if (!eventBus) {
        return this.errorResponse(new Error('Event system not available'), 503)
      }

      const updated = eventBus.updateWebhook(id, webhookData)
      if (!updated) {
        return this.errorResponse(new Error(`Webhook ${id} not found`), 404)
      }

      const webhook = eventBus.getWebhook(id)
      
      this.logger.info('Webhook updated successfully', { 
        id, 
        updatedFields: Object.keys(webhookData) 
      })

      return this.successResponse({ webhook })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  /**
   * Delete a webhook
   */
  private async deleteWebhook(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      const { id } = request.params
      SecurityValidator.validateDocumentId(id)

      // Get event bus and delete webhook
      const eventBus = this.core.getEventBus()
      if (!eventBus) {
        return this.errorResponse(new Error('Event system not available'), 503)
      }

      const deleted = eventBus.unregisterWebhook(id)
      if (!deleted) {
        return this.errorResponse(new Error(`Webhook ${id} not found`), 404)
      }

      this.logger.info('Webhook deleted successfully', { id })

      return this.successResponse({ message: 'Webhook deleted successfully' })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  /**
   * Get webhook delivery history
   */
  private async getWebhookDeliveries(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and read permissions
      await this.validateAuthentication(request)
      await this.validateWebhookReadAccess(request)

      const { id } = request.params
      SecurityValidator.validateDocumentId(id)

      const { limit, offset } = request.query

      // Get event bus and retrieve delivery history
      const eventBus = this.core.getEventBus()
      if (!eventBus) {
        return this.errorResponse(new Error('Event system not available'), 503)
      }

      // Verify webhook exists
      const webhook = eventBus.getWebhook(id)
      if (!webhook) {
        return this.errorResponse(new Error(`Webhook ${id} not found`), 404)
      }

      let deliveries = eventBus.getWebhookDeliveries(id)

      // Apply pagination
      const offsetNum = parseInt(String(offset) || '0', 10)
      const limitNum = parseInt(String(limit) || '50', 10)

      const totalDeliveries = deliveries.length
      if (offsetNum > 0) {
        deliveries = deliveries.slice(offsetNum)
      }
      if (limitNum > 0) {
        deliveries = deliveries.slice(0, limitNum)
      }

      return this.successResponse({
        deliveries,
        meta: {
          total: totalDeliveries,
          limit: limitNum,
          offset: offsetNum,
          hasMore: totalDeliveries > offsetNum + limitNum
        }
      })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  /**
   * Test a webhook by sending a sample event
   */
  private async testWebhook(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and admin privileges
      await this.validateAuthentication(request)
      await this.validateAdminAccess(request)

      const { id } = request.params
      SecurityValidator.validateDocumentId(id)

      const body = (request.body as Record<string, unknown>) || {}
      const { eventType } = body as { eventType?: string }

      // Get event bus and verify webhook exists
      const eventBus = this.core.getEventBus()
      if (!eventBus) {
        return this.errorResponse(new Error('Event system not available'), 503)
      }

      const webhook = eventBus.getWebhook(id)
      if (!webhook) {
        return this.errorResponse(new Error(`Webhook ${id} not found`), 404)
      }

      // Create a test event
      const testEvent = {
        type: eventType || 'system.test',
        source: 'api' as const,
        actor: {
          type: 'user' as const,
          id: 'test-user',
          name: 'Test User'
        },
        data: {
          message: 'This is a test webhook event',
          timestamp: new Date().toISOString(),
          webhookId: id,
          testMode: true
        },
        metadata: {
          test: true,
          triggeredBy: 'webhook-test-endpoint'
        }
      }

      // Emit the test event (webhook will be triggered automatically)
      const eventId = await eventBus.emitEvent(testEvent)

      this.logger.info('Test webhook event sent', { 
        webhookId: id, 
        eventId, 
        eventType: testEvent.type 
      })

      return this.successResponse({
        message: 'Test webhook event sent successfully',
        eventId,
        eventType: testEvent.type,
        webhookUrl: webhook.url
      })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  // ==========================================================================
  // AUDIT LOG ROUTES
  // ==========================================================================

  /**
   * Get audit logs for a specific document
   */
  private async getDocumentAuditLogs(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and basic read permissions
      await this.validateAuthentication(request)
      const currentUser = await this.getCurrentUser(request)
      
      if (!currentUser) {
        return this.errorResponse(new Error('Authentication required'), 401)
      }

      const { documentId } = request.params
      const limit = request.query.limit ? parseInt(request.query.limit as string) : 50
      const offset = request.query.offset ? parseInt(request.query.offset as string) : 0

      // Validate inputs
      SecurityValidator.validateDocumentId(documentId)

      const auditLogs = await this.core.getDocumentAuditLogs(documentId, { limit, offset })

      this.logger.info('Document audit logs retrieved', { 
        documentId, 
        userId: currentUser.id,
        count: auditLogs.length 
      })

      return this.successResponse({
        auditLogs,
        pagination: {
          limit,
          offset,
          count: auditLogs.length
        }
      })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  /**
   * Get audit logs for a collection
   */
  private async getCollectionAuditLogs(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication and schema read permissions
      await this.validateAuthentication(request)
      const { collection } = request.params
      await this.validateSchemaAccess(request, collection, 'read')

      const currentUser = await this.getCurrentUser(request)
      if (!currentUser) {
        return this.errorResponse(new Error('Authentication required'), 401)
      }

      const limit = request.query.limit ? parseInt(request.query.limit as string) : 50
      const offset = request.query.offset ? parseInt(request.query.offset as string) : 0

      // Validate inputs
      SecurityValidator.validateCollectionName(collection)

      const auditLogs = await this.core.getCollectionAuditLogs(collection, { limit, offset })

      this.logger.info('Collection audit logs retrieved', { 
        collection, 
        userId: currentUser.id,
        count: auditLogs.length 
      })

      return this.successResponse({
        auditLogs,
        pagination: {
          limit,
          offset,
          count: auditLogs.length
        }
      })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  /**
   * Get audit logs for a specific actor (user/api/system)
   */
  private async getActorAuditLogs(request: HttpRequest): Promise<HttpResponse> {
    try {
      // SECURITY: Validate authentication
      await this.validateAuthentication(request)
      const currentUser = await this.getCurrentUser(request)
      
      if (!currentUser) {
        return this.errorResponse(new Error('Authentication required'), 401)
      }

      const { actorId } = request.params
      const limit = request.query.limit ? parseInt(request.query.limit as string) : 50
      const offset = request.query.offset ? parseInt(request.query.offset as string) : 0

      // SECURITY: Users can only view their own audit logs unless they're admin
      if (actorId !== currentUser.id && currentUser.role !== 'admin') {
        return this.errorResponse(new Error('Forbidden: Can only view your own audit logs'), 403)
      }

      const auditLogs = await this.core.getActorAuditLogs(actorId, { limit, offset })

      this.logger.info('Actor audit logs retrieved', { 
        actorId, 
        requestedBy: currentUser.id,
        count: auditLogs.length 
      })

      return this.successResponse({
        auditLogs,
        pagination: {
          limit,
          offset,
          count: auditLogs.length
        }
      })
    } catch (error) {
      return this.errorResponse(error)
    }
  }

  // ==========================================================================
  // PASSWORD RESET ROUTES
  // ==========================================================================

  /**
   * Request password reset
   * POST /auth/request-reset
   */
  private async requestPasswordReset(request: HttpRequest): Promise<HttpResponse> {
    // Import password reset handler dynamically
    const { requestPasswordReset: handler } = await import('./auth/password-reset.js')
    return handler(request, this.core)
  }

  /**
   * Reset password with token
   * POST /auth/reset-password
   */
  private async resetPassword(request: HttpRequest): Promise<HttpResponse> {
    // Import password reset handler dynamically
    const { resetPassword: handler } = await import('./auth/password-reset.js')
    return handler(request, this.core)
  }

  /**
   * Verify reset token validity
   * POST /auth/verify-reset-token
   */
  private async verifyResetToken(request: HttpRequest): Promise<HttpResponse> {
    // Import password reset handler dynamically
    const { verifyResetToken: handler } = await import('./auth/password-reset.js')
    return handler(request, this.core)
  }

  /**
   * Change password (authenticated users)
   * POST /auth/change-password
   */
  private async changePassword(request: HttpRequest): Promise<HttpResponse> {
    // SECURITY: Validate authentication and populate request.user
    await this.validateAuthentication(request)

    // Import change password handler dynamically
    const { changePassword: handler } = await import('./auth/change-password.js')
    return handler(request, this.core)
  }

  // ==========================================================================
  // OAuth Routes
  // ==========================================================================

  /**
   * Initialize Google OAuth flow
   * POST /auth/oauth/google/init
   */
  private async initGoogleOAuth(request: HttpRequest): Promise<HttpResponse> {
    // For link mode, validate authentication
    const body = request.body as { mode?: string }
    if (body?.mode === 'link') {
      await this.validateAuthentication(request)
    }

    const { initGoogleOAuth: handler } = await import('./auth/oauth.js')
    return handler(this.core, request)
  }

  /**
   * Handle Google OAuth callback
   * POST /auth/oauth/google/callback
   */
  private async handleGoogleOAuthCallback(request: HttpRequest): Promise<HttpResponse> {
    // For link mode, validate authentication
    const body = request.body as { mode?: string }
    if (body?.mode === 'link') {
      try {
        await this.validateAuthentication(request)
      } catch {
        // Ignore auth errors for link mode - the handler will check
      }
    }

    const { handleGoogleOAuthCallback: handler } = await import('./auth/oauth.js')
    return handler(this.core, request)
  }

  /**
   * Unlink Google account
   * DELETE /auth/oauth/google/unlink
   */
  private async unlinkGoogleAccount(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { unlinkGoogleAccount: handler } = await import('./auth/oauth.js')
    return handler(this.core, request)
  }

  /**
   * Get OAuth status
   * GET /auth/oauth/status
   */
  private async getOAuthStatus(request: HttpRequest): Promise<HttpResponse> {
    const { getOAuthStatus: handler } = await import('./auth/oauth.js')
    return handler(this.core, request)
  }

  // ==========================================================================
  // CAPTCHA Routes
  // ==========================================================================

  /**
   * Get CAPTCHA status and configuration
   * GET /auth/captcha/status
   */
  private async getCaptchaStatus(request: HttpRequest): Promise<HttpResponse> {
    const { getCaptchaStatus: handler } = await import('./auth/captcha.js')
    return handler(request, this.core)
  }

  // ==========================================================================
  // MFA (Multi-Factor Authentication) Routes
  // ==========================================================================

  private async verifyMFA(request: HttpRequest): Promise<HttpResponse> {
    const { verifyMFA: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  private async verifyMFABackup(request: HttpRequest): Promise<HttpResponse> {
    const { verifyMFABackup: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  private async sendMFACode(request: HttpRequest): Promise<HttpResponse> {
    const { sendMFACode: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  private async initTOTPSetup(request: HttpRequest): Promise<HttpResponse> {
    // Allow either auth token or MFA setup token (for login flow)
    if (!request.headers['x-mfa-setup-token']) {
      await this.validateAuthentication(request)
    }
    const { initTOTPSetup: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  private async verifyTOTPSetup(request: HttpRequest): Promise<HttpResponse> {
    // Allow either auth token or MFA setup token (for login flow)
    if (!request.headers['x-mfa-setup-token']) {
      await this.validateAuthentication(request)
    }
    const { verifyTOTPSetup: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  private async initEmailOTPSetup(request: HttpRequest): Promise<HttpResponse> {
    // Allow either auth token or MFA setup token (for login flow)
    if (!request.headers['x-mfa-setup-token']) {
      await this.validateAuthentication(request)
    }
    const { initEmailOTPSetup: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  private async verifyEmailOTPSetup(request: HttpRequest): Promise<HttpResponse> {
    // Allow either auth token or MFA setup token (for login flow)
    if (!request.headers['x-mfa-setup-token']) {
      await this.validateAuthentication(request)
    }
    const { verifyEmailOTPSetup: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  private async disableMFA(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { disableMFA: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  private async disableAllMFA(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { disableAllMFA: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  private async regenerateBackupCodes(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { regenerateBackupCodes: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  private async getMFAStatus(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { getMFAStatus: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  private async getTrustedDevices(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { getTrustedDevices: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  private async revokeTrustedDevice(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { revokeTrustedDevice: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  private async revokeAllTrustedDevices(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { revokeAllTrustedDevices: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  private async adminResetUserMFA(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    // Require admin role for MFA reset
    if (request.user?.role !== 'admin') {
      return this.errorResponse(new InvalidInputError('Admin access required', 'permissions'), 403)
    }
    const { adminResetUserMFA: handler } = await import('./auth/mfa.js')
    return handler(request, this.core)
  }

  // ==========================================================================
  // OAuth2 Authorization Server Routes (Device Flow + Authorization Code Flow)
  // ==========================================================================

  /**
   * Start Device Authorization Flow
   * POST /auth/device
   * No authentication required - called by CLI
   */
  private async startDeviceAuthorization(request: HttpRequest): Promise<HttpResponse> {
    const { startDeviceAuthorization: handler } = await import('./auth/oauth2-server.js')
    return handler(this.core, request)
  }

  /**
   * Get Device Code Info (for verification page)
   * GET /auth/device/verify?code=XXXX-XXXX
   * Authentication required - called by Studio
   */
  private async getDeviceCodeInfo(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { getDeviceCodeInfo: handler } = await import('./auth/oauth2-server.js')
    return handler(this.core, request)
  }

  /**
   * Verify (Authorize/Deny) Device Code
   * POST /auth/device/verify
   * Authentication required - called by Studio
   */
  private async verifyDeviceCode(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { verifyDeviceCode: handler } = await import('./auth/oauth2-server.js')
    return handler(this.core, request)
  }

  /**
   * OAuth2 Token Endpoint
   * POST /auth/token
   * Handles device code exchange, authorization code exchange, and token refresh
   */
  private async handleOAuth2TokenRequest(request: HttpRequest): Promise<HttpResponse> {
    const { handleTokenRequest: handler } = await import('./auth/oauth2-server.js')
    return handler(this.core, request)
  }

  /**
   * Validate Authorization Request (for consent page)
   * GET /auth/authorize
   * Authentication optional - if authenticated, checks for existing consent
   */
  private async validateAuthorizationRequest(request: HttpRequest): Promise<HttpResponse> {
    // Try to authenticate, but don't fail if no token present
    // This allows consent checking for logged-in users
    try {
      await this.validateAuthentication(request)
    } catch {
      // Ignore auth errors - user just won't get auto-approval
    }
    const { validateAuthorizationRequest: handler } = await import('./auth/oauth2-server.js')
    return handler(this.core, request)
  }

  /**
   * Handle Authorization Decision (approve/deny)
   * POST /auth/authorize
   * Authentication required - called when user approves/denies
   */
  private async handleAuthorizationDecision(request: HttpRequest): Promise<HttpResponse> {
    await this.validateAuthentication(request)
    const { handleAuthorizationDecision: handler } = await import('./auth/oauth2-server.js')
    return handler(this.core, request)
  }

}
