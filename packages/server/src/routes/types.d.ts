import type { TrokkyCore, DocumentData, User, CreateUserData, UpdateUserData, LoginCredentials } from '../core/index.js';
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS';
export interface HttpRequest {
    method: HttpMethod;
    url: string;
    path: string;
    query: Record<string, string | string[] | undefined>;
    params: Record<string, string>;
    headers: Record<string, string | string[] | undefined>;
    body?: unknown;
    files?: File[];
}
export interface HttpResponse {
    status: number;
    headers: Record<string, string>;
    body: unknown;
}
export type RouteHandler = (request: HttpRequest) => Promise<HttpResponse>;
export interface RouteDefinition {
    method: HttpMethod;
    path: string;
    handler: RouteHandler;
    description?: string;
}
export interface StaticRouteConfig {
    mountPath: string;
    directory: string;
    maxAge?: number;
}
export interface RoutesConfig {
    core: TrokkyCore;
    basePath?: string;
    corsOptions?: CorsOptions;
    rateLimiting?: RateLimitOptions;
    authentication?: AuthenticationOptions;
    staticRoutes?: {
        media?: StaticRouteConfig;
        assets?: StaticRouteConfig;
        [key: string]: StaticRouteConfig | undefined;
    };
}
export interface CorsOptions {
    origin?: string | string[] | boolean;
    methods?: HttpMethod[];
    allowedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
}
export interface RateLimitOptions {
    windowMs?: number;
    maxRequests?: number;
    message?: string;
}
export interface AuthenticationOptions {
    enabled: boolean;
    headerName?: string;
    validateToken?: (token: string) => Promise<boolean>;
    publicPaths?: string[];
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
    meta?: {
        total?: number;
        page?: number;
        limit?: number;
        hasNext?: boolean;
        hasPrev?: boolean;
    };
}
export interface ListDocumentsRequest {
    collection: string;
    limit?: number;
    offset?: number;
    filter?: Record<string, unknown>;
    sort?: string | string[];
}
export interface CreateDocumentRequest {
    collection: string;
    data: DocumentData;
    id?: string;
}
export interface UpdateDocumentRequest {
    collection: string;
    id: string;
    data: Partial<DocumentData>;
}
export interface GetDocumentRequest {
    collection: string;
    id: string;
}
export interface DeleteDocumentRequest {
    collection: string;
    id: string;
}
export interface UploadMediaRequest {
    files: File[];
    metadata?: Record<string, unknown>;
}
export interface GetMediaRequest {
    id: string;
}
export interface DeleteMediaRequest {
    id: string;
}
export interface ListUsersRequest {
    role?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
}
export interface CreateUserRequest {
    userData: CreateUserData;
}
export interface UpdateUserRequest {
    id: string;
    userData: UpdateUserData;
}
export interface GetUserRequest {
    id: string;
}
export interface DeleteUserRequest {
    id: string;
}
export interface GetUserByUsernameRequest {
    username: string;
}
export interface GetUserByEmailRequest {
    email: string;
}
export interface LoginRequest {
    credentials: LoginCredentials;
}
export interface LoginResponse {
    success: boolean;
    token?: string;
    refreshToken?: string;
    user?: Omit<User, 'passwordHash'>;
    expiresAt?: string;
}
export interface LogoutRequest {
    token?: string;
}
export interface ValidateTokenRequest {
    token: string;
}
export interface RefreshTokenRequest {
    refreshToken: string;
}
export interface CheckSlugUniquenessRequest {
    slug: string;
    collection: string;
    excludeId?: string;
}
export interface CheckSlugUniquenessResponse {
    unique: boolean;
    slug: string;
    collection: string;
    reason?: string;
}
export interface RouteContext {
    core: TrokkyCore;
    config: RoutesConfig;
    request: HttpRequest;
}
export interface FrameworkAdapter<TFrameworkRequest = unknown, TFrameworkResponse = unknown> {
    name: string;
    convertRequest: (frameworkRequest: TFrameworkRequest) => HttpRequest;
    convertResponse: (response: HttpResponse) => TFrameworkResponse;
    handleRoute: (routeHandler: RouteHandler) => (frameworkRequest: TFrameworkRequest) => Promise<TFrameworkResponse>;
}
//# sourceMappingURL=types.d.ts.map