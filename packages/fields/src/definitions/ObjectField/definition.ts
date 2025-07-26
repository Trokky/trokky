import type { BaseFieldDefinition, BaseValidation, BaseFieldOptions } from '../../base/FieldDefinition.js';

// Object-specific validation
export interface ObjectValidation extends BaseValidation {
  /** Required field names within the object */
  requiredFields?: string[];
  /** Allow additional properties not defined in fields */
  additionalProperties?: boolean;
  /** Minimum number of defined properties */
  minProperties?: number;
  /** Maximum number of defined properties */
  maxProperties?: number;
  /** Custom object validation function */
  customValidation?: (value: Record<string, any>) => string | null;
}

// Object layout options - determines how the object fields are presented
export type ObjectLayout = 
  | 'inline'       // All fields in simple vertical layout
  | 'collapsible'  // Expandable/collapsible container
  | 'card'         // Card-based presentation with border
  | 'sections'     // Grouped into defined sections
  | 'columns'      // Multi-column responsive layout
  | 'tabs';        // Tab-based organization

// Object field-specific options
export interface ObjectFieldOptions extends Omit<BaseFieldOptions, 'layout'> {
  /** Object layout style */
  layout?: ObjectLayout;
  
  /** Enable collapsible interface */
  collapsible?: boolean;
  
  /** Default collapsed state */
  collapsed?: boolean;
  
  /** Show field count in header */
  showFieldCount?: boolean;
  
  /** Show completion percentage */
  showProgress?: boolean;
  
  /** Custom title template using field values */
  titleTemplate?: string;
  
  /** Number of columns for responsive layout */
  columns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  
  /** Field spacing */
  spacing?: 'compact' | 'normal' | 'relaxed';
  
  /** Show field descriptions */
  showDescriptions?: boolean;
  
  /** Group fields into sections */
  sections?: Array<{
    /** Section title */
    title: string;
    /** Section description */
    description?: string;
    /** Field names in this section */
    fields: string[];
    /** Make section collapsible */
    collapsible?: boolean;
    /** Default collapsed state for section */
    collapsed?: boolean;
    /** Section icon */
    icon?: string;
  }>;
  
  /** Preview configuration for collapsed state */
  preview?: {
    /** Fields to show in preview when collapsed */
    fields?: string[];
    /** Preview template using field values */
    template?: string;
    /** Maximum preview text length */
    maxLength?: number;
    /** Show field count in preview */
    showCount?: boolean;
  };
  
  /** Tab configuration (for tabs layout) */
  tabs?: Array<{
    /** Tab title */
    title: string;
    /** Tab description */
    description?: string;
    /** Field names in this tab */
    fields: string[];
    /** Tab icon */
    icon?: string;
    /** Tab color scheme */
    color?: 'blue' | 'green' | 'purple' | 'red' | 'yellow' | 'gray';
  }>;
  
  /** Animation settings */
  animations?: {
    /** Enable animations */
    enabled?: boolean;
    /** Animation duration in ms */
    duration?: number;
  };
}

// Individual field definition within an object
export interface ObjectFieldItem {
  /** Field name/key - must be unique within object */
  name: string;
  
  /** Field type - any registered field type */
  type: string;
  
  /** Display title */
  title: string;
  
  /** Field description */
  description?: string;
  
  /** Whether field is required */
  required?: boolean;
  
  /** Field-specific validation */
  validation?: any;
  
  /** Field-specific options */
  options?: any;
  
  /** Default value for this field */
  defaultValue?: any;
  
  /** Hide field conditionally */
  hidden?: boolean | ((values: Record<string, any>) => boolean);
  
  /** Make field read-only conditionally */
  readOnly?: boolean | ((values: Record<string, any>) => boolean);
  
  /** Field group/section name */
  group?: string;
  
  /** Tab name (for tabs layout) */
  tab?: string;
  
  /** Conditional visibility configuration */
  conditional?: {
    /** Field name to watch */
    field: string;
    /** Expected value for visibility */
    value: any;
    /** Comparison operator */
    operator?: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'exists' | 'notExists' | 'greaterThan' | 'lessThan';
    /** Multiple conditions with logical operators */
    conditions?: Array<{
      field: string;
      value: any;
      operator?: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'exists' | 'notExists' | 'greaterThan' | 'lessThan';
    }>;
    /** Logical operator for multiple conditions */
    logic?: 'and' | 'or';
  };
  
  /** Placeholder text */
  placeholder?: string;
  
  /** Help text */
  helpText?: string;
  
  /** Field width in grid layouts */
  width?: 'full' | 'half' | 'third' | 'quarter' | 'auto';
  
  /** Fields for nested objects (if type is 'object') */
  fields?: ObjectFieldItem[];
  
  /** Array item configuration (if type is 'array') */
  of?: ObjectFieldItem;
  
  /** Reference configuration (if type is 'reference') */
  to?: Array<{ type: string } | string>;
}

// Complete object field definition
export interface ObjectFieldDefinition extends Omit<BaseFieldDefinition, 'type'> {
  type: 'object';
  validation?: ObjectValidation;
  options?: ObjectFieldOptions;
  
  /** Fields within the object */
  fields: ObjectFieldItem[];
  
  /** Default value for the entire object */
  defaultValue?: Record<string, any>;
}

// Default configuration for object fields
export const OBJECT_FIELD_DEFAULTS: Partial<ObjectFieldDefinition> = {
  type: 'object',
  fields: [],
  defaultValue: {},
  validation: {
    required: false,
    additionalProperties: true,
    minProperties: 0,
    maxProperties: 50
  },
  options: {
    layout: 'collapsible',
    collapsible: true,
    collapsed: false,
    showFieldCount: true,
    showProgress: false,
    columns: {
      sm: 1,
      md: 1,
      lg: 2,
      xl: 2
    },
    spacing: 'normal',
    showDescriptions: true,
    sections: [],
    preview: {
      fields: [],
      maxLength: 150,
      showCount: true
    },
    tabs: [],
    animations: {
      enabled: true,
      duration: 200
    }
  }
};

// Object field operations interface
export interface ObjectOperations {
  /** Update a field value */
  updateField: (fieldName: string, value: any) => void;
  
  /** Get a field value */
  getField: (fieldName: string) => any;
  
  /** Remove a field (set to undefined) */
  removeField: (fieldName: string) => void;
  
  /** Check if field exists and has a value */
  hasField: (fieldName: string) => boolean;
  
  /** Clear all field values */
  clear: () => void;
  
  /** Reset to default values */
  reset: () => void;
  
  /** Get all field names */
  getFieldNames: () => string[];
  
  /** Get field definition by name */
  getFieldDefinition: (fieldName: string) => ObjectFieldItem | undefined;
}

// Object field context for nested field rendering
export interface ObjectFieldContext {
  /** Current object value */
  values: Record<string, any>;
  
  /** Object field definition */
  definition: ObjectFieldDefinition;
  
  /** Object operations */
  operations: ObjectOperations;
  
  /** Whether object is in read-only mode */
  isReadonly?: boolean;
  
  /** Whether object is disabled */
  isDisabled?: boolean;
  
  /** Validation errors for fields */
  fieldErrors?: Record<string, string>;
  
  /** Current object path (for nested objects) */
  path?: string[];
  
  /** Parent document context */
  documentContext?: any;
}

// Object field metadata for progress tracking
export interface ObjectFieldMetadata {
  /** Total number of defined fields */
  totalFields: number;
  
  /** Number of visible fields (after conditional logic) */
  visibleFields: number;
  
  /** Number of fields with values */
  filledFields: number;
  
  /** Number of required fields */
  requiredFields: number;
  
  /** Number of completed required fields */
  completedRequiredFields: number;
  
  /** Overall completion percentage (0-100) */
  completionPercentage: number;
  
  /** Required fields completion percentage (0-100) */
  requiredCompletionPercentage: number;
  
  /** List of missing required field names */
  missingRequiredFields: string[];
  
  /** List of field names with errors */
  fieldsWithErrors: string[];
  
  /** Whether all required fields are complete */
  isRequiredComplete: boolean;
  
  /** Whether object is considered complete */
  isComplete: boolean;
}

// Conditional visibility evaluation result
export interface ConditionalResult {
  /** Whether the field should be visible */
  visible: boolean;
  
  /** Reason for visibility decision */
  reason?: string;
  
  /** Fields that were evaluated */
  evaluatedFields: string[];
}

// Helper types for template rendering
export interface TemplateContext {
  /** Field values */
  values: Record<string, any>;
  
  /** Field definitions */
  fields: Record<string, ObjectFieldItem>;
  
  /** Metadata */
  metadata: ObjectFieldMetadata;
}