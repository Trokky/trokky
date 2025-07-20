// Core engine
export { TrokkyCore, type TrokkyCoreOptions } from './core/engine.js'

// Schema management
export { SchemaRegistry } from './schema/registry.js'

// Validation
export { DocumentValidator } from './validation/validator.js'

// Security
export { SecurityValidator } from './security/validation.js'
export { RateLimiter, type RateLimitConfig } from './security/rate-limiter.js'

// Utilities
export { IdGenerator, type IdGeneratorOptions } from './utils/id-generator.js'

// Errors
export {
  TrokkyError,
  ValidationError,
  SchemaNotFoundError,
  DocumentNotFoundError,
  InvalidInputError,
  RateLimitError,
  type ValidationErrorDetail
} from './errors/index.js'

// Types
export type {
  Document,
  DocumentData,
  DocumentWithContent,
  ContentSchema,
  FieldDefinition,
  FieldType,
  ListOptions,
  ValidationResult,
  MediaFile,
  MediaMetadata,
  Migration,
  StorageAdapter,
  StorageAdapterOptions,
  ApiConfig,
  TrokkyConfig
} from './types/index.js'

// Zod schemas for validation
export {
  FieldTypeSchema,
  FieldDefinitionSchema,
  ContentSchemaSchema
} from './types/index.js'