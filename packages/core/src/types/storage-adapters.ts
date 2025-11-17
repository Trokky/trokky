/**
 * Split Storage Adapter Interfaces
 * 
 * This file defines the new storage architecture that separates:
 * - DataStorageAdapter: Documents, users, and app tokens (structured data)
 * - MediaStorageAdapter: Files and media content (unstructured data)
 * 
 * This enables optimal deployment patterns like:
 * - Cloudflare: D1 for data + R2 for media
 * - AWS: DynamoDB for data + S3 for media
 * - Hybrid: Filesystem for data + R2 for media
 */

import type {
  Document,
  AuditLog,
  DocumentData,
  ListOptions,
  MediaFile,
  MediaMetadata,
  Migration,
  User,
  UserListOptions,
  CreateUserData,
  UpdateUserData,
  AppToken,
  AppTokenListOptions,
  CreateAppTokenData,
  UpdateAppTokenData,
  AuditContext
} from './index.js'
import type { WebhookConfig } from '../events/types.js'

// =============================================================================
// SETTINGS TYPES
// =============================================================================

/**
 * Studio settings configuration
 */
export interface SettingsConfig {
  /** Unique identifier for settings */
  id: string
  /** Public website URL for "View Live" links */
  publicUrl: string
  /** Studio title displayed in interface */
  studioTitle: string
  /** Default theme for new users */
  defaultTheme: 'light' | 'dark' | 'system'
  /** Organization/company name for branding */
  organizationName?: string
  /** Primary brand color (hex format) */
  primaryColor?: string
  /** Secondary brand color (hex format) */
  secondaryColor?: string
  /** Logo URL or path */
  logo?: string
  /** Settings creation timestamp */
  _createdAt?: string
  /** Settings last update timestamp */
  _updatedAt?: string
  /** User who last updated settings */
  _updatedBy?: string
}

// =============================================================================
// DATA STORAGE ADAPTER - Structured Data (Documents, Users, App Tokens)
// =============================================================================

/**
 * DataStorageAdapter handles all structured data operations
 * 
 * This adapter is responsible for:
 * - Content documents (articles, pages, etc.)
 * - System users and authentication
 * - App tokens for API access
 * - Transactional operations
 * - Queries and filtering
 * 
 * Optimal backends: SQL databases (D1, PostgreSQL, MySQL), NoSQL with query support
 */
export interface DataStorageAdapter {
  // ==========================================================================
  // DOCUMENT OPERATIONS
  // ==========================================================================
  
  /**
   * Retrieve a single document by collection and ID
   * @param collection - The collection name (e.g., 'articles', 'pages')
   * @param id - The document ID
   * @returns The document or null if not found
   * @throws Error if collection/id are invalid or storage fails
   */
  getDocument(collection: string, id: string): Promise<Document | null>
  
  /**
   * Save (create or update) a document
   * @param collection - The collection name
   * @param id - The document ID
   * @param data - The document data (without metadata)
   * @param auditContext - Optional audit context with user information
   * @returns The saved document with metadata
   * @throws Error if validation fails or storage fails
   */
  saveDocument(collection: string, id: string, data: DocumentData, auditContext?: AuditContext): Promise<Document>
  
  /**
   * List documents in a collection with filtering, sorting, and pagination
   * @param collection - The collection name
   * @param options - Query options (limit, offset, filter, sort)
   * @returns Array of matching documents
   * @throws Error if query is invalid or storage fails
   */
  listDocuments(collection: string, options?: ListOptions): Promise<Document[]>
  
  /**
   * Delete a document permanently
   * @param collection - The collection name
   * @param id - The document ID
   * @throws Error if document doesn't exist or storage fails
   */
  deleteDocument(collection: string, id: string): Promise<void>
  
  /**
   * Check if a document exists (optimized check without full retrieval)
   * @param collection - The collection name
   * @param id - The document ID
   * @returns True if document exists
   */
  documentExists?(collection: string, id: string): Promise<boolean>
  
  /**
   * Get document count in a collection (with optional filtering)
   * @param collection - The collection name
   * @param filter - Optional filter criteria
   * @returns Number of matching documents
   */
  countDocuments?(collection: string, filter?: Record<string, unknown>): Promise<number>
  
  // ==========================================================================
  // AUDIT LOG OPERATIONS
  // ==========================================================================
  
  /**
   * Create an audit log entry
   * @param auditLog - The audit log data
   * @returns The created audit log entry
   * @throws Error if storage fails
   */
  createAuditLog?(auditLog: Omit<AuditLog, 'id'>): Promise<AuditLog>
  
  /**
   * Get audit logs for a specific document
   * @param documentId - The document ID
   * @param options - Query options (limit, offset)
   * @returns Array of audit log entries
   */
  getDocumentAuditLogs?(documentId: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]>
  
  /**
   * Get audit logs for a collection
   * @param collection - The collection name
   * @param options - Query options (limit, offset)
   * @returns Array of audit log entries
   */
  getCollectionAuditLogs?(collection: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]>
  
  /**
   * Get audit logs by actor
   * @param actorId - The actor ID
   * @param options - Query options (limit, offset)
   * @returns Array of audit log entries
   */
  getActorAuditLogs?(actorId: string, options?: { limit?: number; offset?: number }): Promise<AuditLog[]>
  
  // ==========================================================================
  // USER OPERATIONS
  // ==========================================================================
  
  /**
   * Retrieve a user by ID
   * @param id - The user ID
   * @returns The user or null if not found
   * @throws Error if storage fails
   */
  getUser(id: string): Promise<User | null>
  
  /**
   * Create or update a user
   * @param id - The user ID
   * @param userData - The user data (partial for updates)
   * @returns The saved user
   * @throws Error if validation fails or storage fails
   */
  saveUser(id: string, userData: CreateUserData | Partial<UpdateUserData>): Promise<User>
  
  /**
   * List users with filtering and pagination
   * @param options - Query options (role, isActive, limit, offset)
   * @returns Array of matching users
   * @throws Error if query is invalid or storage fails
   */
  listUsers(options?: UserListOptions): Promise<User[]>
  
  /**
   * Delete a user permanently
   * @param id - The user ID
   * @throws Error if user doesn't exist or storage fails
   */
  deleteUser(id: string): Promise<void>
  
  /**
   * Find user by username (for authentication)
   * @param username - The username to search for
   * @returns The user or null if not found
   * @throws Error if storage fails
   */
  getUserByUsername(username: string): Promise<User | null>
  
  /**
   * Find user by email address (for authentication and uniqueness checks)
   * @param email - The email address to search for
   * @returns The user or null if not found
   * @throws Error if storage fails
   */
  getUserByEmail(email: string): Promise<User | null>
  
  /**
   * Check if username is available (optimized check)
   * @param username - The username to check
   * @returns True if username is available
   */
  isUsernameAvailable?(username: string): Promise<boolean>
  
  /**
   * Check if email is available (optimized check)
   * @param email - The email to check
   * @returns True if email is available
   */
  isEmailAvailable?(email: string): Promise<boolean>
  
  // ==========================================================================
  // APP TOKEN OPERATIONS
  // ==========================================================================
  
  /**
   * Retrieve an app token by ID
   * @param id - The token ID
   * @returns The app token or null if not found
   * @throws Error if storage fails
   */
  getAppToken(id: string): Promise<AppToken | null>
  
  /**
   * Create or update an app token
   * @param id - The token ID
   * @param tokenData - The token data (partial for updates)
   * @returns The saved app token
   * @throws Error if validation fails or storage fails
   */
  saveAppToken(id: string, tokenData: CreateAppTokenData | Partial<UpdateAppTokenData>): Promise<AppToken>
  
  /**
   * List app tokens with filtering and pagination
   * @param options - Query options (createdBy, isActive, limit, offset)
   * @returns Array of matching app tokens
   * @throws Error if query is invalid or storage fails
   */
  listAppTokens(options?: AppTokenListOptions): Promise<AppToken[]>
  
  /**
   * Delete an app token permanently
   * @param id - The token ID
   * @throws Error if token doesn't exist or storage fails
   */
  deleteAppToken(id: string): Promise<void>
  
  /**
   * Find app token by hash (for authentication)
   * @param hash - The hashed token value
   * @returns The app token or null if not found
   * @throws Error if storage fails
   */
  getAppTokenByHash(hash: string): Promise<AppToken | null>
  
  // ==========================================================================
  // WEBHOOK OPERATIONS
  // ==========================================================================
  
  /**
   * Retrieve a webhook by ID
   * @param id - The webhook ID
   * @returns The webhook configuration or null if not found
   * @throws Error if storage fails
   */
  getWebhook?(id: string): Promise<WebhookConfig | null>
  
  /**
   * Create or update a webhook
   * @param id - The webhook ID
   * @param webhookData - The webhook data (partial for updates)
   * @returns The saved webhook configuration
   * @throws Error if validation fails or storage fails
   */
  saveWebhook?(id: string, webhookData: Partial<WebhookConfig>): Promise<WebhookConfig>
  
  /**
   * List webhooks with filtering and pagination
   * @param options - Query options (active, limit, offset)
   * @returns Array of matching webhooks
   * @throws Error if query is invalid or storage fails
   */
  listWebhooks?(options?: WebhookListOptions): Promise<WebhookConfig[]>
  
  /**
   * Delete a webhook permanently
   * @param id - The webhook ID
   * @throws Error if webhook doesn't exist or storage fails
   */
  deleteWebhook?(id: string): Promise<void>
  
  // ==========================================================================
  // SETTINGS OPERATIONS
  // ==========================================================================
  
  /**
   * Retrieve studio settings
   * @returns The settings configuration or null if not found
   * @throws Error if storage fails
   */
  getSettings?(): Promise<SettingsConfig | null>

  /**
   * Create or update studio settings
   * @param settings - The settings configuration
   * @throws Error if validation fails or storage fails
   */
  saveSettings?(settings: SettingsConfig): Promise<void>
  
  // ==========================================================================
  // UTILITY OPERATIONS
  // ==========================================================================
  
  /**
   * Health check for the data storage system
   * @returns True if storage is healthy and accessible
   * @throws Error if storage is unhealthy
   */
  healthCheck(): Promise<boolean>
  
  /**
   * Run database migrations for schema changes
   * @param migrations - Array of migrations to run
   * @throws Error if migration fails
   */
  migrate?(migrations: Migration[]): Promise<void>
  
  /**
   * Get storage statistics and information
   * @returns Storage metadata and statistics
   */
  getStorageInfo?(): Promise<{
    collections: string[]
    documentCount: number
    userCount: number
    tokenCount: number
    storageSize?: number
    [key: string]: unknown
  }>
  
  /**
   * Begin a transaction (if supported by the storage backend)
   * @returns Transaction context or undefined if not supported
   */
  beginTransaction?(): Promise<DataTransaction | undefined>
}

/**
 * Transaction interface for data operations (optional)
 * Allows atomic operations across multiple documents/users/tokens
 */
export interface DataTransaction {
  /**
   * Commit the transaction
   */
  commit(): Promise<void>
  
  /**
   * Rollback the transaction
   */
  rollback(): Promise<void>
  
  /**
   * Execute multiple operations within the transaction
   */
  execute<T>(operations: () => Promise<T>): Promise<T>
}

// =============================================================================
// MEDIA STORAGE ADAPTER - Unstructured Data (Files, Media Content)
// =============================================================================

/**
 * MediaStorageAdapter handles all unstructured data operations
 * 
 * This adapter is responsible for:
 * - File uploads and storage
 * - Media metadata management
 * - Image variant generation storage
 * - Binary content serving
 * - Large file handling
 * 
 * Optimal backends: Object storage (R2, S3), CDN integration, file systems
 */
export interface MediaStorageAdapter {
  // ==========================================================================
  // FILE OPERATIONS
  // ==========================================================================
  
  /**
   * Upload and store a file
   * @param file - The file to upload
   * @param metadata - File metadata (ID, filename, content type, etc.)
   * @returns The stored media file record
   * @throws Error if upload fails or file is invalid
   */
  uploadFile(file: File, metadata: MediaMetadata): Promise<MediaFile>
  
  /**
   * Retrieve media file metadata by ID
   * @param id - The file ID
   * @returns The media file record or null if not found
   * @throws Error if storage fails
   */
  getFile(id: string): Promise<MediaFile | null>
  
  /**
   * Update media file metadata (not the content)
   * @param id - The file ID
   * @param metadata - Updated metadata
   * @returns The updated media file record
   * @throws Error if file doesn't exist or update fails
   */
  updateFile(id: string, metadata: Record<string, any>): Promise<MediaFile>
  
  /**
   * Retrieve the binary content of a file
   * @param id - The file ID
   * @returns The file content as ArrayBuffer or null if not found
   * @throws Error if storage fails
   */
  getFileContent(id: string): Promise<ArrayBuffer | null>
  
  /**
   * Get a streaming URL for the file (if supported)
   * @param id - The file ID
   * @param options - Optional URL generation options (expiration time, etc.)
   * @returns Public URL for the file or null if not available
   */
  getFileUrl?(id: string, options?: { expiresIn?: number }): Promise<string | null>
  
  /**
   * List media files with filtering and pagination
   * @param options - Query options (limit, offset, content type filters, etc.)
   * @returns Array of matching media files
   * @throws Error if query is invalid or storage fails
   */
  listMedia(options?: MediaListOptions): Promise<MediaFile[]>
  
  /**
   * Delete a file and all its variants permanently
   * @param id - The file ID
   * @throws Error if file doesn't exist or deletion fails
   */
  deleteFile(id: string): Promise<void>
  
  /**
   * Check if a file exists (optimized check without full retrieval)
   * @param id - The file ID
   * @returns True if file exists
   */
  fileExists?(id: string): Promise<boolean>
  
  /**
   * Get file size without downloading content
   * @param id - The file ID
   * @returns File size in bytes or null if file doesn't exist
   */
  getFileSize?(id: string): Promise<number | null>
  
  // ==========================================================================
  // VARIANT OPERATIONS (for processed images/media)
  // ==========================================================================
  
  /**
   * Save a processed variant of a media file
   * @param parentId - The original file ID
   * @param variantName - The variant name (e.g., 'thumbnail', 'preview')
   * @param buffer - The processed file content
   * @param format - The output format (e.g., 'webp', 'jpeg')
   * @returns The variant ID or path
   * @throws Error if save fails
   */
  saveVariantFile(parentId: string, variantName: string, buffer: Buffer, format: string): Promise<string>
  
  /**
   * Retrieve the binary content of a variant
   * @param parentId - The original file ID
   * @param variantName - The variant name
   * @returns The variant content as ArrayBuffer or null if not found
   * @throws Error if storage fails
   */
  getVariantContent(parentId: string, variantName: string): Promise<ArrayBuffer | null>
  
  /**
   * Get a public URL for a variant (if supported)
   * @param parentId - The original file ID
   * @param variantName - The variant name
   * @param options - Optional URL generation options (expiration time, etc.)
   * @returns Public URL for the variant or null if not available
   */
  getVariantUrl?(parentId: string, variantName: string, options?: { expiresIn?: number }): Promise<string | null>
  
  /**
   * List all variants for a media file
   * @param parentId - The original file ID
   * @returns Array of variant information
   */
  listVariants?(parentId: string): Promise<MediaVariant[]>
  
  /**
   * Delete all variants of a media file
   * @param parentId - The original file ID
   * @throws Error if deletion fails
   */
  deleteVariantFiles(parentId: string): Promise<void>
  
  /**
   * Delete a specific variant
   * @param parentId - The original file ID
   * @param variantName - The variant name
   * @throws Error if variant doesn't exist or deletion fails
   */
  deleteVariant?(parentId: string, variantName: string): Promise<void>
  
  // ==========================================================================
  // UTILITY OPERATIONS
  // ==========================================================================
  
  /**
   * Health check for the media storage system
   * @returns True if storage is healthy and accessible
   * @throws Error if storage is unhealthy
   */
  healthCheck(): Promise<boolean>
  
  /**
   * Get storage statistics and quota information
   * @returns Storage usage statistics
   */
  getStorageInfo?(): Promise<{
    totalFiles: number
    totalSize: number
    availableSpace?: number
    usedSpace?: number
    [key: string]: unknown
  }>
  
  /**
   * Clean up orphaned files and variants
   * @returns Number of files cleaned up
   */
  cleanup?(): Promise<number>
  
  /**
   * Optimize storage (compress, deduplicate, etc.)
   * @returns Optimization results
   */
  optimize?(): Promise<{
    filesProcessed: number
    spaceSaved: number
    [key: string]: unknown
  }>
}

// =============================================================================
// SUPPORTING TYPES
// =============================================================================

/**
 * Extended media list options with more filtering capabilities
 */
export interface MediaListOptions {
  limit?: number
  offset?: number
  /** Filter by content type (e.g., 'image/*', 'video/mp4') */
  contentType?: string
  /** Filter by file size range */
  sizeRange?: {
    min?: number
    max?: number
  }
  /** Filter by upload date range */
  dateRange?: {
    from?: Date
    to?: Date
  }
  /** Sort options */
  sort?: 'name' | 'size' | 'date' | 'type'
  /** Sort direction */
  sortDirection?: 'asc' | 'desc'
  /** Include variant information in results */
  includeVariants?: boolean
}

/**
 * Media variant information
 */
export interface MediaVariant {
  name: string
  format: string
  size: number
  width?: number
  height?: number
  url?: string
  createdAt: Date
}

/**
 * Configuration options for split storage adapters
 */
export interface SplitStorageConfig {
  /** Data storage adapter configuration */
  data: {
    adapter: string
    options?: Record<string, unknown>
  }
  /** Media storage adapter configuration */
  media: {
    adapter: string
    options?: Record<string, unknown>
  }
}

/**
 * Webhook list options for filtering and pagination
 */
export interface WebhookListOptions {
  /** Filter by active status */
  active?: boolean
  /** Maximum number of results */
  limit?: number
  /** Skip this many results (for pagination) */
  offset?: number
  /** Filter by event patterns */
  events?: string[]
  /** Filter by creator user ID */
  createdBy?: string
}

/**
 * Combined storage adapter container
 * This is what TrokkyCore will use internally
 */
export interface TrokkyStorageAdapters {
  data: DataStorageAdapter
  media: MediaStorageAdapter
}