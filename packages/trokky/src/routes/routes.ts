import type {
  RoutesConfig,
  RouteDefinition,
  RouteHandler,
  HttpRequest,
  HttpResponse,
  StaticRouteConfig
} from './types.js'
import { SecurityValidator } from '../core/index.js'
import {
  BaseRoutes,
  AuthRoutes,
  DocumentRoutes,
  MediaRoutes,
  UserRoutes,
  TokenRoutes,
  WebhookRoutes,
  AuditRoutes,
  SearchRoutes,
  ConfigRoutes
} from './handlers/index.js'

export class TrokkyRoutes extends BaseRoutes {
  private routes: Map<string, RouteDefinition> = new Map()
  private handlerRoutes: Map<string, RouteDefinition> = new Map()

  constructor(config: RoutesConfig) {
    super(config)
    if (!this.config.basePath) {
      this.config.basePath = ''
    }

    // Route handler groups extracted from this class, sharing the same config reference
    this.collectHandlerRoutes([
      new AuthRoutes(this.config),
      new DocumentRoutes(this.config),
      new MediaRoutes(this.config),
      new UserRoutes(this.config),
      new TokenRoutes(this.config),
      new WebhookRoutes(this.config),
      new AuditRoutes(this.config),
      new SearchRoutes(this.config),
      new ConfigRoutes(this.config)
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
    this.addHandlerRoute('GET', `${basePath}/search`)

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
    this.addHandlerRoute('GET', `${basePath}/users`)
    this.addHandlerRoute('POST', `${basePath}/users`)
    this.addHandlerRoute('GET', `${basePath}/users/:id`)
    this.addHandlerRoute('PUT', `${basePath}/users/:id`)
    this.addHandlerRoute('DELETE', `${basePath}/users/:id`)
    this.addHandlerRoute('GET', `${basePath}/users/by-username/:username`)
    this.addHandlerRoute('GET', `${basePath}/users/by-email/:email`)

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
    this.addHandlerRoute('GET', `${basePath}/tokens`)
    this.addHandlerRoute('POST', `${basePath}/tokens`)
    this.addHandlerRoute('GET', `${basePath}/tokens/:id`)
    this.addHandlerRoute('PUT', `${basePath}/tokens/:id`)
    this.addHandlerRoute('DELETE', `${basePath}/tokens/:id`)

    // Audit log routes (admin/user - read only)
    this.addHandlerRoute('GET', `${basePath}/audit-logs/documents/:documentId`)
    this.addHandlerRoute('GET', `${basePath}/audit-logs/collections/:collection`)
    this.addHandlerRoute('GET', `${basePath}/audit-logs/actors/:actorId`)

    // Webhook management routes (admin only)
    this.addHandlerRoute('GET', `${basePath}/webhooks`)
    this.addHandlerRoute('POST', `${basePath}/webhooks`)
    this.addHandlerRoute('GET', `${basePath}/webhooks/:id`)
    this.addHandlerRoute('PUT', `${basePath}/webhooks/:id`)
    this.addHandlerRoute('DELETE', `${basePath}/webhooks/:id`)
    this.addHandlerRoute('GET', `${basePath}/webhooks/:id/deliveries`)
    this.addHandlerRoute('POST', `${basePath}/webhooks/:id/test`)

    // Schema routes
    this.addHandlerRoute('GET', `${basePath}/schemas/:schemaName`)

    // Configuration routes
    this.addHandlerRoute('GET', `${basePath}/config/structure`)
    this.addHandlerRoute('GET', `${basePath}/config/studio`)
    this.addHandlerRoute('GET', `${basePath}/config/settings`)
    this.addHandlerRoute('PUT', `${basePath}/config/settings`)

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

  private async getOpenApiSpec(request: HttpRequest): Promise<HttpResponse> {
    const basePath = this.config.basePath || ''
    // Derive the advertised API prefix from the request itself so the spec is
    // correct whatever path the router was actually mounted on.
    // Parse against a dummy origin so an absolute request target
    // (GET http://attacker.example/api/openapi.json) yields only its pathname.
    let requestPath: string
    try {
      requestPath = new URL(request.url, 'http://localhost').pathname
    } catch {
      requestPath = '/'
    }
    const serverUrl = requestPath.replace(/\/openapi\.json\/?$/i, '') || '/'
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
      servers: [{ url: serverUrl, description: 'API base path' }],
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
}
