/**
 * Media Field Plugin
 * Complete field plugin definition for media fields
 */

import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { MediaFieldDefinition, MediaFieldValue } from './definition.js';
import { MediaFieldComponent } from './component.js';
import { MediaFieldPreview } from './preview.js';
import { validateMediaField } from './validation.js';
import { MEDIA_FIELD_DEFAULTS, MEDIA_TYPE_PRESETS } from './definition.js';

export const mediaFieldPlugin: FieldPlugin<MediaFieldDefinition, MediaFieldValue | null> = {
  type: 'media',
  displayName: 'Media',
  description: 'Upload and manage images, videos, audio, documents, and other media files',
  category: 'media',
  
  component: MediaFieldComponent,
  previewComponent: MediaFieldPreview,
  
  validate: validateMediaField,
  
  getDefaultValue: (definition) => {
    return definition.defaultValue || MEDIA_FIELD_DEFAULTS.defaultValue || null;
  },
  
  toSchemaField: (definition) => {
    return {
      type: 'media',
      title: definition.title,
      description: definition.description,
      required: definition.required,
      validation: definition.validation,
      options: definition.options,
      defaultValue: definition.defaultValue
    };
  },
  
  fromSchemaField: (schemaField) => {
    return {
      type: 'media' as const,
      title: schemaField.title || 'Media Field',
      description: schemaField.description,
      required: schemaField.required || false,
      validation: schemaField.validation || {},
      options: schemaField.options || {},
      defaultValue: schemaField.defaultValue
    };
  },
  
  settings: {
    icon: 'photo',
    color: '#10B981',
    tags: ['media', 'upload', 'file', 'image', 'video', 'audio', 'document']
  },

  // Demo configuration for auto-generated field demos
  demoConfig: {
    examples: [
      { 
        name: 'Hero Image', 
        value: {
          _type: 'media',
          asset: { _ref: 'image-hero-abc123', _type: 'mediaAsset' },
          alt: 'Beautiful landscape hero image',
          caption: 'Mountain vista at sunrise',
          title: 'Hero Banner'
        }, 
        description: 'Main banner image for website' 
      },
      { 
        name: 'Profile Photo', 
        value: {
          _type: 'media',
          asset: { _ref: 'image-profile-def456', _type: 'mediaAsset' },
          alt: 'John Doe profile photo',
          caption: '',
          title: 'John Profile'
        }, 
        description: 'User profile picture' 
      },
      { 
        name: 'Product Video', 
        value: {
          _type: 'media',
          asset: { _ref: 'video-product-ghi789', _type: 'mediaAsset' },
          alt: '',
          caption: 'Product demonstration video showing key features',
          title: 'Product Demo'
        }, 
        description: 'Marketing video for product page' 
      }
    ],
    invalidValue: null,
    variants: [
      {
        name: 'General Media',
        definition: {
          type: 'media' as const,
          title: 'Media Upload',
          description: 'Upload any type of media file',
          options: {
            enableUpload: true,
            enableBrowse: true,
            enableDragDrop: true,
            showPreview: true,
            showMetadata: true
          }
        }
      },
      {
        name: 'Image Only',
        definition: {
          type: 'media' as const,
          title: 'Image Field',
          description: 'Image upload with alt text requirement',
          required: true,
          validation: MEDIA_TYPE_PRESETS.image,
          options: {
            enableUpload: true,
            enableBrowse: true,
            enableDragDrop: true,
            showPreview: true,
            showMetadata: true,
            requireAlt: true
          }
        }
      },
      {
        name: 'Video Upload',
        definition: {
          type: 'media' as const,
          title: 'Video Field',
          description: 'Video file upload with size limits',
          validation: MEDIA_TYPE_PRESETS.video,
          options: {
            enableUpload: true,
            enableBrowse: false,
            enableDragDrop: true,
            showPreview: true,
            showMetadata: true,
            requireCaption: true
          }
        }
      },
      {
        name: 'Document Upload',
        definition: {
          type: 'media' as const,
          title: 'Document Field',
          description: 'PDF and document upload',
          validation: MEDIA_TYPE_PRESETS.document,
          options: {
            enableUpload: true,
            enableBrowse: true,
            enableDragDrop: true,
            showPreview: false,
            showMetadata: true
          }
        }
      },
      {
        name: 'Small Image',
        definition: {
          type: 'media' as const,
          title: 'Thumbnail Image',
          description: 'Small image with size constraints',
          validation: {
            ...MEDIA_TYPE_PRESETS.image,
            maxFileSize: 2 * 1024 * 1024, // 2MB
            maxWidth: 800,
            maxHeight: 600
          },
          options: {
            enableUpload: true,
            enableBrowse: true,
            enableDragDrop: true,
            showPreview: true,
            previewSize: 'small',
            showMetadata: false,
            requireAlt: true
          }
        }
      },
      {
        name: 'Browse Only',
        definition: {
          type: 'media' as const,
          title: 'Select Existing Media',
          description: 'Select from existing media library only',
          options: {
            enableUpload: false,
            enableBrowse: true,
            enableDragDrop: false,
            showPreview: true,
            showMetadata: true
          }
        }
      }
    ]
  }
};

// Export components and types for direct use
export { MediaFieldComponent } from './component.js';
export { MediaFieldPreview } from './preview.js';
export { validateMediaField } from './validation.js';
export type { 
  MediaFieldDefinition, 
  MediaFieldValue, 
  MediaValidation, 
  MediaFieldOptions,
  MediaAssetReference,
  MediaType
} from './definition.js';
export { MEDIA_FIELD_DEFAULTS, MEDIA_TYPE_PRESETS } from './definition.js';