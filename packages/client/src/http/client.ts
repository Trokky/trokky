/**
 * HTTP Client
 * Framework-agnostic HTTP client for Trokky API
 */

import type { 
  ClientConfig, 
  RequestOptions, 
  ApiError,
  AuthTokens,
  AuthConfig
} from '../types/index.js'
import { createLogger } from '@trokky/trokky'

export class HttpClient {
  private config: Required<ClientConfig & { apiToken: string }>
  private tokens: AuthTokens | null = null
  private logger = createLogger('client', 'HttpClient')

  constructor(config: ClientConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      apiVersion: config.apiVersion ?? '', // Default to no versioning, not 'v1'
      token: config.token || '',
      refreshToken: config.refreshToken || '',
      apiToken: config.apiToken || '',
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      enableCache: config.enableCache ?? true,
      cacheMaxAge: config.cacheMaxAge || 300000, // 5 minutes
      enableRealtime: config.enableRealtime ?? false,
      websocketUrl: config.websocketUrl || '',
      debug: config.debug ?? false
    }

    // Initialize with provided tokens (JWT tokens)
    if (this.config.token) {
      this.tokens = {
        accessToken: this.config.token,
        refreshToken: this.config.refreshToken
      }
    }
  }

  /**
   * Set authentication tokens
   */
  setTokens(tokens: AuthTokens): void {
    this.tokens = tokens
    this.config.token = tokens.accessToken
    this.config.refreshToken = tokens.refreshToken || ''
  }

  /**
   * Get current authentication tokens
   */
  getTokens(): AuthTokens | null {
    return this.tokens
  }

  /**
   * Clear authentication tokens
   */
  clearTokens(): void {
    this.tokens = null
    this.config.token = ''
    this.config.refreshToken = ''
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.tokens?.accessToken
  }

  /**
   * Get the base URL of the API
   */
  getBaseUrl(): string {
    return this.config.baseUrl
  }

  /**
   * Authenticate with username and password
   */
  async authenticate(credentials: AuthConfig): Promise<AuthTokens> {
    const response = await this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials), // Send credentials directly
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Handle both old and new response formats
    // New format: { success: true, token: "...", refreshToken: "...", expiresAt: "..." }
    // Old format: { success: true, data: { token: "...", refreshToken: "...", expiresAt: "..." } }
    // The transformResponse method already handles the old format by extracting the data field
    
    const tokens = {
      accessToken: response.token,
      refreshToken: response.refreshToken,
      expiresAt: response.expiresAt ? new Date(response.expiresAt).getTime() : undefined
    }
    
    // Validate that we received the required tokens
    if (!tokens.accessToken) {
      throw new Error('Authentication failed: No access token received')
    }

    this.setTokens(tokens)
    return tokens
  }

  /**
   * Refresh authentication token
   */
  async refreshAuth(): Promise<AuthTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await this.request<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: this.tokens.refreshToken }),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.setTokens(response)
    return response
  }

  /**
   * Logout and clear tokens
   */
  async logout(): Promise<void> {
    if (this.tokens?.accessToken) {
      try {
        await this.request('/auth/logout', {
          method: 'POST'
        })
      } catch (error) {
        // Continue with logout even if API call fails
        this.log('Logout API call failed, clearing tokens anyway:', error)
      }
    }
    
    this.clearTokens()
  }

  /**
   * Make HTTP request with automatic auth and error handling
   */
  async request<T = any>(
    endpoint: string,
    options: RequestInit & RequestOptions = {}
  ): Promise<T> {
    const url = this.buildUrl(endpoint)
    const requestOptions = this.buildRequestOptions(options)

    let attempt = 0
    while (attempt <= this.config.retries) {
      try {
        const response = await this.makeRequest(url, requestOptions)
        return await this.handleResponse<T>(response)
      } catch (error) {
        attempt++
        
        // If it's an auth error and we have a refresh token, try to refresh
        if (this.isAuthError(error) && this.tokens?.refreshToken && attempt === 1) {
          try {
            await this.refreshAuth()
            requestOptions.headers = this.buildHeaders(options.headers)
            continue
          } catch (refreshError) {
            this.clearTokens()
            throw error
          }
        }

        // If we've exhausted retries or it's not a retryable error, throw
        if (attempt > this.config.retries || !this.isRetryableError(error)) {
          throw error
        }

        // Wait before retry (exponential backoff)
        await this.wait(Math.pow(2, attempt - 1) * 1000)
      }
    }

    throw new Error('Request failed after all retries')
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' })
  }

  /**
   * POST request
   */
  async post<T = any>(
    endpoint: string, 
    data?: any, 
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
  }

  /**
   * PUT request
   */
  async put<T = any>(
    endpoint: string, 
    data?: any, 
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
  }

  /**
   * PATCH request
   */
  async patch<T = any>(
    endpoint: string, 
    data?: any, 
    options: RequestOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' })
  }

  /**
   * Upload file
   */
  async upload(file: File | Buffer, filename?: string): Promise<any> {
    const formData = new FormData()
    
    if (file instanceof File) {
      formData.append('file', file)
    } else {
      // For Node.js Buffer support - convert Buffer to Uint8Array to ensure ArrayBuffer compatibility
      const uint8Array = new Uint8Array(file)
      const blob = new Blob([uint8Array])
      formData.append('file', blob, filename || 'file')
    }

    return this.request('/media', {
      method: 'POST',
      body: formData as any
      // Don't set Content-Type for FormData - browser will set it with boundary
    })
  }

  // API Token Management Methods

  /**
   * List API tokens
   */
  async listApiTokens(): Promise<any> {
    return this.get('/tokens')
  }

  /**
   * Create API token
   */
  async createApiToken(data: any): Promise<any> {
    return this.post('/tokens', data)
  }

  /**
   * Get API token by ID from server
   */
  async getApiTokenById(id: string): Promise<any> {
    return this.get(`/tokens/${id}`)
  }

  /**
   * Update API token
   */
  async updateApiToken(id: string, data: any): Promise<any> {
    return this.put(`/tokens/${id}`, data)
  }

  /**
   * Delete API token
   */
  async deleteApiToken(id: string): Promise<void> {
    return this.delete(`/tokens/${id}`)
  }

  /**
   * Set API token for authentication (alternative to JWT)
   */
  setApiToken(token: string): void {
    this.config.apiToken = token
    // Clear JWT tokens when using API token
    this.clearTokens()
  }

  /**
   * Get current API token
   */
  getApiToken(): string | null {
    return this.config.apiToken || null
  }

  /**
   * Clear API token
   */
  clearApiToken(): void {
    this.config.apiToken = ''
  }

  // Private methods

  private buildUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
    const apiPath = this.config.apiVersion ? `/${this.config.apiVersion}` : ''
    return `${this.config.baseUrl}${apiPath}/${cleanEndpoint}`
  }

  private buildRequestOptions(options: RequestInit & RequestOptions): RequestInit {
    return {
      ...options,
      headers: this.buildHeaders(options.headers),
      signal: options.signal || AbortSignal.timeout(this.config.timeout)
    }
  }

  private buildHeaders(additionalHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...additionalHeaders
    }

    // Priority: JWT token > API token
    if (this.tokens?.accessToken) {
      headers.Authorization = `Bearer ${this.tokens.accessToken}`
    } else if (this.config.apiToken) {
      headers.Authorization = `Bearer ${this.config.apiToken}`
    }

    return headers
  }

  private async makeRequest(url: string, options: RequestInit): Promise<Response> {
    this.log('Request', { method: options.method, url })
    
    const response = await fetch(url, options)
    
    this.log('Response', { status: response.status, statusText: response.statusText })
    
    return response
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('Content-Type') || ''
    
    if (!response.ok) {
      let errorData: any = {}
      
      if (contentType.includes('application/json')) {
        try {
          errorData = await response.json()
        } catch {
          // If JSON parsing fails, use status text
          errorData = { message: response.statusText }
        }
      } else {
        errorData = { message: response.statusText }
      }

      const apiError: ApiError = {
        message: errorData.message || `HTTP ${response.status}`,
        code: errorData.code || 'HTTP_ERROR',
        status: response.status,
        details: errorData.details,
        validation: errorData.validation
      }

      throw apiError
    }

    if (contentType.includes('application/json')) {
      const json = await response.json()
      return this.transformResponse<T>(json)
    }

    return response.text() as any
  }

  /**
   * Transform Trokky API response format to client expected format
   */
  private transformResponse<T>(apiResponse: any): T {
    // If response has success and data fields (Trokky API format)
    if (typeof apiResponse === 'object' && apiResponse.success && apiResponse.data) {
      const data = apiResponse.data
      
      // Transform collection responses
      if (data.documents && data.pagination) {
        return {
          data: data.documents,
          total: data.pagination.total,
          offset: (data.pagination.page - 1) * data.pagination.limit,
          limit: data.pagination.limit,
          hasMore: data.pagination.page < data.pagination.pages
        } as T
      }
      
      // Transform single document responses
      if (data.id || data._id) {
        return data as T
      }
      
      // Return unwrapped data for other cases
      return data as T
    }
    
    // Return as-is if not in Trokky API format
    return apiResponse as T
  }

  private isAuthError(error: any): boolean {
    return error.status === 401 || error.code === 'UNAUTHORIZED'
  }

  private isRetryableError(error: any): boolean {
    // Retry on network errors and 5xx status codes
    if (!error.status) return true // Network error
    return error.status >= 500 && error.status < 600
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private log(message: string, data?: any): void {
    if (this.config.debug) {
      this.logger.debug(message, data)
      // Also log to console for browser debugging
      console.log(`[TrokkyClient] ${message}:`, data)
    }
  }
}