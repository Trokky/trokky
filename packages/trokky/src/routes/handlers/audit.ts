/**
 * AuditRoutes - Audit log route handlers (read only)
 */

import { SecurityValidator } from '../../core/index.js'
import type { HttpRequest, HttpResponse, RouteDefinition } from '../types.js'
import { BaseRoutes } from './base.js'

export class AuditRoutes extends BaseRoutes {
  public getRoutes(): RouteDefinition[] {
    const basePath = this.config.basePath || ''
    return this.defineRoutes([
      ['GET', `${basePath}/audit-logs/documents/:documentId`, this.getDocumentAuditLogs.bind(this)],
      ['GET', `${basePath}/audit-logs/collections/:collection`, this.getCollectionAuditLogs.bind(this)],
      ['GET', `${basePath}/audit-logs/actors/:actorId`, this.getActorAuditLogs.bind(this)]
    ])
  }

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
