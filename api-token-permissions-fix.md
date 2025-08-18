# API Token Permissions Fix

## Problem Analysis

The API token system has limited permissions compared to the user system:

### Current API Token Permissions (Studio UI)
```typescript
const PERMISSIONS = [
  { value: 'content:read', label: 'View Content', group: 'Content' },
  { value: 'content:write', label: 'Edit Content', group: 'Content' },
  { value: 'content:delete', label: 'Delete Content', group: 'Content' },
  { value: 'content:publish', label: 'Publish Content', group: 'Content' },
  { value: 'media:read', label: 'View Media', group: 'Media' },
  { value: 'media:upload', label: 'Upload Media', group: 'Media' },
  { value: 'media:edit', label: 'Edit Media', group: 'Media' },
  { value: 'media:delete', label: 'Delete Media', group: 'Media' }
];
```

### Missing Permissions for API Tokens
1. **Schema-specific permissions**: `homePage:read`, `article:read`, `settings:read`, etc.
2. **System permissions**: `users:read`, `settings:read`, `tokens:read`, etc.
3. **Wildcard permissions**: `content:*`, `media:*`, `homePage:*`, etc.

## Root Cause

The `validateSchemaAccess` method checks for schema-specific permissions:
```typescript
const permission = `${schemaName}:${action}` // e.g., "homePage:read"
```

But API tokens created through Studio only have generic `content:read` permissions, not schema-specific ones.

## Solutions

### Option 1: Fix the Permission Checking Logic
Update `validateSchemaAccess` to properly handle generic permissions for API tokens:

```typescript
// In validateSchemaAccess method
const hasAccess = session.role === 'admin' || 
                 session.permissions.includes(permission) ||           // homePage:read
                 session.permissions.includes(schemaWildcard) ||       // homePage:*
                 session.permissions.includes(contentWildcard) ||      // content:*
                 session.permissions.includes(globalPermission) ||     // content:read ✅ THIS SHOULD WORK
                 (session.role === 'api' && session.permissions.includes(globalPermission)); // Special handling for API tokens
```

### Option 2: Expand Studio API Token Permissions UI
Update the Studio to offer all available permissions including schema-specific ones:

```typescript
// In AppTokenManagement.tsx
const PERMISSIONS = [
  // Generic permissions
  { value: 'content:read', label: 'View All Content', group: 'Content' },
  { value: 'content:write', label: 'Edit All Content', group: 'Content' },
  { value: 'content:*', label: 'Full Content Access', group: 'Content' },
  
  // Schema-specific permissions (dynamically generated)
  { value: 'homePage:read', label: 'View Home Page', group: 'Home Page' },
  { value: 'homePage:write', label: 'Edit Home Page', group: 'Home Page' },
  { value: 'article:read', label: 'View Articles', group: 'Articles' },
  { value: 'article:write', label: 'Edit Articles', group: 'Articles' },
  
  // System permissions
  { value: 'users:read', label: 'View Users', group: 'System' },
  { value: 'settings:read', label: 'View Settings', group: 'System' },
  { value: 'tokens:read', label: 'View API Tokens', group: 'System' },
];
```

### Option 3: Auto-grant Schema Permissions
When an API token has `content:read`, automatically grant access to all schema read operations.

## Recommended Fix

**Immediate Fix**: Update the permission checking logic to properly handle generic permissions.
**Long-term Fix**: Expand the Studio UI to offer schema-specific permissions.

## Files to Modify

1. `/packages/routes/src/routes.ts` - Fix `validateSchemaAccess` method
2. `/packages/studio/src/components/users/AppTokenManagement.tsx` - Expand permission options
3. Consider creating a dynamic permission generator based on available schemas
