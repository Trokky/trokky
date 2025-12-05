/**
 * Trokky Client SDK
 * TypeScript-native client for Trokky CMS with type generation
 */

export { HttpClient } from './http/client.js'
export { CacheManager } from './cache/manager.js'
export { DocumentClient } from './document/client.js'
export { TrokkyClient } from './client.js'
export { MediaHelper } from './media/helper.js'

// Fluent Query Builder
export { QueryBuilder, SingletonBuilder } from './query/builder.js'
export type { QueryBuilderOptions, ExpandConfig } from './query/builder.js'

// Fluent Image URL Builder
export {
  ImageUrlBuilder,
  createImageUrlBuilder,
  getSrcSet,
  getBestVariant
} from './media/url-builder.js'
export type { ImageUrlBuilderOptions, ImageFormat, ImageFit } from './media/url-builder.js'

// Shortcode support
export { ShortcodeResolver, createMediaUrlResolver } from './shortcodes/resolver.js'
export {
  parseShortcodeAttrs,
  parseImageShortcode,
  shortcodeToHtml,
  resolveShortcodes,
  hasShortcodes,
  extractImageShortcodes
} from './shortcodes/parser.js'

export type {
  ClientConfig,
  AuthConfig,
  ApiTokenAuth,
  AuthTokens,
  AppToken,
  CreateAppTokenData,
  AppTokenResult,
  RequestOptions,
  MediaResult,
  ValidationError,
  ApiError,
  CacheEntry,
  TypeGeneratorOptions,
  DocumentGeneratorOptions,
  ClientEvents,
  ClientEventType,
  // Re-exported from @trokky/types
  BaseDocument,
  DocumentResult,
  CollectionResult,
  DocumentWithContent,
  QueryOptions,
  ListOptions,
  MediaAsset,
  MediaFieldValue,
  MediaAssetReference,
  MediaType
} from './types/index.js'

// Shortcode types
export type {
  TrokkyImageShortcode,
  MediaUrlResolver
} from './shortcodes/types.js'

// Type generator exports (for separate import)
export { 
  TypeGenerator, 
  generateTypes, 
  generateTypesFromSchema,
  DocumentGenerator,
  generateDocuments
} from './generator/index.js'

export type {
  FieldSchema,
  DocumentSchema,
  ProjectSchema
} from './generator/index.js'

// Media types
export type {
  MediaVariant,
  MediaFile,
  MediaResponse
} from './media/helper.js'

// React integration (optional export path)
export * as React from './react/index.js'