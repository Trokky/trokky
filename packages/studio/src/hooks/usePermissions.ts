/**
 * Hook for checking user permissions throughout the Studio
 */

import { useCurrentUser } from './useCurrentUser'
import type { Permission } from '@/types'

interface UsePermissionsReturn {
  hasPermission: (permission: Permission) => boolean
  hasAnyPermission: (permissions: Permission[]) => boolean
  hasAllPermissions: (permissions: Permission[]) => boolean
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
  
  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    userPermissions,
    isAdmin: user?.role === 'admin',
    isEditor: user?.role === 'editor',
    isAuthor: user?.role === 'author',
    isViewer: user?.role === 'viewer'
  }
}