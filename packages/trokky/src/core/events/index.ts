/**
 * Trokky Event System
 * 
 * Comprehensive event system for Trokky CMS that enables:
 * - Event emission and listening
 * - Webhook dispatching
 * - Event storage and querying
 * - Audit logging
 * - Real-time updates
 */

// Core event system
export { TrokkyEventBus } from './event-bus.js'
export { MemoryEventStorage } from './memory-storage.js'

// Types and interfaces
export type {
  // Core types
  TrokkyEvent,
  EventActor,
  EventMetadata,
  AnyTrokkyEvent,
  
  // Specific event types
  DocumentEvent,
  MediaEvent,
  UserEvent,
  AppTokenEvent,
  SystemEvent,
  CacheEvent,
  WebhookEvent,
  
  // Event handling
  EventListener,
  EventListenerConfig,
  EventFilter,
  EventQueryResult,
  EventStorage,
  EventStats,
  
  // Webhook types
  WebhookConfig,
  WebhookPayload,
  WebhookDeliveryResult,
  WebhookRetryPolicy,
  WebhookStorage
} from './types.js'

// Event creation utilities
export {
  // Generic event creators
  createDocumentEvent,
  createMediaEvent,
  createUserEvent,
  createAppTokenEvent,
  createSystemEvent,
  
  // Specific event builders
  documentCreated,
  documentUpdated,
  documentDeleted,
  documentPublished,
  documentUnpublished,
  
  mediaUploaded,
  mediaUpdated,
  mediaDeleted,
  mediaVariantGenerated,
  
  userCreated,
  userUpdated,
  userDeleted,
  userLogin,
  userLogout,
  userRoleChanged,
  
  appTokenCreated,
  appTokenUsed,
  
  systemStartup,
  systemShutdown,
  systemError,
  
  // Utility functions
  eventMatches,
  extractDocumentChanges,
  actorFromUser,
  actorFromAppToken,
  systemActor
} from './utils.js'

// Configuration types
export type { EventBusConfig } from './event-bus.js'
export type { MemoryEventStorageConfig } from './memory-storage.js'