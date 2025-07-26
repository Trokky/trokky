/**
 * Image Field Plugin
 * Specialized MediaField variant for image files only
 */

import { MediaFieldComponent } from '../MediaField/component.js';
import { MediaFieldPreview } from '../MediaField/preview.js';
import { validateMediaField } from '../MediaField/validation.js';
import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { MediaFieldDefinition, MediaFieldValue } from '../MediaField/definition.js';

// Image-specific field definition extending MediaField
export interface ImageFieldDefinition extends MediaFieldDefinition {
  type: 'image';
  validation?: MediaFieldDefinition['validation'] & {
    // Image-specific validations
    maxWidth?: number;
    maxHeight?: number;
    minWidth?: number;
    minHeight?: number;
    aspectRatio?: number; // width/height ratio
    allowedFormats?: string[]; // e.g., ['jpeg', 'png', 'webp', 'svg']
  };
  options?: MediaFieldDefinition['options'] & {
    // Image-specific options
    showDimensions?: boolean;
    showFileSize?: boolean;
    cropEnabled?: boolean;
    resizeEnabled?: boolean;
    quality?: number; // 1-100 for JPEG compression
  };
}

export type ImageFieldValue = MediaFieldValue;

// Default image file extensions and MIME types
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff'];
const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  'image/tiff'
];

export const ImageFieldPlugin: FieldPlugin<ImageFieldDefinition, ImageFieldValue> = {
  type: 'image',
  displayName: 'Image',
  description: 'Upload and manage image files with image-specific validation',
  category: 'media',
  
  component: MediaFieldComponent,
  previewComponent: MediaFieldPreview,
  
  validate: (value, definition, context) => {
    // Use base MediaField validation
    const baseResult = validateMediaField(value, definition, context);
    if (!baseResult.isValid) {
      return baseResult;
    }
    
    // Additional image-specific validation would go here
    // For now, we rely on the restrictToMediaType validation
    
    return { isValid: true };
  },
  
  getDefaultValue: () => null,
  
  toSchemaField: (definition) => ({
    type: 'media',
    validation: {
      ...definition.validation,
      restrictToMediaType: 'image',
      allowedExtensions: definition.validation?.allowedExtensions || IMAGE_EXTENSIONS,
      allowedTypes: definition.validation?.allowedTypes || IMAGE_MIME_TYPES,
    },
    options: {
      ...definition.options,
      enableBrowse: definition.options?.enableBrowse ?? true,
      enableUpload: definition.options?.enableUpload ?? true,
      enableDragDrop: definition.options?.enableDragDrop ?? true,
    }
  }),
  
  fromSchemaField: (schemaField) => ({
    type: 'image' as const,
    validation: {
      ...schemaField.validation,
      restrictToMediaType: 'image' as const,
    },
    options: schemaField.options || {}
  }),
  
  settings: {
    icon: '🖼️',
    color: '#10B981',
    tags: ['media', 'image', 'upload', 'visual']
  },
  
  demoConfig: {
    examples: [
      {
        name: 'Hero Image',
        value: {
          _type: 'media',
          asset: {
            _ref: 'image-hero-789',
            _type: 'mediaAsset'
          },
          alt: 'Stunning mountain landscape at sunset',
          title: 'Mountain Sunset Hero Image',
          caption: 'Beautiful landscape perfect for hero sections'
        },
        description: 'High-quality hero image with proper alt text'
      }
    ],
    invalidValue: {
      _type: 'media',
      asset: {
        _ref: 'invalid-document-file',
        _type: 'mediaAsset'  
      }
    },
    variants: [
      {
        name: 'Basic Image',
        definition: {
          type: 'image' as const,
          validation: {
            required: false,
            maxFileSize: 5 * 1024 * 1024 // 5MB
          }
        }
      },
      {
        name: 'High-Quality Hero Image', 
        definition: {
          type: 'image' as const,
          validation: {
            required: true,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
            minWidth: 1920,
            minHeight: 1080,
            aspectRatio: 16/9
          },
          options: {
            requireAlt: true,
            showMetadata: true,
            showDimensions: true,
            showFileSize: true,
            cropEnabled: true,
            quality: 85
          }
        }
      }
    ]
  }
};