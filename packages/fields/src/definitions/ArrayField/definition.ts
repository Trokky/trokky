import type {
  BaseFieldDefinition,
  BaseValidation,
  BaseFieldOptions,
} from '../../base/FieldDefinition.js';

// Array-specific validation
export interface ArrayValidation extends BaseValidation {
  /** Minimum number of items */
  minItems?: number;
  /** Maximum number of items */
  maxItems?: number;
  /** Items must be unique (for primitive types) */
  unique?: boolean;
  /** Unique field for object items */
  uniqueBy?: string;
}

// Array layout options
export type ArrayLayout = 'list' | 'grid' | 'tags' | 'inline' | 'select';

// Array field-specific options
export interface ArrayFieldOptions extends Omit<BaseFieldOptions, 'layout'> {
  /** Array layout style */
  layout?: ArrayLayout;
  /** Enable drag and drop sorting */
  sortable?: boolean;
  /** Insert new items at end (true) or beginning (false) */
  insertAppend?: boolean;
  /** Default collapsed state */
  collapsed?: boolean;
  /** Show item count in header */
  showCount?: boolean;
  /** Custom add button text */
  addButtonText?: string;
  /** Disable add button */
  disableAdd?: boolean;
  /** Disable remove button */
  disableRemove?: boolean;
  /** Maximum width for grid layout */
  gridMaxWidth?: string;
  /** Grid columns for responsive layout */
  gridColumns?: {
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  /** Tag field configuration (for tags layout) */
  tagField?: {
    placeholder?: string;
    allowCustom?: boolean;
    suggestions?: string[];
    confirmDelete?: boolean;
  };
  /** Select field configuration (for select layout) */
  selectField?: {
    /** Available options to select from */
    options: string[];
    /** Display as checkboxes (default), pills, or dropdown */
    displayAs?: 'checkboxes' | 'pills' | 'dropdown';
    /** Number of columns for checkboxes layout */
    columns?: 1 | 2 | 3 | 4;
    /** Number of visible rows for dropdown (default 6) */
    dropdownSize?: number;
  };
  /** Preview mode configuration */
  preview?: {
    /** Show preview of items when collapsed */
    showWhenCollapsed?: boolean;
    /** Number of items to preview */
    maxPreviewItems?: number;
    /** Preview template for items */
    template?: string;
  };
}

// Preview configuration for array items
export interface ArrayItemPreview {
  /** Field name to use as title */
  title?: string;
  /** Field name to use as subtitle */
  subtitle?: string;
  /** Field name to use as media/icon */
  media?: string;
}

// Array item schema definition
export interface ArrayItemDefinition {
  /** Item name/key */
  name: string;
  /** Field type */
  type: string;
  /** Display title */
  title: string;
  /** Item description */
  description?: string;
  /** Whether item is required */
  required?: boolean;
  /** Field-specific validation */
  validation?: any;
  /** Field-specific options */
  options?: any;
  /** Default value for new items */
  default?: any;
  /** Fields for object items */
  fields?: ArrayItemDefinition[];
  /** Reference configuration for reference items */
  to?: Array<{ type: string } | string>;
  /** Array item type for nested arrays */
  of?: ArrayItemDefinition;
  /** Preview configuration for collapsed items */
  preview?: ArrayItemPreview;
}

// Complete array field definition
export interface ArrayFieldDefinition extends BaseFieldDefinition {
  type: 'array';
  validation?: ArrayValidation;
  options?: ArrayFieldOptions;
  /** Definition of array items */
  of: ArrayItemDefinition;
  default?: any[];
}

// Default configuration for array fields
export const ARRAY_FIELD_DEFAULTS = {
  validation: {
    required: false,
    minItems: 0,
    maxItems: 100,
    unique: false,
  } as ArrayValidation,

  options: {
    placeholder: 'Add items...',
    layout: 'list',
    sortable: true,
    insertAppend: true,
    collapsed: false,
    showCount: true,
    addButtonText: 'Add item',
    disableAdd: false,
    disableRemove: false,
    gridColumns: {
      sm: 1,
      md: 2,
      lg: 3,
      xl: 4,
    },
    tagField: {
      placeholder: 'Add tag...',
      allowCustom: true,
      suggestions: [],
      confirmDelete: false,
    },
    selectField: {
      options: [],
      displayAs: 'checkboxes',
      columns: 2,
    },
    preview: {
      showWhenCollapsed: true,
      maxPreviewItems: 3,
      template: '{title} - {description}',
    },
  } as ArrayFieldOptions,

  default: [] as any[],
};

// Helper types for array operations
export interface ArrayOperations {
  add: (item: any, index?: number) => void;
  remove: (index: number) => void;
  move: (fromIndex: number, toIndex: number) => void;
  update: (index: number, item: any) => void;
  clear: () => void;
  toggle: (item: any) => void;
}

// Array field context for nested field rendering
export interface ArrayFieldContext {
  /** Current array value */
  items: any[];
  /** Array operations */
  operations: ArrayOperations;
  /** Array field definition */
  definition: ArrayFieldDefinition;
  /** Current item index (for item-level context) */
  currentIndex?: number;
  /** Whether array is in read-only mode */
  isReadonly?: boolean;
  /** Whether array is disabled */
  isDisabled?: boolean;
  /** Validation errors for items */
  itemErrors?: Record<number, string>;
}

// Array item value wrapper
export interface ArrayItemValue {
  /** Unique identifier for the item */
  _key: string;
  /** Item data */
  value: any;
  /** Item metadata */
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    order?: number;
  };
}