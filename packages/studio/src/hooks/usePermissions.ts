/**
 * Hook for checking user permissions throughout the Studio
 */

import { useCurrentUser } from './useCurrentUser'
import type { Permission, User } from '@/types'

// Action types for schema-level permission checks
export type SchemaAction = 'read' | 'write' | 'delete' | 'publish'

interface UsePermissionsReturn {
  /** Current user, or null while loading / unauthenticated */
  user: User | null
  hasPermission: (permission: Permission) => boolean
  /** Check a global (non schema-scoped) permission by name */
  hasGlobalPermission: (permission: string) => boolean
  hasAnyPermission: (permissions: Permission[]) => boolean
  hasAllPermissions: (permissions: Permission[]) => boolean
  hasSchemaPermission: (
    schemaName: string,
    action: SchemaAction
  ) => boolean
  hasAnySchemaPermission: (
    schemaName: string,
    actions: SchemaAction[]
  ) => boolean
  /** Check if user can delete a specific document (has delete permission OR owns the document) */
  canDeleteDocument: (schemaName: string, document: { _createdBy?: string } | null) => boolean
  /** Check if user can publish content (has content:publish or content:* permission) */
  canPublish: boolean
  userPermissions: Permission[]
  isAdmin: boolean
  isEditor: boolean
  isAuthor: boolean
  isWriter: boolean
  isViewer: boolean
  /** Current user ID for ownership checks */
  userId: string | null
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useCurrentUser()

  const userPermissions = user?.permissions || []

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false

    // Admins have all permissions
    if (user.role === 'admin') return true

    // Check if user has the specific permission
    return userPermissions.includes(permission)
  }

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    if (!user) return false

    // Admins have all permissions
    if (user.role === 'admin') return true

    // Check if user has any of the permissions
    return permissions.some(permission => userPermissions.includes(permission))
  }

  const hasAllPermissions = (permissions: Permission[]): boolean => {
    if (!user) return false

    // Admins have all permissions
    if (user.role === 'admin') return true

    // Check if user has all of the permissions
    return permissions.every(permission => userPermissions.includes(permission))
  }

  const hasSchemaPermission = (
    schemaName: string,
    action: SchemaAction
  ): boolean => {
    if (!user) return false

    // Admins have all permissions
    if (user.role === 'admin') return true

    const permission = `${schemaName}:${action}` as Permission

    // Check specific permission first
    if (userPermissions.includes(permission)) return true

    // Check for schema wildcard (e.g., "actualite:*")
    const schemaWildcard = `${schemaName}:*` as Permission
    if (userPermissions.includes(schemaWildcard)) return true

    // Check for content-wide permissions (most schemas are content)
    // System schemas that are NOT content
    const systemSchemas = ['users', 'settings', 'tokens', 'webhooks', 'media']
    const isContentSchema = !systemSchemas.includes(schemaName.toLowerCase())

    if (isContentSchema) {
      // Check for content:* wildcard
      if (userPermissions.includes('content:*' as Permission)) return true
      // Check for specific content action (e.g., "content:write", "content:publish")
      if (userPermissions.includes(`content:${action}` as Permission))
        return true
    }

    // Check for global wildcard
    if (userPermissions.includes('*' as Permission)) return true

    return false
  }

  const hasAnySchemaPermission = (
    schemaName: string,
    actions: SchemaAction[]
  ): boolean => {
    if (!user) return false

    // Admins have all permissions
    if (user.role === 'admin') return true

    // Check if user has any of the schema permissions
    return actions.some(action => hasSchemaPermission(schemaName, action))
  }

  // Check if user can publish any content
  const canPublish = (): boolean => {
    if (!user) return false
    if (user.role === 'admin') return true

    // Check for content:* or content:publish permission
    return (
      userPermissions.includes('content:*' as Permission) ||
      userPermissions.includes('content:publish' as Permission)
    )
  }

  // Check if user can delete a specific document (has delete permission OR owns the document)
  const canDeleteDocument = (
    schemaName: string,
    document: { _createdBy?: string } | null
  ): boolean => {
    if (!user) return false

    // User has general delete permission for this schema
    if (hasSchemaPermission(schemaName, 'delete')) return true

    // Check if user owns the document (created it)
    if (document?._createdBy) {
      const isOwner =
        document._createdBy === user.id ||
        document._createdBy === user.username
      if (isOwner) return true
    }

    return false
  }

  const hasGlobalPermission = (permission: string): boolean =>
    hasPermission(permission as Permission)

  return {
    user,
    hasPermission,
    hasGlobalPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasSchemaPermission,
    hasAnySchemaPermission,
    canDeleteDocument,
    canPublish: canPublish(),
    userPermissions,
    isAdmin: user?.role === 'admin',
    isEditor: user?.role === 'editor',
    isAuthor: user?.role === 'author',
    isWriter: user?.role === 'writer',
    isViewer: user?.role === 'viewer',
    userId: user?.id || null,
  }
}
