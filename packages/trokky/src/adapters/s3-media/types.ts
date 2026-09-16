/**
 * Configuration for the S3-compatible media adapter.
 */
export interface S3MediaAdapterConfig {
  /**
   * The service endpoint, with scheme and no bucket in it:
   * `https://<account-id>.r2.cloudflarestorage.com`, `https://s3.eu-west-1.amazonaws.com`,
   * `http://127.0.0.1:9000` for MinIO.
   */
  endpoint: string

  /** The bucket name. */
  bucket: string

  accessKeyId: string
  secretAccessKey: string

  /**
   * SigV4 signs over a region whether or not the backend has one. R2 requires `auto`, which is
   * the default here; AWS needs the bucket's actual region.
   */
  region?: string

  /**
   * Address objects as `<endpoint>/<bucket>/<key>` rather than
   * `https://<bucket>.<endpoint>/<key>`. Defaults to **true**: with an explicit endpoint,
   * path-style is what every target in the list accepts, and virtual-hosted style needs wildcard
   * DNS that MinIO, Ceph and B2 do not generally have. Set it false for AWS regional endpoints.
   */
  forcePathStyle?: boolean

  /**
   * Key prefix, so one bucket can host several installs. Normalised to end with `/`.
   * Everything the adapter writes lives under it, and listings never look outside it.
   */
  prefix?: string

  /**
   * Base URL of a public bucket or a CDN in front of it. When set, `getFileUrl` and
   * `getVariantUrl` return direct URLs built from it instead of presigning.
   */
  publicBaseUrl?: string

  /**
   * How long a presigned URL stays valid when no `expiresIn` is given, in seconds.
   * Defaults to 15 minutes. Ignored when `publicBaseUrl` is set.
   */
  defaultUrlExpirySeconds?: number

  /** Reject uploads larger than this. Defaults to 100MB, matching the other media adapters. */
  maxFileSize?: number

  /** Suppress the adapter's own informational logging. */
  silent?: boolean
}

/**
 * The stored form of a media record: one JSON object per file, alongside the bytes.
 *
 * Identical to `R2MediaRecord` on purpose — the two adapters share a key layout and a record
 * format, so one bucket can be handed from a Worker to a Node process and back.
 */
export interface S3MediaRecord {
  id: string
  filename: string
  contentType: string
  size: number
  extension: string
  createdAt: string
  updatedAt: string
  custom: Record<string, unknown>
}
