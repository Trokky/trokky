/**
 * Structure Merger
 * Merges multiple structure configurations with conflict resolution
 */

import type {
  TrokkyStructure,
  StructureItem,
  PermissionConfig,
  ThemeConfig,
  PluginConfig
} from '../types/index.js'

export interface MergeOptions {
  /** Strategy for resolving conflicts */
  conflictResolution?: 'first' | 'last' | 'merge' | 'error'
  
  /** Whether to merge permissions */
  mergePermissions?: boolean
  
  /** Whether to merge themes */
  mergeThemes?: boolean
  
  /** Whether to merge plugins */
  mergePlugins?: boolean
  
  /** Custom merge functions */
  customMergers?: {
    items?: (items: StructureItem[][]) => StructureItem[]
    permissions?: (permissions: PermissionConfig[]) => PermissionConfig
    theme?: (themes: ThemeConfig[]) => ThemeConfig
    plugins?: (plugins: PluginConfig[][]) => PluginConfig[]
  }
  
  /** Prefix for merged item IDs to avoid conflicts */
  idPrefix?: string
}

export interface MergeResult {
  /** Merged structure */
  structure: TrokkyStructure
  
  /** Merge conflicts that were resolved */
  conflicts: MergeConflict[]
  
  /** Merge statistics */
  stats: {
    totalStructures: number
    totalItems: number
    itemsAdded: number
    itemsMerged: number
    conflictsResolved: number
  }
}

export interface MergeConflict {
  /** Conflict type */
  type: 'duplicate-id' | 'permission-conflict' | 'theme-conflict' | 'plugin-conflict'
  
  /** Conflict path */
  path: string
  
  /** Resolution strategy used */
  resolution: string
  
  /** Original values */
  values: any[]
  
  /** Final value */
  resolved: any
}

export class StructureMerger {
  constructor(private defaultOptions: MergeOptions = {}) {
    this.defaultOptions = {
      conflictResolution: 'last',
      mergePermissions: true,
      mergeThemes: true,
      mergePlugins: true,
      ...defaultOptions
    }
  }

  /**
   * Merge multiple structures
   */
  merge(...structures: TrokkyStructure[]): TrokkyStructure {
    const result = this.mergeWithDetails(...structures)
    return result.structure
  }

  /**
   * Merge with detailed conflict information
   */
  mergeWithDetails(...structures: TrokkyStructure[]): MergeResult {
    if (structures.length === 0) {
      throw new Error('At least one structure is required for merging')
    }

    if (structures.length === 1) {
      return {
        structure: structures[0],
        conflicts: [],
        stats: {
          totalStructures: 1,
          totalItems: this.countItems(structures[0].items),
          itemsAdded: this.countItems(structures[0].items),
          itemsMerged: 0,
          conflictsResolved: 0
        }
      }
    }

    const options = { ...this.defaultOptions }
    const conflicts: MergeConflict[] = []
    const stats = {
      totalStructures: structures.length,
      totalItems: 0,
      itemsAdded: 0,
      itemsMerged: 0,
      conflictsResolved: 0
    }

    // Start with first structure as base
    const [baseStructure, ...otherStructures] = structures
    const merged: TrokkyStructure = {
      title: baseStructure.title,
      items: [...baseStructure.items],
      theme: baseStructure.theme ? { ...baseStructure.theme } : undefined,
      permissions: baseStructure.permissions ? { ...baseStructure.permissions } : undefined,
      plugins: baseStructure.plugins ? [...baseStructure.plugins] : undefined,
      customStyles: baseStructure.customStyles,
      metadata: baseStructure.metadata ? { ...baseStructure.metadata } : undefined
    }

    stats.totalItems = this.countItems(merged.items)
    stats.itemsAdded = stats.totalItems

    // Merge each additional structure
    for (let i = 0; i < otherStructures.length; i++) {
      const structure = otherStructures[i]
      const structureConflicts: MergeConflict[] = []

      // Merge title (use last non-empty)
      if (structure.title && structure.title.trim()) {
        if (merged.title !== structure.title) {
          structureConflicts.push({
            type: 'theme-conflict',
            path: 'title',
            resolution: 'last',
            values: [merged.title, structure.title],
            resolved: structure.title
          })
        }
        merged.title = structure.title
      }

      // Merge items
      const itemsResult = this.mergeItems(merged.items, structure.items, options, `structures[${i + 1}].items`)
      merged.items = itemsResult.items
      conflicts.push(...itemsResult.conflicts)
      stats.itemsAdded += itemsResult.stats.added
      stats.itemsMerged += itemsResult.stats.merged

      // Merge permissions
      if (options.mergePermissions && structure.permissions) {
        const permResult = this.mergePermissions(
          merged.permissions,
          structure.permissions,
          options,
          `structures[${i + 1}].permissions`
        )
        merged.permissions = permResult.permissions
        conflicts.push(...permResult.conflicts)
      }

      // Merge theme
      if (options.mergeThemes && structure.theme) {
        const themeResult = this.mergeThemes(
          merged.theme,
          structure.theme,
          options,
          `structures[${i + 1}].theme`
        )
        merged.theme = themeResult.theme
        conflicts.push(...themeResult.conflicts)
      }

      // Merge plugins
      if (options.mergePlugins && structure.plugins) {
        const pluginResult = this.mergePlugins(
          merged.plugins || [],
          structure.plugins,
          options,
          `structures[${i + 1}].plugins`
        )
        merged.plugins = pluginResult.plugins
        conflicts.push(...pluginResult.conflicts)
      }

      // Merge custom styles (concatenate)
      if (structure.customStyles) {
        if (merged.customStyles) {
          merged.customStyles = `${merged.customStyles}\n\n/* Merged from structure ${i + 1} */\n${structure.customStyles}`
        } else {
          merged.customStyles = structure.customStyles
        }
      }

      // Merge metadata
      if (structure.metadata) {
        if (!merged.metadata) {
          merged.metadata = { ...structure.metadata }
        } else {
          merged.metadata = {
            ...merged.metadata,
            ...structure.metadata,
            version: structure.metadata.version || merged.metadata.version,
            description: structure.metadata.description || merged.metadata.description,
            author: structure.metadata.author || merged.metadata.author,
            tags: [
              ...(merged.metadata.tags || []),
              ...(structure.metadata.tags || [])
            ].filter((tag, index, arr) => arr.indexOf(tag) === index) // Remove duplicates
          }
        }
      }

      conflicts.push(...structureConflicts)
    }

    stats.totalItems = this.countItems(merged.items)
    stats.conflictsResolved = conflicts.length

    return {
      structure: merged,
      conflicts,
      stats
    }
  }

  /**
   * Merge structure items
   */
  private mergeItems(
    baseItems: StructureItem[],
    newItems: StructureItem[],
    options: MergeOptions,
    basePath: string
  ): {
    items: StructureItem[]
    conflicts: MergeConflict[]
    stats: { added: number; merged: number }
  } {
    const conflicts: MergeConflict[] = []
    const stats = { added: 0, merged: 0 }
    const merged = [...baseItems]
    const usedIds = new Set(baseItems.map(item => ('id' in item ? item.id : undefined)).filter(Boolean))

    if (options.customMergers?.items) {
      return {
        items: options.customMergers.items([baseItems, newItems]),
        conflicts,
        stats
      }
    }

    for (let i = 0; i < newItems.length; i++) {
      const newItem = newItems[i]
      const itemPath = `${basePath}[${i}]`

      // Handle ID conflicts
      const newItemId = 'id' in newItem ? newItem.id : undefined
      if (newItemId && usedIds.has(newItemId)) {
        const conflict: MergeConflict = {
          type: 'duplicate-id',
          path: `${itemPath}.id`,
          resolution: options.conflictResolution || 'last',
          values: [newItemId],
          resolved: newItemId
        }

        switch (options.conflictResolution) {
          case 'error':
            throw new Error(`Duplicate ID found: ${newItemId} at ${itemPath}`)
          
          case 'first':
            // Skip this item
            continue
          
          case 'last':
            // Remove existing item with same ID
            const existingIndex = merged.findIndex(item => ('id' in item ? item.id : undefined) === newItemId)
            if (existingIndex !== -1) {
              merged.splice(existingIndex, 1)
              stats.merged++
            }
            conflict.resolved = newItemId
            break
          
          case 'merge':
            // Try to merge items with same ID
            const existingItem = merged.find(item => ('id' in item ? item.id : undefined) === newItemId)
            if (existingItem && existingItem.type === newItem.type) {
              const mergedItem = this.mergeStructureItem(existingItem, newItem, options)
              const existingIndex = merged.findIndex(item => ('id' in item ? item.id : undefined) === newItemId)
              merged[existingIndex] = mergedItem
              stats.merged++
              conflict.resolved = mergedItem
              conflicts.push(conflict)
              continue
            } else {
              // Can't merge different types, use last
              const existingIndex = merged.findIndex(item => ('id' in item ? item.id : undefined) === newItemId)
              if (existingIndex !== -1) {
                merged.splice(existingIndex, 1)
              }
              conflict.resolved = newItem
            }
            break
        }

        conflicts.push(conflict)
      }

      // Add item with unique ID
      const itemToAdd = { ...newItem }
      const itemToAddId = 'id' in itemToAdd ? itemToAdd.id : undefined
      if (itemToAddId) {
        usedIds.add(itemToAddId)
      } else if (options.idPrefix && 'id' in itemToAdd) {
        const newId = `${options.idPrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        ;(itemToAdd as any).id = newId
        usedIds.add(newId)
      }

      merged.push(itemToAdd)
      stats.added++
    }

    return { items: merged, conflicts, stats }
  }

  /**
   * Merge two structure items of the same type
   */
  private mergeStructureItem(
    base: StructureItem,
    incoming: StructureItem,
    options: MergeOptions
  ): StructureItem {
    if (base.type !== incoming.type) {
      return incoming // Can't merge different types
    }

    const merged = { ...base }

    // Merge common properties
    merged.title = incoming.title || base.title
    if ('icon' in merged && 'icon' in incoming) {
      merged.icon = incoming.icon || merged.icon
    }
    
    // Merge permissions
    if ('permissions' in incoming && incoming.permissions) {
      const basePermissions = 'permissions' in base ? base.permissions : undefined
      if (basePermissions && options.mergePermissions && 'permissions' in merged) {
        (merged as any).permissions = this.mergePermissionConfigs(basePermissions, incoming.permissions)
      } else if ('permissions' in merged) {
        (merged as any).permissions = incoming.permissions
      }
    }

    // Merge metadata
    if ('metadata' in incoming && incoming.metadata && 'metadata' in merged) {
      (merged as any).metadata = {
        ...(('metadata' in base ? base.metadata : undefined) || {}),
        ...incoming.metadata
      }
    }

    // Type-specific merging
    switch (base.type) {
      case 'documentList':
        if (incoming.type === 'documentList' && merged.type === 'documentList') {
          merged.filter = incoming.filter || merged.filter
          merged.defaultOrdering = incoming.defaultOrdering || merged.defaultOrdering
          merged.views = incoming.views || merged.views
          merged.defaultView = incoming.defaultView || merged.defaultView
          merged.badge = incoming.badge || merged.badge
          merged.bulkActions = [
            ...(merged.bulkActions || []),
            ...(incoming.bulkActions || [])
          ]
          merged.options = {
            ...(merged.options || {}),
            ...(incoming.options || {})
          }
        }
        break

      case 'singleton':
        if (incoming.type === 'singleton' && merged.type === 'singleton') {
          merged.documentId = incoming.documentId || merged.documentId
          merged.layout = incoming.layout || merged.layout
          merged.options = {
            ...(merged.options || {}),
            ...(incoming.options || {})
          }
        }
        break

      case 'group':
        if (incoming.type === 'group' && merged.type === 'group') {
          // Merge group items recursively
          const itemsResult = this.mergeItems(
            merged.items,
            incoming.items,
            options,
            'group.items'
          )
          merged.items = itemsResult.items
          merged.collapsible = incoming.collapsible ?? merged.collapsible
          merged.defaultCollapsed = incoming.defaultCollapsed ?? merged.defaultCollapsed
          merged.options = {
            ...(merged.options || {}),
            ...(incoming.options || {})
          }
        }
        break

      case 'customView':
        if (incoming.type === 'customView' && merged.type === 'customView') {
          merged.viewType = incoming.viewType || merged.viewType
          merged.config = {
            ...(merged.config || {}),
            ...(incoming.config || {})
          }
          merged.dataSource = incoming.dataSource || merged.dataSource
        }
        break
    }

    return merged
  }

  /**
   * Merge permission configurations
   */
  private mergePermissions(
    base: PermissionConfig | undefined,
    incoming: PermissionConfig,
    options: MergeOptions,
    basePath: string
  ): {
    permissions: PermissionConfig
    conflicts: MergeConflict[]
  } {
    const conflicts: MergeConflict[] = []

    if (options.customMergers?.permissions) {
      return {
        permissions: options.customMergers.permissions([base, incoming].filter(Boolean) as PermissionConfig[]),
        conflicts
      }
    }

    if (!base) {
      return { permissions: incoming, conflicts }
    }

    const merged = this.mergePermissionConfigs(base, incoming)
    return { permissions: merged, conflicts }
  }

  /**
   * Merge two permission configs
   */
  private mergePermissionConfigs(base: PermissionConfig, incoming: PermissionConfig): PermissionConfig {
    const merged: PermissionConfig = { ...base }

    // Merge standard permissions
    for (const action of ['read', 'create', 'update', 'delete'] as const) {
      if (incoming[action] !== undefined) {
        merged[action] = incoming[action]
      }
    }

    // Merge custom permissions
    if (incoming.custom) {
      merged.custom = {
        ...(base.custom || {}),
        ...incoming.custom
      }
    }

    return merged
  }

  /**
   * Merge themes
   */
  private mergeThemes(
    base: ThemeConfig | undefined,
    incoming: ThemeConfig,
    options: MergeOptions,
    basePath: string
  ): {
    theme: ThemeConfig
    conflicts: MergeConflict[]
  } {
    const conflicts: MergeConflict[] = []

    if (options.customMergers?.theme) {
      return {
        theme: options.customMergers.theme([base, incoming].filter(Boolean) as ThemeConfig[]),
        conflicts
      }
    }

    if (!base) {
      return { theme: incoming, conflicts }
    }

    const merged: ThemeConfig = {
      ...base,
      ...incoming,
      background: {
        ...(base.background || {}),
        ...(incoming.background || {})
      },
      text: {
        ...(base.text || {}),
        ...(incoming.text || {})
      },
      borderRadius: {
        ...(base.borderRadius || {}),
        ...(incoming.borderRadius || {})
      },
      typography: {
        ...(base.typography || {}),
        ...(incoming.typography || {}),
        fontSize: {
          ...(base.typography?.fontSize || {}),
          ...(incoming.typography?.fontSize || {})
        }
      },
      spacing: {
        ...(base.spacing || {}),
        ...(incoming.spacing || {})
      },
      shadows: {
        ...(base.shadows || {}),
        ...(incoming.shadows || {})
      }
    }

    return { theme: merged, conflicts }
  }

  /**
   * Merge plugins
   */
  private mergePlugins(
    base: PluginConfig[],
    incoming: PluginConfig[],
    options: MergeOptions,
    basePath: string
  ): {
    plugins: PluginConfig[]
    conflicts: MergeConflict[]
  } {
    const conflicts: MergeConflict[] = []

    if (options.customMergers?.plugins) {
      return {
        plugins: options.customMergers.plugins([base, incoming]),
        conflicts
      }
    }

    const merged = [...base]
    const pluginNames = new Set(base.map(p => p.name))

    for (const plugin of incoming) {
      if (pluginNames.has(plugin.name)) {
        // Plugin conflict - replace with incoming
        const existingIndex = merged.findIndex(p => p.name === plugin.name)
        conflicts.push({
          type: 'plugin-conflict',
          path: `${basePath}[${existingIndex}]`,
          resolution: 'last',
          values: [merged[existingIndex], plugin],
          resolved: plugin
        })
        merged[existingIndex] = plugin
      } else {
        merged.push(plugin)
        pluginNames.add(plugin.name)
      }
    }

    return { plugins: merged, conflicts }
  }

  /**
   * Count total items in structure
   */
  private countItems(items: StructureItem[]): number {
    let count = 0
    for (const item of items) {
      count++
      if (item.type === 'group') {
        count += this.countItems(item.items)
      }
    }
    return count
  }
}