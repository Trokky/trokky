import type { R2Bucket } from '@cloudflare/workers-types'

/**
 * The slice of an R2 object the adapter reads, declared structurally.
 *
 * Declared rather than imported, like `ImagesBindingLike`: `@cloudflare/workers-types` exports
 * classes (`Headers` among them) distinct from its own globals, so a Worker whose `env.MEDIA`
 * is typed from the globals (`types: ["@cloudflare/workers-types"]`, or `wrangler types`)
 * could not pass its binding to an adapter typed from the module exports. Any R2 binding
 * satisfies these shapes as-is.
 */
export interface R2ObjectLike {
  key: string
  size: number
  uploaded: Date
  customMetadata?: Record<string, string>
}

export interface R2ObjectBodyLike extends R2ObjectLike {
  arrayBuffer(): Promise<ArrayBuffer>
  text(): Promise<string>
}

/** The methods of an R2 bucket binding the adapter calls. `env.MEDIA` satisfies it as-is. */
export interface R2BucketLike {
  head(key: string): Promise<R2ObjectLike | null>
  get(key: string): Promise<R2ObjectBodyLike | null>
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> }
  ): Promise<unknown>
  delete(keys: string | string[]): Promise<void>
  list(options?: {
    prefix?: string
    limit?: number
    cursor?: string
    include?: ('httpMetadata' | 'customMetadata')[]
  }): Promise<{ objects: R2ObjectLike[]; truncated: boolean; cursor?: string }>
}

/**
 * Configuration for the Cloudflare R2 media adapter.
 */
export interface CloudflareR2AdapterConfig {
  /** The R2 bucket binding from the Worker environment. */
  bucket: R2BucketLike

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

/**
 * Compile-time guard: the real binding type must still satisfy `R2BucketLike`. Change a shape
 * above so that it no longer fits and the package build fails here, not in a user's Worker.
 * Only the module-export type is checkable here; the globals differ from it just in class
 * identity (`Headers`), which the structural shapes above never mention.
 */
type AssertAssignable<T extends R2BucketLike> = T
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- exists only to be checked
type R2BindingFitsAdapter = AssertAssignable<R2Bucket>
