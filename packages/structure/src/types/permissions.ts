/**
 * Permission Types
 * Role-based access control for structure items
 */

import type { User } from '@trokky/core'

/**
 * Permission configuration for structure items
 */
export interface PermissionConfig {
  /** Who can read/view */
  read?: PermissionRule
  
  /** Who can create new documents */
  create?: PermissionRule
  
  /** Who can update existing documents */
  update?: PermissionRule
  
  /** Who can delete documents */
  delete?: PermissionRule
  
  /** Custom permission checks */
  custom?: Record<string, PermissionRule>
}

/**
 * Permission rule types
 */
export type PermissionRule = 
  | boolean                    // Allow/deny all
  | string                     // Single role
  | string[]                   // Multiple roles
  | PermissionFunction         // Custom function
  | PermissionCondition        // Conditional permission

/**
 * Conditional permission configuration
 */
export interface PermissionCondition {
  /** Condition to check */
  condition: string | ((user: User, context: any) => boolean)
  
  /** Roles allowed when condition is true */
  allow?: string | string[]
  
  /** Roles denied when condition is true */
  deny?: string | string[]
  
  /** Fallback permission when condition is false */
  fallback?: PermissionRule
}

/**
 * Custom permission function
 */
export type PermissionFunction = (user: User, context: PermissionContext) => boolean | Promise<boolean>

/**
 * Permission context for evaluating permissions
 */
export interface PermissionContext {
  /** Action being performed */
  action: 'read' | 'create' | 'update' | 'delete' | string
  
  /** Resource being accessed */
  resource?: any
  
  /** Structure item */
  item?: any
  
  /** Additional context data */
  data?: Record<string, any>
  
  /** Request metadata */
  request?: {
    ip?: string
    userAgent?: string
    timestamp: Date
  }
}

/**
 * Permission check result
 */
export interface PermissionResult {
  /** Permission granted */
  allowed: boolean
  
  /** Reason for decision */
  reason?: string
  
  /** Applied rule */
  rule?: PermissionRule
  
  /** Error if permission check failed */
  error?: string
}

/**
 * Permission summary for navigation items
 */
export interface PermissionSummary {
  /** Can read */
  canRead: boolean
  
  /** Can create */
  canCreate: boolean
  
  /** Can update */
  canUpdate: boolean
  
  /** Can delete */
  canDelete: boolean
  
  /** Custom permissions */
  custom?: Record<string, boolean>
  
  /** Effective role */
  effectiveRole?: string
}

/**
 * Built-in permission patterns
 */
export const PermissionPatterns = {
  /** Public read access */
  PUBLIC_READ: {
    read: true,
    create: false,
    update: false,
    delete: false
  },
  
  /** Authenticated users only */
  AUTHENTICATED_ONLY: {
    read: ['user', 'editor', 'admin'],
    create: ['user', 'editor', 'admin'],
    update: ['user', 'editor', 'admin'],
    delete: ['admin']
  },
  
  /** Editors and admins */
  EDITOR_ACCESS: {
    read: ['editor', 'admin'],
    create: ['editor', 'admin'],
    update: ['editor', 'admin'],
    delete: ['admin']
  },
  
  /** Admin only */
  ADMIN_ONLY: {
    read: ['admin'],
    create: ['admin'],
    update: ['admin'],
    delete: ['admin']
  },
  
  /** Owner or admin */
  OWNER_OR_ADMIN: {
    read: true,
    create: ['user', 'editor', 'admin'],
    update: (user: User, context: PermissionContext) => {
      return context.resource?.author === user.id || user.role === 'admin'
    },
    delete: (user: User, context: PermissionContext) => {
      return context.resource?.author === user.id || user.role === 'admin'
    }
  }
} as const

/**
 * Permission validator configuration
 */
export interface PermissionValidatorConfig {
  /** Available roles in the system */
  availableRoles: string[]
  
  /** Default permissions for new items */
  defaultPermissions: PermissionConfig
  
  /** Whether to inherit parent permissions */
  inheritParentPermissions: boolean
  
  /** Maximum permission complexity */
  maxComplexity?: number
}

/**
 * Permission inheritance configuration
 */
export interface PermissionInheritance {
  /** Inherit from parent item */
  fromParent?: boolean
  
  /** Inherit from schema type */
  fromSchema?: boolean
  
  /** Inherit from global configuration */
  fromGlobal?: boolean
  
  /** Override inherited permissions */
  override?: Partial<PermissionConfig>
  
  /** Merge strategy */
  mergeStrategy?: 'replace' | 'union' | 'intersection'
}