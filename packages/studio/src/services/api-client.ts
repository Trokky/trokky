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
   * Initialize the API client with integrated configuration only
   */
  initialize(): void {
    // Check for integrated mode configuration (required)
    if (!(window as any).TROKKY_INTEGRATED_CONFIG) {
      throw new Error('Studio can only run in integrated mode. TROKKY_INTEGRATED_CONFIG not found.');
    }

    const integratedConfig = (window as any).TROKKY_INTEGRATED_CONFIG;
    this.baseUrl = window.location.origin + (integratedConfig.basePath || '/studio');
    
    this.capabilities = {
      version: '2.0.0',
      mode: 'integrated',
      features: {
        search: false,
        media: true, // Enable media features for integrated mode
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
    
    this.logger.info('Studio initialized in integrated mode', { 
      baseUrl: this.baseUrl,
      mode: 'integrated',
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
              const validateResponse = await this.post('/api/auth/validate', { token: storedToken }, true);
              if (validateResponse.success && validateResponse.data?.valid && validateResponse.data?.session) {
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
   * Upload media file
   */
  async uploadMedia(file: File, metadata?: Record<string, any>): Promise<ApiResponse<MediaFile>> {
    if (!this.hasFeature('media')) {
      throw new ApiClientError('Media feature not available');
    }

    const formData = new FormData();
    formData.append('file', file);
    if (metadata) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    return this.request<MediaFile>('/api/media', {
      method: 'POST',
      body: formData
    });
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
    return this.get('/structure');
  }
}

// Singleton instance
export const apiClient = new ApiClient();