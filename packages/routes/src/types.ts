import type { 
  TrokkyCore, 
  Document, 
  DocumentData, 
  ListOptions, 
  MediaFile,
  User,
  CreateUserData,
  UpdateUserData,
  UserListOptions
} from '@trokky/core'

// HTTP Method types
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS'

// Framework-agnostic request interface
export interface HttpRequest {
  method: HttpMethod
  url: string
  path: string
  query: Record<string, string | string[] | undefined>
  params: Record<string, string>
  headers: Record<string, string | string[] | undefined>
  body?: unknown
  files?: File[]
  user?: User // Authenticated user (set by auth middleware)
}

// Framework-agnostic response interface
export interface HttpResponse {
  status: number
  headers: Record<string, string>
  body: unknown
}

// Route handler function type
export type RouteHandler = (request: HttpRequest) => Promise<HttpResponse>

// Route definition interface
export interface RouteDefinition {
  method: HttpMethod
  path: string
  handler: RouteHandler
  description?: string
}

// Static route configuration
export interface StaticRouteConfig {
  mountPath: string
  directory: string
  maxAge?: number // Cache control in seconds
}

// Routes configuration
export interface RoutesConfig {
  core: TrokkyCore
  basePath?: string
  corsOptions?: CorsOptions
  rateLimiting?: RateLimitOptions
  authentication?: AuthenticationOptions
  staticRoutes?: {
    media?: StaticRouteConfig
    assets?: StaticRouteConfig
    [key: string]: StaticRouteConfig | undefined
  }
}

// CORS configuration
export interface CorsOptions {
  origin?: string | string[] | boolean | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => void)
  methods?: HttpMethod[]
  allowedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
}

// Rate limiting configuration
export interface RateLimitOptions {
  windowMs?: number
  maxRequests?: number
  message?: string
}

// Authentication configuration  
export interface AuthenticationOptions {
  enabled: boolean
  headerName?: string
  validateToken?: (token: string) => Promise<boolean>
  publicPaths?: string[]
}

// Standard API response formats
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  meta?: {
    total?: number
    page?: number
    limit?: number
    hasNext?: boolean
    hasPrev?: boolean
  }
}

// Collection endpoints request/response types
export interface ListDocumentsRequest {
  collection: string
  limit?: number
  offset?: number
  filter?: Record<string, unknown>
  sort?: string | string[]
}

export interface CreateDocumentRequest {
  collection: string
  data: DocumentData
  id?: string
}

export interface UpdateDocumentRequest {
  collection: string
  id: string
  data: Partial<DocumentData>
}

export interface GetDocumentRequest {
  collection: string
  id: string
}

export interface DeleteDocumentRequest {
  collection: string
  id: string
}

// Media endpoints request/response types
export interface UploadMediaRequest {
  files: File[]
  metadata?: Record<string, unknown>
}

export interface GetMediaRequest {
  id: string
}

export interface DeleteMediaRequest {
  id: string
}

// User management endpoints request/response types
export interface ListUsersRequest {
  role?: string
  isActive?: boolean
  limit?: number
  offset?: number
}

export interface CreateUserRequest {
  userData: CreateUserData
}

export interface UpdateUserRequest {
  id: string
  userData: UpdateUserData
}

export interface GetUserRequest {
  id: string
}

export interface DeleteUserRequest {
  id: string
}

export interface GetUserByUsernameRequest {
  username: string
}

export interface GetUserByEmailRequest {
  email: string
}

// Authentication endpoints request/response types
export interface LoginRequest {
  username: string
  password: string
  rememberMe?: boolean
}

export interface LoginResponse {
  success: boolean
  token?: string
  refreshToken?: string
  user?: Omit<User, 'passwordHash'>
  expiresAt?: string
}

export interface LogoutRequest {
  token?: string
}

export interface ValidateTokenRequest {
  token: string
}

export interface RefreshTokenRequest {
  refreshToken: string
}

// Slug validation endpoints request/response types
export interface CheckSlugUniquenessRequest {
  slug: string
  collection: string
  excludeId?: string
}

export interface CheckSlugUniquenessResponse {
  unique: boolean
  slug: string
  collection: string
  reason?: string
}

// Route context for handlers
export interface RouteContext {
  core: TrokkyCore
  config: RoutesConfig
  request: HttpRequest
}

// Framework adapter interface
export interface FrameworkAdapter<TFrameworkRequest = unknown, TFrameworkResponse = unknown> {
  name: string
  convertRequest: (frameworkRequest: TFrameworkRequest) => HttpRequest
  convertResponse: (response: HttpResponse) => TFrameworkResponse
  handleRoute: (routeHandler: RouteHandler) => (frameworkRequest: TFrameworkRequest) => Promise<TFrameworkResponse>
}

// Webhook endpoints request/response types
export interface ListWebhooksRequest {
  active?: boolean
  limit?: number
  offset?: number
}

export interface CreateWebhookRequest {
  webhookData: any
}

export interface UpdateWebhookRequest {
  id: string
  webhookData: any
}

export interface GetWebhookRequest {
  id: string
}

export interface DeleteWebhookRequest {
  id: string
}

export interface GetWebhookDeliveriesRequest {
  id: string
  limit?: number
  offset?: number
}

export interface TestWebhookRequest {
  id: string
  eventType?: string
}