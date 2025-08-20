/**
 * System user types for CMS authentication and authorization
 * These are internal system entities, separate from user-defined content schemas
 */
// Default permissions for each role
export const ROLE_PERMISSIONS = {
    admin: [
        'content:read', 'content:write', 'content:delete', 'content:publish',
        'media:read', 'media:upload', 'media:edit', 'media:delete',
        'users:read', 'users:write', 'users:delete', 'users:invite',
        'settings:read', 'settings:write',
        'studio:access',
        'tokens:read', 'tokens:write', 'tokens:delete'
    ],
    editor: [
        'content:read', 'content:write', 'content:delete', 'content:publish',
        'media:read', 'media:upload', 'media:edit', 'media:delete',
        'studio:access'
    ],
    author: [
        'content:read', 'content:write', 'content:publish',
        'media:read', 'media:upload',
        'studio:access'
    ],
    viewer: [
        'content:read',
        'media:read',
        'studio:access'
    ],
    api: [
    // API tokens get their permissions from the token itself, not from role defaults
    // This is just a placeholder - actual permissions come from AppToken.permissions
    ]
};
//# sourceMappingURL=user.js.map