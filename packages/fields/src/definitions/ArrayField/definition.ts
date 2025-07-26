import type { BaseFieldDefinition, BaseValidation, BaseFieldOptions } from '../../base/FieldDefinition.js';

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

// Array layout options - determines how the array is presented
export type ArrayLayout = 
  | 'select'      // Dropdown (single or multi-select)
  | 'checkboxes'  // Checkbox group (multi-select)
  | 'radio'       // Radio button group (single-select)
  | 'tags'        // Tag input with autocomplete
  | 'list'        // Sortable list items
  | 'grid'        // Grid of items
  | 'inline';     // Inline items

// Array item type - what kind of values can be in the array
export type ArrayItemType =
  | 'string'      // Simple string values
  | 'number'      // Simple number values  
  | 'boolean'     // Simple boolean values
  | 'object'      // Complex object values with defined fields
  | 'reference';  // References to other documents

// Array field-specific options
export interface ArrayFieldOptions extends Omit<BaseFieldOptions, 'layout'> {
  /** Array layout style */
  layout?: ArrayLayout;
  
  /** Selection mode for select/checkboxes layouts */
  mode?: 'single' | 'multiple';
  
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
  
  /** Configuration for select/dropdown layout */
  selectOptions?: {
    /** Placeholder text for dropdown */
    placeholder?: string;
    /** Enable search in dropdown */
    searchable?: boolean;
    /** Maximum height for dropdown */
    maxHeight?: string;
    /** Show option descriptions */
    showDescriptions?: boolean;
  };
  
  /** Tag field configuration (for tags layout) */
  tagOptions?: {
    /** Placeholder text */
    placeholder?: string;
    /** Allow custom tags not in predefined list */
    allowCustom?: boolean;
    /** Predefined tag suggestions */
    suggestions?: string[];
    /** Maximum number of tags */
    maxTags?: number;
    /** Tag color scheme */
    colorScheme?: 'blue' | 'green' | 'red' | 'purple' | 'gray';
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
  
  /** Animation settings */
  animations?: {
    /** Enable add/remove animations */
    enabled?: boolean;
    /** Animation duration in ms */
    duration?: number;
  };
}

// Predefined option for select/radio/checkbox layouts
export interface ArrayOption {
  /** Display label */
  title: string;
  /** Stored value */
  value: any;
  /** Optional description */
  description?: string;
  /** Option disabled state */
  disabled?: boolean;
  /** Option icon */
  icon?: string;
  /** Option color/category */
  color?: string;
}

// Array item schema definition for complex objects
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
  defaultValue?: any;
  /** Fields for object items */
  fields?: ArrayItemDefinition[];
  /** Reference configuration for reference items */
  to?: Array<{ type: string } | string>;
}

// Complete array field definition
export interface ArrayFieldDefinition extends Omit<BaseFieldDefinition, 'type'> {
  type: 'array';
  validation?: ArrayValidation;
  options?: ArrayFieldOptions;
  
  /** Type of items in the array */
  itemType: ArrayItemType;
  
  /** For simple types (string, number, boolean): predefined options */
  options_list?: ArrayOption[];
  
  /** For object type: definition of object structure */
  itemDefinition?: ArrayItemDefinition;
  
  /** For reference type: what document types can be referenced */
  referenceTo?: Array<{ type: string } | string>;
  
  /** Default value */
  defaultValue?: any[];
}

// Default configuration for array fields
export const ARRAY_FIELD_DEFAULTS: Partial<ArrayFieldDefinition> = {
  type: 'array',
  itemType: 'string',
  defaultValue: [],
  validation: {
    required: false,
    minItems: 0,
    maxItems: 100,
    unique: false
  },
  options: {
    layout: 'list',
    mode: 'multiple',
    sortable: true,
    insertAppend: true,
    collapsed: false,
    showCount: false,
    addButtonText: 'Add item',
    disableAdd: false,
    disableRemove: false,
    gridColumns: {
      sm: 1,
      md: 2,
      lg: 3,
      xl: 4
    },
    selectOptions: {
      placeholder: 'Select options...',
      searchable: true,
      maxHeight: '200px',
      showDescriptions: false
    },
    tagOptions: {
      placeholder: 'Add tags...',
      allowCustom: true,
      suggestions: [],
      colorScheme: 'blue'
    },
    preview: {
      showWhenCollapsed: true,
      maxPreviewItems: 3,
      template: '{title}'
    },
    animations: {
      enabled: true,
      duration: 200
    }
  }
};

// Helper types for array operations
export interface ArrayOperations {
  add: (item: any, index?: number) => void;
  remove: (index: number) => void;
  move: (fromIndex: number, toIndex: number) => void;
  update: (index: number, item: any) => void;
  clear: () => void;
  toggle: (item: any) => void; // For select modes
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