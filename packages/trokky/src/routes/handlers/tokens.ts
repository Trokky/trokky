/**
 * TokenRoutes - API token management route handlers
 */

import { InvalidInputError } from '../../core/index.js'
import type { HttpRequest, HttpResponse, RouteDefinition } from '../types.js'
import { BaseRoutes } from './base.js'

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
}
