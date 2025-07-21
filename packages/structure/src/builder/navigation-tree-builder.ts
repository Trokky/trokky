/**
 * Navigation Tree Builder
 * Builds navigation trees from structure configurations
 */

import type { User } from '@trokky/core'
import type {
  TrokkyStructure,
  StructureItem,
  DocumentListItem,
  BadgeConfig
} from '../types'
import type {
  NavigationTree,
  NavigationItem,
  PermissionSummary,
  BadgeInfo
} from './StructureBuilder'
import { PermissionChecker } from '../utils/permission-checker'

export class NavigationTreeBuilder {
  constructor(private permissionChecker: PermissionChecker) {}

  /**
   * Build navigation tree from structure
   */
  async build(structure: TrokkyStructure, user?: User): Promise<NavigationTree> {
    const items: NavigationItem[] = []
    let totalItems = 0
    let maxDepth = 0

    for (const item of structure.items) {
      const navItem = await this.buildNavigationItem(item, user, 1)
      if (navItem) {
        items.push(navItem)
        totalItems += this.countItems(navItem)
        maxDepth = Math.max(maxDepth, this.calculateDepth(navItem))
      }
    }

    const permissions = await this.calculateGlobalPermissions(structure, user)

    return {
      items,
      metadata: {
        totalItems,
        maxDepth,
        permissions
      }
    }
  }

  private async buildNavigationItem(
    item: StructureItem,
    user?: User,
    depth = 1
  ): Promise<NavigationItem | null> {
    // Special handling for divider (no permissions check)
    if (item.type === 'divider') {
      return {
        id: this.generateId(item),
        title: item.title || '',
        type: item.type,
        permissions: {
          canRead: true,
          canCreate: false,
          canUpdate: false,
          canDelete: false
        }
      } as NavigationItem
    }

    // Check if user has read permission for other items
    const permissions = 'permissions' in item ? item.permissions : undefined
    if (!(await this.permissionChecker.check(permissions, 'read', user))) {
      return null
    }

    const baseItem: Partial<NavigationItem> = {
      id: ('id' in item ? item.id : undefined) || this.generateId(item),
      title: item.title,
      type: item.type,
      icon: 'icon' in item ? item.icon : undefined,
      permissions: await this.calculatePermissions(item, user)
    }

    switch (item.type) {
      case 'documentList':
        return this.buildDocumentListItem(item, baseItem, user)

      case 'singleton':
        return this.buildSingletonItem(item, baseItem, user)

      case 'group':
        return this.buildGroupItem(item, baseItem, depth, user)

      case 'customView':
        return this.buildCustomViewItem(item, baseItem, user)

      default:
        return null
    }
  }

  private async buildDocumentListItem(
    item: DocumentListItem,
    baseItem: Partial<NavigationItem>,
    user?: User
  ): Promise<NavigationItem> {
    const badge = await this.buildBadge(item.badge, item, user)
    
    return {
      ...baseItem,
      path: `/content/${item.schemaType}`,
      badge,
      metadata: {
        schemaType: item.schemaType,
        filter: item.filter,
        views: item.views,
        defaultView: item.defaultView
      }
    } as NavigationItem
  }

  private async buildSingletonItem(
    item: any,
    baseItem: Partial<NavigationItem>,
    user?: User
  ): Promise<NavigationItem> {
    const documentId = item.documentId || `singleton-${item.schemaType}`
    
    return {
      ...baseItem,
      path: `/content/${item.schemaType}/${documentId}`,
      metadata: {
        schemaType: item.schemaType,
        documentId,
        singleton: true
      }
    } as NavigationItem
  }

  private async buildGroupItem(
    item: any,
    baseItem: Partial<NavigationItem>,
    depth: number,
    user?: User
  ): Promise<NavigationItem | null> {
    const children: NavigationItem[] = []

    for (const childItem of item.items) {
      const child = await this.buildNavigationItem(childItem, user, depth + 1)
      if (child) {
        children.push(child)
      }
    }

    // Don't show empty groups
    if (children.length === 0) {
      return null
    }

    return {
      ...baseItem,
      children,
      metadata: {
        collapsible: item.collapsible,
        defaultCollapsed: item.defaultCollapsed,
        layout: item.options?.layout
      }
    } as NavigationItem
  }

  private buildDividerItem(
    item: any,
    baseItem: Partial<NavigationItem>
  ): NavigationItem {
    return {
      ...baseItem,
      metadata: {
        style: item.style || 'line'
      }
    } as NavigationItem
  }

  private async buildCustomViewItem(
    item: any,
    baseItem: Partial<NavigationItem>,
    user?: User
  ): Promise<NavigationItem> {
    return {
      ...baseItem,
      path: `/views/${item.viewType}`,
      metadata: {
        viewType: item.viewType,
        config: item.config,
        dataSource: item.dataSource
      }
    } as NavigationItem
  }

  private async buildBadge(
    badgeConfig?: BadgeConfig,
    item?: any,
    user?: User
  ): Promise<BadgeInfo | undefined> {
    if (!badgeConfig) return undefined

    // Custom badge logic
    if (badgeConfig.custom) {
      try {
        const result = badgeConfig.custom([]) // Would need actual items
        return result || undefined
      } catch (error) {
        console.warn('Custom badge function failed:', error)
        return undefined
      }
    }

    // Count badge
    if (badgeConfig.count) {
      // Would need to query actual count from client
      return {
        text: '?',
        color: badgeConfig.color || 'gray',
        count: 0
      }
    }

    // Text badge
    if (badgeConfig.text) {
      return {
        text: badgeConfig.text,
        color: badgeConfig.color || 'gray'
      }
    }

    // Field-based badge
    if (badgeConfig.field) {
      // Would need to compute field value
      return {
        text: 'N/A',
        color: badgeConfig.color || 'gray'
      }
    }

    return undefined
  }

  private async calculatePermissions(
    item: StructureItem,
    user?: User
  ): Promise<PermissionSummary> {
    const permissions = 'permissions' in item ? item.permissions : undefined
    const canRead = await this.permissionChecker.check(permissions, 'read', user)
    const canCreate = await this.permissionChecker.check(permissions, 'create', user)
    const canUpdate = await this.permissionChecker.check(permissions, 'update', user)
    const canDelete = await this.permissionChecker.check(permissions, 'delete', user)

    return {
      canRead,
      canCreate,
      canUpdate,
      canDelete,
      effectiveRole: user?.role
    }
  }

  private async calculateGlobalPermissions(
    structure: TrokkyStructure,
    user?: User
  ): Promise<PermissionSummary> {
    const canRead = await this.permissionChecker.check(structure.permissions, 'read', user)
    const canCreate = await this.permissionChecker.check(structure.permissions, 'create', user)
    const canUpdate = await this.permissionChecker.check(structure.permissions, 'update', user)
    const canDelete = await this.permissionChecker.check(structure.permissions, 'delete', user)

    return {
      canRead,
      canCreate,
      canUpdate,
      canDelete,
      effectiveRole: user?.role
    }
  }

  private generateId(item: StructureItem): string {
    if (item.type === 'documentList' || item.type === 'singleton') {
      return `${item.type}-${item.schemaType}`
    }
    
    return `${item.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private countItems(item: NavigationItem): number {
    let count = 1
    if (item.children) {
      count += item.children.reduce((sum, child) => sum + this.countItems(child), 0)
    }
    return count
  }

  private calculateDepth(item: NavigationItem, currentDepth = 1): number {
    if (!item.children || item.children.length === 0) {
      return currentDepth
    }

    return Math.max(
      ...item.children.map(child => this.calculateDepth(child, currentDepth + 1))
    )
  }
}