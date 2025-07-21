/**
 * Core Structure Types
 * Defines the main interfaces for Trokky Structure system
 */

import type { QueryFilter, OrderClause } from './filters'
import type { ViewConfig } from './views'
import type { PermissionConfig } from './permissions'

/**
 * Main structure configuration that defines Studio navigation and organization
 */
export interface TrokkyStructure {
  /** Display title for the Studio */
  title: string
  
  /** Navigation items */
  items: StructureItem[]
  
  /** Global theme configuration */
  theme?: ThemeConfig
  
  /** Global permissions */
  permissions?: PermissionConfig
  
  /** Plugin configurations */
  plugins?: PluginConfig[]
  
  /** Custom CSS/styling */
  customStyles?: string
  
  /** Structure metadata */
  metadata?: {
    version?: string
    description?: string
    author?: string
    tags?: string[]
  }
}

/**
 * Union type of all possible structure items
 */
export type StructureItem = 
  | DocumentListItem 
  | SingletonItem 
  | GroupItem 
  | DividerItem 
  | CustomViewItem

/**
 * Base interface for all structure items
 */
export interface BaseStructureItem {
  /** Unique identifier for the item */
  id?: string
  
  /** Display title */
  title: string
  
  /** Icon identifier */
  icon?: string
  
  /** Custom permissions */
  permissions?: PermissionConfig
  
  /** Custom metadata */
  metadata?: Record<string, any>
}

/**
 * Document list item - displays a collection of documents
 */
export interface DocumentListItem extends BaseStructureItem {
  type: 'documentList'
  
  /** Schema type to display */
  schemaType: string
  
  /** Optional filter query */
  filter?: QueryFilter
  
  /** Default sorting */
  defaultOrdering?: OrderClause[]
  
  /** Available view types */
  views?: ViewConfig[]
  
  /** Default view */
  defaultView?: string
  
  /** Badge configuration */
  badge?: BadgeConfig
  
  /** Bulk operations */
  bulkActions?: BulkActionConfig[]
  
  /** Custom list options */
  options?: {
    /** Items per page */
    pageSize?: number
    
    /** Enable search */
    searchable?: boolean
    
    /** Searchable fields */
    searchFields?: string[]
    
    /** Enable filtering */
    filterable?: boolean
    
    /** Available filters */
    filters?: FilterConfig[]
    
    /** Enable sorting */
    sortable?: boolean
    
    /** Available sort fields */
    sortFields?: string[]
    
    /** Auto-refresh interval (ms) */
    refreshInterval?: number
  }
}

/**
 * Singleton item - single document (settings, config, etc.)
 */
export interface SingletonItem extends BaseStructureItem {
  type: 'singleton'
  
  /** Schema type */
  schemaType: string
  
  /** Fixed document ID (optional) */
  documentId?: string
  
  /** Custom form layout */
  layout?: FormLayoutConfig
  
  /** Singleton options */
  options?: {
    /** Auto-create if missing */
    autoCreate?: boolean
    
    /** Custom form fields */
    customFields?: CustomFieldConfig[]
    
    /** Form validation rules */
    validation?: ValidationConfig
  }
}

/**
 * Group item - organizational folder
 */
export interface GroupItem extends BaseStructureItem {
  type: 'group'
  
  /** Child items */
  items: StructureItem[]
  
  /** Collapsible state */
  collapsible?: boolean
  
  /** Default collapsed state */
  defaultCollapsed?: boolean
  
  /** Group options */
  options?: {
    /** Layout style */
    layout?: 'vertical' | 'horizontal' | 'grid'
    
    /** Maximum items to show before "show more" */
    maxItems?: number
    
    /** Custom ordering */
    ordering?: 'manual' | 'alphabetical' | 'type'
  }
}

/**
 * Divider item - visual separator
 */
export interface DividerItem {
  type: 'divider'
  
  /** Optional title for labeled divider */
  title?: string
  
  /** Divider style */
  style?: 'line' | 'space' | 'label'
}

/**
 * Custom view item - plugin-defined views
 */
export interface CustomViewItem extends BaseStructureItem {
  type: 'customView'
  
  /** View component name */
  viewType: string
  
  /** View configuration */
  config: Record<string, any>
  
  /** Data source configuration */
  dataSource?: {
    /** Schema types to include */
    schemaTypes?: string[]
    
    /** Custom query */
    query?: QueryFilter
    
    /** Refresh strategy */
    refresh?: 'manual' | 'auto' | 'realtime'
  }
}

/**
 * Badge configuration
 */
export interface BadgeConfig {
  /** Show count of items */
  count?: boolean
  
  /** Badge color */
  color?: 'gray' | 'red' | 'yellow' | 'green' | 'blue' | 'indigo' | 'purple' | 'pink'
  
  /** Custom badge text */
  text?: string
  
  /** Field to use for badge value */
  field?: string
  
  /** Badge position */
  position?: 'inline' | 'corner'
  
  /** Custom badge logic */
  custom?: (items: any[]) => { text: string; color: string } | null
}

/**
 * Bulk action configuration
 */
export interface BulkActionConfig {
  /** Action identifier */
  action: string
  
  /** Display title */
  title: string
  
  /** Action icon */
  icon?: string
  
  /** Confirmation message */
  confirm?: string
  
  /** Action permissions */
  permissions?: PermissionConfig
  
  /** Action handler */
  handler?: (items: any[], context: any) => Promise<void>
}

/**
 * Filter configuration for lists
 */
export interface FilterConfig {
  /** Filter identifier */
  id: string
  
  /** Display label */
  label: string
  
  /** Field to filter */
  field: string
  
  /** Filter type */
  type: 'text' | 'select' | 'date' | 'number' | 'boolean' | 'range'
  
  /** Filter options */
  options?: {
    /** Available values (for select) */
    values?: Array<{ label: string; value: any }>
    
    /** Placeholder text */
    placeholder?: string
    
    /** Default value */
    defaultValue?: any
    
    /** Multiple selection */
    multiple?: boolean
  }
}

/**
 * Theme configuration
 */
export interface ThemeConfig {
  /** Primary color */
  primaryColor?: string
  
  /** Secondary color */
  secondaryColor?: string
  
  /** Accent color */
  accentColor?: string
  
  /** Background colors */
  background?: {
    primary?: string
    secondary?: string
    tertiary?: string
  }
  
  /** Text colors */
  text?: {
    primary?: string
    secondary?: string
    muted?: string
  }
  
  /** Border radius */
  borderRadius?: {
    small?: string
    medium?: string
    large?: string
  }
  
  /** Typography */
  typography?: {
    fontFamily?: string
    headingFontFamily?: string
    fontSize?: {
      small?: string
      medium?: string
      large?: string
    }
  }
  
  /** Spacing scale */
  spacing?: {
    small?: string
    medium?: string
    large?: string
  }
  
  /** Shadows */
  shadows?: {
    small?: string
    medium?: string
    large?: string
  }
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  /** Plugin name */
  name: string
  
  /** Plugin options */
  options?: Record<string, any>
  
  /** Plugin enabled state */
  enabled?: boolean
}

/**
 * Form layout configuration for singletons
 */
export interface FormLayoutConfig {
  /** Layout type */
  type: 'default' | 'tabs' | 'accordion' | 'wizard'
  
  /** Layout sections */
  sections?: FormSectionConfig[]
  
  /** Custom layout options */
  options?: Record<string, any>
}

/**
 * Form section configuration
 */
export interface FormSectionConfig {
  /** Section title */
  title: string
  
  /** Fields in this section */
  fields: string[]
  
  /** Section collapsible */
  collapsible?: boolean
  
  /** Section default collapsed state */
  defaultCollapsed?: boolean
}

/**
 * Custom field configuration
 */
export interface CustomFieldConfig {
  /** Field name */
  name: string
  
  /** Custom component */
  component: string
  
  /** Component props */
  props?: Record<string, any>
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  /** Required fields */
  required?: string[]
  
  /** Custom validation rules */
  rules?: Record<string, ValidationRule>
}

/**
 * Validation rule
 */
export interface ValidationRule {
  /** Rule type */
  type: 'regex' | 'custom' | 'length' | 'range'
  
  /** Rule value */
  value: any
  
  /** Error message */
  message: string
}