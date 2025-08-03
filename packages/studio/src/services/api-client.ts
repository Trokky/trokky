import type { 
  ApiResponse, 
  BackendCapabilities, 
  Document, 
  Schema, 
  MediaFile, 
  User, 
  QueryOptions,
  SearchResponse
} from '@/types';
import { createStudioLogger } from '../utils/logger';

export class ApiClientError extends Error {
  constructor(
    message: string, 
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export class ApiClient {
  private baseUrl: string = '';
  private capabilities: BackendCapabilities | null = null;
  private authToken: string | null = null;
  private logger = createStudioLogger('ApiClient');

  constructor(baseUrl?: string) {
    if (baseUrl) {
      this.baseUrl = baseUrl;
    }
  }

  /**
   * Initialize the API client with configuration
   */
  initialize(): void {
    // Check for Studio configuration
    const config = (window as any).TROKKY_CONFIG;
    if (!config) {
      throw new Error('Studio configuration not found. TROKKY_CONFIG not found.');
    }
    
    // In development mode, Studio runs on Vite dev server (5173) but API is on main server (3000)
    // In production mode, both Studio and API are served from the same origin
    if (config.mode === 'development' || window.location.port === '5173') {
      // Development mode: API is on different port
      this.baseUrl = 'http://localhost:3000';
    } else {
      // Production mode: API is on same origin
      this.baseUrl = window.location.origin;
    }
    
    this.capabilities = {
      version: '2.0.0',
      features: {
        search: false,
        media: true, // Enable media features
        auth: true,
        structure: true,
        workflows: false
      },
      endpoints: {
        documents: `${this.baseUrl}/api/collections`,
        auth: `${this.baseUrl}/api/auth`,
        structure: `${this.baseUrl}/api/structure`
      },
      limits: {
        maxUploadSize: 100 * 1024 * 1024,
        maxResults: 100,
        requestRate: 1000
      }
    };
    
    // Restore auth token from localStorage if available
    this.restoreAuthToken();
    
    this.logger.info('Studio initialized', { 
      baseUrl: this.baseUrl,
      hasAuthToken: !!this.authToken
    });
  }

  /**
   * Check if the client is initialized
   */
  get isInitialized(): boolean {
    return !!this.baseUrl && !!this.capabilities;
  }

  /**
   * Get backend capabilities
   */
  getCapabilities(): BackendCapabilities | null {
    return this.capabilities;
  }

  /**
   * Check if a feature is available
   */
  hasFeature(feature: keyof BackendCapabilities['features']): boolean {
    return this.capabilities?.features[feature] ?? false;
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
    try {
      localStorage.setItem('trokky_auth_token', token);
    } catch (error) {
      console.warn('Failed to save auth token:', error);
    }
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.authToken = null;
    try {
      localStorage.removeItem('trokky_auth_token');
    } catch (error) {
      console.warn('Failed to clear auth token:', error);
    }
  }

  /**
   * Restore auth token from storage
   */
  restoreAuthToken(): void {
    try {
      const token = localStorage.getItem('trokky_auth_token');
      if (token) {
        this.authToken = token;
        this.logger.info('Auth token restored from localStorage');
      }
    } catch (error) {
      console.warn('Failed to restore auth token:', error);
    }
  }

  /**
   * Make an HTTP request with automatic error handling
   */
  async request<T>(
    endpoint: string, 
    options: RequestInit = {},
    skipAuth = false
  ): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    // Only set Content-Type if not FormData (browser will set it automatically for FormData)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Add auth token if available and not skipped
    if (this.authToken && !skipAuth) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include'
      });

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        if (!response.ok) {
          throw new ApiClientError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status
          );
        }
        return { success: true, data: null as T };
      }

      const data = await response.json();

      if (!response.ok) {
        // Handle 401 Unauthorized - try to refresh token automatically
        if (response.status === 401 && this.authToken && !skipAuth && !endpoint.includes('/auth/validate')) {
          try {
            // Try to validate stored token to potentially refresh it
            const storedToken = localStorage.getItem('trokky_auth_token');
            if (storedToken) {
              const validateResponse = await this.post('/api/auth/validate', { token: storedToken });
              if (validateResponse.success && 
                  validateResponse.data && 
                  typeof validateResponse.data === 'object' && 
                  'valid' in validateResponse.data && 
                  validateResponse.data.valid && 
                  'session' in validateResponse.data && 
                  validateResponse.data.session) {
                // Token is still valid, retry the original request
                this.setAuthToken(storedToken);
                return this.request(endpoint, options, skipAuth);
              }
            }
          } catch (refreshError) {
            // Token refresh failed, proceed with clearing auth
          }
          
          // Clear invalid token
          this.clearAuthToken();
          localStorage.removeItem('trokky_auth_token');
        }
        
        throw new ApiClientError(
          data.error?.message || `HTTP ${response.status}`,
          response.status,
          data.error?.code,
          data.error?.details
        );
      }

      return {
        success: true,
        data: data.data || data,
        meta: data.meta
      };
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      
      throw new ApiClientError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * GET request helper
   */
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    // Remove leading slash to ensure proper URL joining with baseUrl
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const url = new URL(cleanEndpoint, this.baseUrl.endsWith('/') ? this.baseUrl : this.baseUrl + '/');
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    return this.request<T>(url.toString(), { method: 'GET' });
  }

  /**
   * POST request helper
   */
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    // Remove leading slash to ensure proper URL joining with baseUrl
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const fullEndpoint = this.baseUrl.endsWith('/') ? this.baseUrl + cleanEndpoint : this.baseUrl + '/' + cleanEndpoint;
    return this.request<T>(fullEndpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * PUT request helper
   */
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    // Remove leading slash to ensure proper URL joining with baseUrl
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const fullEndpoint = this.baseUrl.endsWith('/') ? this.baseUrl + cleanEndpoint : this.baseUrl + '/' + cleanEndpoint;
    return this.request<T>(fullEndpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * DELETE request helper
   */
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    // Remove leading slash to ensure proper URL joining with baseUrl
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const fullEndpoint = this.baseUrl.endsWith('/') ? this.baseUrl + cleanEndpoint : this.baseUrl + '/' + cleanEndpoint;
    return this.request<T>(fullEndpoint, { method: 'DELETE' });
  }

  // ========================================
  // Schema & Document Methods
  // ========================================

  /**
   * Get all schemas
   */
  async getSchemas(): Promise<ApiResponse<Schema[]>> {
    const response = await this.get<{ collections: Schema[] }>('/api/collections');
    if (response.success && response.data?.collections) {
      return {
        success: true,
        data: response.data.collections,
        meta: response.meta
      };
    }
    return { success: false, data: [] } as ApiResponse<Schema[]>;
  }

  /**
   * Get schema by name
   */
  async getSchema(name: string): Promise<ApiResponse<Schema>> {
    return this.get<Schema>(`/api/schemas/${name}`);
  }

  /**
   * Get documents for a schema
   */
  async getDocuments(schemaName: string, options: QueryOptions = {}): Promise<ApiResponse<{ documents: Document[]; total: number }>> {
    return this.get<{ documents: Document[]; total: number }>(`/api/collections/${schemaName}`, options);
  }

  /**
   * Get single document
   */
  async getDocument(schemaName: string, id: string): Promise<ApiResponse<Document>> {
    return this.get<Document>(`/api/collections/${schemaName}/${id}`);
  }

  /**
   * Create document
   */
  async createDocument(schemaName: string, data: Partial<Document>): Promise<ApiResponse<Document>> {
    return this.post<Document>(`/api/collections/${schemaName}`, { data });
  }

  /**
   * Update document
   */
  async updateDocument(schemaName: string, id: string, data: Partial<Document>): Promise<ApiResponse<Document>> {
    return this.put<Document>(`/api/collections/${schemaName}/${id}`, { data });
  }

  /**
   * Delete document
   */
  async deleteDocument(schemaName: string, id: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`/api/collections/${schemaName}/${id}`);
  }

  // ========================================
  // Media Methods (if available)
  // ========================================

  /**
   * Get media files
   */
  async getMedia(options: QueryOptions = {}): Promise<ApiResponse<MediaFile[]>> {
    if (!this.hasFeature('media')) {
      throw new ApiClientError('Media feature not available');
    }
    return this.get<MediaFile[]>('/api/media', options);
  }

  /**
   * Get single media file by ID
   */
  async getMediaFile(id: string): Promise<ApiResponse<{ file: MediaFile }>> {
    if (!this.hasFeature('media')) {
      throw new ApiClientError('Media feature not available');
    }
    return this.get<{ file: MediaFile }>(`/api/media/${id}`);
  }

  /**
   * Get single media file by ID (alias for compatibility with MediaField)
   */
  async getMediaById(id: string): Promise<ApiResponse<{ file: MediaFile }>> {
    return this.getMediaFile(id);
  }

  /**
   * Upload media file
   */
  async uploadMedia(file: File, options?: any, metadata?: Record<string, any>): Promise<ApiResponse<MediaFile>> {
    if (!this.hasFeature('media')) {
      throw new ApiClientError('Media feature not available');
    }

    // Handle different call patterns for compatibility
    let finalMetadata = metadata;
    if (options && typeof options === 'object' && !metadata) {
      finalMetadata = options;
    }

    const formData = new FormData();
    formData.append('files', file);
    if (finalMetadata) {
      formData.append('metadata', JSON.stringify(finalMetadata));
    }

    return this.request<MediaFile>('/api/media/upload', {
      method: 'POST',
      body: formData
    });
  }

  /**
   * Update media metadata
   */
  async updateMedia(id: string, metadata: Record<string, any>): Promise<ApiResponse<{ file: MediaFile }>> {
    if (!this.hasFeature('media')) {
      throw new ApiClientError('Media feature not available');
    }
    return this.put<{ file: MediaFile }>(`/api/media/${id}`, { metadata });
  }

  /**
   * Delete media file
   */
  async deleteMedia(id: string): Promise<ApiResponse<void>> {
    if (!this.hasFeature('media')) {
      throw new ApiClientError('Media feature not available');
    }
    return this.delete<void>(`/api/media/${id}`);
  }

  /**
   * Regenerate variants for media file
   */
  async regenerateMediaVariants(id: string): Promise<ApiResponse<{ message: string; file: MediaFile }>> {
    if (!this.hasFeature('media')) {
      throw new ApiClientError('Media feature not available');
    }
    return this.post<{ message: string; file: MediaFile }>(`/api/media/${id}/regenerate-variants`, {});
  }

  // ========================================
  // Document List Methods (Studio-compatible endpoints)
  // ========================================

  /**
   * List documents using Studio-compatible endpoint
   */
  async listDocuments(schemaName: string, options: {
    page?: number;
    limit?: number;
    search?: string;
    filter?: Record<string, any>;
    sort?: string;
  } = {}): Promise<ApiResponse<{
    documents: Document[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>> {
    const queryParams = new URLSearchParams();
    
    if (options.page) queryParams.set('page', String(options.page));
    if (options.limit) queryParams.set('limit', String(options.limit));
    if (options.search) queryParams.set('search', options.search);
    if (options.sort) queryParams.set('sort', options.sort);
    
    // Add filters
    if (options.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.set(`filter[${key}]`, String(value));
        }
      });
    }
    
    const url = `${this.baseUrl}/api/documents/${schemaName}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return this.get<{
      documents: Document[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(url);
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(schemaName: string): Promise<ApiResponse<{
    stats: {
      collection: string;
      totalDocuments: number;
      publishedDocuments: number;
      draftDocuments: number;
      recentDocuments: number;
      lastUpdated: string;
    };
  }>> {
    const url = `${this.baseUrl}/api/stats/${schemaName}`;
    return this.get<{
      stats: {
        collection: string;
        totalDocuments: number;
        publishedDocuments: number;
        draftDocuments: number;
        recentDocuments: number;
        lastUpdated: string;
      };
    }>(url);
  }

  // ========================================
  // Search Methods (if available)
  // ========================================

  /**
   * Global search
   */
  async search(query: string, options: { types?: string[]; limit?: number } = {}): Promise<ApiResponse<SearchResponse>> {
    if (!this.hasFeature('search')) {
      // Fallback to client-side search
      return this.clientSideSearch(query, options);
    }
    
    return this.get<SearchResponse>('/search', { q: query, ...options });
  }

  /**
   * Client-side search fallback
   */
  private async clientSideSearch(query: string, options: { types?: string[]; limit?: number } = {}): Promise<ApiResponse<SearchResponse>> {
    // Basic client-side search implementation
    const results: any[] = [];
    
    // Search documents if enabled
    if (!options.types || options.types.includes('documents')) {
      try {
        const schemas = await this.getSchemas();
        if (schemas.success && schemas.data) {
          for (const schema of schemas.data.slice(0, 3)) {
            const docs = await this.getDocuments(schema.name, { limit: 5, search: query });
            if (docs.success && docs.data?.documents) {
              results.push(...docs.data.documents.map((doc: any) => ({
                id: doc.id || doc._id,
                type: 'document',
                title: doc.title || doc.name || doc.id || doc._id,
                url: `/content/${schema.name}/${doc.id || doc._id}`,
                metadata: {
                  status: doc._status,
                  createdAt: doc._createdAt
                }
              })));
            }
          }
        }
      } catch (error) {
        console.warn('Document search failed:', error);
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
          schemas: 0
        },
        query,
        searchTime: 0
      }
    };
  }

  // ========================================
  // Auth Methods (if available)
  // ========================================

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    if (!this.hasFeature('auth')) {
      throw new ApiClientError('Auth feature not available');
    }
    return this.get<User>('/api/auth/me');
  }

  /**
   * Login
   */
  async login(username: string, password: string): Promise<ApiResponse<{ user: User; token: string; expiresAt?: string }>> {
    if (!this.hasFeature('auth')) {
      throw new ApiClientError('Auth feature not available');
    }
    
    const response = await this.post<{ user: User; token: string; expiresAt?: string }>('/api/auth/login', { username, password });
    
    if (response.success && response.data?.token) {
      this.setAuthToken(response.data.token);
    }
    
    return response;
  }

  /**
   * Logout
   */
  async logout(): Promise<ApiResponse<void>> {
    if (this.hasFeature('auth')) {
      try {
        await this.post('/api/auth/logout');
      } catch (error) {
        // Continue with local logout even if server logout fails
        console.warn('Server logout failed:', error);
      }
    }
    
    this.clearAuthToken();
    return { success: true };
  }

  // ========================================
  // Structure Methods (if available)
  // ========================================

  /**
   * Get structure configuration
   */
  async getStructure(): Promise<ApiResponse<any>> {
    if (!this.hasFeature('structure')) {
      return { success: true, data: null };
    }
    return this.get('/api/structure');
  }
}

// Singleton instance
export const apiClient = new ApiClient();