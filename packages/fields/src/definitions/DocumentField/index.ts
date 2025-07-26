/**
 * Document Field Plugin
 * Specialized MediaField variant for document files only
 */

import { MediaFieldComponent } from '../MediaField/component.js';
import { MediaFieldPreview } from '../MediaField/preview.js';
import { validateMediaField } from '../MediaField/validation.js';
import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { MediaFieldDefinition, MediaFieldValue } from '../MediaField/definition.js';

// Document-specific field definition extending MediaField
export interface DocumentFieldDefinition extends MediaFieldDefinition {
  type: 'document';
  validation?: MediaFieldDefinition['validation'] & {
    // Document-specific validations
    maxPages?: number;
    minPages?: number;
    allowedFormats?: string[]; // e.g., ['pdf', 'doc', 'docx', 'txt', 'rtf']
    requiresPassword?: boolean;
  };
  options?: MediaFieldDefinition['options'] & {
    // Document-specific options
    showPageCount?: boolean;
    showFileSize?: boolean;
    allowPreview?: boolean;
    allowDownload?: boolean;
  };
}

export type DocumentFieldValue = MediaFieldValue;

// Default document file extensions and MIME types
const DOCUMENT_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages',
  'xls', 'xlsx', 'ods', 'numbers',
  'ppt', 'pptx', 'odp', 'key'
];
const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.apple.pages',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.apple.numbers',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.apple.keynote'
];

export const DocumentFieldPlugin: FieldPlugin<DocumentFieldDefinition, DocumentFieldValue> = {
  type: 'document',
  displayName: 'Document',
  description: 'Upload and manage document files with document-specific validation',
  category: 'media',
  
  component: MediaFieldComponent,
  previewComponent: MediaFieldPreview,
  
  validate: (value, definition, context) => {
    // Use base MediaField validation
    const baseResult = validateMediaField(value, definition, context);
    if (!baseResult.isValid) {
      return baseResult;
    }
    
    // Additional document-specific validation would go here
    // For now, we rely on the restrictToMediaType validation
    
    return { isValid: true };
  },
  
  getDefaultValue: () => null,
  
  toSchemaField: (definition) => ({
    type: 'media',
    validation: {
      ...definition.validation,
      restrictToMediaType: 'document',
      allowedExtensions: definition.validation?.allowedExtensions || DOCUMENT_EXTENSIONS,
      allowedTypes: definition.validation?.allowedTypes || DOCUMENT_MIME_TYPES,
    },
    options: {
      ...definition.options,
      enableBrowse: definition.options?.enableBrowse ?? true,
      enableUpload: definition.options?.enableUpload ?? true,
      enableDragDrop: definition.options?.enableDragDrop ?? true,
    }
  }),
  
  fromSchemaField: (schemaField) => ({
    type: 'document' as const,
    validation: {
      ...schemaField.validation,
      restrictToMediaType: 'document' as const,
    },
    options: schemaField.options || {}
  }),
  
  settings: {
    icon: '📄',
    color: '#3B82F6',
    tags: ['media', 'document', 'upload', 'file']
  },
  
  demoConfig: {
    examples: [
      {
        name: 'User Manual PDF',
        value: {
          _type: 'media',
          asset: {
            _ref: 'document-manual-101',
            _type: 'mediaAsset'
          },
          alt: 'Complete user manual for product setup and configuration',
          title: 'User Manual v2.1 - Complete Guide',
          caption: 'Comprehensive documentation for end users'
        },
        description: 'PDF document with metadata for documentation'
      }
    ],
    invalidValue: {
      _type: 'media',
      asset: {
        _ref: 'invalid-image-file',
        _type: 'mediaAsset'  
      }
    },
    variants: [
      {
        name: 'Basic Document',
        definition: {
          type: 'document' as const,
          validation: {
            required: false,
            maxFileSize: 10 * 1024 * 1024 // 10MB
          }
        }
      },
      {
        name: 'Legal Document', 
        definition: {
          type: 'document' as const,
          validation: {
            required: true,
            maxFileSize: 25 * 1024 * 1024, // 25MB
            allowedExtensions: ['pdf', 'doc', 'docx'],
            maxPages: 50
          },
          options: {
            requireAlt: true,
            showMetadata: true,
            showPageCount: true,
            showFileSize: true,
            allowPreview: true,
            allowDownload: true
          }
        }
      }
    ]
  }
};