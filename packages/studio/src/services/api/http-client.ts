import type { ApiResponse, BackendCapabilities } from '@/types'
import { createStudioLogger } from '../../utils/logger'
import { storageService, STORAGE_KEYS } from '@/utils/storage'
import { authStore } from '../auth-store'
import { ApiClientError } from './errors'

/**
 * Endpoints where a 401 must not trigger recovery: asking the session owner to
 * refresh in response to a failing refresh (or validate, or login) would loop.
 */
const NON_RECOVERABLE_ENDPOINTS = [
  '/auth/refresh',
  '/auth/validate',
  '/auth/login',
  '/auth/logout',
]

/**
 * HTTP transport for the Studio API: backend URL resolution, capabilities,
 * the session token, and the verb helpers. ApiClient extends it and adds the
 * endpoint methods.
 */
export class HttpClient {
  protected backendUrl: string = ''
  private capabilities: BackendCapabilities | null = null
  private logger = createStudioLogger('ApiClient')
  private configured = false

  /**
   * Called when a request comes back 401 and the client still holds a token.
   * Returning true means the session was recovered and the request may be
   * retried once. The AuthProvider installs this; the client has no refresh
   * logic of its own.
   */
  onUnauthorized: (() => Promise<boolean>) | null = null

  constructor(backendUrl?: string) {
    if (backendUrl) {
      this.backendUrl = backendUrl
      this.configured = true
    }
  }

  /**
   * Read the current session token. The auth store is the only place it lives.
   */
  protected get authToken(): string | null {
    return authStore.getToken()
  }

  /**
   * Initialize the API client with configuration.
   *
   * Idempotent: the first call wins, so components never have to guard with
   * `if (!apiClient.isInitialized)`. Requests self-initialize through
   * `ensureConfigured()` if they somehow run first.
   */
  initialize(): void {
    if (this.configured) {
      return
    }
    this.configured = true

    // Priority order for backend URL:
    // 1. Injected backend URL from server (integrated deployment) - highest priority
    // 2. Build-time environment variable (VITE_BACKEND_URL)
    // 3. Saved URL from localStorage (user's custom setting) - only if no config provided
    // 4. Development mode fallback

    const config = (window as any).TROKKY_CONFIG
    const injectedBackendUrl = config?.backendUrl
    const buildTimeBackendUrl = import.meta.env.VITE_BACKEND_URL
    const savedBackendUrl = storageService.get<string>(STORAGE_KEYS.BACKEND_URL)

    if (injectedBackendUrl) {
      // Use server-injected backend URL (integrated deployment)
      this.setBackendUrl(injectedBackendUrl)
      // Clear any stale localStorage URL when config is provided
      if (savedBackendUrl && savedBackendUrl !== injectedBackendUrl) {
        storageService.remove(STORAGE_KEYS.BACKEND_URL)
        this.logger.debug('Cleared stale backend URL from localStorage')
      }
    } else if (buildTimeBackendUrl) {
      // Use build-time configured backend URL
      this.setBackendUrl(buildTimeBackendUrl)
      // Clear any stale localStorage URL when build-time config is provided
      if (savedBackendUrl && savedBackendUrl !== buildTimeBackendUrl) {
        storageService.remove(STORAGE_KEYS.BACKEND_URL)
        this.logger.debug('Cleared stale backend URL from localStorage')
      }
    } else if (savedBackendUrl) {
      // Use saved backend URL from localStorage (only when no config provided)
      this.setBackendUrl(savedBackendUrl)
    } else if (import.meta.env.DEV) {
      // Development mode fallback - assume API is on localhost:3210
      const devBackendUrl = 'http://localhost:3210/api'
      this.setBackendUrl(devBackendUrl)
    } else {
      // No backend URL configured - Studio will show login form to set it
      this.logger.info(
        'No backend URL configured. User will need to set it in login form.'
      )
    }

    this.logger.info('Studio initialized', {
      backendUrl: this.backendUrl,
      hasAuthToken: !!this.authToken,
    })
  }

  /**
   * Configure on first use, so a request that beats App's explicit call still
   * finds a backend URL.
   */
  protected ensureConfigured(): void {
    if (!this.configured) {
      this.initialize()
    }
  }

  /**
   * Set a custom backend URL
   * The URL should be the complete API endpoint (e.g., http://localhost:3000/cms-api)
   */
  setBackendUrl(url: string): void {
    // Remove trailing slash if present
    this.backendUrl = url.replace(/\/$/, '')

    // Update capabilities with new endpoints
    this.updateCapabilities()

    this.logger.info('Backend URL set', {
      backendUrl: this.backendUrl,
    })
  }

  /**
   * Update capabilities after backend URL change
   */
  private updateCapabilities(): void {
    this.capabilities = {
      version: '2.0.0',
      features: {
        search: false,
        media: true,
        auth: true,
        structure: true,
        workflows: false,
      },
      endpoints: {
        documents: '/collections',
        auth: '/auth',
        structure: '/structure',
        slugs: '/slugs',
      },
      limits: {
        maxUploadSize: 100 * 1024 * 1024,
        maxResults: 100,
        requestRate: 1000,
      },
    }
  }

  /**
   * Check if the client is initialized
   */
  get isInitialized(): boolean {
    return !!this.backendUrl && !!this.capabilities
  }

  /**
   * Get backend capabilities
   */
  getCapabilities(): BackendCapabilities | null {
    return this.capabilities
  }

  /**
   * Check if a feature is available
   */
  hasFeature(feature: keyof BackendCapabilities['features']): boolean {
    return this.capabilities?.features[feature] ?? false
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    authStore.persist(token)
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    authStore.clear()
  }

  /**
   * Store both auth token and refresh token (used after MFA verification)
   */
  async storeTokens(token: string, refreshToken?: string): Promise<void> {
    authStore.persist(token, refreshToken)
  }

  /**
   * Make an HTTP request with automatic error handling
   */
  async request<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAuth = false,
    retried = false
  ): Promise<ApiResponse<T>> {
    this.ensureConfigured()

    // Check if backend URL is configured
    if (!this.backendUrl) {
      return {
        success: false,
        error: {
          message:
            'Backend URL not configured. Please configure it in the login form.',
          code: 'NO_BACKEND_URL',
        },
      }
    }

    // Build the full URL
    const url = this.buildUrl(endpoint)

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    // Only set Content-Type if not FormData (browser will set it automatically for FormData)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    // Add auth token if available and not skipped
    if (this.authToken && !skipAuth) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      })

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        if (!response.ok) {
          throw new ApiClientError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status
          )
        }
        return { success: true, data: null as T }
      }

      const data = await response.json()

      if (!response.ok) {
        // Handle 401 Unauthorized. Recovery is the AuthProvider's job via
        // onUnauthorized; the client only retries the request, and only once,
        // so an endpoint that keeps returning 401 cannot loop.
        if (
          response.status === 401 &&
          this.authToken &&
          !skipAuth &&
          !retried &&
          !NON_RECOVERABLE_ENDPOINTS.some(path => endpoint.includes(path))
        ) {
          const recovered = (await this.onUnauthorized?.()) ?? false
          if (recovered) {
            return this.request<T>(endpoint, options, skipAuth, true)
          }
        }

        throw new ApiClientError(
          data.error?.message || `HTTP ${response.status}`,
          response.status,
          data.error?.code,
          data.error?.details
        )
      }

      return {
        success: true,
        data: data.data || data,
        meta: data.meta,
      }
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error
      }

      throw new ApiClientError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Build full URL from relative endpoint
   */
  protected buildUrl(endpoint: string): string {
    // If endpoint is already a full URL, return as-is
    if (endpoint.startsWith('http')) {
      return endpoint
    }

    this.ensureConfigured()

    // Check if backendUrl is set
    if (!this.backendUrl) {
      this.logger.warn(
        'Backend URL not set, cannot build URL for endpoint:',
        endpoint
      )
      throw new ApiClientError(
        'Backend URL not configured. Please set the backend URL.'
      )
    }

    // Remove leading slash from endpoint to ensure proper joining
    const cleanEndpoint = endpoint.startsWith('/')
      ? endpoint.slice(1)
      : endpoint

    // Join backendUrl with the clean endpoint
    const url = cleanEndpoint
      ? `${this.backendUrl}/${cleanEndpoint}`
      : this.backendUrl

    this.logger.debug('Building URL:', {
      originalEndpoint: endpoint,
      cleanEndpoint,
      backendUrl: this.backendUrl,
      finalUrl: url,
    })

    return url
  }

  /**
   * GET request helper
   */
  async get<T>(
    endpoint: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    const url = new URL(this.buildUrl(endpoint))
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    return this.request<T>(url.toString(), { method: 'GET' })
  }

  /**
   * POST request helper
   */
  async post<T>(
    endpoint: string,
    data?: any,
    options?: { headers?: Record<string, string>; signal?: AbortSignal }
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: options?.headers,
      signal: options?.signal,
    })
  }

  /**
   * PUT request helper
   */
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * PATCH request helper
   */
  async patch<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * DELETE request helper
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' })
  }
}
