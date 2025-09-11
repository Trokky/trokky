/**
 * Hook for checking user permissions throughout the Studio
 */

import { useCurrentUser } from './useCurrentUser'
import type { Permission } from '@/types'

interface UsePermissionsReturn {
  hasPermission: (permission: Permission) => boolean
  hasAnyPermission: (permissions: Permission[]) => boolean
  hasAllPermissions: (permissions: Permission[]) => boolean
  hasSchemaPermission: (
    schemaName: string,
    action: 'read' | 'write' | 'delete'
  ) => boolean
  hasAnySchemaPermission: (
    schemaName: string,
    actions: ('read' | 'write' | 'delete')[]
  ) => boolean
  userPermissions: Permission[]
  isAdmin: boolean
  isEditor: boolean
  isAuthor: boolean
  isViewer: boolean
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
    action: 'read' | 'write' | 'delete'
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
      // Check for specific content action (e.g., "content:write")
      if (userPermissions.includes(`content:${action}` as Permission))
        return true
    }

    // Check for global wildcard
    if (userPermissions.includes('*' as Permission)) return true

    return false
  }

  const hasAnySchemaPermission = (
    schemaName: string,
    actions: ('read' | 'write' | 'delete')[]
  ): boolean => {
    if (!user) return false

    // Admins have all permissions
    if (user.role === 'admin') return true

    // Check if user has any of the schema permissions
    return actions.some(action => hasSchemaPermission(schemaName, action))
  }

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasSchemaPermission,
    hasAnySchemaPermission,
    userPermissions,
    isAdmin: user?.role === 'admin',
    isEditor: user?.role === 'editor',
    isAuthor: user?.role === 'author',
    isViewer: user?.role === 'viewer',
  }
}
