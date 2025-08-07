/**
 * Type definitions for Cloudflare R2 Media Storage Adapter
 */

import type { R2Bucket } from '@cloudflare/workers-types'

export interface CloudflareR2AdapterConfig {
  /** R2 bucket binding from Cloudflare Workers environment */
  bucket?: R2Bucket
  
  /** Bucket name (for direct configuration) */
  bucketName?: string
  
  /** Key prefix for organizing files (e.g., 'media/', 'uploads/') */
  keyPrefix?: string
  
  /** Enable debug logging */
  debug?: boolean
  
  /** Default cache control header for uploaded files */
  cacheControl?: string
  
  /** Custom metadata to add to all uploads */
  defaultMetadata?: Record<string, string>
  
  /** Enable automatic content type detection */
  autoContentType?: boolean
  
  /** Maximum file size allowed (in bytes) */
  maxFileSize?: number
  
  /** Allow public URLs for files (less secure but faster) */
  allowPublicUrls?: boolean
  
  /** Custom domain for public URLs */
  customDomain?: string
  
  /** Default expiration time for presigned URLs in seconds */
  defaultUrlExpiry?: number
  
  /** Maximum allowed expiration time for presigned URLs in seconds */
  maxUrlExpiry?: number
  
  /** Cloudflare account ID (required for presigned URLs) */
  accountId?: string
  
  /** R2 access key ID (required for presigned URLs) */
  accessKeyId?: string
  
  /** R2 secret access key (required for presigned URLs) */
  secretAccessKey?: string
  
  /** Content Security Policy configuration for served files */
  cspConfig?: {
    /** Enable CSP headers for served content */
    enabled?: boolean
    
    /** Default CSP directive for unknown file types */
    defaultPolicy?: string
    
    /** Per-content-type CSP policies */
    policies?: Record<string, string>
    
    /** Additional CSP directives to always include */
    additionalDirectives?: string[]
    
    /** Report CSP violations to this endpoint */
    reportUri?: string
  }
}

export interface R2UploadOptions {
  /** Content type override */
  contentType?: string
  
  /** Custom metadata for this file */
  metadata?: Record<string, string>
  
  /** Cache control header */
  cacheControl?: string
  
  /** Content encoding */
  contentEncoding?: string
  
  /** Content language */
  contentLanguage?: string
}

export interface R2FileMetadata {
  /** File key in R2 */
  key: string
  
  /** File size in bytes */
  size: number
  
  /** Content type */
  contentType?: string
  
  /** Last modified timestamp */
  lastModified?: Date
  
  /** ETag for caching */
  etag?: string
  
  /** Custom metadata */
  customMetadata?: Record<string, string>
  
  /** Cache control settings */
  cacheControl?: string
}