/**
 * Video Field Plugin
 * Specialized field type for video files only
 */

import { MediaFieldComponent } from '../MediaField/component.js';
import { MediaFieldPreview } from '../MediaField/preview.js';
import { validateMediaField } from '../MediaField/validation.js';
import type { MediaFieldDefinition } from '../MediaField/definition.js';
import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { BaseFieldDefinition } from '../../base/FieldDefinition.js';

// Video field definition - separate type
export interface VideoFieldDefinition extends BaseFieldDefinition {
  type: 'video';
  validation?: {
    required?: boolean;
    maxFileSize?: number;
    allowedExtensions?: string[];
    allowedTypes?: string[];
    restrictToMediaType?: 'video';
    maxDuration?: number; // in seconds
    minDuration?: number; // in seconds
    maxResolution?: { width: number; height: number };
    minResolution?: { width: number; height: number };
    allowedCodecs?: string[]; // e.g., ['h264', 'vp9', 'av1']
  };
  options?: {
    enableBrowse?: boolean;
    enableUpload?: boolean;
    enableDragDrop?: boolean;
    showMetadata?: boolean;
    requireAlt?: boolean;
    requireCaption?: boolean;
    showVariantSelector?: boolean;
    showThumbnail?: boolean;
    showDuration?: boolean;
    autoplay?: boolean;
    muted?: boolean;
    controls?: boolean;
  };
}

export type VideoFieldValue = {
  _type: 'media';
  asset: {
    _ref: string;
    _type: 'mediaAsset';
  };
  alt?: string;
  caption?: string;
  title?: string;
} | null;

// Default video file extensions and MIME types
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'm4v'];
const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',   // MOV files
  'video/x-msvideo',   // AVI files
  'video/x-matroska',  // MKV files
  'video/x-ms-wmv',    // WMV files
  'video/x-flv',       // FLV files
  'video/mov'          // Alternative MOV MIME type
];

// Wrapper component that converts VideoFieldDefinition to MediaFieldDefinition
function VideoFieldComponent(props: any) {
  // Convert VideoFieldDefinition to MediaFieldDefinition format
  const videoDefinition = props.definition as VideoFieldDefinition;
  
  const mediaDefinition: MediaFieldDefinition = {
    type: 'media',
    title: videoDefinition.title,
    description: videoDefinition.description,
    required: videoDefinition.required,
    validation: {
      ...videoDefinition.validation,
      restrictToMediaType: 'video',
      allowedExtensions: videoDefinition.validation?.allowedExtensions || VIDEO_EXTENSIONS,
      allowedTypes: videoDefinition.validation?.allowedTypes || VIDEO_MIME_TYPES,
    },
    options: {
      enableBrowse: true,
      enableUpload: true,
      enableDragDrop: true,
      ...videoDefinition.options,
    }
  };
  
  // Pass converted definition to MediaFieldComponent
  return MediaFieldComponent({
    ...props,
    definition: mediaDefinition
  });
}

export const VideoFieldPlugin: FieldPlugin<VideoFieldDefinition, VideoFieldValue> = {
  type: 'video',
  displayName: 'Video',
  description: 'Upload and manage video files with video-specific validation',
  category: 'media',
  
  component: VideoFieldComponent,
  previewComponent: MediaFieldPreview,
  
  validate: (value, definition, context) => {
    // Convert to MediaField format for validation
    const mediaDefinition = {
      type: 'media' as const,
      title: definition.title,
      validation: {
        ...definition.validation,
        restrictToMediaType: 'video' as const
      },
      options: definition.options
    };
    
    return validateMediaField(value, mediaDefinition as any, context);
  },
  
  getDefaultValue: () => null,
  
  toSchemaField: (definition) => ({
    type: 'video',
    title: definition.title,
    validation: {
      ...definition.validation,
      restrictToMediaType: 'video',
      allowedExtensions: definition.validation?.allowedExtensions || VIDEO_EXTENSIONS,
      allowedTypes: definition.validation?.allowedTypes || VIDEO_MIME_TYPES,
    },
    options: {
      enableBrowse: true,
      enableUpload: true,
      enableDragDrop: true,
      ...definition.options,
    }
  }),
  
  fromSchemaField: (schemaField) => ({
    type: 'video' as const,
    title: schemaField.title || 'Video Field',
    validation: {
      ...schemaField.validation,
      restrictToMediaType: 'video' as const,
    },
    options: schemaField.options || {}
  }),
  
  settings: {
    icon: 'video',
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
    invalidValue: null,
    variants: [
      {
        name: 'Basic Video',
        definition: {
          type: 'video' as const,
          title: 'Video File',
          validation: {
            required: false,
            maxFileSize: 100 * 1024 * 1024, // 100MB
            restrictToMediaType: 'video' as const,
            allowedExtensions: VIDEO_EXTENSIONS,
            allowedTypes: VIDEO_MIME_TYPES
          },
          options: {
            enableBrowse: true,
            enableUpload: true,
            enableDragDrop: true
          }
        }
      },
      {
        name: 'HD Marketing Video', 
        definition: {
          type: 'video' as const,
          title: 'HD Marketing Video',
          validation: {
            required: true,
            maxFileSize: 500 * 1024 * 1024, // 500MB
            restrictToMediaType: 'video' as const,
            allowedExtensions: ['mp4', 'webm'],
            allowedTypes: ['video/mp4', 'video/webm'],
            minResolution: { width: 1280, height: 720 },
            maxDuration: 300 // 5 minutes
          },
          options: {
            enableBrowse: true,
            enableUpload: true,
            enableDragDrop: true,
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