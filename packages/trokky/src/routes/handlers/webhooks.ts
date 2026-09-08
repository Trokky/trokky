/**
 * WebhookRoutes - Webhook management route handlers
 */

import { SecurityValidator, InvalidInputError } from '../../core/index.js'
import type {
  HttpRequest,
  HttpResponse,
  RouteDefinition,
  CreateWebhookRequest,
  UpdateWebhookRequest
} from '../types.js'
import { BaseRoutes } from './base.js'

export class WebhookRoutes extends BaseRoutes {
  public getRoutes(): RouteDefinition[] {
    const basePath = this.config.basePath || ''
    return this.defineRoutes([
      ['GET', `${basePath}/webhooks`, this.listWebhooks.bind(this)],
      ['POST', `${basePath}/webhooks`, this.createWebhook.bind(this)],
      ['GET', `${basePath}/webhooks/:id`, this.getWebhook.bind(this)],
      ['PUT', `${basePath}/webhooks/:id`, this.updateWebhook.bind(this)],
      ['DELETE', `${basePath}/webhooks/:id`, this.deleteWebhook.bind(this)],
      ['GET', `${basePath}/webhooks/:id/deliveries`, this.getWebhookDeliveries.bind(this)],
      ['POST', `${basePath}/webhooks/:id/test`, this.testWebhook.bind(this)]
    ])
  }

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
}
