/**
 * Search Service - Global search functionality for Studio
 */

import { createStudioLogger } from '@/utils/logger';
import type { ApiClient } from './api-client';

const logger = createStudioLogger('search-service');

export interface SearchResult {
  id: string;
  type: 'document' | 'media' | 'user' | 'schema';
  title: string;
  excerpt?: string;
  url?: string;
  metadata?: {
    author?: string;
    createdAt?: string;
    updatedAt?: string;
    size?: string;
    status?: string;
    schemaType?: string;
  };
  highlights?: {
    title?: string[];
    content?: string[];
  };
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  categories: {
    documents: number;
    media: number;
    users: number;
    schemas: number;
  };
  query: string;
  searchTime: number;
}

export interface SearchOptions {
  types?: string[];
  limit?: number;
  offset?: number;
  filters?: Record<string, any>;
}

export class SearchService {
  private cache = new Map<string, { data: SearchResponse; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly RECENT_SEARCHES_KEY = 'trokky_recent_searches';
  private readonly MAX_RECENT_SEARCHES = 10;

  constructor(private client: ApiClient) {}

  async search(query: string, options: SearchOptions = {}): Promise<SearchResponse> {
    if (!query || query.trim().length < 2) {
      return this.getEmptyResponse(query);
    }

    // Check cache first
    const cacheKey = this.getCacheKey(query, options);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.debug('Search cache hit', { query, cacheKey });
      return cached.data;
    }

    try {
      const startTime = Date.now();
      logger.debug('Starting search', { query, options });

      // Search across different content types
      // @TODO: Add schema search back when schema editor is implemented in Studio
      const [documents, media, users] = await Promise.allSettled([
        this.searchDocuments(query),
        this.searchMedia(query),
        this.searchUsers(),
        // this.searchSchemas(query, options), // Disabled until schema editor is available
      ]);

      const results: SearchResult[] = [];
      const categories = { documents: 0, media: 0, users: 0, schemas: 0 };

      // Process documents
      if (documents.status === 'fulfilled') {
        const docResults = documents.value;
        results.push(...docResults);
        categories.documents = docResults.length;
      } else {
        logger.warn('Document search failed', documents.reason);
      }

      // Process media
      if (media.status === 'fulfilled') {
        const mediaResults = media.value;
        results.push(...mediaResults);
        categories.media = mediaResults.length;
      } else {
        logger.warn('Media search failed', media.reason);
      }

      // Process users
      if (users.status === 'fulfilled') {
        const userResults = users.value;
        results.push(...userResults);
        categories.users = userResults.length;
      } else {
        logger.warn('User search failed', users.reason);
      }

      // Process schemas - disabled until schema editor is available
      // @TODO: Uncomment when schema editor is implemented
      // if (schemas.status === 'fulfilled') {
      //   const schemaResults = schemas.value;
      //   results.push(...schemaResults);
      //   categories.schemas = schemaResults.length;
      // } else {
      //   logger.warn('Schema search failed', schemas.reason);
      // }

      const searchTime = Date.now() - startTime;
      const response: SearchResponse = {
        results: results.slice(0, options.limit || 50),
        totalCount: results.length,
        categories,
        query,
        searchTime,
      };

      // Cache the response
      this.cache.set(cacheKey, { data: response, timestamp: Date.now() });
      
      logger.info('Search completed', { 
        query, 
        totalResults: response.totalCount, 
        searchTime: response.searchTime 
      });

      return response;
    } catch (error) {
      logger.error('Search failed', error);
      return this.getEmptyResponse(query);
    }
  }

  async searchDocuments(query: string): Promise<SearchResult[]> {
    try {
      // Get all schemas to search across them
      const schemasResponse = await this.client.getSchemas();
      if (!schemasResponse.success || !schemasResponse.data) {
        return [];
      }

      const schemas = schemasResponse.data;
      const results: SearchResult[] = [];

      // Search each schema's documents
      for (const schema of schemas) {
        try {
          // Since backend doesn't support search, fetch all documents and filter client-side
          const response = await this.client.getDocuments(schema.name, {
            limit: 100, // Get more documents to search through
          });

          if (response.success && response.data?.documents) {
            const documents = response.data.documents;
            const queryLower = query.toLowerCase();
            
            // Filter documents that match the search query
            const filteredDocs = documents.filter((doc: any) => {
              // Search in common text fields
              const searchableFields = [
                doc.title,
                doc.name,
                doc.slug,
                doc.description,
                doc.content,
                doc.body,
                doc.excerpt,
                doc.summary,
              ];
              
              // Check if any field contains the query
              return searchableFields.some(field => 
                field && typeof field === 'string' && 
                field.toLowerCase().includes(queryLower)
              );
            });

            // Add filtered results - deduplicate by title and schema
            const addedDocs = new Set<string>();
            for (const doc of filteredDocs.slice(0, 10)) { // Limit to 10 per schema
              const docTitle = doc.title || doc.name || doc.slug || `${schema.title || schema.name} Document`;
              const dedupeKey = `${schema.name}:${docTitle}`;
              
              // Skip if we already have a document with same title in same schema
              if (addedDocs.has(dedupeKey)) {
                continue;
              }
              addedDocs.add(dedupeKey);
              
              results.push({
                id: doc.id || doc._id,
                type: 'document',
                title: docTitle,
                excerpt: this.extractExcerpt(doc, query),
                url: `/content/${schema.name}/${doc.id || doc._id}`,
                metadata: {
                  schemaType: schema.name,
                  author: typeof doc.author === 'object' && doc.author?._ref 
                    ? (doc.author._cached?.name || doc.author._cached?.title || 'Reference') 
                    : (doc.author || doc._createdBy),
                  createdAt: doc._createdAt || doc.createdAt,
                  updatedAt: doc._updatedAt || doc.updatedAt,
                  status: doc._state || doc.status,
                },
                highlights: this.generateHighlights(doc, query),
              });
            }
          }
        } catch (error) {
          logger.warn(`Failed to search schema ${schema.name}`, error);
        }
      }

      return results;
    } catch (error) {
      logger.error('Document search failed', error);
      return [];
    }
  }

  async searchMedia(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const response = await this.client.get('/api/media', {
        limit: 100, // Get more files to search through
      });

      if (!response.success || !response.data) {
        return [];
      }

      const queryLower = query.toLowerCase();
      
      // Filter media files that match the search query
      const filteredFiles = (response.data as any[]).filter((file: any) => {
        const searchableFields = [
          file.filename,
          file.title,
          file.description,
          file.alt,
        ];
        
        return searchableFields.some(field =>
          field && typeof field === 'string' &&
          field.toLowerCase().includes(queryLower)
        );
      });

      return filteredFiles.slice(0, options.limit || 10).map((file: any) => ({
        id: file.id || file.filename,
        type: 'media' as const,
        title: file.title || file.filename || 'Untitled Media',
        excerpt: file.description || file.alt,
        url: `/media?file=${file.id || file.filename}`,
        metadata: {
          size: this.formatFileSize(file.size),
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        },
      }));
    } catch (error) {
      logger.error('Media search failed', error);
      return [];
    }
  }

  async searchUsers(): Promise<SearchResult[]> {
    // Users API not yet implemented
    return [];
  }

  async searchSchemas(query: string): Promise<SearchResult[]> {
    try {
      const response = await this.client.getSchemas();
      if (!response.success || !response.data) {
        return [];
      }

      const schemas = response.data;
      const filteredSchemas = schemas.filter((schema: any) => 
        schema.name.toLowerCase().includes(query.toLowerCase()) ||
        (schema.title && schema.title.toLowerCase().includes(query.toLowerCase())) ||
        (schema.description && schema.description.toLowerCase().includes(query.toLowerCase()))
      );

      return filteredSchemas.map((schema: any) => ({
        id: schema.name,
        type: 'schema' as const,
        title: schema.title || schema.name,
        excerpt: schema.description,
        url: `/content/${schema.name}`,
        metadata: {
          status: schema.singleton ? 'Singleton' : 'Collection',
        },
      }));
    } catch (error) {
      logger.error('Schema search failed', error);
      return [];
    }
  }

  async getSuggestions(query: string): Promise<string[]> {
    if (query.length < 2) return [];

    try {
      // For now, return recent searches that match the query
      const recentSearches = this.getRecentSearches();
      return recentSearches
        .filter(search => search.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 5);
    } catch (error) {
      logger.error('Failed to get suggestions', error);
      return [];
    }
  }

  saveRecentSearch(query: string): void {
    if (query.length < 2) return;

    try {
      const recentSearches = this.getRecentSearches();
      const updated = [query, ...recentSearches.filter(q => q !== query)].slice(0, this.MAX_RECENT_SEARCHES);
      
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.RECENT_SEARCHES_KEY, JSON.stringify(updated));
      }
      
      logger.debug('Saved recent search', { query });
    } catch (error) {
      logger.warn('Failed to save recent search', error);
    }
  }

  getRecentSearches(): string[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      
      const stored = localStorage.getItem(this.RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      logger.warn('Failed to load recent searches', error);
      return [];
    }
  }

  clearCache(): void {
    this.cache.clear();
    logger.debug('Search cache cleared');
  }

  private getCacheKey(query: string, options: SearchOptions): string {
    return `${query}:${JSON.stringify(options)}`;
  }

  private getEmptyResponse(query: string): SearchResponse {
    return {
      results: [],
      totalCount: 0,
      categories: { documents: 0, media: 0, users: 0, schemas: 0 },
      query,
      searchTime: 0,
    };
  }

  private extractExcerpt(doc: any, query: string): string {
    // Try to find content that includes the search query
    const searchableFields = ['content', 'body', 'description', 'excerpt', 'summary'];
    
    for (const field of searchableFields) {
      if (doc[field] && typeof doc[field] === 'string') {
        const content = doc[field];
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        
        const index = lowerContent.indexOf(lowerQuery);
        if (index !== -1) {
          // Extract 150 characters around the match
          const start = Math.max(0, index - 75);
          const end = Math.min(content.length, index + 75);
          return content.substring(start, end).trim();
        }
      }
    }

    // Fallback to first searchable field
    for (const field of searchableFields) {
      if (doc[field] && typeof doc[field] === 'string') {
        return doc[field].substring(0, 150).trim();
      }
    }

    return '';
  }

  private generateHighlights(doc: any, query: string): SearchResult['highlights'] {
    const highlights: SearchResult['highlights'] = {};
    
    // Highlight title if it matches
    const title = doc.title || doc.name || doc.slug || '';
    if (title.toLowerCase().includes(query.toLowerCase())) {
      const regex = new RegExp(`(${query})`, 'gi');
      highlights.title = [title.replace(regex, '<mark>$1</mark>')];
    }

    // Highlight content if it matches
    const content = doc.content || doc.body || doc.description || '';
    if (typeof content === 'string' && content.toLowerCase().includes(query.toLowerCase())) {
      const regex = new RegExp(`(${query})`, 'gi');
      highlights.content = [content.replace(regex, '<mark>$1</mark>')];
    }

    return Object.keys(highlights).length > 0 ? highlights : undefined;
  }

  private formatFileSize(bytes: number): string {
    if (!bytes) return '';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

// Export singleton instance factory
export function createSearchService(client: ApiClient): SearchService {
  return new SearchService(client);
}