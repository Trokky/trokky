/**
 * BaseRoutes - Abstract base class for route handler groups
 *
 * Holds the shared response, CORS, authentication and authorization helpers
 * used by the domain specific route handlers.
 */

import { TrokkyCore, InvalidInputError, createLogger } from '../../core/index.js'
import type { HttpRequest, HttpResponse, HttpMethod, ApiResponse, RouteDefinition, RouteHandler } from '../types.js'
import type { RouteHandlerConfig } from './types.js'

export abstract class BaseRoutes {
  protected core: TrokkyCore
  protected config: RouteHandlerConfig
  protected logger = createLogger('routes', 'TrokkyRoutes')

  constructor(config: RouteHandlerConfig) {
    // Store reference to config (not a copy) so late-bound properties
    // like studioConfig/structureConfig are visible when set after construction
    this.config = config
    this.core = config.core
  }

  /**
   * Route definitions owned by this handler
   */
  public abstract getRoutes(): RouteDefinition[]

  protected defineRoutes(entries: Array<[HttpMethod, string, RouteHandler]>): RouteDefinition[] {
    return entries.map(([method, path, handler]) => ({
      method,
      path,
      handler,
      description: `${method} ${path}`
    }))
  }

  // Response helpers
  protected successResponse<T>(data: T, status: number = 200): HttpResponse {
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

  protected errorResponse(error: unknown, status?: number): HttpResponse {
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

  protected buildCorsHeaders(): Record<string, string> {
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

  // Authentication middleware
  protected async validateAuthentication(request: HttpRequest): Promise<void> {
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

  protected async validateAdminAccess(request: HttpRequest): Promise<void> {
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

  protected async validateSchemaAccess(request: HttpRequest, schemaName: string, action: 'read' | 'write' | 'delete' | 'publish'): Promise<void> {
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

  // Helper methods for user management
  protected async validateUserReadAccess(request: HttpRequest): Promise<void> {
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

  protected async validateWebhookReadAccess(request: HttpRequest): Promise<void> {
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

  protected logAdminAccess(session: any, path: string, success: boolean): void {
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

  protected async getCurrentUser(request: HttpRequest): Promise<any> {
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

  protected getCustomStructureFunction(): any {
    // In Express integration, custom structure is passed through config
    // This will be available via the core config or a separate structure registry
    return this.config.structureConfig || null
  }

  protected formatSchemaTitle(schemaName: string): string {
    // Convert camelCase/PascalCase to Title Case
    return schemaName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  }
}
