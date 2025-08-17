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

// Studio context interface for field access to Studio capabilities
export interface StudioContext {
  // API client for Studio operations
  apiClient: {
    // Document operations
    getDocuments: (type: string, params?: any) => Promise<any>;
    getDocument: (type: string, id?: string) => Promise<any>;
    createDocument: (type: string, document: any) => Promise<any>;
    updateDocument: (type: string, id: string, document: any) => Promise<any>;
    deleteDocument: (type: string, id: string) => Promise<any>;
    
    // Media operations
    getMedia: (options?: any) => Promise<any>;
    getMediaById: (id: string) => Promise<any>;
    uploadMedia: (file: File, collection?: string, metadata?: any) => Promise<any>;
    deleteMedia: (id: string) => Promise<any>;
    updateMedia: (id: string, metadata: any) => Promise<any>;
    
    // Schema operations
    getSchemas: () => Promise<any>;
    getSchema: (id: string) => Promise<any>;
    
    // Generic HTTP methods
    get: (endpoint: string, options?: any) => Promise<any>;
    post: (endpoint: string, options?: any) => Promise<any>;
  };
  
  // Authentication and user context
  auth: {
    getCurrentUser: () => any;
    hasPermission: (resource: string, action: string) => boolean;
    getAccessToken: () => string | null;
  };
  
  // Inter-field communication
  fieldEvents: {
    emit: (event: string, data: any) => void;
    on: (event: string, callback: (data: any) => void) => () => void;
    getFieldValue: (fieldId: string) => any;
    watchField: (fieldId: string, callback: (value: any) => void) => () => void;
  };
  
  // Studio utilities
  utils: {
    showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
    showConfirm: (message: string, options?: {
      title?: string;
      confirmText?: string;
      cancelText?: string;
      variant?: 'default' | 'danger';
    }) => Promise<boolean>;
    openModal: (component: React.ComponentType, props?: any) => void;
    closeModal: () => void;
    showMediaBrowser: (config: import('@trokky/types').MediaBrowserConfig) => void;
  };
  
  // Studio logger for field components
  logger: {
    debug: (message: string, data?: any) => void;
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, error?: Error | any) => void;
  };
}

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
  studioContext?: StudioContext;
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

  // Demo configuration for auto-generated field demonstrations
  demoConfig?: {
    examples: Array<{
      name: string;
      value: TValue;
      description: string;
    }>;
    invalidValue?: TValue;
    variants: Array<{
      name: string;
      definition: TDefinition;
    }>;
  };
}

// Registered field plugin with metadata
export interface RegisteredFieldPlugin extends FieldPlugin {
  source: FieldPluginSource;
  registeredAt: Date;
  
  // Ensure demoConfig is properly typed for registered plugins
  demoConfig?: {
    examples: Array<{
      name: string;
      value: any;
      description: string;
    }>;
    invalidValue?: any;
    variants: Array<{
      name: string;
      definition: any;
    }>;
  };
}

// Export types (already declared above, no need to re-export)