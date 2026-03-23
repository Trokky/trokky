/**
 * Document Types
 * Shared types for document handling across all Trokky packages
 */

// Base document interface that all documents extend
export interface BaseDocument {
  _id?: string;
  _type: string;
  _createdAt?: string;
  _updatedAt?: string;
  _version?: number;
  [key: string]: any; // Allow dynamic field access
}

// Document result wrapper (from API responses)
export interface DocumentResult<T = any> {
  data: T;
  _id: string;
  _type: string;
  _createdAt: string;
  _updatedAt: string;
  _version: number;
}

// Collection result wrapper (from API responses)
export interface CollectionResult<T = any> {
  documents: DocumentResult<T>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  meta: {
    total: number;
  };
}

// Document with content (for full document responses)
export interface DocumentWithContent<T = any> extends BaseDocument {
  data: T;
}

// Query options for document queries
export interface QueryOptions {
  filter?: Record<string, any>;
  sort?: Record<string, 1 | -1 | 'asc' | 'desc'> | string;
  limit?: number;
  offset?: number;
  select?: string[];
}

// List options for document listing
export interface ListOptions {
  limit?: number;
  offset?: number;
  sort?: string;
  filter?: Record<string, any>;
}
