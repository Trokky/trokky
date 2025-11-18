import { z } from 'zod'
import type { 
  FieldRegistry, 
  FieldType
} from '@trokky/types';
import { CORE_FIELD_TYPES } from '@trokky/types';
import type { 
  User, 
  UserListOptions, 
  AppToken, 
  AppTokenListOptions,
  CreateAppTokenData,
  UpdateAppTokenData,
  AuthContext,
  AuthenticatedUser,
  AuthenticatedAppToken
} from './user.js'

// Audit actor types
export const AUDIT_ACTOR_TYPES = {
  USER: 'user',
  API: 'api',
  SYSTEM: 'system',
  WEBHOOK: 'webhook'
} as const;

export type AuditActorType = typeof AUDIT_ACTOR_TYPES[keyof typeof AUDIT_ACTOR_TYPES];

// Audit context for tracking who is performing actions
export interface AuditContext {
  userId: string
  userType: AuditActorType
  username?: string
  ipAddress?: string
  userAgent?: string
}

// Audit log operations
export const AUDIT_OPERATIONS = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  PUBLISH: 'publish',
  UNPUBLISH: 'unpublish',
  RESTORE: 'restore'
} as const;

export type AuditOperation = typeof AUDIT_OPERATIONS[keyof typeof AUDIT_OPERATIONS];

// Comprehensive audit log entry
export interface AuditLog {
  id: string
  documentId: string
  collection: string
  operation: AuditOperation
  
  // Actor information
  actorId: string
  actorType: AuditActorType
  actorUsername?: string
  
  // Change details
  changes?: {
    before?: Record<string, unknown>
    after?: Record<string, unknown>
    fields?: string[] // List of changed field names
  }
  
  // Metadata
  timestamp: Date
  revision: number
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  
  // Additional context
  metadata?: Record<string, unknown>
}

// Base document structure
export interface Document {
  id: string
  _collection: string
  _createdAt: Date
  _updatedAt: Date
  _revision?: number
  _status?: 'draft' | 'published'
  _createdBy?: string  // User ID who created the document
  _updatedBy?: string  // User ID who last updated the document
  _createdByType?: AuditActorType  // Type of actor who created
  _updatedByType?: AuditActorType  // Type of actor who updated
}

// Document with user content
export interface DocumentWithContent extends Document {
  [key: string]: unknown
}

// Document data without metadata
export type DocumentData = Omit<Document, 'id' | '_collection' | '_createdAt' | '_updatedAt' | '_revision' | '_status'>

// Dynamic field type registry - allows @trokky/fields to register types at runtime
let _fieldRegistry: FieldRegistry | null = null;

export function setFieldRegistry(registry: FieldRegistry) {
  _fieldRegistry = registry;
}

export function getRegisteredFieldTypes(): string[] {
  if (_fieldRegistry) {
    return _fieldRegistry.getTypes();
  }
  // Fallback to core types
  return [...CORE_FIELD_TYPES];
}

// Field type schema - accepts any string to allow dynamic types
export const FieldTypeSchema = z.string();
export type { FieldType };

// Schema field definition interfaces
export interface FieldDefinition {
  type: FieldType
  required?: boolean
  description?: string
  validation?: Record<string, unknown>
  options?: Record<string, unknown> // For field-specific options (e.g., media field upload/browse settings)
  of?: FieldDefinition // For arrays  
  fields?: Record<string, FieldDefinition> | Array<{
    name: string
    type: string
    title: string
    description?: string
    required?: boolean
    validation?: any
    options?: any
    default?: any
    fields?: any
    to?: any
    of?: any
  }> // For objects - support both Record and Array formats
  to?: string // For references
  collection?: string // For references
  
  // Slug field specific properties
  source?: string | string[] // Source field(s) for auto-generation
  autoGenerate?: boolean // Enable auto-generation
  unique?: boolean // Require uniqueness
  maxLength?: number // Maximum length
  minLength?: number // Minimum length
  allowEmpty?: boolean // Allow empty values
  readOnly?: boolean // Read-only field
  preserveCase?: boolean // Preserve case in slugs
  allowedChars?: string // Additional allowed characters
  prefix?: string // Slug prefix
  suffix?: string // Slug suffix
}

// Schema field definition Zod schema
export const FieldDefinitionSchema: z.ZodSchema<any> = z.object({
  type: FieldTypeSchema,
  required: z.boolean().optional().default(false),
  description: z.string().optional(),
  validation: z.record(z.unknown()).optional(),
  options: z.record(z.unknown()).optional(), // For field-specific options
  of: z.lazy(() => FieldDefinitionSchema).optional(), // For arrays
  fields: z.union([
    z.record(z.lazy(() => FieldDefinitionSchema)),
    z.array(z.object({
      name: z.string(),
      type: z.string(),
      title: z.string(),
      description: z.string().optional(),
      required: z.boolean().optional(),
      validation: z.any().optional(),
      options: z.any().optional(),
      default: z.any().optional(),
      fields: z.any().optional(),
      to: z.any().optional(),
      of: z.any().optional()
    }))
  ]).optional(), // For objects - support both Record and Array formats
  to: z.string().optional(), // For references
  collection: z.string().optional(), // For references
  
  // Slug field specific properties
  source: z.union([z.string(), z.array(z.string())]).optional(), // Source field(s) for auto-generation
  autoGenerate: z.boolean().optional(), // Enable auto-generation
  unique: z.boolean().optional(), // Require uniqueness
  maxLength: z.number().optional(), // Maximum length
  minLength: z.number().optional(), // Minimum length
  allowEmpty: z.boolean().optional(), // Allow empty values
  readOnly: z.boolean().optional(), // Read-only field
  preserveCase: z.boolean().optional(), // Preserve case in slugs
  allowedChars: z.string().optional(), // Additional allowed characters
  prefix: z.string().optional(), // Slug prefix
  suffix: z.string().optional() // Slug suffix
}).passthrough() // Allow additional properties for extensibility

// Content schema definition
export const ContentSchemaSchema: z.ZodSchema<any> = z.object({
  name: z.string(),
  type: z.enum(['document', 'singleton']),
  title: z.string().optional(),
  description: z.string().optional(),
  singleton: z.boolean().optional(), // Allow singleton property
  fields: z.record(FieldDefinitionSchema)
})

export type ContentSchema = z.infer<typeof ContentSchemaSchema>

// List options for queries
export interface ListOptions {
  limit?: number
  offset?: number
  filter?: Record<string, unknown>
  sort?: string | string[]
}

// Validation result
export interface ValidationResult {
  valid: boolean
  errors: ValidationErrorDetail[]
}

export interface ValidationErrorDetail {
  field: string
  message: string
  code: string
}

// Media file structure
export interface MediaFile {
  id: string
  url?: string  // Optional - frontend will construct URLs
  filename: string
  contentType: string
  size: number
  metadata?: Record<string, unknown>
  _createdAt: Date
}

export interface MediaMetadata {
  id: string
  filename: string
  contentType: string
  size: number
  extension: string
}

// Migration interface
export interface Migration {
  version: string
  description: string
  up: () => Promise<void>
  down: () => Promise<void>
}

// Storage adapter interface
export interface StorageAdapter {
  // Document operations
  getDocument(collection: string, id: string): Promise<Document | null>
  saveDocument(collection: string, id: string, data: DocumentData, auditContext?: AuditContext): Promise<Document>
  listDocuments(collection: string, options?: ListOptions): Promise<Document[]>
  deleteDocument(collection: string, id: string): Promise<void>

  // Media operations
  uploadFile(file: File, metadata: MediaMetadata): Promise<MediaFile>
  getFile(id: string): Promise<MediaFile | null>
  updateFile?(id: string, metadata: Record<string, any>): Promise<MediaFile>
  getFileContent(id: string): Promise<ArrayBuffer | null>
  listMedia?(options?: { limit?: number; offset?: number }): Promise<MediaFile[]>
  deleteFile(id: string): Promise<void>
  
  // Variant operations (for image processing)
  saveVariantFile?(parentId: string, variantName: string, buffer: Buffer, format: string): Promise<string>
  getVariantContent?(parentId: string, variantName: string): Promise<ArrayBuffer | null>
  getVariantUrl?(parentId: string, variantName: string): string
  deleteVariantFiles?(parentId: string): Promise<void>

  // User operations (system entities)
  getUser?(id: string): Promise<User | null>
  saveUser?(id: string, userData: Partial<User>): Promise<User>
  listUsers?(options?: UserListOptions): Promise<User[]>
  deleteUser?(id: string): Promise<void>
  getUserByUsername?(username: string): Promise<User | null>
  getUserByEmail?(email: string): Promise<User | null>

  // App token operations
  getAppToken?(id: string): Promise<AppToken | null>
  saveAppToken?(id: string, tokenData: Partial<AppToken>): Promise<AppToken>
  listAppTokens?(options?: AppTokenListOptions): Promise<AppToken[]>
  deleteAppToken?(id: string): Promise<void>
  getAppTokenByHash?(hash: string): Promise<AppToken | null>

  // Utility operations
  healthCheck(): Promise<boolean>
  migrate(migrations: Migration[]): Promise<void>
}

// Configuration types
export interface StorageAdapterOptions {
  [key: string]: string | number | boolean | undefined
}

export interface ApiConfig {
  basePath?: string
  cors?: boolean
  rateLimit?: {
    windowMs?: number
    maxRequests?: number
  }
}

export interface TrokkyConfig {
  storage: {
    adapter: string
    options: StorageAdapterOptions
  }
  schemas: string | ContentSchema[]
  api?: ApiConfig
  media?: {
    imageProcessor?: 'none' | 'sharp' | 'cloudflare-images' | 'imagekit' | 'imgix' | 'custom'
    imageVariants?: Array<{
      name: string
      width?: number
      height?: number
      format?: 'jpeg' | 'png' | 'webp' | 'avif'
      quality?: number
      fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
    }>
    imageProcessorOptions?: Record<string, unknown>
    // File validation configuration
    validation?: {
      maxFileSize?: number
      maxFiles?: number
      allowedTypes?: string[]
      allowedExtensions?: string[]
      forbiddenExtensions?: string[]
    }
  }
  // Schema enhancement features
  features?: {
    autoThumbnail?: {
      enabled?: boolean
      fieldName?: string
      skipSingletons?: boolean
      skipSchemas?: string[]
      maxFileSize?: number
      allowedTypes?: string[]
    }
    autoSlug?: {
      enabled?: boolean
      sourceFields?: string[]
      unique?: boolean
    }
  }
  security?: {
    validateInput?: boolean
    rateLimitEnabled?: boolean
    tokens?: {
      accessTokenTtl?: string
      refreshTokenTtl?: string
      rememberMeTtl?: string
    }
  }
  // Mail configuration
  mail?: import('./mail.js').MailConfig
}

// User management types (system entities, not user-defined schemas)
export type {
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
  AuthenticatedAppToken
} from './user.js'

export { ROLE_PERMISSIONS } from './user.js'

// Re-export media types from @trokky/types
export type {
  MediaAssetReference,
  MediaFieldValue,
  MediaType,
  MediaAsset,
  MediaBrowserConfig
} from '@trokky/types';

// Split storage adapter types
export type {
  DataStorageAdapter,
  MediaStorageAdapter,
  DataTransaction,
  MediaListOptions,
  MediaVariant,
  SplitStorageConfig,
  TrokkyStorageAdapters,
  WebhookListOptions,
  SettingsConfig
} from './storage-adapters.js'

// Mail types
export type {
  MailConfig,
  PasswordResetToken,
  PasswordResetRequest,
  PasswordResetVerification
} from './mail.js'