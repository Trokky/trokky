// Core engine
export { TrokkyCore, type TrokkyCoreOptions, type AuditEvent } from './core/engine'

// Crypto adapters
export { 
  detectCryptoAdapter, 
  type CryptoAdapter, 
  type CryptoAdapterOptions, 
  type JWTOptions 
} from './crypto/adapter'

// Schema management
export { SchemaRegistry } from './schema/registry'

// Validation
export { DocumentValidator } from './validation/validator'

// Security
export { SecurityValidator } from './security/validation'
export { RateLimiter, type RateLimitConfig } from './security/rate-limiter'

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
} from './fields/index'

// Utilities
export { IdGenerator, type IdGeneratorOptions } from './utils/id-generator'
export { 
  TrokkyLogger, 
  LoggerFactory, 
  createLogger, 
  LoggerPresets,
  type LogLevel, 
  type LogContext, 
  type LogEntry, 
  type LoggerConfig 
} from './utils/logger'

// Errors
export {
  TrokkyError,
  ValidationError,
  SchemaNotFoundError,
  DocumentNotFoundError,
  InvalidInputError,
  RateLimitError,
  type ValidationErrorDetail
} from './errors/index'

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
} from './types/index'

// Zod schemas for validation
export {
  LegacyFieldTypeSchema,
  LegacyFieldDefinitionSchema,
  ContentSchemaSchema
} from './types/index'