/**
 * Media Types
 * Shared types for media handling across all Trokky packages
 */

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

// Media asset data structure (from storage layer)
export interface MediaAsset {
  id: string;
  filename: string;
  originalFilename?: string;
  contentType: string;
  size: number;
  url: string;
  uploadedAt: string;
  title?: string;
  description?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    title?: string;
    alt?: string;
    credit?: string;
    author?: string;
    tags?: string[];
    imageVariants?: Record<string, {
      url: string;
      width: number;
      height: number;
      format: string;
      size: number;
    }>;
    originalDimensions?: {
      width: number;
      height: number;
    };
  };
}

// Media browser configuration interface
export interface MediaBrowserConfig {
  onSelect: (value: MediaFieldValue) => void;
  mediaTypeFilter?: MediaType;
  showVariantSelector?: boolean;
  context?: string;
}