/**
 * Image Field Plugin  
 * Specialized field type for image files only
 */

import { MediaFieldComponent } from '../MediaField/component.js';
import { MediaFieldPreview } from '../MediaField/preview.js';
import { validateMediaField } from '../MediaField/validation.js';
import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { BaseFieldDefinition } from '../../base/FieldDefinition.js';

// Image field definition - separate type
export interface ImageFieldDefinition extends BaseFieldDefinition {
  type: 'image';
  validation?: {
    required?: boolean;
    maxFileSize?: number;
    allowedExtensions?: string[];
    allowedTypes?: string[];
    restrictToMediaType?: 'image';
    maxWidth?: number;
    maxHeight?: number;
    minWidth?: number;
    minHeight?: number;
    aspectRatio?: number; // width/height ratio
    allowedFormats?: string[]; // e.g., ['jpeg', 'png', 'webp', 'svg']
  };
  options?: {
    enableBrowse?: boolean;
    enableUpload?: boolean;
    enableDragDrop?: boolean;
    showMetadata?: boolean;
    requireAlt?: boolean;
    requireCaption?: boolean;
    showVariantSelector?: boolean;
    showDimensions?: boolean;
    showFileSize?: boolean;
    cropEnabled?: boolean;
    resizeEnabled?: boolean;
    quality?: number; // 1-100 for JPEG compression
  };
}

export type ImageFieldValue = {
  _type: 'media';
  asset: {
    _ref: string;
    _type: 'mediaAsset';
  };
  alt?: string;
  caption?: string;
  title?: string;
} | null;

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
    // Convert to MediaField format for validation
    const mediaDefinition = {
      type: 'media' as const,
      title: definition.title,
      validation: {
        ...definition.validation,
        restrictToMediaType: 'image' as const
      },
      options: definition.options
    };
    
    return validateMediaField(value, mediaDefinition as any, context);
  },
  
  getDefaultValue: () => null,
  
  toSchemaField: (definition) => ({
    type: 'image',
    title: definition.title,
    validation: {
      ...definition.validation,
      restrictToMediaType: 'image',
      allowedExtensions: definition.validation?.allowedExtensions || IMAGE_EXTENSIONS,
      allowedTypes: definition.validation?.allowedTypes || IMAGE_MIME_TYPES,
    },
    options: {
      enableBrowse: true,
      enableUpload: true,
      enableDragDrop: true,
      ...definition.options,
    }
  }),
  
  fromSchemaField: (schemaField) => ({
    type: 'image' as const,
    title: schemaField.title || 'Image Field',
    validation: {
      ...schemaField.validation,
      restrictToMediaType: 'image' as const,
    },
    options: schemaField.options || {}
  }),
  
  settings: {
    icon: 'image',
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
    invalidValue: null,
    variants: [
      {
        name: 'Basic Image',
        definition: {
          type: 'image' as const,
          title: 'Image File',
          validation: {
            required: false,
            maxFileSize: 5 * 1024 * 1024, // 5MB
            restrictToMediaType: 'image' as const,
            allowedExtensions: IMAGE_EXTENSIONS,
            allowedTypes: IMAGE_MIME_TYPES
          },
          options: {
            enableBrowse: true,
            enableUpload: true,
            enableDragDrop: true
          }
        }
      },
      {
        name: 'High-Quality Hero Image', 
        definition: {
          type: 'image' as const,
          title: 'Hero Image',
          validation: {
            required: true,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            restrictToMediaType: 'image' as const,
            allowedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
            allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
            minWidth: 1920,
            minHeight: 1080,
            aspectRatio: 16/9
          },
          options: {
            enableBrowse: true,
            enableUpload: true,
            enableDragDrop: true,
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