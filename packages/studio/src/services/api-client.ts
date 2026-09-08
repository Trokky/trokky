import type {
  ApiResponse,
  BackendCapabilities,
  Document,
  Schema,
  SchemaApiResponse,
  MediaFile,
  User,
  QueryOptions,
  SearchResponse,
} from '@/types'
import { createStudioLogger } from '../utils/logger'
import { storageService, STORAGE_KEYS } from '@/utils/storage'
import { authStore, type RefreshedSession } from './auth-store'

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

export class ApiClient {
  private backendUrl: string = ''
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
  private get authToken(): string | null {
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
  private ensureConfigured(): void {
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
          !endpoint.includes('/auth/')
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
  private buildUrl(endpoint: string): string {
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
  async post<T>(endpoint: string, data?: any, options?: { headers?: Record<string, string> }): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: options?.headers,
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

  // ========================================
  // Schema & Document Methods
  // ========================================

  /**
   * Get all schemas
   */
  async getSchemas(): Promise<ApiResponse<Schema[]>> {
    const response = await this.get<{ collections: Schema[] }>('/collections')
    if (response.success && response.data?.collections) {
      return {
        success: true,
        data: response.data.collections,
        meta: response.meta,
      }
    }
    return { success: false, data: [] } as ApiResponse<Schema[]>
  }

  /**
   * Get schema by name
   */
  async getSchema(name: string): Promise<ApiResponse<SchemaApiResponse>> {
    return this.get<SchemaApiResponse>(`/schemas/${name}`)
  }

  /**
   * Get documents for a schema
   */
  async getDocuments(
    schemaName: string,
    options: QueryOptions = {}
  ): Promise<ApiResponse<{ documents: Document[]; total: number }>> {
    return this.get<{ documents: Document[]; total: number }>(
      `/collections/${schemaName}`,
      options
    )
  }

  /**
   * Get single document
   */
  async getDocument(
    schemaName: string,
    id: string
  ): Promise<ApiResponse<Document>> {
    return this.get<Document>(`/collections/${schemaName}/${id}`)
  }

  /**
   * Create document
   */
  async createDocument(
    schemaName: string,
    data: Partial<Document>
  ): Promise<ApiResponse<Document>> {
    return this.post<Document>(`/collections/${schemaName}`, { data })
  }

  /**
   * Update document
   */
  async updateDocument(
    schemaName: string,
    id: string,
    data: Partial<Document>
  ): Promise<ApiResponse<Document>> {
    return this.put<Document>(`/collections/${schemaName}/${id}`, { data })
  }

  /**
   * Delete document
   */
  async deleteDocument(
    schemaName: string,
    id: string
  ): Promise<ApiResponse<void>> {
    return this.delete<void>(`/collections/${schemaName}/${id}`)
  }

  // ========================================
  // Media Methods (if available)
  // ========================================

  /**
   * Get media files
   */
  async getMedia(
    options: QueryOptions = {}
  ): Promise<ApiResponse<MediaFile[]>> {
    if (!this.hasFeature('media')) {
      throw new ApiClientError('Media feature not available')
    }
    const response = await this.get<MediaFile[]>('/media', options)

    // Transform media objects to include constructed URLs
    if (response.success && response.data) {
      response.data = response.data.map(media =>
        this.transformMediaObject(media)
      )
    }

    return response
  }

  /**
   * Get single media file by ID
   */
  async getMediaFile(id: string): Promise<ApiResponse<{ file: MediaFile }>> {
    if (!this.hasFeature('media')) {
      throw new ApiClientError('Media feature not available')
    }
    const response = await this.get<{ file: MediaFile }>(`/media/${id}`)

    // Transform media object to include constructed URLs
    if (response.success && response.data?.file) {
      response.data.file = this.transformMediaObject(response.data.file)
    }

    return response
  }

  /**
   * Get single media file by ID (alias for compatibility with MediaField)
   */
  async getMediaById(id: string): Promise<ApiResponse<{ file: MediaFile }>> {
    return this.getMediaFile(id)
  }

  /**
   * Upload media file
   */
  async uploadMedia(
    file: File,
    options?: any,
    metadata?: Record<string, any>
  ): Promise<ApiResponse<MediaFile>> {
    if (!this.hasFeature('media')) {
      throw new ApiClientError('Media feature not available')
    }

    // Handle different call patterns for compatibility
    let finalMetadata = metadata
    if (options && typeof options === 'object' && !metadata) {
      finalMetadata = options
    }

    const formData = new FormData()
    formData.append('files', file)
    if (finalMetadata) {
      formData.append('metadata', JSON.stringify(finalMetadata))
    }

    const response = await this.request<MediaFile>('/media/upload', {
      method: 'POST',
      body: formData,
    })

    // Transform media object to include constructed URLs
    if (response.success && response.data) {
      response.data = this.transformMediaObject(response.data)
    }

    return response
  }

  /**
   * Update media metadata
   */
  async updateMedia(
    id: string,
    metadata: Record<string, any>
  ): Promise<ApiResponse<{ file: MediaFile }>> {
    if (!this.hasFeature('media')) {
      throw new ApiClientError('Media feature not available')
    }
    const response = await this.put<{ file: MediaFile }>(`/media/${id}`, {
      metadata,
    })

    // Transform media object to include constructed URLs
    if (response.success && response.data?.file) {
      response.data.file = this.transformMediaObject(response.data.file)
    }

    return response
  }

  /**
   * Delete media file
   */
  async deleteMedia(id: string): Promise<ApiResponse<void>> {
    if (!this.hasFeature('media')) {
      throw new ApiClientError('Media feature not available')
    }
    return this.delete<void>(`/media/${id}`)
  }

  /**
   * Bulk delete media files
   */
  async bulkDeleteMedia(ids: string[]): Promise<
    ApiResponse<{
      message: string
      results: { id: string; success: boolean; error?: string }[]
      successCount: number
      errorCount: number
    }>
  > {
    if (!this.hasFeature('media')) {
      throw new ApiClientError('Media feature not available')
    }
    return this.post<{
      message: string
      results: { id: string; success: boolean; error?: string }[]
      successCount: number
      errorCount: number
    }>('/media/bulk-delete', { ids })
  }

  /**
   * Regenerate variants for media file
   */
  async regenerateMediaVariants(
    id: string
  ): Promise<ApiResponse<{ message: string; file: MediaFile }>> {
    if (!this.hasFeature('media')) {
      throw new ApiClientError('Media feature not available')
    }
    return this.post<{ message: string; file: MediaFile }>(
      `/media/${id}/regenerate-variants`,
      {}
    )
  }

  /**
   * Transform media object to include constructed URLs
   */
  private transformMediaObject(media: any): any {
    if (!media || !media.id) {
      return media
    }

    return {
      ...media,
      url: this.getMediaUrl(media.id), // Original file URL
      // Add variant URLs if they exist
      ...(media.variants && {
        variants: Object.keys(media.variants).reduce((acc, variantName) => {
          acc[variantName] = {
            ...media.variants[variantName],
            url: this.getMediaUrl(media.id, variantName),
          }
          return acc
        }, {} as any),
      }),
    }
  }

  /**
   * Construct media URL for asset reference
   * This properly handles the configurable API base path
   */
  getMediaUrl(assetRef: string, variant?: string): string {
    if (!assetRef) {
      return ''
    }

    // If no variant specified, return the original file URL
    if (!variant) {
      return `${this.backendUrl}/media/${assetRef}/file`
    }

    // Return variant URL
    return `${this.backendUrl}/media/${assetRef}/variants/${variant}`
  }

  /**
   * Get the backend URL (useful for external URL construction)
   */
  getBackendUrl(): string {
    this.ensureConfigured()
    return this.backendUrl
  }

  /**
   * Get the API base path (backward compatibility)
   * @deprecated Use getBackendUrl() instead
   */
  getApiBasePath(): string {
    return this.backendUrl
  }

  // ========================================
  // Document List Methods (Studio-compatible endpoints)
  // ========================================

  /**
   * List documents using Studio-compatible endpoint
   */
  async listDocuments(
    schemaName: string,
    options: {
      page?: number
      limit?: number
      search?: string
      filter?: Record<string, any>
      sort?: string
    } = {}
  ): Promise<
    ApiResponse<{
      documents: Document[]
      pagination: {
        page: number
        limit: number
        total: number
        pages: number
      }
    }>
  > {
    const queryParams = new URLSearchParams()

    if (options.page) queryParams.set('page', String(options.page))
    if (options.limit) queryParams.set('limit', String(options.limit))
    if (options.search) queryParams.set('search', options.search)
    if (options.sort) queryParams.set('sort', options.sort)

    // Add filters
    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.set(`filter[${key}]`, String(value))
        }
      })
    }

    const endpoint = `/collections/${schemaName}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
    return this.get<{
      documents: Document[]
      pagination: {
        page: number
        limit: number
        total: number
        pages: number
      }
    }>(endpoint)
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(schemaName: string): Promise<
    ApiResponse<{
      stats: {
        collection: string
        totalDocuments: number
        publishedDocuments: number
        draftDocuments: number
        recentDocuments: number
        lastUpdated: string
      }
    }>
  > {
    return this.get<{
      stats: {
        collection: string
        totalDocuments: number
        publishedDocuments: number
        draftDocuments: number
        recentDocuments: number
        lastUpdated: string
      }
    }>(`/stats/${schemaName}`)
  }

  // ========================================
  // Search Methods (if available)
  // ========================================

  /**
   * Global search
   */
  async search(
    query: string,
    options: { types?: string[]; limit?: number } = {}
  ): Promise<ApiResponse<SearchResponse>> {
    if (!this.hasFeature('search')) {
      // Fallback to client-side search
      return this.clientSideSearch(query, options)
    }

    return this.get<SearchResponse>('/search', { q: query, ...options })
  }

  /**
   * Client-side search fallback
   */
  private async clientSideSearch(
    query: string,
    options: { types?: string[]; limit?: number } = {}
  ): Promise<ApiResponse<SearchResponse>> {
    // Basic client-side search implementation
    const results: any[] = []

    // Search documents if enabled
    if (!options.types || options.types.includes('documents')) {
      try {
        const schemas = await this.getSchemas()
        if (schemas.success && schemas.data) {
          for (const schema of schemas.data.slice(0, 3)) {
            const docs = await this.getDocuments(schema.name, {
              limit: 5,
              search: query,
            })
            if (docs.success && docs.data?.documents) {
              results.push(
                ...docs.data.documents.map((doc: any) => ({
                  id: doc.id || doc._id,
                  type: 'document',
                  title: doc.title || doc.name || doc.id || doc._id,
                  url: `/content/${schema.name}/${doc.id || doc._id}`,
                  metadata: {
                    status: doc._status,
                    createdAt: doc._createdAt,
                  },
                }))
              )
            }
          }
        }
      } catch (error) {
        console.warn('Document search failed:', error)
      }
    }

    return {
      success: true,
      data: {
        results: results.slice(0, options.limit || 20),
        totalCount: results.length,
        categories: {
          documents: results.filter(r => r.type === 'document').length,
          media: 0,
          users: 0,
          schemas: 0,
        },
        query,
        searchTime: 0,
      },
    }
  }

  // ========================================
  // Auth Methods (if available)
  // ========================================

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    if (!this.hasFeature('auth')) {
      throw new ApiClientError('Auth feature not available')
    }
    return this.get<User>('/auth/me')
  }

  /**
   * Login
   */
  async login(
    username: string,
    password: string,
    rememberMe?: boolean,
    deviceId?: string,
    captchaToken?: string
  ): Promise<ApiResponse<{ user: User; token: string; expiresAt?: string }>> {
    if (!this.hasFeature('auth')) {
      throw new ApiClientError('Auth feature not available')
    }

    const response = await this.post<{
      user: User
      token: string
      expiresAt?: string
    }>('/auth/login', { username, password, rememberMe, deviceId, captchaToken })

    if (response.success && response.data?.token) {
      this.setAuthToken(response.data.token)
    }

    return response
  }

  /**
   * Logout
   */
  async logout(): Promise<ApiResponse<void>> {
    if (this.hasFeature('auth')) {
      try {
        await this.post('/auth/logout')
      } catch (error) {
        // Continue with local logout even if server logout fails
        console.warn('Server logout failed:', error)
      }
    }

    this.clearAuthToken()
    return { success: true }
  }

  // ========================================
  // Slug Methods
  // ========================================

  /**
   * Check slug uniqueness
   */
  async checkSlugUniqueness(
    slug: string,
    collection: string,
    excludeId?: string
  ): Promise<
    ApiResponse<{
      unique: boolean
      slug: string
      collection: string
      reason?: string
    }>
  > {
    const queryParams = new URLSearchParams({
      slug: slug,
      collection: collection,
    })

    if (excludeId) {
      queryParams.append('excludeId', excludeId)
    }

    return this.get(`/slugs/check-unique?${queryParams}`)
  }

  // ========================================
  // Structure Methods (if available)
  // ========================================

  /**
   * Get structure configuration
   */
  async getStructure(): Promise<ApiResponse<any>> {
    if (!this.hasFeature('structure')) {
      return { success: true, data: null }
    }
    return this.get('/structure')
  }
}

// Singleton instance
export const apiClient = new ApiClient()

// The auth store owns the refresh mechanism but not the transport; wire the one
// round trip it needs here, where the singleton exists.
authStore.setRefresher(async refreshToken => {
  const response = await apiClient.post<RefreshedSession>('/auth/refresh', {
    refreshToken,
  })
  return response.success && response.data?.token ? response.data : null
})
