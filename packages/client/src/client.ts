/**
 * Main Trokky Client
 * High-level client that orchestrates all SDK functionality
 */

import { HttpClient } from './http/client.js'
import { CacheManager } from './cache/manager.js'
import { DocumentClient } from './document/client.js'
import { MediaHelper } from './media/helper.js'
import { ShortcodeResolver } from './shortcodes/resolver.js'

import type { 
  ClientConfig, 
  AuthConfig, 
  AuthTokens,
  QueryOptions,
  DocumentResult,
  CollectionResult,
  MediaResult,
  BaseDocument
} from './types/index.js'

export class TrokkyClient {
  public readonly http: HttpClient
  public readonly cache: CacheManager
  public readonly documents: DocumentClient
  public readonly media: MediaHelper
  public readonly shortcodes: ShortcodeResolver

  constructor(config: ClientConfig) {
    // Initialize core components
    this.http = new HttpClient(config)
    this.cache = new CacheManager(config.cacheMaxAge)
    this.documents = new DocumentClient(this.http, this.cache)
    this.media = new MediaHelper(this.http)
    this.shortcodes = new ShortcodeResolver(this.http, this.media)
  }

  // Authentication methods (delegate to http client)
  
  /**
   * Authenticate with username and password
   */
  async authenticate(credentials: AuthConfig): Promise<AuthTokens> {
    return this.http.authenticate(credentials)
  }

  /**
   * Refresh authentication token
   */
  async refreshAuth(): Promise<AuthTokens> {
    return this.http.refreshAuth()
  }

  /**
   * Logout and clear tokens
   */
  async logout(): Promise<void> {
    await this.http.logout()
    this.cache.clear() // Clear cache on logout
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return this.http.isAuthenticated()
  }

  /**
   * Get current authentication tokens
   */
  getTokens(): AuthTokens | null {
    return this.http.getTokens()
  }

  /**
   * Set authentication tokens
   */
  setTokens(tokens: AuthTokens): void {
    this.http.setTokens(tokens)
  }

  /**
   * Set API token for authentication (alternative to JWT)
   */
  setApiToken(token: string): void {
    this.http.setApiToken(token)
  }

  /**
   * Get current API token
   */
  getApiToken(): string | null {
    return this.http.getApiToken()
  }

  /**
   * Clear API token
   */
  clearApiToken(): void {
    this.http.clearApiToken()
  }

  // Document methods (delegate to document client)

  /**
   * Get document by ID
   */
  async getDocument<T extends BaseDocument>(
    type: string, 
    id: string, 
    useCache = true
  ): Promise<DocumentResult<T>> {
    return this.documents.getById<T>(type, id, useCache)
  }

  /**
   * Query documents
   */
  async queryDocuments<T extends BaseDocument>(
    type: string, 
    options: QueryOptions = {},
    useCache = true
  ): Promise<CollectionResult<T>> {
    return this.documents.query<T>(type, options, useCache)
  }

  /**
   * Create new document
   */
  async createDocument<T extends BaseDocument>(
    type: string, 
    data: Omit<T, '_id' | '_type' | '_createdAt' | '_updatedAt' | '_version'>
  ): Promise<DocumentResult<T>> {
    return this.documents.create<T>(type, data)
  }

  /**
   * Update document
   */
  async updateDocument<T extends BaseDocument>(
    type: string, 
    id: string, 
    data: Partial<Omit<T, '_id' | '_type' | '_createdAt' | '_updatedAt' | '_version'>>
  ): Promise<DocumentResult<T>> {
    return this.documents.update<T>(type, id, data)
  }

  /**
   * Replace document
   */
  async replaceDocument<T extends BaseDocument>(
    type: string, 
    id: string, 
    data: Omit<T, '_id' | '_type' | '_createdAt' | '_updatedAt' | '_version'>
  ): Promise<DocumentResult<T>> {
    return this.documents.replace<T>(type, id, data)
  }

  /**
   * Delete document
   */
  async deleteDocument(type: string, id: string): Promise<void> {
    return this.documents.delete(type, id)
  }

  /**
   * Search documents
   */
  async searchDocuments<T extends BaseDocument>(
    type: string, 
    searchTerm: string,
    fields?: string[],
    options: Omit<QueryOptions, 'filter'> = {}
  ): Promise<CollectionResult<T>> {
    return this.documents.search<T>(type, searchTerm, fields, options)
  }

  /**
   * Count documents
   */
  async countDocuments(type: string, filter?: Record<string, any>): Promise<number> {
    return this.documents.count(type, filter)
  }

  /**
   * Check if document exists
   */
  async documentExists(type: string, id: string): Promise<boolean> {
    return this.documents.exists(type, id)
  }

  // Media methods (delegate to http client)

  /**
   * Upload file
   */
  async uploadFile(file: File | Buffer, filename?: string): Promise<MediaResult> {
    return this.http.upload(file, filename)
  }

  /**
   * Get media by ID
   */
  async getMedia(id: string): Promise<MediaResult> {
    return this.http.get<MediaResult>(`/media/${id}`)
  }

  /**
   * Delete media
   */
  async deleteMedia(id: string): Promise<void> {
    return this.http.delete(`/media/${id}`)
  }

  // API Token Management methods

  /**
   * List API tokens
   */
  async listApiTokens(): Promise<any> {
    return this.http.listApiTokens()
  }

  /**
   * Create API token
   */
  async createApiToken(data: any): Promise<any> {
    return this.http.createApiToken(data)
  }

  /**
   * Get API token by ID
   */
  async getApiTokenById(id: string): Promise<any> {
    return this.http.getApiTokenById(id)
  }

  /**
   * Update API token
   */
  async updateApiToken(id: string, data: any): Promise<any> {
    return this.http.updateApiToken(id, data)
  }

  /**
   * Delete API token
   */
  async deleteApiToken(id: string): Promise<void> {
    return this.http.deleteApiToken(id)
  }

  // Content methods with shortcode support

  /**
   * Resolve shortcodes in content to HTML
   * Converts environment-agnostic shortcodes to actual HTML for display
   */
  resolveContent(content: string): string {
    return this.shortcodes.resolveContent(content)
  }

  /**
   * Check if content contains shortcodes
   */
  hasShortcodes(content: string): boolean {
    return this.shortcodes.hasShortcodes(content)
  }

  /**
   * Extract media dependencies from content
   * Useful for preloading or understanding content requirements
   */
  extractContentMedia(content: string) {
    return this.shortcodes.extractImageShortcodes(content)
  }

  /**
   * Preload all media in content for faster rendering
   */
  async preloadContentMedia(content: string): Promise<void> {
    return this.shortcodes.preloadContentMedia(content)
  }

  // Utility methods

  /**
   * Test API connection
   */
  async ping(): Promise<{ status: string; timestamp: string }> {
    return this.http.get('/ping')
  }

  /**
   * Get API health status
   */
  async health(): Promise<{ status: string; services: Record<string, string> }> {
    return this.http.get('/health')
  }

  /**
   * Clear client cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number } {
    return {
      size: this.cache.size()
    }
  }

  /**
   * Destroy client and cleanup resources
   */
  destroy(): void {
    this.cache.destroy()
  }
}