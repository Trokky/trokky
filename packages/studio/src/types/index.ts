// Global Studio Types

export interface StudioConfig {
  backend: {
    url: string;
    apiVersion: string;
    features: BackendFeature[];
  };
  branding?: {
    title: string;
    logo?: string;
    theme?: ThemeConfig;
  };
  features?: {
    search: boolean;
    media: boolean;
    users: boolean;
    workflows: boolean;
  };
  defaults?: {
    pageSize: number;
    dateFormat: string;
    timeZone: string;
  };
}

export interface BackendCapabilities {
  version: string;
  features: {
    search: boolean;
    media: boolean;
    auth: boolean;
    structure: boolean;
    workflows: boolean;
  };
  endpoints: {
    documents: string;
    media?: string;
    auth?: string;
    structure?: string;
    users?: string;
    slugs?: string;
  };
  limits: {
    maxUploadSize: number;
    maxResults: number;
    requestRate: number;
  };
}

export type BackendFeature = 
  | 'documents'
  | 'media'
  | 'auth'
  | 'structure'
  | 'search'
  | 'users'
  | 'workflows';

export interface ThemeConfig {
  primary: string;
  background: string;
  mode: 'light' | 'dark' | 'system';
}

// Navigation Types
export interface NavigationItem {
  id: string;
  title: string;
  href: string;
  icon: string;
  description?: string;
  badge?: {
    text: string;
    variant: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  };
  children?: NavigationItem[];
  requiredPermission?: {
    resource: string;
    action: string;
  };
}

// Content Types
export interface Document {
  _id: string;
  _type: string;
  _createdAt: string;
  _updatedAt: string;
  _createdBy?: string;
  _status?: 'draft' | 'published' | 'archived';
  [key: string]: any;
}

export interface Schema {
  name: string;
  title?: string;
  description?: string;
  type: 'document' | 'singleton';
  singleton?: boolean;
  icon?: string;
  fields: SchemaField[];
  preview?: {
    select: Record<string, string>;
    prepare: (selection: any) => PreviewValue;
  };
}

// API response wrapper for schema endpoint
export interface SchemaApiResponse {
  schema: Schema;
}

export interface SchemaField {
  name: string;
  title?: string;
  type: string;
  description?: string;
  validation?: any;
  options?: any;
}

export interface PreviewValue {
  title?: string;
  subtitle?: string;
  media?: string;
}

// Media Types
export interface MediaFile {
  id: string;
  originalFilename: string;
  filename: string;
  mimeType: string;
  contentType: string; // Added for compatibility
  size: number;
  url: string;
  title?: string;
  alt?: string;
  description?: string;
  author?: string;
  credit?: string;
  metadata?: {
    dimensions?: { width: number; height: number };
    duration?: number;
    format?: string;
    path?: string;
    extension?: string;
    originalFilename?: string;
    title?: string;
    alt?: string;
    author?: string;
    credit?: string;
    imageVariants?: Record<string, {
      url: string;
      width: number;
      height: number;
      format: string;
      size: number;
    }>;
    originalDimensions?: {
      width: number;
      height: number;
    };
  };
  variants?: Record<string, { url: string; width: number; height: number }>;
  createdAt: string;
  updatedAt: string;
  uploadedAt: string; // Added for compatibility
  _createdAt: string; // Legacy field for compatibility - now required
}

// Search Types
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

// API Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
    hasMore?: boolean;
  };
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  search?: string;
  filter?: Record<string, any>;
  sort?: string;
  order?: 'asc' | 'desc';
}

// User Management Types
export type UserRole = 'admin' | 'editor' | 'author' | 'viewer';

export type Permission = 
  // Content permissions
  | 'content:read'
  | 'content:write'
  | 'content:delete'
  | 'content:publish'
  // Media permissions
  | 'media:read'
  | 'media:upload'
  | 'media:edit'
  | 'media:delete'
  // User management permissions
  | 'users:read'
  | 'users:write'
  | 'users:delete'
  | 'users:invite'
  // Settings permissions
  | 'settings:read'
  | 'settings:write'
  // Studio access
  | 'studio:access'
  // App token management
  | 'tokens:read'
  | 'tokens:write'
  | 'tokens:delete'
  // Webhook management
  | 'webhooks:read'
  | 'webhooks:write'
  | 'webhooks:delete'
  | 'webhooks:test';

// Default permissions for each role
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'content:*', // 🆕 Full content access to all schemas
    'media:read', 'media:upload', 'media:edit', 'media:delete',
    'users:read', 'users:write', 'users:delete', 'users:invite',
    'settings:read', 'settings:write',
    'studio:access',
    'tokens:read', 'tokens:write', 'tokens:delete',
    'webhooks:read', 'webhooks:write', 'webhooks:delete', 'webhooks:test'
  ],
  editor: [
    'content:*', // 🆕 Full content access to all schemas  
    'media:read', 'media:upload', 'media:edit', 'media:delete',
    'studio:access',
    'webhooks:read', 'webhooks:test'
  ],
  author: [
    'content:read', 'content:write', 'content:publish', // Can access all content but not delete
    'media:read', 'media:upload',
    'studio:access'
  ],
  viewer: [
    'content:read', // 🆕 Can view all content across all schemas
    'media:read',
    'studio:access'
  ]
};

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  profileImage?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppToken {
  id: string;
  name: string;
  description?: string;
  tokenHash: string;
  permissions: Permission[];
  createdBy: string;
  isActive: boolean;
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Auth Types
export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Error Types
export interface StudioError {
  message: string;
  code?: string;
  type: 'api' | 'validation' | 'permission' | 'network' | 'config';
  details?: any;
  timestamp: Date;
}

// Window types for global configuration
declare global {
  interface Window {
    TROKKY_CONFIG?: {
      backendUrl?: string;
      timeout?: number;
      branding?: {
        title?: string;
        logo?: string;
        theme?: 'light' | 'dark' | 'system';
      };
    };
    TROKKY_STUDIO_CONFIG?: Partial<StudioConfig>;
  }
}