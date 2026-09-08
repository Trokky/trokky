/**
 * Route types for Trokky
 *
 * Types are now centralized in @trokky/types and re-exported here for backwards compatibility.
 */

import type { TrokkyCore } from '../core/index.js'

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
} from '../types/index.js'

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
} from '../types/index.js'

// Import types needed for local interfaces
import type {
  HttpRequest,
  StaticRouteConfig,
  CorsOptions,
  RateLimitOptions,
  AuthenticationOptions
} from '../types/index.js'

// Routes configuration (depends on TrokkyCore, so stays here)
export interface RoutesConfig {
  core: TrokkyCore
  basePath?: string
  /** Path the routes are actually mounted on (set by the integration at mount time) */
  mountedApiPath?: string
  corsOptions?: CorsOptions
  rateLimiting?: RateLimitOptions
  authentication?: AuthenticationOptions
  staticRoutes?: {
    media?: StaticRouteConfig
    assets?: StaticRouteConfig
    [key: string]: StaticRouteConfig | undefined
  }
  /** Studio configuration (passed from integration, avoids globals) */
  studioConfig?: any
  /** Structure configuration (passed from integration, avoids globals) */
  structureConfig?: any
}

// Route context for handlers (depends on TrokkyCore, so stays here)
export interface RouteContext {
  core: TrokkyCore
  config: RoutesConfig
  request: HttpRequest
}