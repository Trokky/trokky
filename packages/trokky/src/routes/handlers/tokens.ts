/**
 * TokenRoutes - API token management route handlers
 */

import { InvalidInputError } from '../../core/index.js'
import type { HttpRequest, HttpResponse, RouteDefinition } from '../types.js'
import { BaseRoutes } from './base.js'

// `resource:action` or `resource:*`, where resource is a collection-style name
const PERMISSION_FORMAT = /^[A-Za-z][A-Za-z0-9_-]*:(\*|[a-z]+)$/

export class TokenRoutes extends BaseRoutes {
  public getRoutes(): RouteDefinition[] {
    const basePath = this.config.basePath || ''
    return this.defineRoutes([
      ['GET', `${basePath}/tokens`, this.listTokens.bind(this)],
      ['POST', `${basePath}/tokens`, this.createToken.bind(this)],
      ['GET', `${basePath}/tokens/:id`, this.getToken.bind(this)],
      ['PUT', `${basePath}/tokens/:id`, this.updateToken.bind(this)],
      ['DELETE', `${basePath}/tokens/:id`, this.deleteToken.bind(this)]
    ])
  }

  // Token Management Routes
  private async listTokens(request: HttpRequest): Promise<HttpResponse> {
    try {
      await this.requirePermission(request, 'tokens:read')

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
      const session = await this.requirePermission(request, 'tokens:write')

      if (!request.body || typeof request.body !== 'object') {
        return this.errorResponse(new InvalidInputError('Token data is required'))
      }

      const tokenData = request.body as Record<string, unknown>

      // Validate required fields
      if (!tokenData.name || !Array.isArray(tokenData.permissions) || tokenData.permissions.length === 0 ||
          !tokenData.permissions.every(p => typeof p === 'string')) {
        return this.errorResponse(new InvalidInputError('Token name and permissions are required'))
      }

      const permissions = tokenData.permissions as string[]
      const malformed = permissions.filter(p => !PERMISSION_FORMAT.test(p))
      if (malformed.length > 0) {
        return this.errorResponse(new InvalidInputError(`Malformed permissions: ${malformed.join(', ')}`, 'permissions_format'))
      }

      let expiresAt: number | undefined
      if (tokenData.expiresAt !== undefined) {
        expiresAt = typeof tokenData.expiresAt === 'string' ? Date.parse(tokenData.expiresAt) : NaN
        if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
          return this.errorResponse(new InvalidInputError('expiresAt must be a future date, as an ISO 8601 string', 'expiresAt'))
        }
      }

      if (session) {
        // A token can never hold more than the person minting it
        const exceeding = permissions.filter(p => !this.sessionHasPermission(session, p))
        if (exceeding.length > 0) {
          return this.errorResponse(new InvalidInputError(`Cannot grant permissions you do not hold: ${exceeding.join(', ')}`, 'permissions'))
        }

        // A token minting tokens must not be able to outlive or out-replicate itself:
        // children cannot manage tokens, and cannot expire after their parent.
        if (session.role === 'api') {
          if (permissions.some(p => p.startsWith('tokens:'))) {
            return this.errorResponse(new InvalidInputError('An API token cannot grant token permissions', 'permissions'))
          }
          if (session.expiresAt) {
            const parentExpiry = Date.parse(session.expiresAt)
            if (expiresAt === undefined || expiresAt > parentExpiry) {
              return this.errorResponse(new InvalidInputError('A token created by an API token must expire no later than it', 'permissions'))
            }
          }
        }
      }

      const createdBy = session?.userId ?? 'system'

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
      await this.requirePermission(request, 'tokens:read')

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
      await this.requirePermission(request, 'tokens:write')

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
      await this.requirePermission(request, 'tokens:delete')

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
}
