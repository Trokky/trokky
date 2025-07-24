/**
 * Field plugin system interfaces
 * Based on proven legacy architecture from Trokky v1
 */

import type { ComponentType } from 'react';
import type { BaseFieldDefinition, ValidationResult, DocumentContext } from './FieldDefinition.js';

// Field plugin source types
export type FieldPluginSource = 'builtin' | 'external' | 'custom';

// Import ValidationState from FieldDefinition to avoid duplication
import type { ValidationState } from './FieldDefinition.js';

// Props passed to field components
export interface FieldComponentProps {
  fieldId: string;
  value: any;
  onChange: (value: any) => void;
  definition: BaseFieldDefinition;
  hasError?: boolean;
  error?: string;
  validationState?: ValidationState;
  isDisabled?: boolean;
  isReadonly?: boolean;
  documentContext?: DocumentContext;
  onValidationChange?: (result: ValidationResult) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  [key: string]: any; // Allow additional props
}

// Core field plugin interface
export interface FieldPlugin<TDefinition extends BaseFieldDefinition = BaseFieldDefinition, TValue = any> {
  // Plugin metadata
  type: string;
  displayName: string;
  description: string;
  category: import('./FieldDefinition.js').FieldCategory;
  
  // React component for Studio rendering
  component: ComponentType<FieldComponentProps>;
  
  // Validation function
  validate: (value: TValue, definition: TDefinition, context?: DocumentContext) => ValidationResult;
  
  // Default value generator
  getDefaultValue: (definition: TDefinition) => TValue;
  
  // Schema conversion utilities
  toSchemaField: (definition: TDefinition) => any;
  fromSchemaField: (schemaField: any) => TDefinition;
  
  // Optional preview component for read-only display
  previewComponent?: ComponentType<FieldComponentProps>;
  
  // Optional settings for the field type
  settings?: {
    icon?: string;
    color?: string;
    tags?: string[];
  };
}

// Registered field plugin with metadata
export interface RegisteredFieldPlugin extends FieldPlugin {
  source: FieldPluginSource;
  registeredAt: Date;
}

// Export types (already declared above, no need to re-export)