/**
 * Trokky Client SDK
 * TypeScript-native client for Trokky CMS with type generation
 */

export { HttpClient } from './http/client'
export { CacheManager } from './cache/manager'
export { DocumentClient } from './document/client'
export { TrokkyClient } from './client'

export type {
  ClientConfig,
  AuthConfig,
  AuthTokens,
  RequestOptions,
  QueryOptions,
  DocumentResult,
  CollectionResult,
  MediaResult,
  ValidationError,
  ApiError,
  CacheEntry,
  TypeGeneratorOptions,
  BaseDocument,
  ClientEvents,
  ClientEventType
} from './types'

// Type generator exports (for separate import)
export { 
  TypeGenerator, 
  generateTypes, 
  generateTypesFromSchema 
} from './generator'

export type {
  FieldSchema,
  DocumentSchema,
  ProjectSchema
} from './generator'