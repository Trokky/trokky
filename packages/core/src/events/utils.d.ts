/**
 * Event System Utilities
 *
 * Helper functions for creating and working with events in the Trokky CMS.
 */
import type { TrokkyEvent, DocumentEvent, MediaEvent, UserEvent, AppTokenEvent, SystemEvent, EventActor, EventMetadata } from './types.js';
import type { Document, MediaFile, User, AppToken } from '../types/index.js';
/**
 * Create a document-related event
 */
export declare function createDocumentEvent(type: DocumentEvent['type'], data: DocumentEvent['data'], actor?: EventActor, metadata?: EventMetadata): Omit<DocumentEvent, 'id' | 'timestamp'>;
/**
 * Create a media-related event
 */
export declare function createMediaEvent(type: MediaEvent['type'], data: MediaEvent['data'], actor?: EventActor, metadata?: EventMetadata): Omit<MediaEvent, 'id' | 'timestamp'>;
/**
 * Create a user-related event
 */
export declare function createUserEvent(type: UserEvent['type'], data: UserEvent['data'], actor?: EventActor, metadata?: EventMetadata): Omit<UserEvent, 'id' | 'timestamp'>;
/**
 * Create an app token related event
 */
export declare function createAppTokenEvent(type: AppTokenEvent['type'], data: AppTokenEvent['data'], actor?: EventActor, metadata?: EventMetadata): Omit<AppTokenEvent, 'id' | 'timestamp'>;
/**
 * Create a system event
 */
export declare function createSystemEvent(type: SystemEvent['type'], data: SystemEvent['data'], metadata?: EventMetadata): Omit<SystemEvent, 'id' | 'timestamp'>;
/**
 * Create document created event
 */
export declare function documentCreated(collection: string, document: Document, actor?: EventActor, metadata?: EventMetadata): Omit<DocumentEvent, 'id' | 'timestamp'>;
/**
 * Create document updated event
 */
export declare function documentUpdated(collection: string, document: Document, previousDocument?: Document, changes?: string[], actor?: EventActor, metadata?: EventMetadata): Omit<DocumentEvent, 'id' | 'timestamp'>;
/**
 * Create document deleted event
 */
export declare function documentDeleted(collection: string, id: string, previousDocument?: Document, actor?: EventActor, metadata?: EventMetadata): Omit<DocumentEvent, 'id' | 'timestamp'>;
/**
 * Create document published event
 */
export declare function documentPublished(collection: string, document: Document, wasPublished: boolean, actor?: EventActor, metadata?: EventMetadata): Omit<DocumentEvent, 'id' | 'timestamp'>;
/**
 * Create document unpublished event
 */
export declare function documentUnpublished(collection: string, document: Document, wasPublished: boolean, actor?: EventActor, metadata?: EventMetadata): Omit<DocumentEvent, 'id' | 'timestamp'>;
/**
 * Create media uploaded event
 */
export declare function mediaUploaded(file: MediaFile, actor?: EventActor, metadata?: EventMetadata): Omit<MediaEvent, 'id' | 'timestamp'>;
/**
 * Create media updated event
 */
export declare function mediaUpdated(file: MediaFile, actor?: EventActor, metadata?: EventMetadata): Omit<MediaEvent, 'id' | 'timestamp'>;
/**
 * Create media deleted event
 */
export declare function mediaDeleted(fileId: string, file?: MediaFile, actor?: EventActor, metadata?: EventMetadata): Omit<MediaEvent, 'id' | 'timestamp'>;
/**
 * Create media variant generated event
 */
export declare function mediaVariantGenerated(fileId: string, variantName: string, variant: {
    name: string;
    format: string;
    size: number;
    width?: number;
    height?: number;
}, processingTime?: number, actor?: EventActor, metadata?: EventMetadata): Omit<MediaEvent, 'id' | 'timestamp'>;
/**
 * Create user created event
 */
export declare function userCreated(user: User, actor?: EventActor, metadata?: EventMetadata): Omit<UserEvent, 'id' | 'timestamp'>;
/**
 * Create user updated event
 */
export declare function userUpdated(user: User, actor?: EventActor, metadata?: EventMetadata): Omit<UserEvent, 'id' | 'timestamp'>;
/**
 * Create user deleted event
 */
export declare function userDeleted(userId: string, user?: User, actor?: EventActor, metadata?: EventMetadata): Omit<UserEvent, 'id' | 'timestamp'>;
/**
 * Create user login event
 */
export declare function userLogin(user: User, sessionId: string, loginMethod: 'password' | 'token' | 'oauth', success: boolean, ipAddress?: string, metadata?: EventMetadata): Omit<UserEvent, 'id' | 'timestamp'>;
/**
 * Create user logout event
 */
export declare function userLogout(user: User, sessionId: string, metadata?: EventMetadata): Omit<UserEvent, 'id' | 'timestamp'>;
/**
 * Create user role changed event
 */
export declare function userRoleChanged(user: User, fromRole: string, toRole: string, actor?: EventActor, metadata?: EventMetadata): Omit<UserEvent, 'id' | 'timestamp'>;
/**
 * Create app token created event
 */
export declare function appTokenCreated(token: AppToken, actor?: EventActor, metadata?: EventMetadata): Omit<AppTokenEvent, 'id' | 'timestamp'>;
/**
 * Create app token used event
 */
export declare function appTokenUsed(token: AppToken, endpoint: string, method: string, ipAddress?: string, userAgent?: string, metadata?: EventMetadata): Omit<AppTokenEvent, 'id' | 'timestamp'>;
/**
 * Create system startup event
 */
export declare function systemStartup(component?: string, metadata?: EventMetadata): Omit<SystemEvent, 'id' | 'timestamp'>;
/**
 * Create system shutdown event
 */
export declare function systemShutdown(component?: string, metadata?: EventMetadata): Omit<SystemEvent, 'id' | 'timestamp'>;
/**
 * Create system error event
 */
export declare function systemError(error: Error, component?: string, metadata?: EventMetadata): Omit<SystemEvent, 'id' | 'timestamp'>;
/**
 * Check if an event matches a pattern
 */
export declare function eventMatches(event: TrokkyEvent, pattern: string): boolean;
/**
 * Extract field changes from document update
 */
export declare function extractDocumentChanges(current: Document, previous?: Document): string[];
/**
 * Create EventActor from User
 */
export declare function actorFromUser(user: User): EventActor;
/**
 * Create EventActor from AppToken
 */
export declare function actorFromAppToken(token: AppToken): EventActor;
/**
 * Create system actor
 */
export declare function systemActor(): EventActor;
//# sourceMappingURL=utils.d.ts.map