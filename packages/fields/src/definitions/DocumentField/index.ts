/**
 * Document Field Plugin
 * Specialized field type for document files only
 */

import { MediaFieldComponent } from '../MediaField/component.js';
import { MediaFieldPreview } from '../MediaField/preview.js';
import { validateMediaField } from '../MediaField/validation.js';
import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { BaseFieldDefinition } from '../../base/FieldDefinition.js';

// Document field definition - separate type
export interface DocumentFieldDefinition extends BaseFieldDefinition {
  type: 'document';
  validation?: {
    required?: boolean;
    maxFileSize?: number;
    allowedExtensions?: string[];
    allowedTypes?: string[];
    restrictToMediaType?: 'document';
    maxPages?: number;
    minPages?: number;
    allowedFormats?: string[]; // e.g., ['pdf', 'doc', 'docx', 'txt', 'rtf']
    requiresPassword?: boolean;
  };
  options?: {
    enableBrowse?: boolean;
    enableUpload?: boolean;
    enableDragDrop?: boolean;
    showMetadata?: boolean;
    requireAlt?: boolean;
    requireCaption?: boolean;
    showVariantSelector?: boolean;
    showPageCount?: boolean;
    showFileSize?: boolean;
    allowPreview?: boolean;
    allowDownload?: boolean;
  };
}

export type DocumentFieldValue = {
  _type: 'media';
  asset: {
    _ref: string;
    _type: 'mediaAsset';
  };
  alt?: string;
  caption?: string;
  title?: string;
} | null;

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
    // Convert to MediaField format for validation
    const mediaDefinition = {
      type: 'media' as const,
      title: definition.title,
      validation: {
        ...definition.validation,
        restrictToMediaType: 'document' as const
      },
      options: definition.options
    };
    
    return validateMediaField(value, mediaDefinition as any, context);
  },
  
  getDefaultValue: () => null,
  
  toSchemaField: (definition) => ({
    type: 'document',
    title: definition.title,
    validation: {
      ...definition.validation,
      restrictToMediaType: 'document',
      allowedExtensions: definition.validation?.allowedExtensions || DOCUMENT_EXTENSIONS,
      allowedTypes: definition.validation?.allowedTypes || DOCUMENT_MIME_TYPES,
    },
    options: {
      enableBrowse: true,
      enableUpload: true,
      enableDragDrop: true,
      ...definition.options,
    }
  }),
  
  fromSchemaField: (schemaField) => ({
    type: 'document' as const,
    title: schemaField.title || 'Document Field',
    validation: {
      ...schemaField.validation,
      restrictToMediaType: 'document' as const,
    },
    options: schemaField.options || {}
  }),
  
  settings: {
    icon: 'document',
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
    invalidValue: null,
    variants: [
      {
        name: 'Basic Document',
        definition: {
          type: 'document' as const,
          title: 'Document File',
          validation: {
            required: false,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            restrictToMediaType: 'document' as const,
            allowedExtensions: DOCUMENT_EXTENSIONS,
            allowedTypes: DOCUMENT_MIME_TYPES
          },
          options: {
            enableBrowse: true,
            enableUpload: true,
            enableDragDrop: true
          }
        }
      },
      {
        name: 'Legal Document', 
        definition: {
          type: 'document' as const,
          title: 'Legal Document',
          validation: {
            required: true,
            maxFileSize: 25 * 1024 * 1024, // 25MB
            restrictToMediaType: 'document' as const,
            allowedExtensions: ['pdf', 'doc', 'docx'],
            allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            maxPages: 50
          },
          options: {
            enableBrowse: true,
            enableUpload: true,
            enableDragDrop: true,
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