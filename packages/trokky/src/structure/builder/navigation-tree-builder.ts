/**
 * Navigation Tree Builder
 * Builds navigation trees from structure configurations
 */

import type { User } from '../../core/index.js'
import type {
  TrokkyStructure,
  StructureItem,
  DocumentListItem,
  SingletonItem,
  GroupItem,
  DividerItem,
  CustomViewItem,
  BadgeConfig,
  QueryFilter
} from '../types/index.js'
import type {
  NavigationTree,
  NavigationItem,
  PermissionSummary,
  BadgeInfo
} from './StructureBuilder.js'
import { PermissionChecker } from '../utils/permission-checker.js'
import { NavigationError, ErrorCodes, ErrorRecovery } from '../errors/index.js'

export interface CountService {
  getCount(schemaType: string, filter?: QueryFilter): Promise<number>
}

export class NavigationTreeBuilder {
  constructor(
    private permissionChecker: PermissionChecker,
    private countService?: CountService
  ) {}

  /**
   * Build navigation tree from structure
   */
  async build(structure: TrokkyStructure, user?: User): Promise<NavigationTree> {
    try {
      const items: NavigationItem[] = []
      let totalItems = 0
      let maxDepth = 0

      for (const item of structure.items) {
        try {
          const navItem = await this.buildNavigationItem(item, user, 1)
          if (navItem) {
            items.push(navItem)
            totalItems += this.countItems(navItem)
            maxDepth = Math.max(maxDepth, this.calculateDepth(navItem))
          }
        } catch (error) {
          console.warn('Failed to build navigation item:', {
            itemType: item.type,
            itemTitle: item.title,
            error: (error as Error).message
          })
          // Continue building other items instead of failing completely
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
    } catch (error) {
      throw new NavigationError(
        'Failed to build navigation tree',
        { structureTitle: structure.title, user: user?.id },
        error as Error
      )
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
    item: SingletonItem,
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
    item: GroupItem,
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
    item: DividerItem,
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
    item: CustomViewItem,
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
    item?: DocumentListItem,
    user?: User
  ): Promise<BadgeInfo | undefined> {
    if (!badgeConfig) return undefined

    try {
      // Custom badge logic
      if (badgeConfig.custom) {
        try {
          // Get actual items for custom badge function
          let items: any[] = []
          if (this.countService && item) {
            const count = await this.countService.getCount(item.schemaType, item.filter)
            // For custom badge, we pass count as a pseudo-item array
            items = Array(count).fill(null)
          }
          
          const result = await Promise.resolve(badgeConfig.custom(items))
          return result || undefined
        } catch (error) {
          console.warn('Custom badge function failed:', error)
          return {
            text: 'Error',
            color: 'red'
          }
        }
      }

      // Count badge
      if (badgeConfig.count && this.countService && item) {
        try {
          const count = await this.countService.getCount(item.schemaType, item.filter)
          return {
            text: count.toString(),
            color: badgeConfig.color || 'gray',
            count
          }
        } catch (error) {
          console.warn('Failed to get count for badge:', error)
          return {
            text: '?',
            color: badgeConfig.color || 'gray',
            count: 0
          }
        }
      }

      // Count badge without service - show placeholder
      if (badgeConfig.count) {
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
        // Could be enhanced to compute field values from actual data
        return {
          text: 'N/A',
          color: badgeConfig.color || 'gray'
        }
      }

      return undefined
    } catch (error) {
      console.warn('Badge building failed:', error)
      return {
        text: 'Error',
        color: 'red'
      }
    }
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