/**
 * What an OAuth2 access token may do: the lesser of what its scopes allow and what the user
 * who granted it may do.
 *
 * Neither side alone is enough. The scopes are what the user agreed to hand the client, so a
 * token must never exceed them, even for an admin. The user's permissions are the ceiling, so
 * a scope must never lend a user something they could not do themselves.
 */

import { ROLE_PERMISSIONS } from '../../types/user.js'
import { SCOPE_TO_PERMISSIONS } from '../../../types/oauth2.js'
import type { OAuth2Scope } from '../../../types/oauth2.js'
import type { Permission, UserRole } from '../../../types/auth.js'

/** Resources that are not content collections, so `<name>:<action>` is not a schema permission */
const NON_CONTENT_RESOURCES = new Set(['content', 'media', 'users', 'settings', 'studio', 'tokens', 'webhooks'])

export function scopesToPermissionSet(scopes: string[]): Permission[] {
  const permissions = new Set<Permission>()
  for (const scope of scopes) {
    for (const permission of SCOPE_TO_PERMISSIONS[scope as OAuth2Scope] ?? []) {
      permissions.add(permission)
    }
  }
  return [...permissions]
}

export function scopedPermissions(
  user: { role: UserRole; permissions?: Permission[] },
  scopes: string[]
): Permission[] {
  const granted = scopesToPermissionSet(scopes)
  if (user.role === 'admin') {
    return granted
  }

  // Stored permissions are a snapshot from creation; the role's current defaults count too,
  // as they do everywhere else a user's permissions are judged
  const held = new Set<string>([...(user.permissions ?? []), ...(ROLE_PERMISSIONS[user.role] ?? [])])
  const holds = (permission: string): boolean =>
    held.has(permission) || held.has(`${permission.split(':')[0]}:*`)

  const result = new Set<Permission>()
  for (const permission of granted) {
    if (holds(permission)) {
      result.add(permission)
      continue
    }
    // A user limited to some collections (`posts:write`) keeps exactly those under a
    // site-wide content scope (`content:write`)
    const [resource, action] = permission.split(':')
    if (resource !== 'content') continue
    for (const own of held) {
      const [ownResource, ownAction] = own.split(':')
      if (!ownResource || NON_CONTENT_RESOURCES.has(ownResource)) continue
      if (ownAction === action || ownAction === '*') {
        result.add(`${ownResource}:${action}` as Permission)
      }
    }
  }
  return [...result]
}
