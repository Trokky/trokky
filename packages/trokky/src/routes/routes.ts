import type {
  RoutesConfig,
  RouteDefinition,
  RouteHandler,
  HttpRequest,
  HttpResponse,
  ApiResponse,
  StaticRouteConfig,
  ListUsersRequest,
  CreateUserRequest,
  UpdateUserRequest,
  GetUserRequest,
  DeleteUserRequest,
  GetUserByUsernameRequest,
  GetUserByEmailRequest,
  ListWebhooksRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  GetWebhookRequest,
  DeleteWebhookRequest,
  GetWebhookDeliveriesRequest,
  TestWebhookRequest
} from './types.js'
import { TrokkyCore, SecurityValidator, InvalidInputError, createLogger } from '../core/index.js'
import { AuthRoutes, DocumentRoutes, MediaRoutes } from './handlers/index.js'

export class TrokkyRoutes {
  private core: TrokkyCore
  private config: RoutesConfig
  private routes: Map<string, RouteDefinition> = new Map()
  private handlerRoutes: Map<string, RouteDefinition> = new Map()
  private logger = createLogger('routes', 'TrokkyRoutes')

  constructor(config: RoutesConfig) {
    this.core = config.core
    // Store reference to config (not a copy) so late-bound properties
    // like studioConfig/structureConfig are visible when set after construction
    this.config = config
    if (!this.config.basePath) {
      this.config.basePath = ''
    }

    // Route handler groups extracted from this class, sharing the same config reference
    this.collectHandlerRoutes([
      new AuthRoutes(this.config),
      new DocumentRoutes(this.config),
      new MediaRoutes(this.config)
    ])

    this.initializeRoutes()
  }

  private collectHandlerRoutes(handlers: Array<{ getRoutes(): RouteDefinition[] }>): void {
    for (const handler of handlers) {
      for (const route of handler.getRoutes()) {
        this.handlerRoutes.set(`${route.method}:${route.path}`, route)
      }
    }
  }

  /**
   * Register a route owned by one of the extracted handler groups.
   * Keeps registration order identical to inline registration.
   */
  private addHandlerRoute(method: string, path: string): void {
    const route = this.handlerRoutes.get(`${method}:${path}`)
    if (!route) {
      throw new Error(`No handler registered for route ${method} ${path}`)
    }
    this.addRoute(method, path, route.handler)
  }

  private initializeRoutes(): void {
    const basePath = this.config.basePath || ''
    this.logger.debug('Initializing routes', { basePath })

    // Collection routes
    this.addHandlerRoute('GET', `${basePath}/collections`)
    this.addHandlerRoute('GET', `${basePath}/collections/:collection`)
    this.addHandlerRoute('POST', `${basePath}/collections/:collection`)
    this.addHandlerRoute('GET', `${basePath}/collections/:collection/:id`)
    this.addHandlerRoute('PUT', `${basePath}/collections/:collection/:id`)
    this.addHandlerRoute('DELETE', `${basePath}/collections/:collection/:id`)

    // Search routes
    this.addRoute('GET', `${basePath}/search`, this.searchContent.bind(this))

    // Removed duplicate document routes - use /collections endpoints instead

    // Statistics routes
    this.addHandlerRoute('GET', `${basePath}/stats/:collection`)

    // Media routes
    this.addHandlerRoute('GET', `${basePath}/media`)
    this.addHandlerRoute('POST', `${basePath}/media/upload`)
    this.addHandlerRoute('POST', `${basePath}/media/bulk-delete`)
    this.addHandlerRoute('GET', `${basePath}/media/:id`)
    this.addHandlerRoute('PUT', `${basePath}/media/:id`)
    this.addHandlerRoute('GET', `${basePath}/media/:id/file`)
    this.addHandlerRoute('GET', `${basePath}/media/:id/variants/:variant`)
    this.addHandlerRoute('POST', `${basePath}/media/:id/regenerate-variants`)
    this.addHandlerRoute('DELETE', `${basePath}/media/:id`)

    // User management routes (admin only)
    this.addRoute('GET', `${basePath}/users`, this.listUsers.bind(this))
    this.addRoute('POST', `${basePath}/users`, this.createUser.bind(this))
    this.addRoute('GET', `${basePath}/users/:id`, this.getUser.bind(this))
    this.addRoute('PUT', `${basePath}/users/:id`, this.updateUser.bind(this))
    this.addRoute('DELETE', `${basePath}/users/:id`, this.deleteUser.bind(this))
    this.addRoute('GET', `${basePath}/users/by-username/:username`, this.getUserByUsername.bind(this))
    this.addRoute('GET', `${basePath}/users/by-email/:email`, this.getUserByEmail.bind(this))

    // Authentication routes (public)
    this.addHandlerRoute('POST', `${basePath}/auth/login`)
    this.addHandlerRoute('POST', `${basePath}/auth/logout`)
    this.addHandlerRoute('GET', `${basePath}/auth/me`)
    this.addHandlerRoute('POST', `${basePath}/auth/validate`)
    this.addHandlerRoute('POST', `${basePath}/auth/refresh`)

    // Password reset routes (public)
    this.addHandlerRoute('POST', `${basePath}/auth/request-reset`)
    this.addHandlerRoute('POST', `${basePath}/auth/reset-password`)
    this.addHandlerRoute('POST', `${basePath}/auth/verify-reset-token`)

    // Password change route (authenticated users)
    this.addHandlerRoute('POST', `${basePath}/auth/change-password`)

    // OAuth routes
    this.addHandlerRoute('POST', `${basePath}/auth/oauth/google/init`)
    this.addHandlerRoute('POST', `${basePath}/auth/oauth/google/callback`)
    this.addHandlerRoute('DELETE', `${basePath}/auth/oauth/google/unlink`)
    this.addHandlerRoute('GET', `${basePath}/auth/oauth/status`)

    // Passkey/WebAuthn routes
    this.addHandlerRoute('GET', `${basePath}/auth/passkey/status`)
    this.addHandlerRoute('POST', `${basePath}/auth/passkey/register/options`)
    this.addHandlerRoute('POST', `${basePath}/auth/passkey/register/verify`)
    this.addHandlerRoute('POST', `${basePath}/auth/passkey/login/options`)
    this.addHandlerRoute('POST', `${basePath}/auth/passkey/login/verify`)
    this.addHandlerRoute('GET', `${basePath}/auth/passkey/credentials`)
    this.addHandlerRoute('PATCH', `${basePath}/auth/passkey/credentials/:credentialId`)
    this.addHandlerRoute('DELETE', `${basePath}/auth/passkey/credentials/:credentialId`)

    // CAPTCHA routes
    this.addHandlerRoute('GET', `${basePath}/auth/captcha/status`)

    // MFA (Multi-Factor Authentication) routes
    this.addHandlerRoute('POST', `${basePath}/auth/mfa/verify`)
    this.addHandlerRoute('POST', `${basePath}/auth/mfa/verify-backup`)
    this.addHandlerRoute('POST', `${basePath}/auth/mfa/send-code`)
    this.addHandlerRoute('POST', `${basePath}/auth/mfa/setup/totp`)
    this.addHandlerRoute('POST', `${basePath}/auth/mfa/setup/totp/verify`)
    this.addHandlerRoute('POST', `${basePath}/auth/mfa/setup/email`)
    this.addHandlerRoute('POST', `${basePath}/auth/mfa/setup/email/verify`)
    this.addHandlerRoute('POST', `${basePath}/auth/mfa/disable`)
    this.addHandlerRoute('POST', `${basePath}/auth/mfa/disable-all`)
    this.addHandlerRoute('POST', `${basePath}/auth/mfa/backup-codes/regenerate`)
    this.addHandlerRoute('GET', `${basePath}/auth/mfa/status`)
    this.addHandlerRoute('GET', `${basePath}/auth/mfa/trusted-devices`)
    this.addHandlerRoute('DELETE', `${basePath}/auth/mfa/trusted-devices/:deviceId`)
    this.addHandlerRoute('DELETE', `${basePath}/auth/mfa/trusted-devices`)
    this.addHandlerRoute('POST', `${basePath}/admin/users/:userId/mfa/reset`)

    // OAuth2 Authorization Server routes (Device Flow + Authorization Code Flow)
    this.addHandlerRoute('POST', `${basePath}/auth/device`)
    this.addHandlerRoute('GET', `${basePath}/auth/device/verify`)
    this.addHandlerRoute('POST', `${basePath}/auth/device/verify`)
    this.addHandlerRoute('POST', `${basePath}/auth/token`)
    this.addHandlerRoute('GET', `${basePath}/auth/authorize`)
    this.addHandlerRoute('POST', `${basePath}/auth/authorize`)

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
    this.addHandlerRoute('GET', `${basePath}/slugs/check-unique`)

    // Health check route
    this.addRoute('GET', `${basePath}/health`, this.healthCheck.bind(this))

    // OpenAPI spec (public)
    this.addRoute('GET', `${basePath}/openapi.json`, this.getOpenApiSpec.bind(this))

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
        const { items: mediaFiles } = await this.core.listMedia({ limit: limit * 2 })
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

  private async getOpenApiSpec(_request: HttpRequest): Promise<HttpResponse> {
    const basePath = this.config.basePath || ''
    const routes = this.getApiRoutes()

    const paths: Record<string, Record<string, unknown>> = {}

    for (const route of routes) {
      if (route.method === 'OPTIONS') continue
      if (route.path.endsWith('/openapi.json')) continue

      // Convert Express :param to OpenAPI {param}
      const openApiPath = route.path.replace(/:(\w+)/g, '{$1}')
      const method = route.method.toLowerCase()

      // Extract path parameters
      const paramMatches = route.path.matchAll(/:(\w+)/g)
      const parameters: unknown[] = []
      for (const match of paramMatches) {
        parameters.push({
          name: match[1],
          in: 'path',
          required: true,
          schema: { type: 'string' }
        })
      }

      // Determine tag from path
      let tag = 'Other'
      const pathWithoutBase = route.path.replace(basePath, '')
      if (pathWithoutBase.startsWith('/collections')) tag = 'Collections'
      else if (pathWithoutBase.startsWith('/search')) tag = 'Search'
      else if (pathWithoutBase.startsWith('/stats')) tag = 'Statistics'
      else if (pathWithoutBase.startsWith('/media')) tag = 'Media'
      else if (pathWithoutBase.startsWith('/users')) tag = 'Users'
      else if (pathWithoutBase.startsWith('/auth/mfa') || pathWithoutBase.startsWith('/admin/users')) tag = 'MFA'
      else if (pathWithoutBase.startsWith('/auth/passkey')) tag = 'Passkeys'
      else if (pathWithoutBase.startsWith('/auth/oauth')) tag = 'OAuth'
      else if (pathWithoutBase.startsWith('/auth/device') || pathWithoutBase.startsWith('/auth/token') || pathWithoutBase.startsWith('/auth/authorize')) tag = 'OAuth2 Server'
      else if (pathWithoutBase.startsWith('/auth/captcha')) tag = 'CAPTCHA'
      else if (pathWithoutBase.startsWith('/auth')) tag = 'Authentication'
      else if (pathWithoutBase.startsWith('/tokens')) tag = 'API Tokens'
      else if (pathWithoutBase.startsWith('/audit-logs')) tag = 'Audit Logs'
      else if (pathWithoutBase.startsWith('/webhooks')) tag = 'Webhooks'
      else if (pathWithoutBase.startsWith('/schemas') || pathWithoutBase.startsWith('/config')) tag = 'Configuration'
      else if (pathWithoutBase.startsWith('/slugs')) tag = 'Utility'
      else if (pathWithoutBase.startsWith('/health')) tag = 'Utility'

      // Determine if public
      const publicPaths = ['/health', '/auth/login', '/auth/logout', '/auth/validate', '/auth/refresh',
        '/auth/request-reset', '/auth/reset-password', '/auth/verify-reset-token',
        '/auth/captcha/status', '/auth/device', '/auth/token', '/openapi.json']
      const isPublic = publicPaths.some(p => pathWithoutBase === p || pathWithoutBase.startsWith('/auth/oauth') || pathWithoutBase.startsWith('/auth/passkey/login'))

      const operation: Record<string, unknown> = {
        tags: [tag],
        operationId: route.description?.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || `${method}_${openApiPath}`,
        summary: `${route.method} ${pathWithoutBase}`
      }

      if (parameters.length > 0) {
        operation.parameters = parameters
      }

      // Add query parameters for known endpoints
      if (method === 'get' && pathWithoutBase === '/collections/:collection') {
        (operation.parameters as unknown[]).push(
          { name: 'limit', in: 'query', schema: { type: 'integer' }, description: 'Max results to return' },
          { name: 'offset', in: 'query', schema: { type: 'integer' }, description: 'Results to skip' },
          { name: 'sort', in: 'query', schema: { type: 'string' }, description: 'Sort field (prefix with - for descending)' },
          { name: 'filter', in: 'query', schema: { type: 'string' }, description: 'JSON filter object' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Full-text search query' }
        )
      } else if (method === 'get' && pathWithoutBase === '/slugs/check-unique') {
        operation.parameters = [
          { name: 'slug', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'collection', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'excludeId', in: 'query', schema: { type: 'string' } }
        ]
      }

      // Add request body for POST/PUT/PATCH
      if (['post', 'put', 'patch'].includes(method) && !pathWithoutBase.includes('/upload')) {
        operation.requestBody = {
          content: { 'application/json': { schema: { type: 'object' } } }
        }
      } else if (pathWithoutBase.includes('/upload')) {
        operation.requestBody = {
          content: { 'multipart/form-data': { schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } } } } } }
        }
      }

      // Responses
      operation.responses = {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: { '$ref': '#/components/schemas/ApiResponse' } } }
        },
        ...(isPublic ? {} : { '401': { description: 'Unauthorized' } }),
        '400': { description: 'Bad request' },
        '500': { description: 'Internal server error' }
      }

      if (!isPublic) {
        operation.security = [{ bearerAuth: [] }]
      }

      if (!paths[openApiPath]) {
        paths[openApiPath] = {}
      }
      paths[openApiPath][method] = operation
    }

    const spec = {
      openapi: '3.0.3',
      info: {
        title: 'Trokky CMS API',
        version: '2.0.0',
        description: 'REST API for Trokky content management system'
      },
      servers: [{ url: basePath || '/api', description: 'API base path' }],
      paths,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token or API token'
          }
        },
        schemas: {
          ApiResponse: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', description: 'Response payload' },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                  details: { type: 'object' }
                }
              },
              meta: {
                type: 'object',
                properties: {
                  total: { type: 'integer' },
                  page: { type: 'integer' },
                  limit: { type: 'integer' },
                  hasNext: { type: 'boolean' },
                  hasPrev: { type: 'boolean' }
                }
              }
            }
          }
        }
      }
    }

    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: spec
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

  private async validateSchemaAccess(request: HttpRequest, schemaName: string, action: 'read' | 'write' | 'delete' | 'publish'): Promise<void> {
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
      const studioConfig = this.config.studioConfig || {
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
    return this.config.structureConfig || null
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
}
