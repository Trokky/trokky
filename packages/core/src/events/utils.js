/**
 * Event System Utilities
 *
 * Helper functions for creating and working with events in the Trokky CMS.
 */
// =============================================================================
// EVENT CREATION HELPERS
// =============================================================================
/**
 * Create a document-related event
 */
export function createDocumentEvent(type, data, actor, metadata) {
    return {
        type,
        source: 'trokky-core',
        actor,
        metadata,
        data
    };
}
/**
 * Create a media-related event
 */
export function createMediaEvent(type, data, actor, metadata) {
    return {
        type,
        source: 'trokky-core',
        actor,
        metadata,
        data
    };
}
/**
 * Create a user-related event
 */
export function createUserEvent(type, data, actor, metadata) {
    return {
        type,
        source: 'trokky-core',
        actor,
        metadata,
        data
    };
}
/**
 * Create an app token related event
 */
export function createAppTokenEvent(type, data, actor, metadata) {
    return {
        type,
        source: 'trokky-core',
        actor,
        metadata,
        data
    };
}
/**
 * Create a system event
 */
export function createSystemEvent(type, data, metadata) {
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
    };
}
// =============================================================================
// SPECIFIC EVENT BUILDERS
// =============================================================================
/**
 * Create document created event
 */
export function documentCreated(collection, document, actor, metadata) {
    return createDocumentEvent('document.created', { collection, id: document.id, document }, actor, metadata);
}
/**
 * Create document updated event
 */
export function documentUpdated(collection, document, previousDocument, changes, actor, metadata) {
    return createDocumentEvent('document.updated', { collection, id: document.id, document, previousDocument, changes }, actor, metadata);
}
/**
 * Create document deleted event
 */
export function documentDeleted(collection, id, previousDocument, actor, metadata) {
    return createDocumentEvent('document.deleted', { collection, id, document: undefined, previousDocument }, actor, metadata);
}
/**
 * Create document published event
 */
export function documentPublished(collection, document, wasPublished, actor, metadata) {
    return createDocumentEvent('document.published', {
        collection,
        id: document.id,
        document,
        publishedState: {
            from: wasPublished,
            to: true
        }
    }, actor, metadata);
}
/**
 * Create document unpublished event
 */
export function documentUnpublished(collection, document, wasPublished, actor, metadata) {
    return createDocumentEvent('document.unpublished', {
        collection,
        id: document.id,
        document,
        publishedState: {
            from: wasPublished,
            to: false
        }
    }, actor, metadata);
}
/**
 * Create media uploaded event
 */
export function mediaUploaded(file, actor, metadata) {
    return createMediaEvent('media.uploaded', { fileId: file.id, file }, actor, metadata);
}
/**
 * Create media updated event
 */
export function mediaUpdated(file, actor, metadata) {
    return createMediaEvent('media.updated', { fileId: file.id, file }, actor, metadata);
}
/**
 * Create media deleted event
 */
export function mediaDeleted(fileId, file, actor, metadata) {
    return createMediaEvent('media.deleted', { fileId, file }, actor, metadata);
}
/**
 * Create media variant generated event
 */
export function mediaVariantGenerated(fileId, variantName, variant, processingTime, actor, metadata) {
    return createMediaEvent('media.variant.generated', { fileId, variantName, variant, processingTime }, actor, metadata);
}
/**
 * Create user created event
 */
export function userCreated(user, actor, metadata) {
    return createUserEvent('user.created', { userId: user.id, user }, actor, metadata);
}
/**
 * Create user updated event
 */
export function userUpdated(user, actor, metadata) {
    return createUserEvent('user.updated', { userId: user.id, user }, actor, metadata);
}
/**
 * Create user deleted event
 */
export function userDeleted(userId, user, actor, metadata) {
    return createUserEvent('user.deleted', { userId, user }, actor, metadata);
}
/**
 * Create user login event
 */
export function userLogin(user, sessionId, loginMethod, success, ipAddress, metadata) {
    const actor = {
        type: 'user',
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email
    };
    return createUserEvent('user.login', {
        userId: user.id,
        user,
        sessionId,
        loginMethod,
        loginAttempt: {
            success,
            reason: success ? undefined : 'Invalid credentials',
            ipAddress
        }
    }, actor, metadata);
}
/**
 * Create user logout event
 */
export function userLogout(user, sessionId, metadata) {
    const actor = {
        type: 'user',
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        email: user.email
    };
    return createUserEvent('user.logout', { userId: user.id, user, sessionId }, actor, metadata);
}
/**
 * Create user role changed event
 */
export function userRoleChanged(user, fromRole, toRole, actor, metadata) {
    return createUserEvent('user.role_changed', {
        userId: user.id,
        user,
        roleChange: {
            from: fromRole,
            to: toRole
        }
    }, actor, metadata);
}
/**
 * Create app token created event
 */
export function appTokenCreated(token, actor, metadata) {
    return createAppTokenEvent('app_token.created', { tokenId: token.id, token }, actor, metadata);
}
/**
 * Create app token used event
 */
export function appTokenUsed(token, endpoint, method, ipAddress, userAgent, metadata) {
    const actor = {
        type: 'app-token',
        id: token.id,
        name: token.name
    };
    return createAppTokenEvent('app_token.used', {
        tokenId: token.id,
        token,
        usage: {
            endpoint,
            method,
            ipAddress,
            userAgent
        }
    }, actor, metadata);
}
/**
 * Create system startup event
 */
export function systemStartup(component, metadata) {
    return createSystemEvent('system.startup', { component }, metadata);
}
/**
 * Create system shutdown event
 */
export function systemShutdown(component, metadata) {
    return createSystemEvent('system.shutdown', { component }, metadata);
}
/**
 * Create system error event
 */
export function systemError(error, component, metadata) {
    return createSystemEvent('system.error', {
        component,
        error: {
            message: error.message,
            stack: error.stack,
            code: 'code' in error ? String(error.code) : undefined
        }
    }, metadata);
}
// =============================================================================
// EVENT ANALYSIS HELPERS
// =============================================================================
/**
 * Check if an event matches a pattern
 */
export function eventMatches(event, pattern) {
    if (pattern === '*')
        return true;
    if (pattern.endsWith('*')) {
        return event.type.startsWith(pattern.slice(0, -1));
    }
    return event.type === pattern;
}
/**
 * Extract field changes from document update
 */
export function extractDocumentChanges(current, previous) {
    if (!previous) {
        // For new documents, get all content keys (excluding metadata)
        const contentKeys = Object.keys(current).filter(key => !key.startsWith('_') && key !== 'id');
        return contentKeys;
    }
    const changes = [];
    // Get all content keys from both documents (excluding metadata)
    const currentKeys = Object.keys(current).filter(key => !key.startsWith('_') && key !== 'id');
    const previousKeys = Object.keys(previous).filter(key => !key.startsWith('_') && key !== 'id');
    const allKeys = new Set([...currentKeys, ...previousKeys]);
    for (const key of allKeys) {
        const currentValue = current[key];
        const previousValue = previous[key];
        if (JSON.stringify(currentValue) !== JSON.stringify(previousValue)) {
            changes.push(key);
        }
    }
    // Also check status changes
    if (current._status !== previous._status)
        changes.push('_status');
    return changes;
}
/**
 * Create EventActor from User
 */
export function actorFromUser(user) {
    return {
        type: 'user',
        id: user.id,
        name: `${user.firstName} ${user.lastName}`.trim() || user.username,
        email: user.email
    };
}
/**
 * Create EventActor from AppToken
 */
export function actorFromAppToken(token) {
    return {
        type: 'app-token',
        id: token.id,
        name: token.name
    };
}
/**
 * Create system actor
 */
export function systemActor() {
    return {
        type: 'system',
        id: 'trokky-core',
        name: 'Trokky CMS'
    };
}
//# sourceMappingURL=utils.js.map