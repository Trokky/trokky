import type { BaseFieldDefinition, BaseValidation, BaseFieldOptions } from '../../base/FieldDefinition.js';

export interface ReferenceValidation extends BaseValidation {
  multiple?: boolean;
  minReferences?: number;
  maxReferences?: number;
  customValidation?: (value: string | string[]) => boolean | string;
}

export interface ReferenceFieldOptions extends BaseFieldOptions {
  showPreview?: boolean;
  allowCreate?: boolean;
  displayField?: string;
  previewFields?: string[];
  enableSearch?: boolean;
  searchPlaceholder?: string;
  maxSearchResults?: number;
  groupByType?: boolean;
  pickerLayout?: 'list' | 'grid' | 'dropdown';
  sortable?: boolean;
  showCount?: boolean;
}

export interface ReferenceTarget {
  type: string;
  displayName?: string;
  icon?: string;
  filter?: Record<string, any>;
}

export interface ReferenceFieldDefinition extends BaseFieldDefinition {
  type: 'reference';
  validation?: ReferenceValidation;
  options?: ReferenceFieldOptions;
  to: string | Array<ReferenceTarget | string>;
  bidirectional?: boolean;
  bidirectionalConfig?: {
    targetField?: string;
    cascadeDelete?: 'none' | 'unlink' | 'delete';
    autoSync?: boolean;
  };
  default?: string | string[];
}

export const REFERENCE_FIELD_DEFAULTS = {
  validation: {
    required: false,
    multiple: false,
    minReferences: 0,
    maxReferences: 10
  } as ReferenceValidation,
  
  options: {
    placeholder: 'Select reference...',
    showPreview: true,
    allowCreate: false,
    displayField: 'title',
    previewFields: ['title', 'description'],
    enableSearch: true,
    searchPlaceholder: 'Search documents...',
    maxSearchResults: 20,
    groupByType: true,
    pickerLayout: 'list',
    sortable: true,
    showCount: true
  } as ReferenceFieldOptions,
  
  default: undefined as string | string[] | undefined
};

export interface ReferenceValue {
  _ref: string;
  _type: string;
  _cached?: {
    title?: string;
    description?: string;
    [key: string]: any;
  };
  _metadata?: {
    createdAt?: string;
    updatedAt?: string;
    strength?: 'strong' | 'weak';
  };
}

export interface ReferenceSearchResult {
  id: string;
  type: string;
  title: string;
  description?: string;
  displayData?: Record<string, any>;
  isSelected?: boolean;
}

export interface ReferenceFieldContext {
  value: string | string[] | ReferenceValue | ReferenceValue[] | undefined;
  definition: ReferenceFieldDefinition;
  availableDocuments?: ReferenceSearchResult[];
  isLoading?: boolean;
  searchQuery?: string;
  typeFilter?: string;
}

export interface ReferenceOperations {
  addReference: (documentId: string, documentType: string) => void;
  removeReference: (documentId: string) => void;
  setReference: (documentId: string, documentType: string) => void;
  clear: () => void;
  reorderReferences: (fromIndex: number, toIndex: number) => void;
  searchDocuments: (query: string, types?: string[]) => Promise<ReferenceSearchResult[]>;
  getReferencedDocument: (documentId: string) => Promise<any>;
}