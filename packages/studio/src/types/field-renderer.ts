/**
 * Field Renderer Types - Architecture for connecting @trokky/fields-core to React components
 */

// Field renderer types for Studio

/**
 * Props passed to field renderer components
 */
export interface FieldRendererProps<TValue = any, TConfig = any> {
  /** Current field value */
  value: TValue
  
  /** Field configuration from schema */
  config: TConfig
  
  /** Field metadata from schema */
  field: {
    name: string
    title?: string
    description?: string
    required?: boolean
    type: string
  }
  
  /** Field validation state */
  validation?: {
    isValid: boolean
    errors: string[]
    warnings: string[]
  }
  
  /** Field interaction state */
  state: {
    focused: boolean
    touched: boolean
    dirty: boolean
    disabled: boolean
    readOnly: boolean
  }
  
  /** Event handlers */
  onChange: (value: TValue | null) => void
  onBlur: () => void
  onFocus: () => void
  
  /** Additional context 
   * @todo Extend context with proper FieldContext type from @trokky/core
   * @todo Add document state, validation state, and API client access
   */
  context?: {
    document?: any
    schema?: any
    path?: string
  }
}

/**
 * Field renderer component type
 */
export type FieldRenderer<TValue = any, TConfig = any> = React.ComponentType<
  FieldRendererProps<TValue, TConfig>
>

/**
 * Field renderer registration entry
 */
export interface FieldRendererEntry {
  /** Field type name this renderer handles */
  type: string
  
  /** React component for rendering the field */
  component: FieldRenderer
  
  /** Preview component for read-only display (optional) */
  preview?: FieldRenderer
  
  /** Metadata */
  meta: {
    /** Display name for this field type */
    displayName: string
    
    /** Description of what this field type does */
    description: string
    
    /** Icon identifier for UI */
    icon: string
    
    /** Category for grouping in UI */
    category: 'text' | 'number' | 'media' | 'reference' | 'structure' | 'specialized'
  }
}

/**
 * Field renderer registry for managing field type to component mappings
 */
export interface FieldRendererRegistry {
  /** Register a field renderer */
  register(entry: FieldRendererEntry): void
  
  /** Get renderer for a field type */
  getRenderer(type: string): FieldRenderer | null
  
  /** Get preview renderer for a field type */
  getPreviewRenderer(type: string): FieldRenderer | null
  
  /** Check if a field type has a renderer */
  hasRenderer(type: string): boolean
  
  /** Get all registered field types */
  getRegisteredTypes(): string[]
  
  /** Get all registered renderers with metadata */
  getAllRenderers(): Map<string, FieldRendererEntry>
}

/**
 * Field group configuration for organizing fields in forms
 */
export interface FieldGroup {
  /** Group identifier */
  id: string
  
  /** Display title */
  title: string
  
  /** Optional description */
  description?: string
  
  /** Fields in this group */
  fields: string[]
  
  /** Group layout */
  layout?: {
    /** Number of columns */
    columns?: number
    
    /** Group collapsible state */
    collapsible?: boolean
    
    /** Default collapsed state */
    defaultCollapsed?: boolean
  }
}

/**
 * Form layout configuration
 */
export interface FormLayoutConfig {
  /** Field groups */
  groups?: FieldGroup[]
  
  /** Global form layout */
  layout?: {
    /** Form columns */
    columns?: number
    
    /** Field spacing */
    spacing?: 'compact' | 'normal' | 'relaxed'
    
    /** Show field descriptions */
    showDescriptions?: boolean
    
    /** Show required indicators */
    showRequired?: boolean
  }
  
  /** Custom field order (overrides schema order) */
  fieldOrder?: string[]
  
  /** Fields to exclude from rendering */
  excludeFields?: string[]
  
  /** Fields to make read-only */
  readOnlyFields?: string[]
}