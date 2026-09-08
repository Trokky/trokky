// Main exports for @trokky/routes package
export { TrokkyRoutes } from './routes.js'

// Route handler groups
export {
  BaseRoutes,
  AuthRoutes,
  DocumentRoutes,
  MediaRoutes,
  UserRoutes,
  TokenRoutes,
  WebhookRoutes,
  AuditRoutes,
  SearchRoutes,
  ConfigRoutes
} from './handlers/index.js'
export type { RouteHandlerConfig } from './handlers/index.js'

export type {
  // Core HTTP types
  HttpMethod,
  HttpRequest,
  HttpResponse,
  RouteHandler,
  RouteDefinition,
  
  // Configuration types
  RoutesConfig,
  CorsOptions,
  RateLimitOptions,
  AuthenticationOptions,
  
  // API response types
  ApiResponse,
  
  // Request/response payload types
  ListDocumentsRequest,
  CreateDocumentRequest,
  UpdateDocumentRequest,
  GetDocumentRequest,
  DeleteDocumentRequest,
  UploadMediaRequest,
  GetMediaRequest,
  DeleteMediaRequest,
  
  // User management request/response types
  ListUsersRequest,
  CreateUserRequest,
  UpdateUserRequest,
  GetUserRequest,
  DeleteUserRequest,
  GetUserByUsernameRequest,
  GetUserByEmailRequest,
  
  // Authentication request/response types
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  ValidateTokenRequest,
  RefreshTokenRequest,
  
  // Slug validation request/response types
  CheckSlugUniquenessRequest,
  CheckSlugUniquenessResponse,
  
  // Framework adapter types
  RouteContext,
  FrameworkAdapter
} from './types.js'