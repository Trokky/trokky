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

// HTTP and API types
export type {
  // HTTP method
  HttpMethod,
  // Request/Response
  HttpRequest,
  HttpResponse,
  RouteHandler,
  // Route definitions
  RouteDefinition,
  StaticRouteConfig,
  // Configuration
  CorsOptions,
  RateLimitOptions,
  AuthenticationOptions,
  // API Response
  ApiResponse,
  // Framework adapter
  FrameworkAdapter
} from './http.js';

// API Request types
export type {
  // Document requests
  ListDocumentsRequest,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  GetDocumentRequest,
  DeleteDocumentRequest,
  // Media requests
  UploadMediaRequest,
  GetMediaRequest,
  DeleteMediaRequest,
  // User requests
  ListUsersRequest,
  CreateUserRequest,
  UpdateUserRequest,
  GetUserRequest,
  DeleteUserRequest,
  GetUserByUsernameRequest,
  GetUserByEmailRequest,
  // Auth requests
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  ValidateTokenRequest,
  RefreshTokenRequest,
  // Slug requests
  CheckSlugUniquenessRequest,
  CheckSlugUniquenessResponse,
  // Webhook requests
  WebhookRetryPolicy,
  ListWebhooksRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  GetWebhookRequest,
  DeleteWebhookRequest,
  GetWebhookDeliveriesRequest,
  TestWebhookRequest
} from './api-requests.js';

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

// OAuth2 types
export type {
  // Grant and client types
  OAuth2GrantType,
  OAuth2ClientType,
  OAuth2Client,
  OAuth2Scope,
  // Device authorization flow
  DeviceAuthorizationRequest,
  DeviceAuthorizationResponse,
  DeviceCodeState,
  DeviceTokenRequest,
  // Authorization code flow
  AuthorizationRequest,
  AuthorizationCodeState,
  AuthorizationCodeTokenRequest,
  OAuth2RefreshTokenRequest,
  // Token responses
  TokenResponse,
  OAuth2ErrorResponse,
  OAuth2ErrorCode,
  // User consent
  UserConsent,
  // Token storage
  OAuth2AccessToken,
  OAuth2RefreshToken,
  // Client management
  CreateOAuth2ClientData,
  UpdateOAuth2ClientData
} from './oauth2.js';

export { SCOPE_TO_PERMISSIONS, BUILTIN_CLI_CLIENT } from './oauth2.js';

// Mail types
export type {
  // Adapter interface
  MailAdapter,
  // Message types
  MailMessage,
  MailAttachment,
  // Result types
  MailResult,
  MailBatchResult,
  // Template types
  TemplateData,
  RenderedTemplate,
  TemplateRenderer,
  // Adapter configurations
  BaseMailAdapterConfig,
  SMTPMailAdapterConfig,
  ResendMailAdapterConfig,
  GmailMailAdapterConfig,
  SESMailAdapterConfig,
  ConsoleMailAdapterConfig
} from './mail.js';

// i18n types
export type {
  SupportedLocale,
  TranslationNamespace,
  I18nConfig,
  DetectionOrder,
  LanguagePreference
} from './i18n.js';

export {
  DEFAULT_NAMESPACE,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  LOCALE_NAMES
} from './i18n.js';

// Passkey/WebAuthn types
export type {
  AuthenticatorTransportType,
  PasskeyCredential,
  PasskeyAuthenticatorSelection,
  PasskeyConfig,
  PasskeyCredentialDescriptor,
  PasskeyRegistrationOptions,
  PasskeyRegistrationOptionsRequest,
  PasskeyRegistrationVerifyRequest,
  PasskeyAuthenticationOptions,
  PasskeyAuthenticationOptionsRequest,
  PasskeyAuthenticationVerifyRequest,
  PasskeyUpdateRequest,
  PasskeyCredentialListResponse,
  PasskeySession
} from './passkey.js';