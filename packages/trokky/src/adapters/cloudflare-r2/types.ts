import type { R2Bucket } from '@cloudflare/workers-types'

/**
 * Configuration for the Cloudflare R2 media adapter.
 */
export interface CloudflareR2AdapterConfig {
  /** The R2 bucket binding from the Worker environment. */
  bucket: R2Bucket

  /**
   * Key prefix, so one bucket can host several installs. Normalised to end with `/`.
   * Everything the adapter writes lives under it, and listings never look outside it.
   */
  prefix?: string

  /**
   * Base URL of a public bucket or a custom domain in front of it. When set, `getFileUrl`
   * and `getVariantUrl` return direct URLs; when not, they return null and the caller
   * serves bytes through Trokky's own media routes.
   *
   * R2 bucket bindings cannot presign, so `expiresIn` is not honoured either way.
   */
  publicBaseUrl?: string

  /** Reject uploads larger than this. Defaults to 100MB, matching the filesystem adapter. */
  maxFileSize?: number

  /** Suppress the adapter's own informational logging. */
  silent?: boolean
}

/**
 * The stored form of a media record: one JSON object per file, alongside the bytes.
 *
 * The free-form fields a caller writes through `updateFile` (title, alt, tags,
 * imageVariants, …) are held under `custom` rather than spread at the top level, so a
 * caller can never shadow `id`, `size` or `createdAt` by choosing a colliding key.
 */
export interface R2MediaRecord {
  id: string
  filename: string
  contentType: string
  size: number
  extension: string
  createdAt: string
  updatedAt: string
  custom: Record<string, unknown>
}
