/**
 * @trokky/types - HTTP and API Types
 *
 * Framework-agnostic HTTP types used across the Trokky ecosystem.
 * These types enable consistent request/response handling across different frameworks.
 */

import type { User } from './auth.js'

// ============================================================================
// HTTP Method Types
// ============================================================================

/**
 * Standard HTTP methods supported by Trokky routes
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS'

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Framework-agnostic HTTP request interface
 * Adapters convert framework-specific requests to this format
 */
export interface HttpRequest {
  /** HTTP method */
  method: HttpMethod
  /** Full URL of the request */
  url: string
  /** URL path (without query string) */
  path: string
  /** Query string parameters */
  query: Record<string, string | string[] | undefined>
  /** URL path parameters (from route patterns like /users/:id) */
  params: Record<string, string>
  /** HTTP headers */
  headers: Record<string, string | string[] | undefined>
  /** Request body (parsed) */
  body?: unknown
  /** Uploaded files */
  files?: File[]
  /** Authenticated user (set by auth middleware) */
  user?: User
}

/**
 * Framework-agnostic HTTP response interface
 * Route handlers return this format, adapters convert to framework-specific responses
 */
export interface HttpResponse {
  /** HTTP status code */
  status: number
  /** Response headers */
  headers: Record<string, string>
  /** Response body */
  body: unknown
}

/**
 * Route handler function type
 */
export type RouteHandler = (request: HttpRequest) => Promise<HttpResponse>

// ============================================================================
// Route Definition Types
// ============================================================================

/**
 * Route definition interface
 */
export interface RouteDefinition {
  /** HTTP method for this route */
  method: HttpMethod
  /** URL path pattern (supports :param syntax) */
  path: string
  /** Handler function for this route */
  handler: RouteHandler
  /** Optional description for documentation */
  description?: string
}

/**
 * Static route configuration for serving files
 */
export interface StaticRouteConfig {
  /** URL path to mount the static files */
  mountPath: string
  /** Directory containing the static files */
  directory: string
  /** Cache control max-age in seconds */
  maxAge?: number
}

// ============================================================================
// CORS Configuration
// ============================================================================

/**
 * CORS (Cross-Origin Resource Sharing) configuration
 */
export interface CorsOptions {
  /** Allowed origin(s) - string, array, boolean, or callback function */
  origin?: string | string[] | boolean | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => void)
  /** Allowed HTTP methods */
  methods?: HttpMethod[]
  /** Allowed request headers */
  allowedHeaders?: string[]
  /** Whether to include credentials */
  credentials?: boolean
  /** Preflight cache duration in seconds */
  maxAge?: number
}

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

/**
 * Rate limiting configuration
 */
export interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs?: number
  /** Maximum requests per window */
  maxRequests?: number
  /** Error message when rate limited */
  message?: string
}

// ============================================================================
// Authentication Configuration
// ============================================================================

/**
 * Authentication middleware configuration
 */
export interface AuthenticationOptions {
  /** Whether authentication is enabled */
  enabled: boolean
  /** Header name for the auth token (default: Authorization) */
  headerName?: string
  /** Custom token validation function */
  validateToken?: (token: string) => Promise<boolean>
  /** Paths that don't require authentication */
  publicPaths?: string[]
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Standard API response format
 * @template T - Type of the response data
 */
export interface ApiResponse<T = unknown> {
  /** Whether the request was successful */
  success: boolean
  /** Response data (on success) */
  data?: T
  /** Error details (on failure) */
  error?: {
    /** Error code for programmatic handling */
    code: string
    /** Human-readable error message */
    message: string
    /** Additional error details */
    details?: unknown
  }
  /** Pagination metadata */
  meta?: {
    /** Total number of items */
    total?: number
    /** Current page number */
    page?: number
    /** Items per page */
    limit?: number
    /** Whether there are more items after this page */
    hasNext?: boolean
    /** Whether there are items before this page */
    hasPrev?: boolean
  }
}

// ============================================================================
// Framework Adapter Interface
// ============================================================================

/**
 * Framework adapter interface for converting between framework-specific and Trokky types
 * @template TFrameworkRequest - Framework's native request type
 * @template TFrameworkResponse - Framework's native response type
 */
export interface FrameworkAdapter<TFrameworkRequest = unknown, TFrameworkResponse = unknown> {
  /** Adapter name (e.g., 'express', 'hono', 'fastify') */
  name: string
  /** Convert framework request to HttpRequest */
  convertRequest: (frameworkRequest: TFrameworkRequest) => HttpRequest
  /** Convert HttpResponse to framework response */
  convertResponse: (response: HttpResponse) => TFrameworkResponse
  /** Create a framework-compatible route handler from a RouteHandler */
  handleRoute: (routeHandler: RouteHandler) => (frameworkRequest: TFrameworkRequest) => Promise<TFrameworkResponse>
}
