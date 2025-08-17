/**
 * Permission constants for better type safety and autocomplete
 * Uses the centralized Permission type from types/index.ts
 */

import type { Permission } from '@/types';

// Content permissions
export const CONTENT_PERMISSIONS = {
  READ: 'content:read' as Permission,
  WRITE: 'content:write' as Permission,
  DELETE: 'content:delete' as Permission,
  PUBLISH: 'content:publish' as Permission,
} as const;

// Media permissions  
export const MEDIA_PERMISSIONS = {
  READ: 'media:read' as Permission,
  UPLOAD: 'media:upload' as Permission,
  EDIT: 'media:edit' as Permission,
  DELETE: 'media:delete' as Permission,
} as const;

// User management permissions
export const USER_PERMISSIONS = {
  READ: 'users:read' as Permission,
  WRITE: 'users:write' as Permission,
  DELETE: 'users:delete' as Permission,
  INVITE: 'users:invite' as Permission,
} as const;

// Settings permissions
export const SETTINGS_PERMISSIONS = {
  READ: 'settings:read' as Permission,
  WRITE: 'settings:write' as Permission,
} as const;

// Token management permissions
export const TOKEN_PERMISSIONS = {
  READ: 'tokens:read' as Permission,
  WRITE: 'tokens:write' as Permission,
  DELETE: 'tokens:delete' as Permission,
} as const;

// Webhook management permissions
export const WEBHOOK_PERMISSIONS = {
  READ: 'webhooks:read' as Permission,
  WRITE: 'webhooks:write' as Permission,
  DELETE: 'webhooks:delete' as Permission,
  TEST: 'webhooks:test' as Permission,
} as const;

// Studio access
export const STUDIO_PERMISSIONS = {
  ACCESS: 'studio:access' as Permission,
} as const;

// Convenience exports for common permission groups
export const ALL_MEDIA_PERMISSIONS = Object.values(MEDIA_PERMISSIONS);
export const ALL_USER_PERMISSIONS = Object.values(USER_PERMISSIONS);
export const ALL_SETTINGS_PERMISSIONS = Object.values(SETTINGS_PERMISSIONS);
export const ALL_TOKEN_PERMISSIONS = Object.values(TOKEN_PERMISSIONS);
export const ALL_WEBHOOK_PERMISSIONS = Object.values(WEBHOOK_PERMISSIONS);

// Common permission combinations
export const SETTINGS_MENU_PERMISSIONS = [
  SETTINGS_PERMISSIONS.READ,
  USER_PERMISSIONS.READ,
  TOKEN_PERMISSIONS.READ,    // API Tokens access
  WEBHOOK_PERMISSIONS.READ,  // Webhooks access
  SETTINGS_PERMISSIONS.WRITE, // for Fields Demo
] as const;