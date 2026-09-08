import type {
  ApiResponse,
  Document,
  Schema,
  SchemaApiResponse,
  MediaFile,
  User,
  QueryOptions,
  SearchResponse,
} from '@/types'
import { authStore, type RefreshedSession } from './auth-store'
import { ApiClientError } from './api/errors'
import { HttpClient } from './api/http-client'
import { buildMediaUrl, transformMediaObject } from './api/media-urls'
import { clientSideSearch } from './api/client-search'

export { ApiClientError }

/**
 * The Studio API client: every endpoint the admin UI talks to, on top of the
 * HttpClient transport.
 */
export class ApiClient extends HttpClient {
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
   * Download a media file's bytes.
   *
   * Callers used to reach for a bare `fetch('/api/media/<id>/file')`, which
   * hardcoded the API path and sent no credentials. This goes through the
   * configured backend URL and the session token like every other request.
   */
  async downloadMediaFile(id: string): Promise<Blob> {
    this.ensureConfigured()

    const headers: Record<string, string> = {}
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`
    }

    // Same transport as every other request, including `credentials`. A
    // credentialed cross-origin request needs the API to reflect the Origin
    // rather than answer `*`; verified against the deployments, which reflect
    // it and allow the Authorization header on the media preflight.
    const response = await fetch(this.buildUrl(`/media/${id}/file`), {
      headers,
      credentials: 'include',
    })

    if (!response.ok) {
      throw new ApiClientError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status
      )
    }

    return response.blob()
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
    return transformMediaObject(this.backendUrl, media)
  }

  /**
   * Construct media URL for asset reference
   * This properly handles the configurable API base path
   */
  getMediaUrl(assetRef: string, variant?: string): string {
    return buildMediaUrl(this.backendUrl, assetRef, variant)
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
    return clientSideSearch(this, query, options)
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
