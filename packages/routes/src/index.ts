// Main exports for @trokky/routes package
export { TrokkyRoutes } from './routes.js'

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
  
  // Framework adapter types
  RouteContext,
  FrameworkAdapter
} from './types.js'