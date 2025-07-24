// Core engine
export { TrokkyCore, type TrokkyCoreOptions, type AuditEvent } from './core/engine.js'

// Crypto adapters
export { 
  detectCryptoAdapter, 
  type CryptoAdapter, 
  type CryptoAdapterOptions, 
  type JWTOptions 
} from './crypto/adapter.js'

// Schema management
export { SchemaRegistry } from './schema/registry.js'

// Validation
export { DocumentValidator } from './validation/validator.js'

// Security
export { SecurityValidator } from './security/validation.js'
export { RateLimiter, type RateLimitConfig } from './security/rate-limiter.js'

// Field system
export {
  FieldTypeRegistry,
  FieldTypeRegistrationError,
  ConditionalEvaluator,
  ConditionalEvaluationError,
  ConditionalUtils,
  FieldUtils,
  defineField,
  defineType,
  rule,
  Rule,
  type FieldType,
  FieldCategory,
  type FieldContext,
  type FieldDefinition,
  type FieldProps,
  type PreviewProps,
  type ConditionalExpression,
  type ValidationRule,
  type FieldMigration,
  type FieldTypeMetadata,
  type HttpClient,
  type ApiClient
} from './fields/index.js'

// Studio integration
export { StudioIntegration, type StudioConfig, type StudioRoute, type StudioRequest, type StudioResponse } from './studio/integration.js'

// Utilities
export { IdGenerator, type IdGeneratorOptions } from './utils/id-generator.js'
export { 
  TrokkyLogger, 
  LoggerFactory, 
  createLogger, 
  LoggerPresets,
  type LogLevel, 
  type LogContext, 
  type LogEntry, 
  type LoggerConfig 
} from './utils/logger.js'

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
  ListOptions,
  ValidationResult,
  MediaFile,
  MediaMetadata,
  Migration,
  StorageAdapter,
  StorageAdapterOptions,
  ApiConfig,
  TrokkyConfig,
  User,
  UserRole,
  Permission,
  UserPreferences,
  CreateUserData,
  UpdateUserData,
  UserListOptions,
  LoginCredentials,
  UserSession
} from './types/index.js'

// Zod schemas for validation
export {
  LegacyFieldTypeSchema,
  LegacyFieldDefinitionSchema,
  ContentSchemaSchema
} from './types/index.js'