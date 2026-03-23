/**
 * @trokky/types - API Request Types
 *
 * Request and response types for Trokky API endpoints.
 * These types define the contract for document, media, user, and other operations.
 */

// ============================================================================
// Document Request Types
// ============================================================================

/**
 * Request to list documents in a collection
 */
export interface ListDocumentsRequest {
  /** Collection name */
  collection: string
  /** Maximum number of documents to return */
  limit?: number
  /** Number of documents to skip */
  offset?: number
  /** Filter criteria */
  filter?: Record<string, unknown>
  /** Sort field(s) */
  sort?: string | string[]
}

/**
 * Request to create a new document
 */
export interface CreateDocumentRequest {
  /** Collection name */
  collection: string
  /** Document data */
  data: Record<string, unknown>
  /** Optional custom document ID */
  id?: string
}

/**
 * Request to update an existing document
 */
export interface UpdateDocumentRequest {
  /** Collection name */
  collection: string
  /** Document ID */
  id: string
  /** Partial document data to update */
  data: Record<string, unknown>
}

/**
 * Request to get a single document
 */
export interface GetDocumentRequest {
  /** Collection name */
  collection: string
  /** Document ID */
  id: string
}

/**
 * Request to delete a document
 */
export interface DeleteDocumentRequest {
  /** Collection name */
  collection: string
  /** Document ID */
  id: string
}

// ============================================================================
// Media Request Types
// ============================================================================

/**
 * Request to upload media files
 */
export interface UploadMediaRequest {
  /** Files to upload */
  files: File[]
  /** Optional metadata for the uploaded files */
  metadata?: Record<string, unknown>
}

/**
 * Request to get a media file
 */
export interface GetMediaRequest {
  /** Media file ID */
  id: string
}

/**
 * Request to delete a media file
 */
export interface DeleteMediaRequest {
  /** Media file ID */
  id: string
}

// ============================================================================
// User Request Types
// ============================================================================

/**
 * Request to list users
 */
export interface ListUsersRequest {
  /** Filter by role */
  role?: string
  /** Filter by active status */
  isActive?: boolean
  /** Maximum number of users to return */
  limit?: number
  /** Number of users to skip */
  offset?: number
}

/**
 * Request to create a new user
 */
export interface CreateUserRequest {
  /** User data for creation */
  userData: {
    username: string
    email: string
    password: string
    firstName: string
    lastName: string
    role: string
    permissions?: string[]
    isActive?: boolean
  }
}

/**
 * Request to update an existing user
 */
export interface UpdateUserRequest {
  /** User ID */
  id: string
  /** Partial user data to update */
  userData: {
    username?: string
    email?: string
    firstName?: string
    lastName?: string
    role?: string
    permissions?: string[]
    isActive?: boolean
  }
}

/**
 * Request to get a single user
 */
export interface GetUserRequest {
  /** User ID */
  id: string
}

/**
 * Request to delete a user
 */
export interface DeleteUserRequest {
  /** User ID */
  id: string
}

/**
 * Request to get a user by username
 */
export interface GetUserByUsernameRequest {
  /** Username to search for */
  username: string
}

/**
 * Request to get a user by email
 */
export interface GetUserByEmailRequest {
  /** Email to search for */
  email: string
}

// ============================================================================
// Authentication Request Types
// ============================================================================

/**
 * Login request
 */
export interface LoginRequest {
  /** Username */
  username: string
  /** Password */
  password: string
  /** Whether to create a long-lived session */
  rememberMe?: boolean
  /** Device identifier for trusted device tracking */
  deviceId?: string
  /** CAPTCHA token for bot protection */
  captchaToken?: string
}

/**
 * Login response
 */
export interface LoginResponse {
  /** Whether login was successful */
  success: boolean
  /** JWT access token */
  token?: string
  /** JWT refresh token */
  refreshToken?: string
  /** Authenticated user (without sensitive fields) */
  user?: {
    id: string
    username: string
    email: string
    firstName: string
    lastName: string
    role: string
    permissions: string[]
    isActive: boolean
  }
  /** Token expiration timestamp */
  expiresAt?: string
}

/**
 * Logout request
 */
export interface LogoutRequest {
  /** Token to invalidate (optional) */
  token?: string
}

/**
 * Token validation request
 */
export interface ValidateTokenRequest {
  /** Token to validate */
  token: string
}

/**
 * Token refresh request
 */
export interface RefreshTokenRequest {
  /** Refresh token */
  refreshToken: string
}

// ============================================================================
// Slug Request Types
// ============================================================================

/**
 * Request to check slug uniqueness
 */
export interface CheckSlugUniquenessRequest {
  /** Slug to check */
  slug: string
  /** Collection to check within */
  collection: string
  /** Document ID to exclude (for updates) */
  excludeId?: string
}

/**
 * Response for slug uniqueness check
 */
export interface CheckSlugUniquenessResponse {
  /** Whether the slug is unique */
  unique: boolean
  /** The checked slug */
  slug: string
  /** The collection checked */
  collection: string
  /** Reason if not unique */
  reason?: string
}

// ============================================================================
// Webhook Request Types
// ============================================================================

/**
 * Request to list webhooks
 */
export interface ListWebhooksRequest {
  /** Filter by active status */
  active?: boolean
  /** Maximum number of webhooks to return */
  limit?: number
  /** Number of webhooks to skip */
  offset?: number
}

/**
 * Retry policy configuration for webhooks
 */
export interface WebhookRetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Type of backoff strategy */
  backoffType: 'linear' | 'exponential'
  /** Base delay in milliseconds */
  baseDelay: number
  /** Maximum delay in milliseconds */
  maxDelay: number
  /** HTTP status codes that trigger a retry */
  retryOnStatus: number[]
}

/**
 * Request to create a webhook
 */
export interface CreateWebhookRequest {
  /** Webhook configuration data */
  webhookData: {
    name: string
    url: string
    events: string[]
    secret?: string
    active?: boolean
    headers?: Record<string, string>
    retryPolicy?: WebhookRetryPolicy
  }
}

/**
 * Request to update a webhook
 */
export interface UpdateWebhookRequest {
  /** Webhook ID */
  id: string
  /** Partial webhook data to update */
  webhookData: {
    name?: string
    url?: string
    events?: string[]
    secret?: string
    active?: boolean
    headers?: Record<string, string>
  }
}

/**
 * Request to get a webhook
 */
export interface GetWebhookRequest {
  /** Webhook ID */
  id: string
}

/**
 * Request to delete a webhook
 */
export interface DeleteWebhookRequest {
  /** Webhook ID */
  id: string
}

/**
 * Request to get webhook delivery history
 */
export interface GetWebhookDeliveriesRequest {
  /** Webhook ID */
  id: string
  /** Maximum number of deliveries to return */
  limit?: number
  /** Number of deliveries to skip */
  offset?: number
}

/**
 * Request to test a webhook
 */
export interface TestWebhookRequest {
  /** Webhook ID */
  id: string
  /** Event type to simulate */
  eventType?: string
}
