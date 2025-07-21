/**
 * Client SDK Types
 * Core types for the TypeScript-native Trokky client
 */

export interface ClientConfig {
  // API endpoint configuration
  baseUrl: string
  apiVersion?: string
  
  // Authentication
  token?: string
  refreshToken?: string
  
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

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

export interface RequestOptions {
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
}

export interface QueryOptions {
  filter?: Record<string, any>
  sort?: Record<string, 1 | -1>
  limit?: number
  offset?: number
  select?: string[]
}

export interface DocumentResult<T = any> {
  data: T
  _id: string
  _type: string
  _createdAt: string
  _updatedAt: string
  _version: number
}

export interface CollectionResult<T = any> {
  data: DocumentResult<T>[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
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
}

// Generic document types that will be enhanced by generated types
export interface BaseDocument {
  _id?: string
  _type: string
  _createdAt?: string
  _updatedAt?: string
  _version?: number
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