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
} from '../types'

export class HttpClient {
  private config: Required<ClientConfig>
  private tokens: AuthTokens | null = null

  constructor(config: ClientConfig) {
    this.config = {
      baseUrl: config.baseUrl,
      apiVersion: config.apiVersion || 'v1',
      token: config.token || '',
      refreshToken: config.refreshToken || '',
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      enableCache: config.enableCache ?? true,
      cacheMaxAge: config.cacheMaxAge || 300000, // 5 minutes
      enableRealtime: config.enableRealtime ?? false,
      websocketUrl: config.websocketUrl || '',
      debug: config.debug ?? false
    }

    // Initialize with provided tokens
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
   * Authenticate with username and password
   */
  async authenticate(credentials: AuthConfig): Promise<AuthTokens> {
    const response = await this.request<AuthTokens>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.setTokens(response)
    return response
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
      // For Node.js Buffer support
      const blob = new Blob([file])
      formData.append('file', blob, filename || 'file')
    }

    return this.request('/media', {
      method: 'POST',
      body: formData as any
      // Don't set Content-Type for FormData - browser will set it with boundary
    })
  }

  // Private methods

  private buildUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint
    return `${this.config.baseUrl}/api/${this.config.apiVersion}/${cleanEndpoint}`
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

    if (this.tokens?.accessToken) {
      headers.Authorization = `Bearer ${this.tokens.accessToken}`
    }

    return headers
  }

  private async makeRequest(url: string, options: RequestInit): Promise<Response> {
    this.log('Request:', options.method, url)
    
    const response = await fetch(url, options)
    
    this.log('Response:', response.status, response.statusText)
    
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
      return response.json()
    }

    return response.text() as unknown as T
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

  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[TrokkyClient]', ...args)
    }
  }
}