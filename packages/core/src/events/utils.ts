/**
 * Event System Utilities
 * 
 * Helper functions for creating and working with events in the Trokky CMS.
 */

import { generateUUID } from '../utils/universal-crypto.js'
import type {
  TrokkyEvent,
  DocumentEvent,
  MediaEvent,
  UserEvent,
  AppTokenEvent,
  SystemEvent,
  EventActor,
  EventMetadata
} from './types.js'
import type { Document, MediaFile, User, AppToken } from '../types/index.js'

// =============================================================================
// EVENT CREATION HELPERS
// =============================================================================

/**
 * Create a document-related event
 */
export function createDocumentEvent(
  type: DocumentEvent['type'],
  data: DocumentEvent['data'],
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<DocumentEvent, 'id' | 'timestamp'> {
  return {
    type,
    source: 'trokky-core',
    actor,
    metadata,
    data
  }
}

/**
 * Create a media-related event
 */
export function createMediaEvent(
  type: MediaEvent['type'],
  data: MediaEvent['data'],
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<MediaEvent, 'id' | 'timestamp'> {
  return {
    type,
    source: 'trokky-core',
    actor,
    metadata,
    data
  }
}

/**
 * Create a user-related event
 */
export function createUserEvent(
  type: UserEvent['type'],
  data: UserEvent['data'],
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<UserEvent, 'id' | 'timestamp'> {
  return {
    type,
    source: 'trokky-core',
    actor,
    metadata,
    data
  }
}

/**
 * Create an app token related event
 */
export function createAppTokenEvent(
  type: AppTokenEvent['type'],
  data: AppTokenEvent['data'],
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<AppTokenEvent, 'id' | 'timestamp'> {
  return {
    type,
    source: 'trokky-core',
    actor,
    metadata,
    data
  }
}

/**
 * Create a system event
 */
export function createSystemEvent(
  type: SystemEvent['type'],
  data: SystemEvent['data'],
  metadata?: EventMetadata
): Omit<SystemEvent, 'id' | 'timestamp'> {
  return {
    type,
    source: 'system',
    actor: {
      type: 'system',
      id: 'trokky-core',
      name: 'Trokky CMS'
    },
    metadata,
    data
  }
}

// =============================================================================
// SPECIFIC EVENT BUILDERS
// =============================================================================

/**
 * Create document created event
 */
export function documentCreated(
  collection: string,
  document: Document,
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<DocumentEvent, 'id' | 'timestamp'> {
  return createDocumentEvent(
    'document.created',
    { collection, id: document.id, document },
    actor,
    metadata
  )
}

/**
 * Create document updated event
 */
export function documentUpdated(
  collection: string,
  document: Document,
  previousDocument?: Document,
  changes?: string[],
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<DocumentEvent, 'id' | 'timestamp'> {
  return createDocumentEvent(
    'document.updated',
    { collection, id: document.id, document, previousDocument, changes },
    actor,
    metadata
  )
}

/**
 * Create document deleted event
 */
export function documentDeleted(
  collection: string,
  id: string,
  previousDocument?: Document,
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<DocumentEvent, 'id' | 'timestamp'> {
  return createDocumentEvent(
    'document.deleted',
    { collection, id, document: undefined, previousDocument },
    actor,
    metadata
  )
}

/**
 * Create document published event
 */
export function documentPublished(
  collection: string,
  document: Document,
  wasPublished: boolean,
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<DocumentEvent, 'id' | 'timestamp'> {
  return createDocumentEvent(
    'document.published',
    {
      collection,
      id: document.id,
      document,
      publishedState: {
        from: wasPublished,
        to: true
      }
    },
    actor,
    metadata
  )
}

/**
 * Create document unpublished event
 */
export function documentUnpublished(
  collection: string,
  document: Document,
  wasPublished: boolean,
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<DocumentEvent, 'id' | 'timestamp'> {
  return createDocumentEvent(
    'document.unpublished',
    {
      collection,
      id: document.id,
      document,
      publishedState: {
        from: wasPublished,
        to: false
      }
    },
    actor,
    metadata
  )
}

/**
 * Create media uploaded event
 */
export function mediaUploaded(
  file: MediaFile,
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<MediaEvent, 'id' | 'timestamp'> {
  return createMediaEvent(
    'media.uploaded',
    { fileId: file.id, file },
    actor,
    metadata
  )
}

/**
 * Create media updated event
 */
export function mediaUpdated(
  file: MediaFile,
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<MediaEvent, 'id' | 'timestamp'> {
  return createMediaEvent(
    'media.updated',
    { fileId: file.id, file },
    actor,
    metadata
  )
}

/**
 * Create media deleted event
 */
export function mediaDeleted(
  fileId: string,
  file?: MediaFile,
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<MediaEvent, 'id' | 'timestamp'> {
  return createMediaEvent(
    'media.deleted',
    { fileId, file },
    actor,
    metadata
  )
}

/**
 * Create media variant generated event
 */
export function mediaVariantGenerated(
  fileId: string,
  variantName: string,
  variant: {
    name: string
    format: string
    size: number
    width?: number
    height?: number
  },
  processingTime?: number,
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<MediaEvent, 'id' | 'timestamp'> {
  return createMediaEvent(
    'media.variant.generated',
    { fileId, variantName, variant, processingTime },
    actor,
    metadata
  )
}

/**
 * Create user created event
 */
export function userCreated(
  user: User,
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<UserEvent, 'id' | 'timestamp'> {
  return createUserEvent(
    'user.created',
    { userId: user.id, user },
    actor,
    metadata
  )
}

/**
 * Create user updated event
 */
export function userUpdated(
  user: User,
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<UserEvent, 'id' | 'timestamp'> {
  return createUserEvent(
    'user.updated',
    { userId: user.id, user },
    actor,
    metadata
  )
}

/**
 * Create user deleted event
 */
export function userDeleted(
  userId: string,
  user?: User,
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<UserEvent, 'id' | 'timestamp'> {
  return createUserEvent(
    'user.deleted',
    { userId, user },
    actor,
    metadata
  )
}

/**
 * Create user login event
 */
export function userLogin(
  user: User,
  sessionId: string,
  loginMethod: 'password' | 'token' | 'oauth',
  success: boolean,
  ipAddress?: string,
  metadata?: EventMetadata
): Omit<UserEvent, 'id' | 'timestamp'> {
  const actor: EventActor = {
    type: 'user',
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email
  }

  return createUserEvent(
    'user.login',
    {
      userId: user.id,
      user,
      sessionId,
      loginMethod,
      loginAttempt: {
        success,
        reason: success ? undefined : 'Invalid credentials',
        ipAddress
      }
    },
    actor,
    metadata
  )
}

/**
 * Create user logout event
 */
export function userLogout(
  user: User,
  sessionId: string,
  metadata?: EventMetadata
): Omit<UserEvent, 'id' | 'timestamp'> {
  const actor: EventActor = {
    type: 'user',
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email
  }

  return createUserEvent(
    'user.logout',
    { userId: user.id, user, sessionId },
    actor,
    metadata
  )
}

/**
 * Create user role changed event
 */
export function userRoleChanged(
  user: User,
  fromRole: string,
  toRole: string,
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<UserEvent, 'id' | 'timestamp'> {
  return createUserEvent(
    'user.role_changed',
    {
      userId: user.id,
      user,
      roleChange: {
        from: fromRole,
        to: toRole
      }
    },
    actor,
    metadata
  )
}

/**
 * Create app token created event
 */
export function appTokenCreated(
  token: AppToken,
  actor?: EventActor,
  metadata?: EventMetadata
): Omit<AppTokenEvent, 'id' | 'timestamp'> {
  return createAppTokenEvent(
    'app_token.created',
    { tokenId: token.id, token },
    actor,
    metadata
  )
}

/**
 * Create app token used event
 */
export function appTokenUsed(
  token: AppToken,
  endpoint: string,
  method: string,
  ipAddress?: string,
  userAgent?: string,
  metadata?: EventMetadata
): Omit<AppTokenEvent, 'id' | 'timestamp'> {
  const actor: EventActor = {
    type: 'app-token',
    id: token.id,
    name: token.name
  }

  return createAppTokenEvent(
    'app_token.used',
    {
      tokenId: token.id,
      token,
      usage: {
        endpoint,
        method,
        ipAddress,
        userAgent
      }
    },
    actor,
    metadata
  )
}

/**
 * Create system startup event
 */
export function systemStartup(
  component?: string,
  metadata?: EventMetadata
): Omit<SystemEvent, 'id' | 'timestamp'> {
  return createSystemEvent(
    'system.startup',
    { component },
    metadata
  )
}

/**
 * Create system shutdown event
 */
export function systemShutdown(
  component?: string,
  metadata?: EventMetadata
): Omit<SystemEvent, 'id' | 'timestamp'> {
  return createSystemEvent(
    'system.shutdown',
    { component },
    metadata
  )
}

/**
 * Create system error event
 */
export function systemError(
  error: Error,
  component?: string,
  metadata?: EventMetadata
): Omit<SystemEvent, 'id' | 'timestamp'> {
  return createSystemEvent(
    'system.error',
    {
      component,
      error: {
        message: error.message,
        stack: error.stack,
        code: 'code' in error ? String(error.code) : undefined
      }
    },
    metadata
  )
}

// =============================================================================
// EVENT ANALYSIS HELPERS
// =============================================================================

/**
 * Check if an event matches a pattern
 */
export function eventMatches(event: TrokkyEvent, pattern: string): boolean {
  if (pattern === '*') return true
  if (pattern.endsWith('*')) {
    return event.type.startsWith(pattern.slice(0, -1))
  }
  return event.type === pattern
}

/**
 * Extract field changes from document update
 */
export function extractDocumentChanges(
  current: Document,
  previous?: Document
): string[] {
  if (!previous) {
    // For new documents, get all content keys (excluding metadata)
    const contentKeys = Object.keys(current).filter(key => !key.startsWith('_') && key !== 'id')
    return contentKeys
  }

  const changes: string[] = []
  
  // Get all content keys from both documents (excluding metadata)
  const currentKeys = Object.keys(current).filter(key => !key.startsWith('_') && key !== 'id')
  const previousKeys = Object.keys(previous).filter(key => !key.startsWith('_') && key !== 'id')
  const allKeys = new Set([...currentKeys, ...previousKeys])

  for (const key of allKeys) {
    const currentValue = (current as any)[key]
    const previousValue = (previous as any)[key]
    
    if (JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
      changes.push(key)
    }
  }

  // Also check status changes
  if (current._status !== previous._status) changes.push('_status')

  return changes
}

/**
 * Create EventActor from User
 */
export function actorFromUser(user: User): EventActor {
  return {
    type: 'user',
    id: user.id,
    name: `${user.firstName} ${user.lastName}`.trim() || user.username,
    email: user.email
  }
}

/**
 * Create EventActor from AppToken
 */
export function actorFromAppToken(token: AppToken): EventActor {
  return {
    type: 'app-token',
    id: token.id,
    name: token.name
  }
}

/**
 * Create system actor
 */
export function systemActor(): EventActor {
  return {
    type: 'system',
    id: 'trokky-core',
    name: 'Trokky CMS'
  }
}