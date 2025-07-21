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
  icon?: string;
  fields: SchemaField[];
  preview?: {
    select: Record<string, string>;
    prepare: (selection: any) => PreviewValue;
  };
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
  };
  variants?: Record<string, { url: string; width: number; height: number }>;
  createdAt: string;
  updatedAt: string;
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

// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  permissions: string[];
  isActive: boolean;
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
    TROKKY_CONFIG?: Partial<StudioConfig>;
    TROKKY_STUDIO_CONFIG?: Partial<StudioConfig>;
  }
}