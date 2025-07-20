import { z } from 'zod'
import type { User, UserListOptions } from './user.js'

// Base document structure
export interface Document {
  id: string
  _collection: string
  _createdAt: Date
  _updatedAt: Date
  _revision?: number
  _status?: 'draft' | 'published'
}

// Document with user content
export interface DocumentWithContent extends Document {
  [key: string]: unknown
}

// Document data without metadata
export type DocumentData = Omit<Document, 'id' | '_collection' | '_createdAt' | '_updatedAt' | '_revision' | '_status'>

// Schema field types
export const FieldTypeSchema = z.enum([
  'string',
  'number',
  'boolean',
  'date',
  'array',
  'object',
  'reference',
  'media'
])

export type FieldType = z.infer<typeof FieldTypeSchema>

// Schema field definition interfaces
export interface FieldDefinition {
  type: FieldType
  required?: boolean
  description?: string
  validation?: Record<string, unknown>
  items?: FieldDefinition // For arrays
  properties?: Record<string, FieldDefinition> // For objects
  collection?: string // For references
}

// Schema field definition Zod schema
export const FieldDefinitionSchema: z.ZodType<FieldDefinition> = z.object({
  type: FieldTypeSchema,
  required: z.boolean().optional().default(false),
  description: z.string().optional(),
  validation: z.record(z.unknown()).optional(),
  items: z.lazy(() => FieldDefinitionSchema).optional(), // For arrays
  properties: z.record(z.lazy(() => FieldDefinitionSchema)).optional(), // For objects
  collection: z.string().optional() // For references
})

// Content schema definition
export const ContentSchemaSchema = z.object({
  name: z.string(),
  type: z.enum(['document', 'singleton']),
  title: z.string().optional(),
  description: z.string().optional(),
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
  url: string
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
  saveDocument(collection: string, id: string, data: DocumentData): Promise<Document>
  listDocuments(collection: string, options?: ListOptions): Promise<Document[]>
  deleteDocument(collection: string, id: string): Promise<void>

  // Media operations
  uploadFile(file: File, metadata: MediaMetadata): Promise<MediaFile>
  getFile(id: string): Promise<MediaFile | null>
  deleteFile(id: string): Promise<void>

  // User operations (system entities)
  getUser?(id: string): Promise<User | null>
  saveUser?(id: string, userData: Partial<User>): Promise<User>
  listUsers?(options?: UserListOptions): Promise<User[]>
  deleteUser?(id: string): Promise<void>
  getUserByUsername?(username: string): Promise<User | null>
  getUserByEmail?(email: string): Promise<User | null>

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
  security?: {
    validateInput?: boolean
    rateLimitEnabled?: boolean
  }
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
  UserSession
} from './user.js'