import type {
  BaseFieldDefinition,
  BaseValidation,
  BaseFieldOptions,
} from '../../base/FieldDefinition.js';

// Object-specific validation
export interface ObjectValidation extends Omit<BaseValidation, 'required'> {
  /** Whether the object itself is required */
  required?: boolean;
  /** Required field names within the object */
  requiredFields?: string[];
  /** Allow additional properties not defined in fields */
  additionalProperties?: boolean;
  /** Minimum number of defined properties */
  minProperties?: number;
  /** Maximum number of defined properties */
  maxProperties?: number;
  /** Custom object validation function */
  customValidation?: (value: Record<string, any>) => boolean | string;
}

// Object layout options
export type ObjectLayout =
  | 'inline'
  | 'collapsible'
  | 'modal'
  | 'card'
  | 'section'
  | 'sections'
  | 'columns'
  | 'tabs';

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
  /** Custom title template */
  titleTemplate?: string;
  /** Columns for field layout */
  columns?: number | {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  /** Field spacing */
  spacing?: 'compact' | 'normal' | 'relaxed';
  /** Show field descriptions */
  showDescriptions?: boolean;
  /** Field ordering (explicit order for Record format) */
  fieldOrder?: string[];
  /** Group fields into sections */
  sections?: Array<{
    title: string;
    description?: string;
    fields: string[];
    collapsible?: boolean;
    collapsed?: boolean;
    icon?: string;
  }>;
  /** Tab configuration (for tabs layout) */
  tabs?: Array<{
    title: string;
    description?: string;
    fields: string[];
    icon?: string;
  }>;
  /** Preview configuration */
  preview?: {
    /** Fields to show in preview when collapsed */
    fields?: string[];
    /** Preview template */
    template?: string;
    /** Maximum preview length */
    maxLength?: number;
    /** Show field count */
    showCount?: boolean;
  };
  /** Modal configuration (for modal layout) */
  modal?: {
    /** Modal title */
    title?: string;
    /** Modal size */
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    /** Show modal footer */
    showFooter?: boolean;
  };
  /** Animation configuration */
  animations?: {
    /** Enable animations */
    enabled?: boolean;
  };
}

// Modern nested field definition
export interface NestedFieldDefinition {
  /** Field type */
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
  /** Default value */
  default?: any;
  /** Hide field conditionally */
  hidden?: boolean | ((values: Record<string, any>) => boolean);
  /** Make field read-only conditionally */
  readOnly?: boolean | ((values: Record<string, any>) => boolean);
  /** Field group/section */
  group?: string;
  /** Conditional visibility */
  conditional?: {
    field: string;
    value: any;
    operator?: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'exists' | 'notExists';
  };
  /** Fields for nested objects (Record format) */
  fields?: Record<string, NestedFieldDefinition>;
  /** Reference configuration for reference fields */
  to?: Array<{ type: string } | string>;
  /** Array item configuration for array fields */
  of?: NestedFieldDefinition;
}

// Modern object field definition (Record format)
export interface ObjectFieldDefinition extends BaseFieldDefinition {
  type: 'object';
  validation?: ObjectValidation;
  options?: ObjectFieldOptions;
  /** Fields within the object (Record format - modern) */
  fields: Record<string, NestedFieldDefinition>;
  default?: Record<string, any>;
}

// Default configuration for object fields
export const OBJECT_FIELD_DEFAULTS = {
  validation: {
    required: false,
    additionalProperties: true,
    minProperties: 0,
    maxProperties: 100,
  } as ObjectValidation,

  options: {
    placeholder: 'Configure object...',
    layout: 'collapsible',
    collapsible: true,
    collapsed: false,
    showFieldCount: true,
    columns: 1,
    spacing: 'normal',
    showDescriptions: true,
    fieldOrder: [],
    sections: [],
    tabs: [],
    preview: {
      fields: [],
      maxLength: 100,
    },
    modal: {
      title: 'Edit Object',
      size: 'lg',
      showFooter: true,
    },
  } as ObjectFieldOptions,

  default: {} as Record<string, any>,
};

// Object field context for nested field rendering
export interface ObjectFieldContext {
  /** Current object value */
  values: Record<string, any>;
  /** Object field definition */
  definition: ObjectFieldDefinition;
  /** Update field value */
  updateField: (fieldName: string, value: any) => void;
  /** Get field value */
  getField: (fieldName: string) => any;
  /** Whether object is in read-only mode */
  isReadonly?: boolean;
  /** Whether object is disabled */
  isDisabled?: boolean;
  /** Validation errors for fields */
  fieldErrors?: Record<string, string>;
  /** Current object path (for nested objects) */
  path?: string[];
}

// Object operations interface
export interface ObjectOperations {
  /** Update a field value */
  updateField: (fieldName: string, value: any) => void;
  /** Get a field value */
  getField: (fieldName: string) => any;
  /** Remove a field */
  removeField: (fieldName: string) => void;
  /** Check if field exists */
  hasField: (fieldName: string) => boolean;
  /** Clear all fields */
  clear: () => void;
  /** Reset to default values */
  reset: () => void;
}

// Object field metadata
export interface ObjectFieldMetadata {
  /** Number of defined fields */
  fieldCount: number;
  /** Number of filled fields */
  filledCount: number;
  /** Completion percentage */
  completionPercentage: number;
  /** Required fields status */
  requiredFieldsStatus: {
    total: number;
    completed: number;
    missing: string[];
  };
  /** Array of filled field names */
  filledFields: string[];
  /** Array of visible field names */
  visibleFields: string[];
  /** Whether all required fields are complete */
  isRequiredComplete: boolean;
}

// Helper function to get ordered field entries
export function getOrderedFields(definition: ObjectFieldDefinition): Array<{
  name: string;
  definition: NestedFieldDefinition;
}> {
  const fieldOrder = definition.options?.fieldOrder || Object.keys(definition.fields);
  return fieldOrder.map(name => ({
    name,
    definition: definition.fields[name]
  })).filter(field => field.definition); // Filter out undefined fields
}
