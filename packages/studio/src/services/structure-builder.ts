/**
 * Structure Builder - Creates navigation structure from schemas
 */

import type { ApiClient } from './api-client'
import type { 
  StudioStructure, 
  StructureItem, 
  NavigationTree, 
  NavigationItem,
  StructureGenerationOptions 
} from '../types/structure'

export class StructureBuilder {
  constructor(private client: ApiClient) {}

  /**
   * Generate structure from available schemas
   */
  async generateFromSchemas(options: StructureGenerationOptions = {}): Promise<StudioStructure> {
    try {
      const response = await this.client.getSchemas()
      
      if (!response.success || !response.data) {
        throw new Error('Failed to fetch schemas')
      }
      
      const schemas = response.data
      
      const {
        includeSchemas,
        excludeSchemas = [],
        groupBy = 'none',
        defaultPageSize = 25
      } = options

      // Filter schemas
      let filteredSchemas = schemas
      if (includeSchemas) {
        filteredSchemas = schemas.filter((schema: any) => includeSchemas.includes(schema.name))
      }
      filteredSchemas = filteredSchemas.filter((schema: any) => !excludeSchemas.includes(schema.name))

      // Generate structure items
      const items: StructureItem[] = []

      if (groupBy === 'none') {
        // Simple flat list
        for (const schema of filteredSchemas) {
          items.push(this.createDocumentListItem(schema, defaultPageSize))
        }
      } else {
        // Group by category (basic implementation)
        const groups = this.groupSchemas(filteredSchemas, groupBy)
        
        for (const [groupName, groupSchemas] of Object.entries(groups)) {
          if (groupSchemas.length === 1) {
            // Single item, don't group
            items.push(this.createDocumentListItem(groupSchemas[0], defaultPageSize))
          } else {
            // Create group
            items.push({
              type: 'group',
              title: this.formatGroupTitle(groupName),
              icon: this.getGroupIcon(groupName),
              items: groupSchemas.map(schema => 
                this.createDocumentListItem(schema, defaultPageSize)
              ),
              collapsible: true,
              defaultCollapsed: false
            })
          }
        }
      }

      return {
        title: 'Content Management',
        items,
        metadata: {
          version: '1.0.0',
          description: 'Auto-generated structure from schemas'
        }
      }
    } catch (error) {
      console.error('Failed to generate structure from schemas:', error)
      return this.getFallbackStructure()
    }
  }

  /**
   * Build navigation tree from structure
   */
  buildNavigation(structure: StudioStructure, currentPath?: string): NavigationTree {
    const items: NavigationItem[] = []
    let totalItems = 0
    let maxDepth = 0

    const buildItem = (item: StructureItem, depth = 0): NavigationItem | null => {
      maxDepth = Math.max(maxDepth, depth)
      totalItems++

      switch (item.type) {
        case 'documentList':
          return {
            id: item.id || `list-${item.schemaType}`,
            title: item.title,
            type: 'documentList',
            icon: item.icon || 'document-text',
            path: `/content/${item.schemaType}`,
            active: currentPath === `/content/${item.schemaType}`,
            metadata: { schemaType: item.schemaType, filter: item.filter }
          }

        case 'singleton':
          const documentId = item.documentId || 'singleton'
          return {
            id: item.id || `singleton-${item.schemaType}`,
            title: item.title,
            type: 'singleton',
            icon: item.icon || 'cog',
            path: `/content/${item.schemaType}/${documentId}`,
            active: currentPath === `/content/${item.schemaType}/${documentId}`,
            metadata: { schemaType: item.schemaType, documentId }
          }

        case 'group':
          const children: NavigationItem[] = []
          for (const childItem of item.items) {
            const child = buildItem(childItem, depth + 1)
            if (child) children.push(child)
          }

          return {
            id: item.id || `group-${item.title.toLowerCase().replace(/\s+/g, '-')}`,
            title: item.title,
            type: 'group',
            icon: item.icon || 'folder',
            children,
            metadata: { 
              collapsible: item.collapsible,
              defaultCollapsed: item.defaultCollapsed 
            }
          }

        case 'divider':
          return {
            id: `divider-${totalItems}`,
            title: item.title || '',
            type: 'divider'
          }

        default:
          return null
      }
    }

    for (const item of structure.items) {
      const navItem = buildItem(item)
      if (navItem) items.push(navItem)
    }

    return {
      items,
      metadata: {
        totalItems,
        maxDepth
      }
    }
  }

  /**
   * Validate structure configuration
   */
  validate(structure: StudioStructure): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!structure.title) {
      errors.push('Structure title is required')
    }

    if (!Array.isArray(structure.items)) {
      errors.push('Structure items must be an array')
    } else {
      structure.items.forEach((item, index) => {
        this.validateItem(item, `items[${index}]`, errors)
      })
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private validateItem(item: StructureItem, path: string, errors: string[]): void {
    if (!item.type) {
      errors.push(`${path}: Item type is required`)
      return
    }

    switch (item.type) {
      case 'documentList':
      case 'singleton':
        if (!item.title) {
          errors.push(`${path}: Title is required`)
        }
        if (!item.schemaType) {
          errors.push(`${path}: Schema type is required`)
        }
        break

      case 'group':
        if (!item.title) {
          errors.push(`${path}: Group title is required`)
        }
        if (!Array.isArray(item.items)) {
          errors.push(`${path}: Group items must be an array`)
        } else {
          item.items.forEach((childItem, index) => {
            this.validateItem(childItem, `${path}.items[${index}]`, errors)
          })
        }
        break

      case 'divider':
        // Dividers are always valid
        break

      default:
        errors.push(`${path}: Unknown item type "${(item as any).type}"`)
    }
  }

  private createDocumentListItem(schema: any, defaultPageSize: number): StructureItem {
    return {
      type: 'documentList',
      title: this.formatSchemaTitle(schema.name),
      schemaType: schema.name,
      icon: this.getSchemaIcon(schema),
      defaultOrdering: [
        { field: 'updatedAt', direction: 'desc' }
      ],
      options: {
        pageSize: defaultPageSize,
        searchable: true,
        searchFields: this.getSearchableFields(schema)
      }
    }
  }

  private groupSchemas(schemas: any[], groupBy: string): Record<string, any[]> {
    const groups: Record<string, any[]> = {}

    for (const schema of schemas) {
      let groupKey = 'Content'

      if (groupBy === 'type') {
        // Group by singleton vs collection
        groupKey = schema.singleton ? 'Settings' : 'Content'
      } else if (groupBy === 'category') {
        // Group by schema category (if available)
        groupKey = schema.category || 'Content'
      }

      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(schema)
    }

    return groups
  }

  private formatSchemaTitle(schemaName: string): string {
    // Convert camelCase/PascalCase to Title Case
    return schemaName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  }

  private formatGroupTitle(groupName: string): string {
    return groupName.charAt(0).toUpperCase() + groupName.slice(1)
  }

  private getSchemaIcon(schema: any): string {
    // Basic icon mapping based on schema name
    const name = schema.name.toLowerCase()
    
    if (name.includes('post') || name.includes('article')) return 'document-text'
    if (name.includes('page')) return 'document'
    if (name.includes('user') || name.includes('author')) return 'user'
    if (name.includes('category') || name.includes('tag')) return 'tag'
    if (name.includes('media') || name.includes('image')) return 'photo'
    if (name.includes('setting') || name.includes('config')) return 'cog'
    if (name.includes('menu') || name.includes('navigation')) return 'menu'
    
    return 'document-text'
  }

  private getGroupIcon(groupName: string): string {
    const name = groupName.toLowerCase()
    
    if (name.includes('content')) return 'document-text'
    if (name.includes('setting')) return 'cog'
    if (name.includes('user') || name.includes('people')) return 'users'
    if (name.includes('media')) return 'photo'
    
    return 'folder'
  }

  private getSearchableFields(schema: any): string[] {
    // Basic searchable fields detection
    const searchableFields = ['title', 'name', 'slug']
    
    if (schema.fields) {
      const fieldNames = Object.keys(schema.fields)
      return fieldNames.filter(name => 
        searchableFields.some(searchable => name.toLowerCase().includes(searchable))
      )
    }
    
    return ['title']
  }

  private getFallbackStructure(): StudioStructure {
    return {
      title: 'Content Management',
      items: [
        {
          type: 'documentList',
          title: 'Posts',
          schemaType: 'post',
          icon: 'document-text',
          defaultOrdering: [{ field: 'updatedAt', direction: 'desc' }],
          options: { pageSize: 25, searchable: true, searchFields: ['title'] }
        },
        {
          type: 'documentList',
          title: 'Authors',
          schemaType: 'author',
          icon: 'user',
          defaultOrdering: [{ field: 'name', direction: 'asc' }],
          options: { pageSize: 25, searchable: true, searchFields: ['name'] }
        },
        {
          type: 'singleton',
          title: 'Settings',
          schemaType: 'settings',
          documentId: 'site-settings',
          icon: 'cog',
          options: { autoCreate: true }
        }
      ],
      metadata: {
        version: '1.0.0',
        description: 'Fallback structure'
      }
    }
  }
}