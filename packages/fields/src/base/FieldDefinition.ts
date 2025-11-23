/**
 * Base field definition interfaces
 * Based on proven legacy architecture from Trokky v1
 */

// Conditional visibility operators
export type ConditionalOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'exists'
  | 'notExists'
  | 'greaterThan'
  | 'lessThan';

// Conditional visibility configuration
export interface ConditionalConfig {
  // Single condition
  field?: string;
  value?: any;
  operator?: ConditionalOperator;

  // Multiple conditions
  conditions?: Array<{
    field: string;
    value?: any;
    operator?: ConditionalOperator;
  }>;
  logic?: 'and' | 'or';  // How to combine multiple conditions (default: 'and')
}

// Base field definition that all field types extend
export interface BaseFieldDefinition {
  type: string;
  title: string;
  description?: string;
  required?: boolean;

  /**
   * Field visibility control
   * - boolean: Static visibility (always hidden or visible)
   * - function: Dynamic visibility based on document state
   *
   * NOTE: Functions cannot be serialized over HTTP. If your schemas are sent from backend to frontend,
   * use the `conditional` property instead for dynamic visibility.
   */
  hidden?: boolean | ((document: Record<string, any>) => boolean);

  readOnly?: boolean;
  hideLabel?: boolean; // Hide field label in Studio (useful for display-only fields like info)
  group?: string;

  /**
   * Declarative conditional visibility (serializable, works over HTTP)
   * Prefer this over function-based `hidden` when schemas are sent via API
   */
  conditional?: ConditionalConfig;
}

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// Base validation interface
export interface BaseValidation {
  required?: boolean;
  custom?: (value: any) => ValidationResult;
}

// Base options interface for field display and behavior
export interface BaseFieldOptions {
  placeholder?: string;
  helpText?: string;
  layout?: 'default' | 'compact' | 'inline';
  width?: 'full' | 'half' | 'third' | 'quarter';
  className?: string;
}

// Field categories for organization
export type FieldCategory = 
  | 'text'        // String, Text, RichText, Slug
  | 'number'      // Number, Currency, Percentage
  | 'boolean'     // Boolean, Toggle
  | 'date'        // Date, DateTime, Time
  | 'media'       // Image, Video, Audio, Document
  | 'reference'   // Reference, CrossReference
  | 'structure'   // Array, Object, Group
  | 'location'    // GeoCoordinate, Address
  | 'custom';     // Custom field types

// Base value interface that all field values extend
export interface BaseFieldValue {
  _type: string;
}

// Validation state for real-time feedback
export interface ValidationState {
  isValidating: boolean;
  lastValidatedValue?: any;
  lastValidatedAt?: Date;
}

// Document context for field rendering
export interface DocumentContext {
  documentId?: string;
  schema: string;
  isNewDocument: boolean;
  allDocuments?: Record<string, any[]>;
  allValues?: Record<string, any>; // Current form values for field interactions
  currentUser?: any;
  permissions?: string[];
  nestingLevel?: number; // Nesting level for object fields (0 = top-level, 1+ = nested)
}