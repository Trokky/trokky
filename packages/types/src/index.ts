/**
 * @trokky/types - Shared TypeScript types
 *
 * This package contains shared types used across the Trokky ecosystem.
 * It has no dependencies to avoid circular dependency issues.
 */

// Document types
export type {
  BaseDocument,
  DocumentResult,
  CollectionResult,
  DocumentWithContent,
  QueryOptions,
  ListOptions
} from './document.js';

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

// Slug types
export type {
  SlugifyOptions,
  SlugFieldConfig,
  SlugFieldValue,
  SlugFieldOptions
} from './slug.js';

// Field system types
export type {
  // Conditional visibility
  ConditionalOperator,
  ConditionalConfig,
  // Validation
  ValidationResult,
  BaseValidation,
  ValidationState,
  // Field definitions
  FieldCategory,
  BaseFieldOptions,
  BaseFieldDefinition,
  BaseFieldValue,
  // Document context
  DocumentContext,
  // Plugin types (base - without React)
  FieldPluginSource,
  BaseFieldPlugin,
  BaseRegisteredFieldPlugin
} from './field-system.js';

// Authentication and authorization types
export type {
  // OAuth
  OAuthProviderType,
  OAuthProvider,
  // MFA
  MFAMethodType,
  MFAMethod,
  TrustedDevice,
  MFAConfig,
  // Roles and Permissions
  UserRole,
  Permission,
  UserPreferences,
  // User types
  User,
  CreateUserData,
  UpdateUserData,
  UserListOptions,
  LoginCredentials,
  UserSession,
  // App Token types
  AppToken,
  CreateAppTokenData,
  UpdateAppTokenData,
  AppTokenListOptions,
  // Auth context
  AuthenticatedUser,
  AuthenticatedAppToken,
  AuthContext,
  // JWT payloads
  UserTokenPayload,
  AppTokenPayload,
  MFAPendingTokenPayload,
  MFASetupTokenPayload,
  TokenPayload,
  // Auth results
  AuthenticationSuccessResult,
  AuthenticationMFARequiredResult,
  AuthenticationMFASetupRequiredResult,
  AuthenticationResult
} from './auth.js';