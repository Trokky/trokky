/**
 * Component that conditionally renders children based on user permissions
 */

import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { Permission, UserRole } from '@/types';

interface PermissionGuardProps {
  /** Single permission required */
  permission?: Permission;
  /** Multiple permissions (user needs ANY of these) */
  anyPermissions?: Permission[];
  /** Multiple permissions (user needs ALL of these) */
  allPermissions?: Permission[];
  /** Role-based access */
  roles?: UserRole[];
  /** What to render when user doesn't have permission */
  fallback?: React.ReactNode;
  /** Children to render when user has permission */
  children: React.ReactNode;
}

export function PermissionGuard({
  permission,
  anyPermissions,
  allPermissions,
  roles,
  fallback = null,
  children
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, user } = usePermissions();

  // Check role-based access first
  if (roles && user) {
    if (!roles.includes(user.role)) {
      return <>{fallback}</>;
    }
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // Check any permissions
  if (anyPermissions && !hasAnyPermission(anyPermissions)) {
    return <>{fallback}</>;
  }

  // Check all permissions
  if (allPermissions && !hasAllPermissions(allPermissions)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Hook-based permission guard for conditional logic
 */
export function usePermissionGuard(
  permission?: Permission,
  anyPermissions?: Permission[],
  allPermissions?: Permission[],
  roles?: UserRole[]
): boolean {
  const { hasPermission, hasAnyPermission, hasAllPermissions, user } = usePermissions();

  // Check role-based access first
  if (roles && user) {
    if (!roles.includes(user.role)) {
      return false;
    }
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return false;
  }

  // Check any permissions
  if (anyPermissions && !hasAnyPermission(anyPermissions)) {
    return false;
  }

  // Check all permissions
  if (allPermissions && !hasAllPermissions(allPermissions)) {
    return false;
  }

  return true;
}