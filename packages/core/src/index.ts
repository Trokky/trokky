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

// OAuth
export {
  GoogleOAuthService,
  type GoogleOAuthConfig,
  type GoogleUserInfo,
  type GoogleTokenResponse,
  type PKCEChallenge,
} from './security/oauth/index.js'

// MFA (Multi-Factor Authentication)
export {
  TOTPService,
  createTOTPService,
  EmailOTPService,
  createEmailOTPService,
  getOTPEmailSubject,
  getOTPEmailBody,
  getOTPEmailHTML,
  type TOTPConfig,
  type TOTPSecretResult,
  type BackupCodeVerificationResult,
  type EmailOTPConfig,
  type EmailOTPResult,
} from './security/mfa/index.js'

// CAPTCHA
export {
  TurnstileService,
  createTurnstileService,
  createCaptchaProvider,
  type CaptchaProvider,
  type CaptchaProviderConfig,
  type CaptchaProviderType,
  type CaptchaProtectedEndpoint,
  type CaptchaVerificationResult,
  type TurnstileConfig,
} from './security/captcha/index.js'

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

// Media processing
export { 
  ImageProcessor, 
  NoOpImageProcessor, 
  createImageProcessor, 
  DEFAULT_IMAGE_VARIANTS,
  type ImageVariant, 
  type ProcessedImage, 
  type ProcessedImageVariant, 
  type ImageProcessorConfig 
} from './media/image-processor.js'

// Adapter registry system
export {
  getAdapterRegistry,
  registerAdapter,
  createAdapter,
  adapterRegistry,
  type AdapterRegistryConfig,
  type DataAdapterFactory,
  type MediaAdapterFactory
} from './adapters/registry.js'

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
export {
  getUniversalCrypto,
  bytesToHex,
  generateRandomHex,
  generateUUID,
  getSecureRandomInt,
  secureShuffleArray,
  generateSecurePassword,
  type UniversalCrypto,
  type SecurePasswordOptions
} from './utils/universal-crypto.js'

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
  UserSession,
  AppToken,
  AppTokenListOptions,
  CreateAppTokenData,
  UpdateAppTokenData,
  AuthContext,
  AuthenticatedUser,
  AuthenticatedAppToken,
  OAuthProvider,
  OAuthProviderType,
  // MFA types
  MFAMethodType,
  MFAMethod,
  TrustedDevice,
  MFAConfig,
  MFAPendingTokenPayload,
  MFASetupTokenPayload,
  TokenPayload,
  // Authentication result types
  AuthenticationResult,
  AuthenticationSuccessResult,
  AuthenticationMFARequiredResult,
  AuthenticationMFASetupRequiredResult,
  // Split storage adapter types
  DataStorageAdapter,
  MediaStorageAdapter,
  DataTransaction,
  MediaListOptions,
  MediaVariant,
  SplitStorageConfig,
  TrokkyStorageAdapters,
  WebhookListOptions,
  SettingsConfig,
  // Audit types
  AuditContext,
  AuditActorType,
  AuditLog,
  AuditOperation
} from './types/index.js'

export { ROLE_PERMISSIONS, AUDIT_ACTOR_TYPES, AUDIT_OPERATIONS } from './types/index.js'

// Zod schemas for validation
export {
  FieldTypeSchema,
  FieldDefinitionSchema,
  ContentSchemaSchema
} from './types/index.js'

// Event system
export {
  TrokkyEventBus,
  MemoryEventStorage,
  // Event creation utilities
  createDocumentEvent,
  createMediaEvent,
  createUserEvent,
  createAppTokenEvent,
  createSystemEvent,
  // Specific event builders
  documentCreated,
  documentUpdated,
  documentDeleted,
  documentPublished,
  documentUnpublished,
  mediaUploaded,
  mediaUpdated,
  mediaDeleted,
  mediaVariantGenerated,
  userCreated,
  userUpdated,
  userDeleted,
  userLogin,
  userLogout,
  userRoleChanged,
  appTokenCreated,
  appTokenUsed,
  systemStartup,
  systemShutdown,
  systemError,
  // Utility functions
  eventMatches,
  extractDocumentChanges,
  actorFromUser,
  actorFromAppToken,
  systemActor
} from './events/index.js'

export type {
  // Core event types
  TrokkyEvent,
  EventActor,
  EventMetadata,
  AnyTrokkyEvent,
  // Specific event types
  DocumentEvent,
  MediaEvent,
  UserEvent,
  AppTokenEvent,
  SystemEvent,
  CacheEvent,
  WebhookEvent,
  // Event handling
  EventListener,
  EventListenerConfig,
  EventFilter,
  EventQueryResult,
  EventStorage,
  EventStats,
  // Webhook types
  WebhookConfig,
  WebhookPayload,
  WebhookDeliveryResult,
  WebhookRetryPolicy,
  // Configuration types
  EventBusConfig,
  MemoryEventStorageConfig
} from './events/index.js'

// Mail types
export type {
  MailConfig,
  PasswordResetToken,
  PasswordResetRequest,
  PasswordResetVerification
} from './types/mail.js'