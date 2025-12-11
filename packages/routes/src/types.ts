/**
 * Route types for Trokky
 *
 * Types are now centralized in @trokky/types and re-exported here for backwards compatibility.
 */

import type { TrokkyCore } from '@trokky/core'

// Re-export HTTP types from @trokky/types
export type {
  HttpMethod,
  HttpRequest,
  HttpResponse,
  RouteHandler,
  RouteDefinition,
  StaticRouteConfig,
  CorsOptions,
  RateLimitOptions,
  AuthenticationOptions,
  ApiResponse,
  FrameworkAdapter
} from '@trokky/types'

// Re-export API request types from @trokky/types
export type {
  ListDocumentsRequest,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  GetDocumentRequest,
  DeleteDocumentRequest,
  UploadMediaRequest,
  GetMediaRequest,
  DeleteMediaRequest,
  ListUsersRequest,
  CreateUserRequest,
  UpdateUserRequest,
  GetUserRequest,
  DeleteUserRequest,
  GetUserByUsernameRequest,
  GetUserByEmailRequest,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  ValidateTokenRequest,
  RefreshTokenRequest,
  CheckSlugUniquenessRequest,
  CheckSlugUniquenessResponse,
  WebhookRetryPolicy,
  ListWebhooksRequest,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  GetWebhookRequest,
  DeleteWebhookRequest,
  GetWebhookDeliveriesRequest,
  TestWebhookRequest
} from '@trokky/types'

// Import types needed for local interfaces
import type {
  HttpRequest,
  StaticRouteConfig,
  CorsOptions,
  RateLimitOptions,
  AuthenticationOptions
} from '@trokky/types'

// Routes configuration (depends on TrokkyCore, so stays here)
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

// Route context for handlers (depends on TrokkyCore, so stays here)
export interface RouteContext {
  core: TrokkyCore
  config: RoutesConfig
  request: HttpRequest
}