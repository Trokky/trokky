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

import { createLogger } from '../../core/index.js'
import { withRetry } from '../../core/utils/retry.js'

/** aws4fetch is an optional dependency; the module is only reachable through this adapter. */
type AwsClientLike = {
  fetch(input: string, init?: RequestInit): Promise<Response>
  sign(input: string, init?: Record<string, unknown>): Promise<Request>
}

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
  private client?: AwsClientLike
  private readonly options: S3ClientOptions

  constructor(options: S3ClientOptions) {
    this.options = options
    this.origin = options.endpoint.replace(/\/+$/, '')
    this.bucket = options.bucket
    this.forcePathStyle = options.forcePathStyle
  }

  /**
   * aws4fetch is loaded on first use rather than at module scope.
   *
   * It is an optionalDependency, so a install that never touches this adapter may not have it,
   * and a missing package should surface as a clear error from the first S3 call rather than as
   * an import crash while the adapter registry is being populated.
   */
  private async aws(): Promise<AwsClientLike> {
    if (this.client) return this.client

    let AwsClient: new (init: Record<string, unknown>) => AwsClientLike
    try {
      ;({ AwsClient } = (await import('aws4fetch')) as unknown as {
        AwsClient: new (init: Record<string, unknown>) => AwsClientLike
      })
    } catch (error) {
      throw new Error(
        'The s3-media adapter needs the "aws4fetch" package. Install it: npm install aws4fetch',
        { cause: error }
      )
    }

    this.client = new AwsClient({
      accessKeyId: this.options.accessKeyId,
      secretAccessKey: this.options.secretAccessKey,
      region: this.options.region,
      service: 's3'
    })
    return this.client
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
    const aws = await this.aws()

    return withRetry(
      async () => {
        const response = await aws.fetch(url, init)
        if (response.ok || response.status === 404) return response

        const body = await response.text().catch(() => '')
        throw new S3RequestError(
          `${label} failed: ${response.status} ${response.statusText}${body ? ` — ${body.slice(0, 300)}` : ''}`,
          response.status,
          /<Code>([^<]+)<\/Code>/.exec(body)?.[1]
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

    await this.send(this.url(key), { method: 'PUT', body: body as BodyInit, headers }, `PUT ${key}`)
  }

  public async get(key: string): Promise<Response | null> {
    const response = await this.send(this.url(key), { method: 'GET' }, `GET ${key}`)
    return response.status === 404 ? null : response
  }

  /** Object metadata without the bytes, or null when there is no such key. */
  public async head(key: string): Promise<{ size: number; metadata: Record<string, string> } | null> {
    const response = await this.send(this.url(key), { method: 'HEAD' }, `HEAD ${key}`)
    if (response.status === 404) return null

    const metadata: Record<string, string> = {}
    response.headers.forEach((value, name) => {
      if (name.toLowerCase().startsWith('x-amz-meta-')) {
        metadata[name.slice('x-amz-meta-'.length).toLowerCase()] = decodeURIComponent(value)
      }
    })

    return { size: Number(response.headers.get('content-length') ?? 0), metadata }
  }

  /** Deleting a key that is not there is a success, exactly as it is on R2. */
  public async delete(key: string): Promise<void> {
    await this.send(this.url(key), { method: 'DELETE' }, `DELETE ${key}`)
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

  /** A URL that carries its own signature, good for `expiresIn` seconds. */
  public async presign(key: string, expiresIn: number): Promise<string> {
    const aws = await this.aws()
    const signed = await aws.sign(`${this.url(key)}?X-Amz-Expires=${expiresIn}`, {
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
      size: Number(/<Size>(\d+)<\/Size>/.exec(entry)?.[1] ?? 0),
      lastModified: new Date(/<LastModified>([\s\S]*?)<\/LastModified>/.exec(entry)?.[1] ?? 0)
    })
  }

  const truncated = /<IsTruncated>\s*true\s*<\/IsTruncated>/i.test(xml)
  const token = /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1]

  return { objects, nextToken: truncated && token ? decodeURIComponent(token) : undefined }
}
