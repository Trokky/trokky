/**
 * Enhanced Structure Types for Studio with Context Sidebar Support
 * Lightweight implementation with callback-based context sidebar content
 */

import { ReactNode } from 'react'

export interface StudioStructure {
  /** Display title for the Studio */
  title: string
  
  /** Navigation items */
  items: StructureItem[]
  
  /** Global context sidebar configuration */
  contextSidebar?: GlobalContextSidebarConfig
  
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
  | LinkItem

export interface BaseStructureItem {
  /** Unique identifier for the item */
  id?: string
  
  /** Display title */
  title: string
  
  /** Icon identifier (heroicons name) */
  icon?: string
  
  /** Context sidebar configuration for this item */
  contextSidebar?: ContextSidebarConfig
  
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

export interface LinkItem extends BaseStructureItem {
  type: 'link'
  
  /** Link href */
  href: string
  
  /** Open in new tab */
  target?: '_blank' | '_self'
}

/**
 * Context Sidebar Configuration
 */
export interface ContextSidebarConfig {
  /** Enable/disable context sidebar for this context */
  enabled?: boolean
  
  /** Sidebar title */
  title?: string
  
  /** Sidebar position */
  position?: 'left' | 'right'
  
  /** Default visibility */
  defaultVisible?: boolean
  
  /** Default width */
  width?: number
  
  /** Content definition approaches (choose one) */
  content?: ContextSidebarContent
}

export interface GlobalContextSidebarConfig {
  /** Global enable/disable */
  enabled?: boolean
  
  /** Default position for all sidebars */
  defaultPosition?: 'left' | 'right'
  
  /** Default width */
  defaultWidth?: number
  
  /** Per-context overrides */
  contexts?: {
    /** Collection index pages */
    collectionIndex?: ContextSidebarConfig
    
    /** Document editor pages */
    documentEditor?: ContextSidebarConfig
    
    /** Dashboard */
    dashboard?: ContextSidebarConfig
    
    /** Media browser */
    media?: ContextSidebarConfig
    
    /** User management */
    users?: ContextSidebarConfig
    
    /** Settings */
    settings?: ContextSidebarConfig
  }
}

/**
 * Context Sidebar Content Definition
 */
export type ContextSidebarContent = 
  | CallbackContent
  | ComponentContent
  | WidgetContent  // Keep for backward compatibility

export interface CallbackContent {
  type: 'callback'
  
  /** Function that returns React content */
  render: (context: ContextSidebarRenderContext) => ReactNode
}

export interface ComponentContent {
  type: 'component'
  
  /** Component to render */
  component: React.ComponentType<ContextSidebarComponentProps>
  
  /** Props to pass to component */
  props?: Record<string, any>
}

export interface WidgetContent {
  type: 'widgets'
  
  /** Widget configurations */
  widgets: ContextSidebarWidget[]
}

/**
 * Context provided to sidebar content - comprehensive access to Studio state
 */
export interface ContextSidebarRenderContext {
  /** Current route/page context */
  context: {
    type: 'collectionIndex' | 'documentEditor' | 'dashboard' | 'media' | 'users' | 'settings' | 'schema'
    schemaType?: string
    documentId?: string
    isEditing?: boolean
    isCreating?: boolean
    isNewDocument?: boolean
    isSingleton?: boolean
  }
  
  /** Current structure item */
  structureItem?: StructureItem
  
  /** Current document (if in document editor) */
  document?: {
    id: string
    _collection: string
    _createdAt: Date
    _updatedAt: Date
    _revision: number
    _status: string
    [key: string]: any
  }
  
  /** Collection/Schema information */
  collection?: {
    name: string
    title?: string
    type: 'document' | 'singleton'
    schema: any
    totalDocuments?: number
    recentDocuments?: any[]
  }
  
  /** Current user */
  user?: {
    id: string
    username: string
    email: string
    role: string
    permissions: string[]
    preferences?: Record<string, any>
  }
  
  /** Permission system */
  permissions: {
    /** Check if user has permission for a schema */
    hasSchemaPermission: (schemaName: string, action: 'read' | 'write' | 'delete') => boolean
    
    /** Check if user has global permission */
    hasGlobalPermission: (permission: string) => boolean
    
    /** Check if user has role */
    hasRole: (role: string) => boolean
    
    /** Get all permissions for current user */
    getUserPermissions: () => string[]
  }
  
  /** Studio context and utilities */
  studio: {
    /** Studio configuration */
    config: any
    
    /** Current theme */
    theme: 'light' | 'dark' | 'auto'
    
    /** Studio settings */
    settings: Record<string, any>
    
    /** All available schemas */
    schemas: Record<string, any>
    
    /** Structure configuration */
    structure: StudioStructure
  }
  
  /** Data access utilities */
  data: {
    /** Get documents from a collection */
    getDocuments: (schemaType: string, options?: {
      limit?: number
      offset?: number
      filter?: Record<string, any>
      sort?: string
    }) => Promise<any[]>
    
    /** Get a single document */
    getDocument: (schemaType: string, documentId: string) => Promise<any>
    
    /** Get document count */
    getDocumentCount: (schemaType: string, filter?: Record<string, any>) => Promise<number>
    
    /** Get recent documents */
    getRecentDocuments: (schemaType?: string, limit?: number) => Promise<any[]>
    
    /** Search documents */
    searchDocuments: (query: string, schemaTypes?: string[]) => Promise<any[]>
    
    /** Get user statistics */
    getUserStats: () => Promise<{
      totalUsers: number
      activeUsers: number
      recentLogins: any[]
    }>
    
    /** Get system statistics */
    getSystemStats: () => Promise<{
      totalDocuments: number
      totalMedia: number
      storageUsed: number
      lastBackup?: Date
    }>
  }
  
  /** UI utilities */
  ui: {
    /** Navigate to a route */
    navigate: (path: string) => void
    
    /** Show toast message */
    showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void
    
    /** Show confirmation dialog */
    showConfirm: (message: string, title?: string) => Promise<boolean>
    
    /** Refresh current page/data */
    refresh: () => void
    
    /** Toggle context sidebar */
    toggleSidebar: () => void
    
    /** Set sidebar content dynamically */
    setSidebarContent: (content: ReactNode) => void
  }
  
  /** API client for custom requests */
  api: {
    /** Raw API client */
    client: any
    
    /** Make authenticated request */
    request: (method: string, path: string, data?: any) => Promise<any>
    
    /** Upload file */
    uploadFile: (file: File, options?: { 
      onProgress?: (progress: number) => void 
    }) => Promise<any>
    
    /** Download file */
    downloadFile: (mediaId: string) => Promise<Blob>
  }
  
  /** Real-time utilities */
  realtime?: {
    /** Subscribe to document changes */
    subscribeToDocument: (schemaType: string, documentId: string, callback: (document: any) => void) => () => void
    
    /** Subscribe to collection changes */
    subscribeToCollection: (schemaType: string, callback: (documents: any[]) => void) => () => void
    
    /** Broadcast event */
    broadcast: (event: string, data: any) => void
    
    /** Listen to events */
    listen: (event: string, callback: (data: any) => void) => () => void
  }
  
  /** Utility functions */
  utils: {
    /** Format date */
    formatDate: (date: Date | string, format?: string) => string
    
    /** Format relative time */
    formatRelativeTime: (date: Date | string) => string
    
    /** Format file size */
    formatFileSize: (bytes: number) => string
    
    /** Generate slug */
    generateSlug: (text: string) => string
    
    /** Validate email */
    isValidEmail: (email: string) => boolean
    
    /** Debounce function */
    debounce: <T extends (...args: any[]) => any>(func: T, delay: number) => T
    
    /** Copy to clipboard */
    copyToClipboard: (text: string) => Promise<boolean>
    
    /** Download as JSON */
    downloadJSON: (data: any, filename: string) => void
  }
}

export interface ContextSidebarComponentProps {
  /** Render context */
  context: ContextSidebarRenderContext
  
  /** Additional props from structure */
  [key: string]: any
}

/**
 * Widget system (for backward compatibility)
 */
export interface ContextSidebarWidget {
  type: string
  title?: string
  props?: Record<string, any>
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
  
  /** Context sidebar config */
  contextSidebar?: ContextSidebarConfig
  
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
  
  /** Context sidebar preferences */
  contextSidebar?: {
    /** Global enable/disable */
    enabled?: boolean
    
    /** Default position */
    defaultPosition?: 'left' | 'right'
  }
}