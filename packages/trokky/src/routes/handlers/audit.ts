/**
 * AuditRoutes - Audit log route handlers (read only)
 */

import { SecurityValidator } from '../../core/index.js'
import type { HttpRequest, HttpResponse, RouteDefinition } from '../types.js'
import type { UserSession } from '../../types/auth.js'
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
      const session = await this.resolveSession(request)
      const currentUser = session ? { id: session.userId } : null

      const { documentId } = request.params
      const limit = request.query.limit ? parseInt(request.query.limit as string) : 50
      const offset = request.query.offset ? parseInt(request.query.offset as string) : 0

      // Validate inputs
      SecurityValidator.validateDocumentId(documentId)

      const auditLogs = this.readable(session, await this.core.getDocumentAuditLogs(documentId, { limit, offset }))

      this.logger.info('Document audit logs retrieved', {
        documentId,
        userId: currentUser?.id,
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
      const session = await this.resolveSession(request)
      const currentUser = session ? { id: session.userId, role: session.role } : null

      const { actorId } = request.params
      const limit = request.query.limit ? parseInt(request.query.limit as string) : 50
      const offset = request.query.offset ? parseInt(request.query.offset as string) : 0

      // SECURITY: Users can only view their own audit logs unless they're admin
      if (currentUser && actorId !== currentUser.id && currentUser.role !== 'admin') {
        return this.errorResponse(new Error('Forbidden: Can only view your own audit logs'), 403)
      }

      const auditLogs = this.readable(session, await this.core.getActorAuditLogs(actorId, { limit, offset }))

      this.logger.info('Actor audit logs retrieved', {
        actorId,
        requestedBy: currentUser?.id,
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
   * An audit entry records the document's content before and after a change, so it is only
   * as readable as the collection it belongs to. Without this, any signed-in caller — a token
   * scoped to media, a user limited to one collection — read every document through its log.
   */
  private readable<T extends { collection: string }>(session: UserSession | null, logs: T[]): T[] {
    if (!session) return logs
    return logs.filter(log => this.sessionCanAccessSchema(session, log.collection, 'read'))
  }
}
