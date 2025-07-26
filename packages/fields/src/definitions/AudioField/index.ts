/**
 * Audio Field Plugin
 * Specialized MediaField variant for audio files only
 */

import { MediaFieldComponent } from '../MediaField/component.js';
import { MediaFieldPreview } from '../MediaField/preview.js';
import { validateMediaField } from '../MediaField/validation.js';
import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { MediaFieldDefinition, MediaFieldValue } from '../MediaField/definition.js';

// Audio-specific field definition extending MediaField
export interface AudioFieldDefinition extends MediaFieldDefinition {
  type: 'audio';
  validation?: MediaFieldDefinition['validation'] & {
    // Audio-specific validations
    maxDuration?: number; // in seconds
    minDuration?: number; // in seconds
    allowedCodecs?: string[]; // e.g., ['mp3', 'wav', 'ogg', 'aac']
  };
  options?: MediaFieldDefinition['options'] & {
    // Audio-specific options
    showWaveform?: boolean;
    showDuration?: boolean;
    autoplay?: boolean;
  };
}

export type AudioFieldValue = MediaFieldValue;

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
    // Use base MediaField validation
    const baseResult = validateMediaField(value, definition, context);
    if (!baseResult.isValid) {
      return baseResult;
    }
    
    // Additional audio-specific validation would go here
    // For now, we rely on the restrictToMediaType validation
    
    return { isValid: true };
  },
  
  getDefaultValue: () => null,
  
  toSchemaField: (definition) => ({
    type: 'media',
    validation: {
      ...definition.validation,
      restrictToMediaType: 'audio',
      allowedExtensions: definition.validation?.allowedExtensions || AUDIO_EXTENSIONS,
      allowedTypes: definition.validation?.allowedTypes || AUDIO_MIME_TYPES,
    },
    options: {
      ...definition.options,
      enableBrowse: definition.options?.enableBrowse ?? true,
      enableUpload: definition.options?.enableUpload ?? true,
      enableDragDrop: definition.options?.enableDragDrop ?? true,
    }
  }),
  
  fromSchemaField: (schemaField) => ({
    type: 'audio' as const,
    validation: {
      ...schemaField.validation,
      restrictToMediaType: 'audio' as const,
    },
    options: schemaField.options || {}
  }),
  
  settings: {
    icon: '🎵',
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
    invalidValue: {
      _type: 'media',
      asset: {
        _ref: 'invalid-video-file',
        _type: 'mediaAsset'  
      }
    },
    variants: [
      {
        name: 'Basic Audio',
        definition: {
          type: 'audio' as const,
          validation: {
            required: false,
            maxFileSize: 50 * 1024 * 1024 // 50MB
          }
        }
      },
      {
        name: 'Podcast Audio', 
        definition: {
          type: 'audio' as const,
          validation: {
            required: true,
            maxFileSize: 100 * 1024 * 1024, // 100MB
            allowedExtensions: ['mp3', 'wav']
          },
          options: {
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