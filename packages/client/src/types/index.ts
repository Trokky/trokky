/**
 * Client SDK Types
 * Core types for the TypeScript-native Trokky client
 */

// Import shared types from @trokky/types to avoid circular dependencies
import type {
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
} from 'trokky/types'

// Re-export shared types for consumers
export type {
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
} from 'trokky/types'

export interface ClientConfig {
  // API endpoint configuration
  baseUrl: string
  apiVersion?: string
  
  // Authentication (choose one method)
  token?: string        // JWT token from login
  refreshToken?: string // Refresh token
  apiToken?: string     // Long-lived API token (alternative to JWT)
  
  // Request configuration
  timeout?: number
  retries?: number
  
  // Caching
  enableCache?: boolean
  cacheMaxAge?: number
  
  // Real-time (future)
  enableRealtime?: boolean
  websocketUrl?: string
  
  // Development
  debug?: boolean
}

export interface AuthConfig {
  username: string
  password: string
}

export interface ApiTokenAuth {
  token: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

export interface AppToken {
  id: string
  name: string
  description?: string
  permissions: string[]
  createdBy: string
  createdAt: string
  lastUsed?: string
  isActive: boolean
}

export interface CreateAppTokenData {
  name: string
  description?: string
  permissions: string[]
  expiresAt?: string
}

export interface AppTokenResult extends AppToken {
  token?: string // Only returned when creating a token
}

export interface RequestOptions {
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
}

export interface MediaResult {
  _id: string
  filename: string
  mimeType: string
  size: number
  url: string
  uploadedAt: string
  metadata?: Record<string, any>
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface ApiError {
  message: string
  code: string
  status: number
  details?: any
  validation?: ValidationError[]
}

export interface CacheEntry<T = any> {
  data: T
  timestamp: number
  maxAge: number
}

export interface TypeGeneratorOptions {
  outputDir: string
  schemaUrl: string
  namespace?: string
  fileExtension?: 'ts' | 'd.ts'
  includeValidation?: boolean
  // Authentication options
  authToken?: string
  username?: string
  password?: string
}

export interface DocumentGeneratorOptions {
  // Schema source
  schemaUrl?: string
  schemas?: DocumentSchema[]
  
  // Generation settings
  count?: number
  locale?: string
  seed?: number
  
  // Output options
  format?: 'json' | 'typescript' | 'both'
  outputDir?: string
  
  // Field generation overrides
  fieldOverrides?: Record<string, (faker: any, field: FieldSchema) => any>
  
  // Relations
  generateReferences?: boolean
  existingDocuments?: Record<string, string[]> // collection -> document IDs
}

export interface DocumentSchema {
  name: string
  title?: string
  description?: string
  fields: FieldSchema[]
}

export interface FieldSchema {
  type: string
  name: string
  title?: string
  description?: string
  required?: boolean
  validation?: Record<string, any>
  options?: Record<string, any>
  
  // Slug field specific
  source?: string | string[]
  autoGenerate?: boolean
  unique?: boolean
  prefix?: string
  suffix?: string
}

// Client events for real-time capabilities
export interface ClientEvents {
  'document:created': (document: DocumentResult) => void
  'document:updated': (document: DocumentResult) => void
  'document:deleted': (id: string) => void
  'connection:open': () => void
  'connection:close': () => void
  'connection:error': (error: Error) => void
}

export type ClientEventType = keyof ClientEvents