/**
 * Media Field Definition
 * Based on proven legacy architecture from Trokky v1
 */

import type { BaseFieldDefinition, BaseValidation, BaseFieldOptions } from '../../base/FieldDefinition.js';

// Media asset reference structure (matches legacy pattern)
export interface MediaAssetReference {
  _ref: string;
  _type: 'mediaAsset';
}

// Media field value structure
export interface MediaFieldValue {
  _type: 'media';
  asset: MediaAssetReference;
  // Instance-specific metadata (usage-specific)
  alt?: string;
  caption?: string;
  title?: string; // Override asset title for this usage
  variant?: string; // Selected variant name (e.g., 'thumbnail', 'preview', 'hero')
}

// Supported media types
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'archive';

// File validation constraints
export interface MediaValidation extends BaseValidation {
  // File type constraints
  allowedTypes?: string[]; // MIME types: ['image/jpeg', 'image/png']
  allowedExtensions?: string[]; // Extensions: ['.jpg', '.png', '.pdf']
  restrictToMediaType?: MediaType; // Restrict to specific media category
  
  // Size constraints
  maxFileSize?: number; // Bytes
  minFileSize?: number; // Bytes
  
  // Image-specific constraints (for image media types)
  maxWidth?: number;
  maxHeight?: number;
  minWidth?: number;
  minHeight?: number;
  aspectRatio?: number; // Width/height ratio
  aspectRatioTolerance?: number; // Tolerance for aspect ratio (0.1 = 10%)
  
  // Video-specific constraints
  maxDuration?: number; // Seconds
  minDuration?: number; // Seconds
  
  // Security constraints
  blockDangerousExtensions?: boolean; // Block .exe, .bat, etc.
  requireVirusScan?: boolean; // Require virus scanning
}

// Media field specific options
export interface MediaFieldOptions extends BaseFieldOptions {
  // Upload behavior
  enableUpload?: boolean; // Allow direct upload
  enableBrowse?: boolean; // Allow browsing existing media
  enableDragDrop?: boolean; // Enable drag & drop upload
  
  // UI options
  showPreview?: boolean; // Show preview in edit mode
  previewSize?: 'small' | 'medium' | 'large';
  showMetadata?: boolean; // Show metadata editor
  
  // Browser options
  mediaTypeFilter?: MediaType; // Filter media browser by type
  showVariantSelector?: boolean; // Allow variant selection for images
  
  // Upload directory
  uploadPath?: string; // Custom upload path
  
  // Instance metadata requirements
  requireAlt?: boolean; // Require alt text (accessibility)
  requireCaption?: boolean; // Require caption
  
  // Asset metadata requirements
  requireAssetTitle?: boolean; // Require asset to have title
  requireAssetDescription?: boolean; // Require asset to have description
}

// Media field definition
export interface MediaFieldDefinition extends BaseFieldDefinition {
  type: 'media';
  validation?: MediaValidation;
  options?: MediaFieldOptions;
  defaultValue?: MediaFieldValue | null;
}

// Default media field configuration
export const MEDIA_FIELD_DEFAULTS: Partial<MediaFieldDefinition> = {
  type: 'media',
  required: false,
  options: {
    enableUpload: true,
    enableBrowse: true,
    enableDragDrop: true,
    showPreview: true,
    previewSize: 'medium',
    showMetadata: true,
    showVariantSelector: false,
    requireAlt: false,
    requireCaption: false,
    requireAssetTitle: false,
    requireAssetDescription: false,
    layout: 'default',
    width: 'full'
  },
  validation: {
    maxFileSize: 10 * 1024 * 1024, // 10MB default
    blockDangerousExtensions: true,
    requireVirusScan: false
  },
  defaultValue: null
};

// Common media type presets
export const MEDIA_TYPE_PRESETS = {
  image: {
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
    restrictToMediaType: 'image' as MediaType,
    maxFileSize: 20 * 1024 * 1024, // 20MB for images
    requireAlt: true // Images should have alt text for accessibility
  },
  video: {
    allowedTypes: ['video/mp4', 'video/webm', 'video/mov', 'video/avi'],
    allowedExtensions: ['.mp4', '.webm', '.mov', '.avi'],
    restrictToMediaType: 'video' as MediaType,
    maxFileSize: 500 * 1024 * 1024, // 500MB for videos
    maxDuration: 3600 // 1 hour max
  },
  audio: {
    allowedTypes: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'],
    allowedExtensions: ['.mp3', '.wav', '.ogg', '.m4a'],
    restrictToMediaType: 'audio' as MediaType,
    maxFileSize: 50 * 1024 * 1024, // 50MB for audio
    maxDuration: 7200 // 2 hours max
  },
  document: {
    allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    allowedExtensions: ['.pdf', '.doc', '.docx'],
    restrictToMediaType: 'document' as MediaType,
    maxFileSize: 25 * 1024 * 1024 // 25MB for documents
  }
};