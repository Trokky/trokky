/**
 * Audio Field Plugin
 * Specialized field type for audio files only
 */

import { MediaFieldComponent } from '../MediaField/component.js';
import { MediaFieldPreview } from '../MediaField/preview.js';
import { validateMediaField } from '../MediaField/validation.js';
import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { BaseFieldDefinition, ValidationResult, DocumentContext } from '../../base/FieldDefinition.js';

// Audio field definition - separate type, not extending MediaFieldDefinition
export interface AudioFieldDefinition extends BaseFieldDefinition {
  type: 'audio';
  validation?: {
    required?: boolean;
    maxFileSize?: number;
    allowedExtensions?: string[];
    allowedTypes?: string[];
    restrictToMediaType?: 'audio';
    maxDuration?: number; // in seconds
    minDuration?: number; // in seconds
    allowedCodecs?: string[]; // e.g., ['mp3', 'wav', 'ogg', 'aac']
  };
  options?: {
    enableBrowse?: boolean;
    enableUpload?: boolean;
    enableDragDrop?: boolean;
    showMetadata?: boolean;
    requireAlt?: boolean;
    requireCaption?: boolean;
    showVariantSelector?: boolean;
    showWaveform?: boolean;
    showDuration?: boolean;
    autoplay?: boolean;
  };
}

// Use MediaFieldValue for consistency
export type AudioFieldValue = {
  _type: 'media';
  asset: {
    _ref: string;
    _type: 'mediaAsset';
  };
  alt?: string;
  caption?: string;
  title?: string;
} | null;

// Default audio file extensions and MIME types
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'webm'];
const AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/wav', 
  'audio/wave',
  'audio/ogg',
  'audio/aac',
  'audio/mp4',
  'audio/flac',
  'audio/webm'
];

export const AudioFieldPlugin: FieldPlugin<AudioFieldDefinition, AudioFieldValue> = {
  type: 'audio',
  displayName: 'Audio',
  description: 'Upload and manage audio files with audio-specific validation',
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
        restrictToMediaType: 'audio' as const
      },
      options: definition.options
    };
    
    return validateMediaField(value, mediaDefinition as any, context);
  },
  
  getDefaultValue: () => null,
  
  toSchemaField: (definition) => ({
    type: 'audio',
    title: definition.title,
    validation: {
      ...definition.validation,
      restrictToMediaType: 'audio',
      allowedExtensions: definition.validation?.allowedExtensions || AUDIO_EXTENSIONS,
      allowedTypes: definition.validation?.allowedTypes || AUDIO_MIME_TYPES,
    },
    options: {
      enableBrowse: true,
      enableUpload: true,
      enableDragDrop: true,
      ...definition.options,
    }
  }),
  
  fromSchemaField: (schemaField) => ({
    type: 'audio' as const,
    title: schemaField.title || 'Audio Field',
    validation: {
      ...schemaField.validation,
      restrictToMediaType: 'audio' as const,
    },
    options: schemaField.options || {}
  }),
  
  settings: {
    icon: 'audio',
    color: '#8B5CF6',
    tags: ['media', 'audio', 'upload']
  },
  
  demoConfig: {
    examples: [
      {
        name: 'Podcast Episode',
        value: {
          _type: 'media',
          asset: {
            _ref: 'audio-podcast-123',
            _type: 'mediaAsset'
          },
          alt: 'Weekly tech podcast episode 42',
          title: 'Tech Talk Episode 42: The Future of AI',
          caption: 'Discussion about AI trends and developments'
        },
        description: 'Audio file with metadata for podcast content'
      }
    ],
    invalidValue: null,
    variants: [
      {
        name: 'Basic Audio',
        definition: {
          type: 'audio' as const,
          title: 'Audio File',
          validation: {
            required: false,
            maxFileSize: 50 * 1024 * 1024, // 50MB
            restrictToMediaType: 'audio' as const,
            allowedExtensions: AUDIO_EXTENSIONS,
            allowedTypes: AUDIO_MIME_TYPES
          },
          options: {
            enableBrowse: true,
            enableUpload: true,
            enableDragDrop: true
          }
        }
      },
      {
        name: 'Podcast Audio', 
        definition: {
          type: 'audio' as const,
          title: 'Podcast Audio',
          validation: {
            required: true,
            maxFileSize: 100 * 1024 * 1024, // 100MB
            restrictToMediaType: 'audio' as const,
            allowedExtensions: ['mp3', 'wav'],
            allowedTypes: ['audio/mpeg', 'audio/wav']
          },
          options: {
            enableBrowse: true,
            enableUpload: true,
            enableDragDrop: true,
            requireAlt: true,
            showMetadata: true,
            showWaveform: true,
            showDuration: true
          }
        }
      }
    ]
  }
};