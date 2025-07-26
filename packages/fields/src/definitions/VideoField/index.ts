/**
 * Video Field Plugin
 * Specialized MediaField variant for video files only
 */

import { MediaFieldComponent } from '../MediaField/component.js';
import { MediaFieldPreview } from '../MediaField/preview.js';
import { validateMediaField } from '../MediaField/validation.js';
import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { MediaFieldDefinition, MediaFieldValue } from '../MediaField/definition.js';

// Video-specific field definition extending MediaField
export interface VideoFieldDefinition extends MediaFieldDefinition {
  type: 'video';
  validation?: MediaFieldDefinition['validation'] & {
    // Video-specific validations
    maxDuration?: number; // in seconds
    minDuration?: number; // in seconds
    maxResolution?: { width: number; height: number };
    minResolution?: { width: number; height: number };
    allowedCodecs?: string[]; // e.g., ['h264', 'vp9', 'av1']
  };
  options?: MediaFieldDefinition['options'] & {
    // Video-specific options
    showThumbnail?: boolean;
    showDuration?: boolean;
    autoplay?: boolean;
    muted?: boolean;
    controls?: boolean;
  };
}

export type VideoFieldValue = MediaFieldValue;

// Default video file extensions and MIME types
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'm4v'];
const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/x-ms-wmv',
  'video/x-flv'
];

export const VideoFieldPlugin: FieldPlugin<VideoFieldDefinition, VideoFieldValue> = {
  type: 'video',
  displayName: 'Video',
  description: 'Upload and manage video files with video-specific validation',
  category: 'media',
  
  component: MediaFieldComponent,
  previewComponent: MediaFieldPreview,
  
  validate: (value, definition, context) => {
    // Use base MediaField validation
    const baseResult = validateMediaField(value, definition, context);
    if (!baseResult.isValid) {
      return baseResult;
    }
    
    // Additional video-specific validation would go here
    // For now, we rely on the restrictToMediaType validation
    
    return { isValid: true };
  },
  
  getDefaultValue: () => null,
  
  toSchemaField: (definition) => ({
    type: 'media',
    validation: {
      ...definition.validation,
      restrictToMediaType: 'video',
      allowedExtensions: definition.validation?.allowedExtensions || VIDEO_EXTENSIONS,
      allowedTypes: definition.validation?.allowedTypes || VIDEO_MIME_TYPES,
    },
    options: {
      ...definition.options,
      enableBrowse: definition.options?.enableBrowse ?? true,
      enableUpload: definition.options?.enableUpload ?? true,
      enableDragDrop: definition.options?.enableDragDrop ?? true,
    }
  }),
  
  fromSchemaField: (schemaField) => ({
    type: 'video' as const,
    validation: {
      ...schemaField.validation,
      restrictToMediaType: 'video' as const,
    },
    options: schemaField.options || {}
  }),
  
  settings: {
    icon: '🎥',
    color: '#EF4444',
    tags: ['media', 'video', 'upload']
  },
  
  demoConfig: {
    examples: [
      {
        name: 'Product Demo Video',
        value: {
          _type: 'media',
          asset: {
            _ref: 'video-demo-456',
            _type: 'mediaAsset'
          },
          alt: 'Product demonstration video showing key features',
          title: 'Product Demo - Key Features Overview',
          caption: 'Learn about our product\'s main capabilities in under 3 minutes'
        },
        description: 'Video file with metadata for marketing content'
      }
    ],
    invalidValue: {
      _type: 'media',
      asset: {
        _ref: 'invalid-audio-file',
        _type: 'mediaAsset'  
      }
    },
    variants: [
      {
        name: 'Basic Video',
        definition: {
          type: 'video' as const,
          validation: {
            required: false,
            maxFileSize: 100 * 1024 * 1024 // 100MB
          }
        }
      },
      {
        name: 'HD Marketing Video', 
        definition: {
          type: 'video' as const,
          validation: {
            required: true,
            maxFileSize: 500 * 1024 * 1024, // 500MB
            allowedExtensions: ['mp4', 'webm'],
            minResolution: { width: 1280, height: 720 },
            maxDuration: 300 // 5 minutes
          },
          options: {
            requireAlt: true,
            showMetadata: true,
            showThumbnail: true,
            showDuration: true,
            controls: true
          }
        }
      }
    ]
  }
};