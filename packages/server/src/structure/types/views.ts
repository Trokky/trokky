/**
 * View Types
 * Configurations for different view types in the Studio
 */

import type { PermissionConfig } from './permissions.js'

/**
 * Base view configuration
 */
export interface ViewConfig {
  /** View type identifier */
  type: 'list' | 'grid' | 'calendar' | 'kanban' | 'map' | string
  
  /** Display title */
  title?: string
  
  /** Default view flag */
  default?: boolean
  
  /** View-specific options */
  options?: Record<string, any>
  
  /** View permissions */
  permissions?: PermissionConfig
}

/**
 * List view configuration
 */
export interface ListViewConfig extends ViewConfig {
  type: 'list'
  options?: {
    /** Column configuration */
    columns?: ColumnConfig[]
    
    /** Default page size */
    pageSize?: number
    
    /** Enable sorting */
    sortable?: boolean
    
    /** Enable filtering */
    filterable?: boolean
    
    /** Row selection */
    selectable?: boolean | 'single' | 'multiple'
    
    /** Row actions */
    rowActions?: ActionConfig[]
    
    /** Compact/comfortable density */
    density?: 'compact' | 'comfortable' | 'spacious'
    
    /** Show row numbers */
    showRowNumbers?: boolean
    
    /** Sticky header */
    stickyHeader?: boolean
  }
}

/**
 * Grid view configuration
 */
export interface GridViewConfig extends ViewConfig {
  type: 'grid'
  options?: {
    /** Card size */
    cardSize?: 'small' | 'medium' | 'large' | 'auto'
    
    /** Image field for thumbnails */
    imageField?: string
    
    /** Title field */
    titleField?: string
    
    /** Subtitle field */
    subtitleField?: string
    
    /** Cards per row */
    columnsPerRow?: number | 'auto'
    
    /** Card layout */
    cardLayout?: 'vertical' | 'horizontal'
    
    /** Aspect ratio for images */
    aspectRatio?: number | 'auto'
    
    /** Enable card hover effects */
    hoverEffects?: boolean
    
    /** Card actions */
    cardActions?: ActionConfig[]
  }
}

/**
 * Calendar view configuration
 */
export interface CalendarViewConfig extends ViewConfig {
  type: 'calendar'
  options?: {
    /** Date field (required) */
    dateField: string
    
    /** End date field for ranges */
    endDateField?: string
    
    /** Title field */
    titleField?: string
    
    /** Color field */
    colorField?: string
    
    /** Available calendar views */
    views?: ('month' | 'week' | 'day' | 'agenda')[]
    
    /** Default calendar view */
    defaultView?: 'month' | 'week' | 'day' | 'agenda'
    
    /** Time slot configuration */
    timeSlots?: {
      start?: string // "09:00"
      end?: string   // "17:00"
      step?: number  // minutes
    }
    
    /** Event click behavior */
    eventClick?: 'edit' | 'view' | 'custom'
    
    /** Allow event creation */
    allowCreate?: boolean
    
    /** Allow event dragging */
    allowDrag?: boolean
  }
}

/**
 * Kanban view configuration
 */
export interface KanbanViewConfig extends ViewConfig {
  type: 'kanban'
  options?: {
    /** Field to group by (required) */
    groupBy: string
    
    /** Title field */
    titleField?: string
    
    /** Subtitle field */
    subtitleField?: string
    
    /** Assignee field */
    assigneeField?: string
    
    /** Priority field */
    priorityField?: string
    
    /** Card color field */
    colorField?: string
    
    /** Enable drag and drop */
    dragAndDrop?: boolean
    
    /** Column configuration */
    columns?: KanbanColumnConfig[]
    
    /** Card template */
    cardTemplate?: 'default' | 'compact' | 'detailed'
    
    /** Show column counts */
    showColumnCounts?: boolean
    
    /** Allow column creation */
    allowColumnCreate?: boolean
  }
}

/**
 * Map view configuration
 */
export interface MapViewConfig extends ViewConfig {
  type: 'map'
  options?: {
    /** Location field (required) */
    locationField: string
    
    /** Title field */
    titleField?: string
    
    /** Description field */
    descriptionField?: string
    
    /** Map provider */
    provider?: 'google' | 'mapbox' | 'openstreet'
    
    /** Default zoom level */
    defaultZoom?: number
    
    /** Default center */
    defaultCenter?: {
      lat: number
      lng: number
    }
    
    /** Marker clustering */
    clustering?: boolean
    
    /** Custom marker icon */
    markerIcon?: string
    
    /** Popup template */
    popupTemplate?: 'default' | 'minimal' | 'detailed'
  }
}

/**
 * Column configuration for list view
 */
export interface ColumnConfig {
  /** Field name */
  field: string
  
  /** Column title */
  title: string
  
  /** Column width */
  width?: number | string
  
  /** Is sortable */
  sortable?: boolean
  
  /** Is filterable */
  filterable?: boolean
  
  /** Column alignment */
  align?: 'left' | 'center' | 'right'
  
  /** Data type for formatting */
  dataType?: 'string' | 'number' | 'date' | 'boolean' | 'image' | 'link'
  
  /** Custom formatter function */
  formatter?: (value: any, row: any) => string
  
  /** Custom component for rendering */
  component?: string
  
  /** Column visibility */
  visible?: boolean
  
  /** Sticky column */
  sticky?: 'left' | 'right'
}

/**
 * Action configuration
 */
export interface ActionConfig {
  /** Action identifier */
  id: string
  
  /** Action title */
  title: string
  
  /** Action icon */
  icon?: string
  
  /** Action type */
  type?: 'button' | 'link' | 'dropdown'
  
  /** Action handler */
  handler?: (item: any, context: any) => void | Promise<void>
  
  /** Action permissions */
  permissions?: PermissionConfig
  
  /** Confirmation required */
  confirm?: boolean
  
  /** Confirmation message */
  confirmMessage?: string
  
  /** Action style */
  style?: 'default' | 'primary' | 'secondary' | 'danger'
  
  /** Show in context menu */
  contextMenu?: boolean
}

/**
 * Kanban column configuration
 */
export interface KanbanColumnConfig {
  /** Column ID (matches field value) */
  id: string
  
  /** Column title */
  title: string
  
  /** Column color */
  color?: string
  
  /** Column limit */
  limit?: number
  
  /** Column order */
  order?: number
  
  /** Column collapsed state */
  collapsed?: boolean
  
  /** Column actions */
  actions?: ActionConfig[]
}

/**
 * View plugin interface
 */
export interface ViewPlugin {
  /** Plugin name */
  name: string
  
  /** View component */
  component: any
  
  /** Configuration schema */
  config: Record<string, any>
  
  /** Validation function */
  validate?: (options: any) => boolean | string
  
  /** Plugin metadata */
  metadata?: {
    title: string
    description: string
    author: string
    version: string
  }
}

/**
 * Bulk action plugin interface
 */
export interface BulkActionPlugin {
  /** Plugin name */
  name: string
  
  /** Action title */
  title: string
  
  /** Action icon */
  icon?: string
  
  /** Action handler */
  handler: (items: any[], context: any) => Promise<void>
  
  /** Required permissions */
  permissions?: string | string[]
  
  /** Confirmation required */
  confirm?: boolean
  
  /** Plugin metadata */
  metadata?: {
    description: string
    author: string
    version: string
  }
}