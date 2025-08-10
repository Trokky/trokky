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
  | 'section';

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
  columns?: number;
  /** Field spacing */
  spacing?: 'compact' | 'normal' | 'relaxed';
  /** Show field descriptions */
  showDescriptions?: boolean;
  /** Group fields into sections */
  sections?: Array<{
    title: string;
    description?: string;
    fields: string[];
    collapsible?: boolean;
    collapsed?: boolean;
  }>;
  /** Preview configuration */
  preview?: {
    /** Fields to show in preview when collapsed */
    fields?: string[];
    /** Preview template */
    template?: string;
    /** Maximum preview length */
    maxLength?: number;
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
}

// Object field definition for nested fields
export interface ObjectFieldDefinition extends BaseFieldDefinition {
  type: 'object';
  validation?: ObjectValidation;
  options?: ObjectFieldOptions;
  /** Fields within the object */
  fields: ObjectFieldItem[];
  default?: Record<string, any>;
}

// Individual field definition within an object
export interface ObjectFieldItem {
  /** Field name/key */
  name: string;
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
    operator?:
      | 'equals'
      | 'notEquals'
      | 'contains'
      | 'notContains'
      | 'exists'
      | 'notExists';
  };
  /** Fields for nested objects */
  fields?: ObjectFieldItem[];
  /** Reference configuration for reference fields */
  to?: Array<{ type: string } | string>;
  /** Array item configuration for array fields */
  of?: ObjectFieldItem;
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
    sections: [],
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
}