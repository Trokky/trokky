/**
 * Trokky Event System Types
 * 
 * Defines the core event types, interfaces, and structures for the Trokky CMS
 * event system. This enables webhooks, caching invalidation, audit logs, and
 * real-time updates.
 */

import type { Document, MediaFile, User, AppToken } from '../types/index.js'

// =============================================================================
// CORE EVENT TYPES
// =============================================================================

/**
 * Base interface for all Trokky events
 */
export interface TrokkyEvent {
  /** Unique event identifier */
  id: string
  /** Event type (e.g., 'document.created', 'user.login') */
  type: string
  /** Event timestamp */
  timestamp: Date
  /** Source system that generated the event */
  source: 'trokky-core' | 'api' | 'studio' | 'migration' | 'webhook' | 'system'
  /** Actor who triggered the event (if applicable) */
  actor?: EventActor
  /** Event-specific data payload */
  data: Record<string, unknown>
  /** Additional metadata */
  metadata?: EventMetadata
}

/**
 * Actor who triggered an event
 */
export interface EventActor {
  /** Actor type */
  type: 'user' | 'system' | 'app-token' | 'anonymous'
  /** Actor ID */
  id: string
  /** Actor display name */
  name?: string
  /** Actor email (for users) */
  email?: string
}

/**
 * Event metadata for additional context
 */
export interface EventMetadata {
  /** User agent string */
  userAgent?: string
  /** IP address */
  ipAddress?: string
  /** Request trace ID for debugging */
  traceId?: string
  /** Session ID */
  sessionId?: string
  /** Additional custom metadata */
  [key: string]: unknown
}

// =============================================================================
// SPECIFIC EVENT TYPES
// =============================================================================

/**
 * Document-related events
 */
export interface DocumentEvent extends TrokkyEvent {
  type: 'document.created' | 'document.updated' | 'document.deleted' | 'document.published' | 'document.unpublished'
  data: {
    /** Collection name */
    collection: string
    /** Document ID */
    id: string
    /** Current document state */
    document?: Document
    /** Previous document state (for updates) */
    previousDocument?: Document
    /** List of changed field names (for updates) */
    changes?: string[]
    /** Publication status change (for publish/unpublish events) */
    publishedState?: {
      from: boolean
      to: boolean
    }
  }
}

/**
 * Media-related events
 */
export interface MediaEvent extends TrokkyEvent {
  type: 'media.uploaded' | 'media.updated' | 'media.deleted' | 'media.variant.generated' | 'media.variant.deleted'
  data: {
    /** Media file ID */
    fileId: string
    /** Media file record */
    file?: MediaFile
    /** Variant name (for variant events) */
    variantName?: string
    /** Processing time for variant generation */
    processingTime?: number
    /** Variant details */
    variant?: {
      name: string
      format: string
      size: number
      width?: number
      height?: number
    }
  }
}

/**
 * User-related events
 */
export interface UserEvent extends TrokkyEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted' | 'user.login' | 'user.logout' | 'user.password_changed' | 'user.password_reset_requested' | 'user.role_changed' | 'user.invited'
  data: {
    /** User ID */
    userId: string
    /** User record */
    user?: User
    /** Session ID (for login/logout) */
    sessionId?: string
    /** Login method */
    loginMethod?: 'password' | 'token' | 'oauth'
    /** Role change details */
    roleChange?: {
      from: string
      to: string
    }
    /** Login attempt details */
    loginAttempt?: {
      success: boolean
      reason?: string
      ipAddress?: string
    }
    /** Password reset token (for password_reset_requested) */
    resetToken?: string
    /** Invite token (for user.invited) */
    inviteToken?: string
    /** Inviter name (for user.invited) */
    inviterName?: string
    /** Email (for user.invited) */
    email?: string
  }
}

/**
 * App token related events
 */
export interface AppTokenEvent extends TrokkyEvent {
  type: 'app_token.created' | 'app_token.updated' | 'app_token.deleted' | 'app_token.used'
  data: {
    /** Token ID */
    tokenId: string
    /** App token record */
    token?: AppToken
    /** Usage details (for token.used events) */
    usage?: {
      endpoint: string
      method: string
      ipAddress?: string
      userAgent?: string
    }
  }
}

/**
 * System-related events
 */
export interface SystemEvent extends TrokkyEvent {
  type: 'system.startup' | 'system.shutdown' | 'system.error' | 'system.migration' | 'system.backup' | 'system.health_check'
  data: {
    /** System component */
    component?: string
    /** Error details (for error events) */
    error?: {
      message: string
      stack?: string
      code?: string
    }
    /** Migration details */
    migration?: {
      version: string
      direction: 'up' | 'down'
      duration?: number
    }
    /** Health check results */
    healthCheck?: {
      status: 'healthy' | 'degraded' | 'unhealthy'
      checks: Record<string, boolean>
    }
    /** Backup details */
    backup?: {
      type: 'full' | 'incremental'
      destination: string
      size?: number
    }
  }
}

/**
 * Cache-related events
 */
export interface CacheEvent extends TrokkyEvent {
  type: 'cache.hit' | 'cache.miss' | 'cache.invalidated' | 'cache.cleared'
  data: {
    /** Cache key */
    key: string
    /** Cache keys (for bulk operations) */
    keys?: string[]
    /** Cache statistics */
    stats?: {
      hitRate: number
      missRate: number
      size: number
    }
  }
}

/**
 * Webhook-related events
 */
export interface WebhookEvent extends TrokkyEvent {
  type: 'webhook.delivered' | 'webhook.failed' | 'webhook.retry'
  data: {
    /** Webhook ID */
    webhookId: string
    /** Webhook URL */
    url: string
    /** Original event that triggered the webhook */
    originalEvent: TrokkyEvent
    /** Delivery attempt number */
    attempt: number
    /** HTTP response status */
    statusCode?: number
    /** Response time in milliseconds */
    responseTime?: number
    /** Error message (for failures) */
    error?: string
  }
}

// =============================================================================
// EVENT UNIONS
// =============================================================================

/**
 * Union of all specific event types
 */
export type AnyTrokkyEvent = 
  | DocumentEvent
  | MediaEvent
  | UserEvent
  | AppTokenEvent
  | SystemEvent
  | CacheEvent
  | WebhookEvent

// =============================================================================
// EVENT FILTERING AND QUERYING
// =============================================================================

/**
 * Filter options for querying events
 */
export interface EventFilter {
  /** Filter by event type (supports wildcards) */
  type?: string | string[]
  /** Filter by actor ID */
  actor?: string
  /** Filter by source system */
  source?: string | string[]
  /** Filter by date range */
  since?: Date
  /** Filter by date range */
  until?: Date
  /** Filter by event data (simple key-value matching) */
  data?: Record<string, unknown>
  /** Maximum number of events to return */
  limit?: number
  /** Number of events to skip */
  offset?: number
  /** Sort order */
  sortOrder?: 'asc' | 'desc'
}

/**
 * Event query result
 */
export interface EventQueryResult {
  /** Matching events */
  events: TrokkyEvent[]
  /** Total count (before pagination) */
  totalCount: number
  /** Whether there are more events available */
  hasMore: boolean
  /** Pagination cursor for next page */
  nextCursor?: string
}

// =============================================================================
// EVENT LISTENERS AND HANDLERS
// =============================================================================

/**
 * Event listener function type
 */
export type EventListener<T extends TrokkyEvent = TrokkyEvent> = (event: T) => void | Promise<void>

/**
 * Event listener configuration
 */
export interface EventListenerConfig {
  /** Unique listener ID */
  id: string
  /** Event pattern to listen for (supports wildcards) */
  pattern: string | string[]
  /** Listener function */
  handler: EventListener
  /** Whether the listener should be called asynchronously */
  async?: boolean
  /** Maximum number of times this listener should fire */
  maxInvocations?: number
  /** Current invocation count */
  invocations?: number
}

// =============================================================================
// WEBHOOK TYPES
// =============================================================================

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  /** Unique webhook ID */
  id: string
  /** Webhook name/description */
  name: string
  /** Target URL */
  url: string
  /** Event patterns to listen for */
  events: string[]
  /** Secret for signature verification */
  secret: string
  /** Whether webhook is active */
  active: boolean
  /** Additional HTTP headers */
  headers?: Record<string, string>
  /** Retry policy */
  retryPolicy?: WebhookRetryPolicy
  /** Created timestamp */
  createdAt: Date
  /** Last updated timestamp */
  updatedAt: Date
  /** Created by user ID */
  createdBy: string
}

/**
 * Webhook retry policy
 */
export interface WebhookRetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Backoff strategy */
  backoffType: 'linear' | 'exponential'
  /** Base delay between retries (in milliseconds) */
  baseDelay: number
  /** Maximum delay between retries (in milliseconds) */
  maxDelay?: number
  /** HTTP status codes that should trigger retries */
  retryOnStatus?: number[]
}

/**
 * Webhook delivery payload
 */
export interface WebhookPayload {
  /** Webhook metadata */
  webhook: {
    id: string
    name: string
  }
  /** The event that triggered this webhook */
  event: TrokkyEvent
  /** Delivery metadata */
  delivery: {
    id: string
    timestamp: Date
    attempt: number
  }
}

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  /** Delivery ID */
  deliveryId: string
  /** Whether delivery was successful */
  success: boolean
  /** HTTP status code */
  statusCode?: number
  /** Response time in milliseconds */
  responseTime: number
  /** Error message (if failed) */
  error?: string
  /** Timestamp of delivery attempt */
  timestamp: Date
  /** Attempt number */
  attempt: number
}

// =============================================================================
// WEBHOOK STORAGE (used by EventBus to persist webhooks without depending on DataStorageAdapter)
// =============================================================================

/**
 * Minimal interface for webhook persistence.
 * EventBus depends on this instead of DataStorageAdapter, breaking the
 * circular dependency between core/events and core/types/storage-adapters.
 */
export interface WebhookStorage {
  saveWebhook(id: string, webhookData: Partial<WebhookConfig>): Promise<WebhookConfig>
  listWebhooks(options?: { active?: boolean; limit?: number; offset?: number }): Promise<WebhookConfig[]>
  deleteWebhook(id: string): Promise<void>
}

// =============================================================================
// EVENT STORAGE
// =============================================================================

/**
 * Interface for storing and retrieving events
 */
export interface EventStorage {
  /**
   * Store an event
   */
  store(event: TrokkyEvent): Promise<void>

  /**
   * Query events with filtering
   */
  query(filter?: EventFilter): Promise<EventQueryResult>

  /**
   * Get a specific event by ID
   */
  getEvent(id: string): Promise<TrokkyEvent | null>

  /**
   * Delete events older than the specified date
   */
  cleanup(olderThan: Date): Promise<number>

  /**
   * Get event statistics
   */
  getStats(): Promise<EventStats>

  /**
   * Release whatever the storage is holding open — connections, and above all timers.
   *
   * Optional because a storage that only appends to an array has nothing to release, and
   * third-party implementations written against this interface before the method existed
   * must keep compiling. Note this is not `cleanup()` above — that one deletes old events
   * and the process stays alive afterwards; this one is what lets it exit. Make it safe to
   * call twice.
   */
  close?(): Promise<void>
}

/**
 * Event system statistics
 */
export interface EventStats {
  /** Total number of events */
  totalEvents: number
  /** Events by type */
  eventsByType: Record<string, number>
  /** Events by source */
  eventsBySource: Record<string, number>
  /** Events in the last 24 hours */
  recentEvents: number
  /** Average events per day */
  avgEventsPerDay: number
}