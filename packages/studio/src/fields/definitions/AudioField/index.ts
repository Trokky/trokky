/**
 * Audio Field Plugin
 * Specialized field type for audio files only
 */

import { MediaFieldComponent } from '../MediaField/component.js';
import { MediaFieldPreview } from '../MediaField/preview.js';
import { validateMediaField } from '../MediaField/validation.js';
import type { MediaFieldDefinition } from '../MediaField/definition.js';
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
  'audio/mpeg',       // MP3
  'audio/mp3',        // Alternative MP3 MIME type
  'audio/wav',        // WAV
  'audio/wave',       // Alternative WAV MIME type
  'audio/ogg',        // OGG
  'audio/aac',        // AAC
  'audio/mp4',        // M4A (MP4 audio)
  'audio/x-m4a',      // Alternative M4A MIME type
  'audio/flac',       // FLAC
  'audio/webm'        // WebM audio
];

// Wrapper component that converts AudioFieldDefinition to MediaFieldDefinition
function AudioFieldComponent(props: any) {
  // Convert AudioFieldDefinition to MediaFieldDefinition format
  const audioDefinition = props.definition as AudioFieldDefinition;
  
  const mediaDefinition: MediaFieldDefinition = {
    type: 'media',
    title: audioDefinition.title,
    description: audioDefinition.description,
    required: audioDefinition.required,
    validation: {
      ...audioDefinition.validation,
      restrictToMediaType: 'audio',
      allowedExtensions: audioDefinition.validation?.allowedExtensions || AUDIO_EXTENSIONS,
      allowedTypes: audioDefinition.validation?.allowedTypes || AUDIO_MIME_TYPES,
    },
    options: {
      enableBrowse: true,
      enableUpload: true,
      enableDragDrop: true,
      ...audioDefinition.options,
    }
  };
  
  // Pass converted definition to MediaFieldComponent
  return MediaFieldComponent({
    ...props,
    definition: mediaDefinition
  });
}

export const AudioFieldPlugin: FieldPlugin<AudioFieldDefinition, AudioFieldValue> = {
  type: 'audio',
  displayName: 'Audio',
  description: 'Upload and manage audio files with audio-specific validation',
  category: 'media',
  
  component: AudioFieldComponent,
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
            maxFileSize: 100 * 1024 * 1024, // 100MB for music files
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
            maxFileSize: 200 * 1024 * 1024, // 200MB for podcasts
            restrictToMediaType: 'audio' as const,
            allowedExtensions: ['mp3', 'wav', 'aac', 'm4a'],
            allowedTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/aac', 'audio/mp4', 'audio/x-m4a']
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