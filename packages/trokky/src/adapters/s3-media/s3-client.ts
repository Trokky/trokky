/**
 * The thinnest S3 client that serves a media adapter.
 *
 * Not an SDK. Six operations — put, get, head, delete, list, presign — over `aws4fetch`, which
 * is ~6KB of WebCrypto and therefore works unchanged in Node, workerd and a browser. The AWS
 * SDK would be two orders of magnitude larger for the same six calls.
 *
 * Two deliberate omissions:
 *
 *  - **No `DeleteObjects`.** The multi-key delete requires a `Content-MD5` (or a checksum
 *    header whose support varies by backend), and WebCrypto has no MD5, so implementing it
 *    means shipping an MD5. Individual DELETEs with bounded concurrency cost more requests and
 *    no correctness, and this adapter only ever bulk-deletes a file's variants or a cleanup's
 *    orphans — both rare and small.
 *  - **No multipart upload.** The adapter caps a file at 100MB and S3's single-PUT limit is
 *    5GB, so there is nothing to split. Raising the cap means implementing it.
 *
 * Listings ask for `encoding-type=url`, so keys come back percent-encoded and XML entities
 * cannot smuggle a `&` or a `<` through a filename into the parser.
 */

import { AwsClient } from 'aws4fetch'
import { createLogger } from '../../core/index.js'
import { withRetry } from '../../core/utils/retry.js'

export interface S3ObjectSummary {
  key: string
  size: number
  lastModified: Date
}

export interface S3ListPage {
  objects: S3ObjectSummary[]
  nextToken?: string
}

export interface S3ClientOptions {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  forcePathStyle: boolean
}

/** Status codes worth trying again: throttling and the backend having a bad moment. */
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

/**
 * Methods for which a 404 is an answer rather than a failure.
 *
 * On a GET, HEAD or DELETE it means "no such key", which every caller here handles. On a PUT or
 * a LIST it means `NoSuchBucket` — and swallowing that made a misconfigured bucket look like an
 * empty one: uploads returned a MediaFile having written nothing, and listings reported zero.
 */
const ABSENCE_IS_NOT_FAILURE = new Set(['GET', 'HEAD', 'DELETE'])

/** A stalled connection is the classic object-store failure; without this the promise never settles. */
const REQUEST_TIMEOUT_MS = 30_000

/** SigV4 caps a presigned URL at seven days. */
const MAX_PRESIGN_SECONDS = 604_800

export class S3RequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'S3RequestError'
  }
}

export class S3Client {
  private readonly logger = createLogger('adapter', 'S3Client')
  private readonly origin: string
  private readonly bucket: string
  private readonly forcePathStyle: boolean
  private readonly client: AwsClient

  constructor(options: S3ClientOptions) {
    this.origin = options.endpoint.replace(/\/+$/, '')
    this.bucket = options.bucket
    this.forcePathStyle = options.forcePathStyle
    this.client = new AwsClient({
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      region: options.region,
      service: 's3'
    })
  }

  /**
   * The URL for a key. Every path segment is encoded individually: a key contains `/` as a real
   * separator, and `encodeURIComponent` on the whole key would destroy it.
   */
  public url(key: string): string {
    const path = key.split('/').map(encodeURIComponent).join('/')
    return this.forcePathStyle
      ? `${this.origin}/${this.bucket}/${path}`
      : this.origin.replace('://', `://${this.bucket}.`) + `/${path}`
  }

  private base(): string {
    return this.forcePathStyle
      ? `${this.origin}/${this.bucket}`
      : this.origin.replace('://', `://${this.bucket}.`)
  }

  /** One signed request, retried on throttling and 5xx, never on a 4xx that means what it says. */
  private async send(url: string, init: RequestInit, label: string): Promise<Response> {
    const method = (init.method ?? 'GET').toUpperCase()
    const absenceIsAnswer = ABSENCE_IS_NOT_FAILURE.has(method)

    return withRetry(
      async () => {
        const response = await this.client.fetch(url, {
          ...init,
          // Without this a stalled connection never settles, so withRetry never sees an error
          // and the caller's request hangs for as long as the process lives.
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        })

        // A 404 means "no such key" on a read or a delete, which every caller here handles. On a
        // PUT or a LIST it means NoSuchBucket, and treating that as success made a misconfigured
        // bucket indistinguishable from an empty one.
        if (response.ok || (response.status === 404 && absenceIsAnswer)) return response

        const body = await response.text().catch(() => '')
        const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1]

        // The body is NOT in the message. AWS puts AWSAccessKeyId, StringToSign and
        // CanonicalRequest in a SignatureDoesNotMatch document, and this message travels
        // to an HTTP 500 response body through the Express error handler.
        this.logger.debug(`${label} failed`, { status: response.status, body: body.slice(0, 300) })

        throw new S3RequestError(
          `${label} failed: ${response.status} ${response.statusText}${code ? ` (${code})` : ''}`,
          response.status,
          code
        )
      },
      {
        attempts: 4,
        isRetryable: error =>
          !(error instanceof S3RequestError) || RETRYABLE_STATUS.has(error.status),
        onRetry: ({ error, attempt }) =>
          this.logger.warn(`${label}: retrying after failure`, { attempt, error: String(error) })
      }
    )
  }

  public async put(
    key: string,
    body: ArrayBuffer | Uint8Array | string,
    options: { contentType?: string; metadata?: Record<string, string> } = {}
  ): Promise<void> {
    const headers: Record<string, string> = {}
    if (options.contentType) headers['content-type'] = options.contentType
    for (const [name, value] of Object.entries(options.metadata ?? {})) {
      // User metadata must be a header-safe latin-1 string; a filename need not be either.
      headers[`x-amz-meta-${name}`] = encodeURIComponent(value)
    }

    await drain(
      await this.send(this.url(key), { method: 'PUT', body: body as BodyInit, headers }, `PUT ${key}`)
    )
  }

  public async get(key: string): Promise<Response | null> {
    const response = await this.send(this.url(key), { method: 'GET' }, `GET ${key}`)
    if (response.status !== 404) return response
    // An undici body that is never read pins its connection until GC.
    await drain(response)
    return null
  }

  /** Object metadata without the bytes, or null when there is no such key. */
  public async head(key: string): Promise<{ size: number; metadata: Record<string, string> } | null> {
    const response = await this.send(this.url(key), { method: 'HEAD' }, `HEAD ${key}`)
    await drain(response)
    if (response.status === 404) return null

    const metadata: Record<string, string> = {}
    response.headers.forEach((value, name) => {
      if (name.toLowerCase().startsWith('x-amz-meta-')) {
        metadata[name.slice('x-amz-meta-'.length).toLowerCase()] = decodeMetadata(value)
      }
    })

    return { size: Number(response.headers.get('content-length') ?? 0), metadata }
  }

  /** Deleting a key that is not there is a success, exactly as it is on R2. */
  public async delete(key: string): Promise<void> {
    await drain(await this.send(this.url(key), { method: 'DELETE' }, `DELETE ${key}`))
  }

  /**
   * Delete many keys, a few at a time.
   *
   * Sixteen in flight keeps a cleanup of a large bucket from opening a thousand sockets while
   * still finishing in a sensible time. See the header note on why this is not `DeleteObjects`.
   */
  public async deleteMany(keys: string[], concurrency = 16): Promise<void> {
    for (let index = 0; index < keys.length; index += concurrency) {
      await Promise.all(keys.slice(index, index + concurrency).map(key => this.delete(key)))
    }
  }

  /** One page of ListObjectsV2. */
  public async list(
    prefix: string,
    options: { token?: string; maxKeys?: number } = {}
  ): Promise<S3ListPage> {
    const query = new URLSearchParams({
      'list-type': '2',
      prefix,
      'encoding-type': 'url',
      'max-keys': String(options.maxKeys ?? 1000)
    })
    if (options.token) query.set('continuation-token', options.token)

    const response = await this.send(
      `${this.base()}?${query.toString()}`,
      { method: 'GET' },
      `LIST ${prefix}`
    )
    return parseListResponse(await response.text())
  }

  /** Every page of a prefix. A partial listing would mis-count a total. */
  public async listAll(prefix: string): Promise<S3ObjectSummary[]> {
    const objects: S3ObjectSummary[] = []
    let token: string | undefined

    do {
      const page = await this.list(prefix, { token })
      objects.push(...page.objects)
      token = page.nextToken
    } while (token)

    return objects
  }

  /**
   * A URL that carries its own signature, good for `expiresIn` seconds.
   *
   * The expiry goes through `URL.searchParams`, not string concatenation. Concatenating let a
   * caller that forwards a request value smuggle extra query parameters — and because they land
   * before signing, S3 honours them: `response-content-type=text/html` turns an uploaded image
   * into stored XSS on the bucket origin.
   */
  public async presign(key: string, expiresIn: number): Promise<string> {
    const seconds = Math.floor(Number(expiresIn))
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_PRESIGN_SECONDS) {
      throw new Error(
        `expiresIn must be a whole number of seconds between 1 and ${MAX_PRESIGN_SECONDS}`
      )
    }

    const url = new URL(this.url(key))
    url.searchParams.set('X-Amz-Expires', String(seconds))

    const signed = await this.client.sign(url.toString(), {
      method: 'GET',
      aws: { signQuery: true }
    })
    return signed.url
  }
}

/**
 * Pull the contents out of a ListObjectsV2 body.
 *
 * A regex rather than an XML parser because neither Node nor workerd ships one, the schema here
 * is four fields deep, and `encoding-type=url` guarantees the only characters inside the tags we
 * read are percent-encoded ASCII.
 */
export function parseListResponse(xml: string): S3ListPage {
  const objects: S3ObjectSummary[] = []

  for (const match of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const entry = match[1]
    const key = /<Key>([\s\S]*?)<\/Key>/.exec(entry)?.[1]
    if (key === undefined) continue

    objects.push({
      key: decodeURIComponent(key),
      // \s* because a pretty-printing backend puts the digits on their own line.
      size: Number(/<Size>\s*(\d+)\s*<\/Size>/.exec(entry)?.[1] ?? 0),
      lastModified: new Date(/<LastModified>([\s\S]*?)<\/LastModified>/.exec(entry)?.[1] ?? 0)
    })
  }

  const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml)
  const token = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1]

  // `encoding-type=url` is specified to cover Delimiter, Prefix, Key and StartAfter — NOT the
  // continuation token. AWS and R2 return base64, where decoding is a no-op, but a backend that
  // returns a raw marker could carry a `%` that decodeURIComponent would throw on or corrupt.
  return { objects, nextToken: truncated && token ? decodeMetadata(token) : undefined }
}

/**
 * Read and discard a body we do not need.
 *
 * Under undici a response body that is neither read nor cancelled pins its connection until GC,
 * so a cleanup issuing thousands of DELETEs can exhaust the pool.
 */
async function drain(response: Response): Promise<void> {
  try {
    await response.arrayBuffer()
  } catch {
    // A body that cannot be read is already gone, which is the state we wanted.
  }
}

/**
 * Percent-decode a value this adapter may not have written.
 *
 * `put()` encodes metadata values because a filename need not be header-safe, but
 * `CloudflareR2Adapter` mirrors the filename into `customMetadata` raw — and sharing one bucket
 * between the two is the point of this layout. A file named `100% off.png` written from a Worker
 * would otherwise make `decodeURIComponent` throw and take `fileExists`, `listVariants` and
 * `healthCheck` down with it.
 */
export function decodeMetadata(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
