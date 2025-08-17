/**
 * @trokky/types - Shared TypeScript types
 * 
 * This package contains shared types used across the Trokky ecosystem.
 * It has no dependencies to avoid circular dependency issues.
 */

// Media types
export type {
  MediaAssetReference,
  MediaFieldValue, 
  MediaType,
  MediaAsset,
  MediaBrowserConfig
} from './media.js';

// Field types  
export type {
  FieldRegistry,
  FieldTypeProvider,
  CoreFieldType,
  FieldType
} from './fields.js';

export { CORE_FIELD_TYPES } from './fields.js';