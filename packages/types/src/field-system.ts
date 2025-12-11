/**
 * @trokky/types - Field System Types
 *
 * Core field system types used across the Trokky ecosystem.
 * These types define the foundation for field definitions, validation, and context.
 */

// ============================================================================
// Conditional Visibility Types
// ============================================================================

/**
 * Operators for conditional field visibility
 */
export type ConditionalOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'exists'
  | 'notExists'
  | 'greaterThan'
  | 'lessThan'

/**
 * Configuration for conditional field visibility
 * Supports both single conditions and multiple conditions with logic operators
 */
export interface ConditionalConfig {
  /** Field name for single condition */
  field?: string
  /** Value to compare against */
  value?: any
  /** Comparison operator */
  operator?: ConditionalOperator

  /** Multiple conditions for complex visibility rules */
  conditions?: Array<{
    field: string
    value?: any
    operator?: ConditionalOperator
  }>
  /** How to combine multiple conditions (default: 'and') */
  logic?: 'and' | 'or'
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Result of field validation
 */
export interface ValidationResult {
  /** Whether the validation passed */
  isValid: boolean
  /** Array of error messages */
  errors: string[]
  /** Optional array of warning messages */
  warnings?: string[]
}

/**
 * Base validation configuration
 */
export interface BaseValidation {
  /** Whether the field is required */
  required?: boolean
  /** Custom validation function */
  custom?: (value: any) => ValidationResult
}

/**
 * Real-time validation state for field feedback
 */
export interface ValidationState {
  /** Whether validation is currently in progress */
  isValidating: boolean
  /** The last value that was validated */
  lastValidatedValue?: any
  /** When the last validation occurred */
  lastValidatedAt?: Date
}

// ============================================================================
// Field Definition Types
// ============================================================================

/**
 * Categories for organizing field types
 */
export type FieldCategory =
  | 'text'        // String, Text, RichText, Slug
  | 'number'      // Number, Currency, Percentage
  | 'boolean'     // Boolean, Toggle
  | 'date'        // Date, DateTime, Time
  | 'media'       // Image, Video, Audio, Document
  | 'reference'   // Reference, CrossReference
  | 'structure'   // Array, Object, Group
  | 'location'    // GeoCoordinate, Address
  | 'custom'      // Custom field types

/**
 * Base options interface for field display and behavior
 */
export interface BaseFieldOptions {
  /** Placeholder text for input fields */
  placeholder?: string
  /** Help text displayed below the field */
  helpText?: string
  /** Layout style for the field */
  layout?: 'default' | 'compact' | 'inline'
  /** Width of the field in the form */
  width?: 'full' | 'half' | 'third' | 'quarter'
  /** Additional CSS class name */
  className?: string
}

/**
 * Base field definition that all field types extend
 */
export interface BaseFieldDefinition {
  /** The field type identifier */
  type: string
  /** Display title for the field */
  title: string
  /** Optional description/help text */
  description?: string
  /** Whether the field is required */
  required?: boolean

  /**
   * Field visibility control
   * - boolean: Static visibility (always hidden or visible)
   * - function: Dynamic visibility based on document state
   *
   * NOTE: Functions cannot be serialized over HTTP. If your schemas are sent from backend to frontend,
   * use the `conditional` property instead for dynamic visibility.
   */
  hidden?: boolean | ((document: Record<string, any>) => boolean)

  /** Whether the field is read-only */
  readOnly?: boolean
  /** Hide field label in Studio (useful for display-only fields like info) */
  hideLabel?: boolean
  /** Group name for organizing fields */
  group?: string

  /**
   * Declarative conditional visibility (serializable, works over HTTP)
   * Prefer this over function-based `hidden` when schemas are sent via API
   */
  conditional?: ConditionalConfig
}

/**
 * Base value interface that all field values extend
 */
export interface BaseFieldValue {
  /** Type identifier for the value */
  _type: string
}

// ============================================================================
// Document Context Types
// ============================================================================

/**
 * Context provided to fields during rendering
 * Contains document information, schema, and user context
 */
export interface DocumentContext {
  /** The document ID (undefined for new documents) */
  documentId?: string
  /** The schema/collection name */
  schema: string
  /** Whether this is a new document being created */
  isNewDocument: boolean
  /** All documents in the system, keyed by collection */
  allDocuments?: Record<string, any[]>
  /** Current form values for field interactions */
  allValues?: Record<string, any>
  /** Current authenticated user */
  currentUser?: any
  /** User's permissions */
  permissions?: string[]
  /** Nesting level for object fields (0 = top-level, 1+ = nested) */
  nestingLevel?: number
}

// ============================================================================
// Field Plugin Types (Base - without React dependencies)
// ============================================================================

/**
 * Field plugin source types
 */
export type FieldPluginSource = 'builtin' | 'external' | 'custom'

/**
 * Base field plugin interface (without React component types)
 * The full FieldPlugin interface with React components is in @trokky/fields
 */
export interface BaseFieldPlugin<
  TDefinition extends BaseFieldDefinition = BaseFieldDefinition,
  TValue = any,
> {
  /** Unique type identifier for the field */
  type: string
  /** Human-readable display name */
  displayName: string
  /** Description of the field type */
  description: string
  /** Category for organizing fields */
  category: FieldCategory

  /** Validation function */
  validate: (
    value: TValue,
    definition: TDefinition,
    context?: DocumentContext
  ) => ValidationResult

  /** Default value generator */
  getDefaultValue: (definition: TDefinition) => TValue

  /** Convert definition to schema field */
  toSchemaField: (definition: TDefinition) => any
  /** Convert schema field to definition */
  fromSchemaField: (schemaField: any) => TDefinition

  /** Optional settings for the field type */
  settings?: {
    icon?: string
    color?: string
    tags?: string[]
  }

  /** Demo configuration for auto-generated field demonstrations */
  demoConfig?: {
    examples: Array<{
      name: string
      value: TValue
      description: string
    }>
    invalidValue?: TValue
    variants: Array<{
      name: string
      definition: TDefinition
    }>
  }
}

/**
 * Base registered field plugin with metadata (without React components)
 */
export interface BaseRegisteredFieldPlugin extends BaseFieldPlugin {
  /** Source of the plugin */
  source: FieldPluginSource
  /** When the plugin was registered */
  registeredAt: Date
}
