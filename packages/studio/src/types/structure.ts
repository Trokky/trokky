/**
 * Basic Structure Types for Studio
 * Lightweight implementation inspired by @trokky/structure spec
 */

export interface StudioStructure {
  /** Display title for the Studio */
  title: string
  
  /** Navigation items */
  items: StructureItem[]
  
  /** Structure metadata */
  metadata?: {
    version?: string
    description?: string
  }
}

export type StructureItem = 
  | DocumentListItem 
  | SingletonItem 
  | GroupItem 
  | DividerItem

export interface BaseStructureItem {
  /** Unique identifier for the item */
  id?: string
  
  /** Display title */
  title: string
  
  /** Icon identifier (heroicons name) */
  icon?: string
  
  /** Custom metadata */
  metadata?: Record<string, any>
}

export interface DocumentListItem extends BaseStructureItem {
  type: 'documentList'
  
  /** Schema type to display */
  schemaType: string
  
  /** Optional filter query (basic for now) */
  filter?: Record<string, any>
  
  /** Default sorting */
  defaultOrdering?: {
    field: string
    direction: 'asc' | 'desc'
  }[]
  
  /** Options */
  options?: {
    /** Items per page */
    pageSize?: number
    
    /** Enable search */
    searchable?: boolean
    
    /** Searchable fields */
    searchFields?: string[]
  }
}

export interface SingletonItem extends BaseStructureItem {
  type: 'singleton'
  
  /** Schema type */
  schemaType: string
  
  /** Fixed document ID (optional) */
  documentId?: string
  
  /** Singleton options */
  options?: {
    /** Auto-create if missing */
    autoCreate?: boolean
  }
}

export interface GroupItem extends BaseStructureItem {
  type: 'group'
  
  /** Child items */
  items: StructureItem[]
  
  /** Collapsible state */
  collapsible?: boolean
  
  /** Default collapsed state */
  defaultCollapsed?: boolean
}

export interface DividerItem {
  type: 'divider'
  
  /** Optional title for labeled divider */
  title?: string
}

/**
 * Navigation Tree (resolved structure for UI)
 */
export interface NavigationTree {
  /** Tree items */
  items: NavigationItem[]
  
  /** Tree metadata */
  metadata: {
    totalItems: number
    maxDepth: number
  }
}

export interface NavigationItem {
  /** Item ID */
  id: string
  
  /** Display title */
  title: string
  
  /** Item type */
  type: string
  
  /** Icon */
  icon?: string
  
  /** Child items */
  children?: NavigationItem[]
  
  /** Route/path */
  path?: string
  
  /** Metadata */
  metadata?: any
  
  /** Whether this item is currently active */
  active?: boolean
}

/**
 * Default structure generation options
 */
export interface StructureGenerationOptions {
  /** Include all schemas or filter */
  includeSchemas?: string[]
  
  /** Exclude specific schemas */
  excludeSchemas?: string[]
  
  /** Group schemas by category */
  groupBy?: 'type' | 'category' | 'none'
  
  /** Default page size for lists */
  defaultPageSize?: number
}