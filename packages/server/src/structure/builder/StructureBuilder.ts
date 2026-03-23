/**
 * Structure Builder
 * Main class for building, validating, and processing structure configurations
 */

import { SchemaRegistry, User } from '../../core/index.js'
import type {
  TrokkyStructure,
  StructureItem,
  DocumentListItem,
  QueryFilter,
  ResolvedQuery,
  PermissionConfig,
  PermissionContext,
  PermissionResult,
  QueryContext
} from '../types/index.js'
import { TrokkyStructureSchema } from '../validation/schemas.js'
import { PermissionChecker } from '../utils/permission-checker.js'
import { QueryBuilder } from '../utils/query-builder.js'
import { NavigationTreeBuilder, CountService } from './navigation-tree-builder.js'
import { StructureMerger } from '../utils/structure-merger.js'
import { CacheKeyUtils } from '../utils/hash.js'

/**
 * Structure builder options
 */
export interface StructureBuilderOptions {
  /** Enable query optimization */
  enableOptimization?: boolean
  
  /** Enable caching */
  enableCaching?: boolean
  
  /** Default cache TTL (ms) */
  defaultCacheTTL?: number
  
  /** Maximum query complexity */
  maxQueryComplexity?: number
  
  /** Enable permission inheritance */
  enablePermissionInheritance?: boolean
  
  /** Count service for badge counting */
  countService?: CountService
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Validation success flag */
  isValid: boolean
  
  /** Validation errors */
  errors: ValidationError[]
  
  /** Validation warnings */
  warnings: ValidationWarning[]
  
  /** Performance suggestions */
  suggestions?: string[]
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error path */
  path: string
  
  /** Error message */
  message: string
  
  /** Error code */
  code: string
  
  /** Error context */
  context?: any
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning path */
  path: string
  
  /** Warning message */
  message: string
  
  /** Warning code */
  code: string
}

/**
 * Navigation tree
 */
export interface NavigationTree {
  /** Tree items */
  items: NavigationItem[]
  
  /** Tree metadata */
  metadata: {
    totalItems: number
    maxDepth: number
    permissions: PermissionSummary
  }
}

/**
 * Navigation item
 */
export interface NavigationItem {
  /** Item ID */
  id: string
  
  /** Display title */
  title: string
  
  /** Item type */
  type: string
  
  /** Icon */
  icon?: string
  
  /** Badge */
  badge?: BadgeInfo
  
  /** Child items */
  children?: NavigationItem[]
  
  /** Route/path */
  path?: string
  
  /** Permissions */
  permissions: PermissionSummary
  
  /** Metadata */
  metadata?: any
}

/**
 * Permission summary
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
 * Badge info
 */
export interface BadgeInfo {
  /** Badge text */
  text: string
  
  /** Badge color */
  color: string
  
  /** Badge count */
  count?: number
}

/**
 * Generation options
 */
export interface GenerationOptions {
  /** Group by field */
  groupBy?: 'category' | 'type' | 'none'
  
  /** Default views */
  defaultViews?: string[]
  
  /** Include workflow states */
  includeWorkflowStates?: boolean
  
  /** Exclude types */
  excludeTypes?: string[]
  
  /** Custom views for specific types */
  customViews?: Record<string, string[]>
  
  /** Auto-generate permissions */
  autoPermissions?: boolean
}

/**
 * Main StructureBuilder class
 */
export class StructureBuilder {
  private permissionChecker: PermissionChecker
  private queryBuilder: QueryBuilder
  private navigationBuilder: NavigationTreeBuilder
  private structureMerger: StructureMerger
  private cache = new Map<string, any>()

  constructor(
    private schemaRegistry: SchemaRegistry,
    private options: StructureBuilderOptions = {}
  ) {
    this.permissionChecker = new PermissionChecker({
      enableInheritance: options.enablePermissionInheritance
    })
    this.queryBuilder = new QueryBuilder({
      optimize: options.enableOptimization ?? true,
      cache: options.enableCaching ?? true,
      cacheTTL: options.defaultCacheTTL ?? 300000,
      maxComplexity: options.maxQueryComplexity ?? 1000
    })
    this.navigationBuilder = new NavigationTreeBuilder(this.permissionChecker, options.countService)
    this.structureMerger = new StructureMerger()
  }

  /**
   * Validate structure configuration
   */
  validate(structure: TrokkyStructure): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []
    const suggestions: string[] = []

    try {
      // Schema validation
      const schemaResult = TrokkyStructureSchema.safeParse(structure)
      if (!schemaResult.success) {
        schemaResult.error.errors.forEach(error => {
          errors.push({
            path: error.path.join('.'),
            message: error.message,
            code: 'SCHEMA_VALIDATION',
            context: error
          })
        })
      }

      // Semantic validation
      this.validateSemantics(structure, errors, warnings, suggestions)

      // Schema type validation
      this.validateSchemaTypes(structure, errors, warnings)

      // Permission validation
      this.validatePermissions(structure, errors, warnings)

      // Performance validation
      this.validatePerformance(structure, warnings, suggestions)

    } catch (error: any) {
      errors.push({
        path: 'root',
        message: `Validation failed: ${error.message}`,
        code: 'VALIDATION_ERROR',
        context: error
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }

  /**
   * Build navigation tree for Studio
   */
  async buildNavigation(structure: TrokkyStructure, user?: User): Promise<NavigationTree> {
    const cacheKey = CacheKeyUtils.navigationKey(structure.title, user?.id)
    
    if (this.options.enableCaching && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    const result = await this.navigationBuilder.build(structure, user)
    
    if (this.options.enableCaching) {
      this.cache.set(cacheKey, result)
      // Clear cache after TTL
      setTimeout(() => this.cache.delete(cacheKey), this.options.defaultCacheTTL ?? 300000)
    }

    return result
  }

  /**
   * Resolve queries for a structure item
   */
  async resolveQuery(item: DocumentListItem, context?: QueryContext): Promise<ResolvedQuery> {
    if (item.type !== 'documentList') {
      throw new Error('Query resolution only supported for documentList items')
    }

    return this.queryBuilder.buildQuery(item, context)
  }

  /**
   * Check permissions for current user
   */
  async checkPermissions(
    item: StructureItem,
    action: 'read' | 'create' | 'update' | 'delete',
    user?: User,
    context?: any
  ): Promise<boolean> {
    const permissionContext: PermissionContext = {
      action,
      item,
      data: context,
      request: {
        timestamp: new Date()
      }
    }

    const permissions = 'permissions' in item ? item.permissions : undefined
    return await this.permissionChecker.check(permissions, action, user, permissionContext)
  }

  /**
   * Merge multiple structure configurations
   */
  merge(...structures: TrokkyStructure[]): TrokkyStructure {
    return this.structureMerger.merge(...structures)
  }

  /**
   * Generate structure from schemas
   */
  generateFromSchemas(options: GenerationOptions = {}): TrokkyStructure {
    const schemas = this.schemaRegistry.getAllSchemas()
    const items: StructureItem[] = []

    // Filter schemas
    const filteredSchemas = schemas.filter(schema => 
      !options.excludeTypes?.includes(schema.name)
    )

    if (options.groupBy === 'category') {
      // Group by category
      const categories = this.groupSchemasByCategory(filteredSchemas)
      
      for (const [category, categorySchemas] of categories) {
        items.push({
          type: 'group',
          title: this.formatCategoryTitle(category),
          icon: this.getCategoryIcon(category),
          items: categorySchemas.map(schema => this.createDocumentListItem(schema, options))
        })
      }
    } else if (options.groupBy === 'type') {
      // Group by document type
      items.push({
        type: 'group',
        title: 'Content',
        icon: 'document-text',
        items: filteredSchemas.map(schema => this.createDocumentListItem(schema, options))
      })
    } else {
      // Flat structure
      items.push(...filteredSchemas.map(schema => this.createDocumentListItem(schema, options)))
    }

    return {
      title: 'Generated Structure',
      items,
      metadata: {
        version: '1.0.0',
        description: 'Auto-generated from schemas',
        author: 'Trokky Structure Builder'
      }
    }
  }

  /**
   * Optimize structure for performance
   */
  optimize(structure: TrokkyStructure): TrokkyStructure {
    const optimized = { ...structure }

    // Optimize queries
    optimized.items = this.optimizeItems(structure.items)

    return optimized
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }

  // Private methods

  private validateSemantics(
    structure: TrokkyStructure,
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: string[]
  ): void {
    // Check for duplicate IDs
    const ids = new Set<string>()
    this.collectIds(structure.items, ids, errors)

    // Check for empty groups
    this.checkEmptyGroups(structure.items, warnings)

    // Check for complex queries
    this.checkQueryComplexity(structure.items, warnings, suggestions)

    // Check for missing default views
    this.checkDefaultViews(structure.items, warnings)
  }

  private validateSchemaTypes(
    structure: TrokkyStructure,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const validateItem = (item: StructureItem, path: string) => {
      if (item.type === 'documentList' || item.type === 'singleton') {
        const schema = this.schemaRegistry.getSchema(item.schemaType)
        if (!schema) {
          errors.push({
            path: `${path}.schemaType`,
            message: `Schema type "${item.schemaType}" not found`,
            code: 'SCHEMA_NOT_FOUND',
            context: { schemaType: item.schemaType }
          })
        }
      }

      if (item.type === 'group') {
        item.items.forEach((child, index) => {
          validateItem(child, `${path}.items[${index}]`)
        })
      }
    }

    structure.items.forEach((item, index) => {
      validateItem(item, `items[${index}]`)
    })
  }

  private validatePermissions(
    structure: TrokkyStructure,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    // Validate permission rules format
    const validatePermissionConfig = (config: PermissionConfig | undefined, path: string) => {
      if (!config) return

      for (const [action, rule] of Object.entries(config)) {
        if (typeof rule === 'string') {
          // Check if role exists (if we have role validation)
          continue
        }
        
        if (Array.isArray(rule)) {
          // Check if all roles exist
          continue
        }

        if (typeof rule === 'object' && rule !== null && 'condition' in rule) {
          // Validate conditional permission
          continue
        }
      }
    }

    const validateItem = (item: StructureItem, path: string) => {
      const permissions = 'permissions' in item ? item.permissions : undefined
      validatePermissionConfig(permissions, `${path}.permissions`)

      if (item.type === 'group') {
        item.items.forEach((child, index) => {
          validateItem(child, `${path}.items[${index}]`)
        })
      }
    }

    validatePermissionConfig(structure.permissions, 'permissions')
    structure.items.forEach((item, index) => {
      validateItem(item, `items[${index}]`)
    })
  }

  private validatePerformance(
    structure: TrokkyStructure,
    warnings: ValidationWarning[],
    suggestions: string[]
  ): void {
    // Check for too many top-level items
    if (structure.items.length > 20) {
      warnings.push({
        path: 'items',
        message: 'Too many top-level items may impact navigation performance',
        code: 'PERFORMANCE_WARNING'
      })
      suggestions.push('Consider grouping related items together')
    }

    // Check for deep nesting
    const maxDepth = this.calculateMaxDepth(structure.items)
    if (maxDepth > 4) {
      warnings.push({
        path: 'items',
        message: 'Deep nesting may impact user experience',
        code: 'UX_WARNING'
      })
      suggestions.push('Consider flattening the structure')
    }
  }

  private collectIds(items: StructureItem[], ids: Set<string>, errors: ValidationError[]): void {
    items.forEach((item, index) => {
      const itemId = 'id' in item ? item.id : undefined
      if (itemId) {
        if (ids.has(itemId)) {
          errors.push({
            path: `items[${index}].id`,
            message: `Duplicate ID: "${itemId}"`,
            code: 'DUPLICATE_ID',
            context: { id: itemId }
          })
        } else {
          ids.add(itemId)
        }
      }

      if (item.type === 'group') {
        this.collectIds(item.items, ids, errors)
      }
    })
  }

  private checkEmptyGroups(items: StructureItem[], warnings: ValidationWarning[]): void {
    items.forEach((item, index) => {
      if (item.type === 'group' && item.items.length === 0) {
        warnings.push({
          path: `items[${index}]`,
          message: 'Empty group',
          code: 'EMPTY_GROUP'
        })
      }

      if (item.type === 'group') {
        this.checkEmptyGroups(item.items, warnings)
      }
    })
  }

  private checkQueryComplexity(
    items: StructureItem[],
    warnings: ValidationWarning[],
    suggestions: string[]
  ): void {
    items.forEach((item, index) => {
      if (item.type === 'documentList' && item.filter) {
        const complexity = this.queryBuilder.calculateComplexity(item.filter)
        if (complexity.score > 100) {
          warnings.push({
            path: `items[${index}].filter`,
            message: 'Complex query may impact performance',
            code: 'COMPLEX_QUERY'
          })
          suggestions.push(...complexity.recommendations)
        }
      }

      if (item.type === 'group') {
        this.checkQueryComplexity(item.items, warnings, suggestions)
      }
    })
  }

  private checkDefaultViews(items: StructureItem[], warnings: ValidationWarning[]): void {
    items.forEach((item, index) => {
      if (item.type === 'documentList' && item.views && item.views.length > 1) {
        const hasDefault = item.views.some(view => view.default)
        if (!hasDefault) {
          warnings.push({
            path: `items[${index}].views`,
            message: 'Multiple views without default specified',
            code: 'NO_DEFAULT_VIEW'
          })
        }
      }

      if (item.type === 'group') {
        this.checkDefaultViews(item.items, warnings)
      }
    })
  }

  private calculateMaxDepth(items: StructureItem[], currentDepth = 1): number {
    let maxDepth = currentDepth

    for (const item of items) {
      if (item.type === 'group') {
        const groupDepth = this.calculateMaxDepth(item.items, currentDepth + 1)
        maxDepth = Math.max(maxDepth, groupDepth)
      }
    }

    return maxDepth
  }

  private groupSchemasByCategory(schemas: any[]): Map<string, any[]> {
    const categories = new Map<string, any[]>()

    schemas.forEach(schema => {
      const category = schema.category || 'General'
      if (!categories.has(category)) {
        categories.set(category, [])
      }
      categories.get(category)!.push(schema)
    })

    return categories
  }

  private formatCategoryTitle(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1)
  }

  private getCategoryIcon(category: string): string {
    const iconMap: Record<string, string> = {
      content: 'document-text',
      media: 'photograph',
      users: 'users',
      settings: 'cog',
      general: 'folder'
    }

    return iconMap[category.toLowerCase()] || 'folder'
  }

  private createDocumentListItem(schema: any, options: GenerationOptions): DocumentListItem {
    const views = options.customViews?.[schema.name] || options.defaultViews || ['list']
    
    return {
      type: 'documentList',
      title: schema.title || schema.name,
      schemaType: schema.name,
      views: views.map(type => ({ type })),
      defaultView: views[0],
      badge: { count: true },
      permissions: options.autoPermissions ? {
        read: ['viewer', 'editor', 'admin'],
        create: ['editor', 'admin'],
        update: ['editor', 'admin'],
        delete: ['admin']
      } : undefined
    }
  }

  private optimizeItems(items: StructureItem[]): StructureItem[] {
    return items.map(item => {
      if (item.type === 'documentList') {
        // Optimize queries
        const optimizedItem = { ...item }
        if (item.filter) {
          optimizedItem.filter = this.queryBuilder.optimizeFilter(item.filter)
        }
        return optimizedItem
      }

      if (item.type === 'group') {
        return {
          ...item,
          items: this.optimizeItems(item.items)
        }
      }

      return item
    })
  }
}