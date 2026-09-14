/**
 * Cloudflare R2 media storage adapter.
 *
 * R2 is a flat key/value object store with no directories, no metadata queries and no
 * transactions, which drives every choice below:
 *
 *  - **Bytes and description are two objects.** `files/<id>` holds the content and
 *    `meta/<id>.json` holds the record. Updating a title must not rewrite a 12MB photo,
 *    and serving the photo must not parse JSON.
 *  - **The listing carries its own index.** The sortable and filterable fields are
 *    mirrored into each record object's `customMetadata`, so `listMedia` can filter, sort
 *    and count from one `list()` sweep and then read full records only for the page it is
 *    about to return. Without that, listing 900 files would mean 900 GETs.
 *  - **The record object is the source of truth for existence.** It is written last on
 *    upload and deleted first on delete, so a half-finished operation can leave an
 *    orphaned blob — which `cleanup()` reclaims — but never a listing entry pointing at
 *    bytes that are not there.
 *  - **Variant keys carry no format.** `variants/<id>/<name>` with the format in
 *    `customMetadata` means re-encoding a variant to another format overwrites it instead
 *    of leaving both behind, and reading one needs no lookup in the parent's metadata.
 *  - **Caller fields are namespaced under `custom`.** A caller passing `{ size: 0 }` to
 *    `updateFile` must not be able to shadow the real size in the listing index.
 */

import type { R2Bucket, R2Object, R2ObjectBody } from '@cloudflare/workers-types'
import { InvalidInputError, SecurityValidator, createLogger } from '../../core/index.js'
import type { MediaFile, MediaMetadata } from '../../core/types/index.js'
import type {
  MediaListOptions,
  MediaListResult,
  MediaStorageAdapter,
  MediaVariant
} from '../../core/types/storage-adapters.js'
import type { CloudflareR2AdapterConfig, R2MediaRecord } from './types.js'

/** Matches the filesystem adapter's ceiling, so a file that uploads on one uploads on both. */
const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024

/** R2 caps a listing page at 1000; asking for fewer keeps each response small when metadata is included. */
const LIST_PAGE_SIZE = 500

/** An extension goes into no key, but it is still validated so both adapters reject the same input. */
const EXTENSION_PATTERN = /^[A-Za-z0-9]{1,10}$/

/** Fields the caller may set through `updateFile` that belong to the record, not to `custom`. */
const RECORD_FIELDS = new Set(['filename', 'contentType', 'size', 'extension'])

/** The subset of a record mirrored into customMetadata so listings need no GETs. */
interface IndexEntry {
  id: string
  filename: string
  contentType: string
  size: number
  createdAt: Date
}

export class CloudflareR2Adapter implements MediaStorageAdapter {
  private readonly bucket: R2Bucket
  private readonly prefix: string
  private readonly publicBaseUrl?: string
  private readonly maxFileSize: number
  private readonly silent: boolean
  private readonly logger = createLogger('adapter', 'CloudflareR2Adapter')

  constructor(config: CloudflareR2AdapterConfig) {
    if (!config?.bucket) {
      throw new InvalidInputError('CloudflareR2Adapter requires an R2 bucket binding', 'bucket')
    }

    this.bucket = config.bucket
    this.prefix = config.prefix ? config.prefix.replace(/\/*$/, '/') : ''
    this.publicBaseUrl = config.publicBaseUrl?.replace(/\/+$/, '')
    this.maxFileSize = config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE
    this.silent = config.silent ?? false

    if (!this.silent) {
      this.logger.info('CloudflareR2Adapter initialized', { prefix: this.prefix || '(none)' })
    }
  }

  // ==========================================================================
  // KEYS
  // ==========================================================================

  private fileKey(id: string): string {
    return `${this.prefix}files/${id}`
  }

  private recordKey(id: string): string {
    return `${this.prefix}meta/${id}.json`
  }

  private variantKey(parentId: string, variantName: string): string {
    return `${this.prefix}variants/${parentId}/${variantName}`
  }

  private variantPrefix(parentId: string): string {
    return `${this.prefix}variants/${parentId}/`
  }

  // ==========================================================================
  // FILE OPERATIONS
  // ==========================================================================

  public async uploadFile(file: File, metadata: MediaMetadata): Promise<MediaFile> {
    this.validateMediaMetadata(metadata)

    const buffer = await file.arrayBuffer()
    if (buffer.byteLength > this.maxFileSize) {
      throw new InvalidInputError(
        `File too large (${buffer.byteLength} bytes). Maximum size is ${this.maxFileSize} bytes.`,
        'size'
      )
    }

    // New bytes make any existing variant a description of content that is gone.
    await this.deleteVariantFiles(metadata.id)

    const now = new Date()
    const record: R2MediaRecord = {
      id: metadata.id,
      filename: metadata.filename,
      contentType: metadata.contentType,
      size: metadata.size,
      extension: metadata.extension,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      custom: {}
    }

    await this.bucket.put(this.fileKey(metadata.id), buffer, {
      httpMetadata: { contentType: metadata.contentType }
    })
    // The record is written last: until it lands, nothing lists the file as present.
    await this.writeRecord(record)

    if (!this.silent) {
      this.logger.info('File uploaded', {
        id: metadata.id,
        filename: metadata.filename,
        size: metadata.size
      })
    }

    return this.toMediaFile(record)
  }

  public async getFile(id: string): Promise<MediaFile | null> {
    SecurityValidator.validateDocumentId(id)

    const record = await this.readRecord(id)
    return record ? this.toMediaFile(record) : null
  }

  public async updateFile(id: string, metadata: Record<string, any>): Promise<MediaFile> {
    SecurityValidator.validateDocumentId(id)

    const record = await this.readRecord(id)
    if (!record) {
      throw new Error(`Media file ${id} not found`)
    }

    const updated: R2MediaRecord = {
      ...record,
      custom: { ...record.custom },
      updatedAt: new Date().toISOString()
    }

    for (const [key, value] of Object.entries(metadata ?? {})) {
      // The id identifies the object; letting it be rewritten would orphan the bytes.
      if (key === 'id') continue
      if (RECORD_FIELDS.has(key)) {
        ;(updated as unknown as Record<string, unknown>)[key] = value
      } else {
        updated.custom[key] = value
      }
    }

    await this.writeRecord(updated)

    if (!this.silent) {
      this.logger.info('File metadata updated', { id })
    }

    return this.toMediaFile(updated)
  }

  public async getFileContent(id: string): Promise<ArrayBuffer | null> {
    SecurityValidator.validateDocumentId(id)

    const object = (await this.bucket.get(this.fileKey(id))) as R2ObjectBody | null
    if (!object) return null
    return object.arrayBuffer()
  }

  public async getFileUrl(id: string): Promise<string | null> {
    SecurityValidator.validateDocumentId(id)

    // An R2 bucket binding cannot presign; without a public base there is no URL to give.
    if (!this.publicBaseUrl) return null
    if (!(await this.fileExists(id))) return null
    return `${this.publicBaseUrl}/${this.fileKey(id)}`
  }

  public async fileExists(id: string): Promise<boolean> {
    SecurityValidator.validateDocumentId(id)
    return (await this.bucket.head(this.recordKey(id))) !== null
  }

  public async getFileSize(id: string): Promise<number | null> {
    SecurityValidator.validateDocumentId(id)

    const record = await this.readRecord(id)
    return record ? record.size : null
  }

  public async deleteFile(id: string): Promise<void> {
    SecurityValidator.validateDocumentId(id)

    const record = await this.readRecord(id)
    if (!record) {
      throw new Error(`Media file ${id} not found`)
    }

    await this.deleteVariantFiles(id)
    // The record goes first: if the blob delete fails, the file is already invisible to
    // every listing and `cleanup()` can reclaim the bytes later.
    await this.bucket.delete(this.recordKey(id))
    await this.bucket.delete(this.fileKey(id))

    if (!this.silent) {
      this.logger.debug('File deleted', { id })
    }
  }

  // ==========================================================================
  // LISTING
  // ==========================================================================

  public async listMedia(options: MediaListOptions = {}): Promise<MediaListResult> {
    let entries = await this.listIndex()

    if (options.contentType) {
      const wanted = options.contentType
      entries = entries.filter(entry => entry.contentType.includes(wanted))
    }

    if (options.sizeRange) {
      const { min, max } = options.sizeRange
      entries = entries.filter(entry => {
        if (min !== undefined && entry.size < min) return false
        if (max !== undefined && entry.size > max) return false
        return true
      })
    }

    if (options.dateRange) {
      const { from, to } = options.dateRange
      entries = entries.filter(entry => {
        if (from && entry.createdAt < from) return false
        if (to && entry.createdAt > to) return false
        return true
      })
    }

    // No sort means newest first, matching the filesystem adapter and what the Studio shows.
    this.sortIndex(entries, options.sort ?? 'date', options.sortDirection ?? (options.sort ? 'asc' : 'desc'))

    const total = entries.length
    const offset = options.offset ?? 0
    const page = options.limit === undefined
      ? entries.slice(offset)
      : entries.slice(offset, offset + options.limit)

    // Only the page is read in full; the filters and the total came from the listing alone.
    const records = await Promise.all(page.map(entry => this.readRecord(entry.id)))
    const items = records
      .filter((record): record is R2MediaRecord => record !== null)
      .map(record => this.toMediaFile(record))

    return { items, total }
  }

  // ==========================================================================
  // VARIANT OPERATIONS
  // ==========================================================================

  public async saveVariantFile(
    parentId: string,
    variantName: string,
    buffer: Buffer,
    format: string
  ): Promise<string> {
    SecurityValidator.validateDocumentId(parentId)
    SecurityValidator.validateDocumentId(variantName)

    if (!format || typeof format !== 'string' || !EXTENSION_PATTERN.test(format)) {
      throw new InvalidInputError('Invalid variant format', 'format')
    }

    const key = this.variantKey(parentId, variantName)
    // Buffer is a Uint8Array view; copy out so R2 stores exactly this variant's bytes and
    // never a window onto a larger pooled allocation.
    const bytes = new Uint8Array(buffer.byteLength)
    bytes.set(buffer)

    await this.bucket.put(key, bytes, {
      httpMetadata: { contentType: `image/${format}` },
      customMetadata: { format }
    })

    if (!this.silent) {
      this.logger.info('Variant file saved', { parentId, variantName, format })
    }

    return key
  }

  public async getVariantContent(parentId: string, variantName: string): Promise<ArrayBuffer | null> {
    SecurityValidator.validateDocumentId(parentId)
    SecurityValidator.validateDocumentId(variantName)

    const object = (await this.bucket.get(this.variantKey(parentId, variantName))) as R2ObjectBody | null
    if (!object) return null
    return object.arrayBuffer()
  }

  public async getVariantUrl(parentId: string, variantName: string): Promise<string | null> {
    SecurityValidator.validateDocumentId(parentId)
    SecurityValidator.validateDocumentId(variantName)

    if (!this.publicBaseUrl) return null
    if (!(await this.bucket.head(this.variantKey(parentId, variantName)))) return null
    return `${this.publicBaseUrl}/${this.variantKey(parentId, variantName)}`
  }

  public async listVariants(parentId: string): Promise<MediaVariant[]> {
    SecurityValidator.validateDocumentId(parentId)

    const prefix = this.variantPrefix(parentId)
    // The format lives only in customMetadata, which R2 omits from a listing unless asked.
    const objects = await this.listAll(prefix, true)

    return objects.map(object => ({
      name: object.key.slice(prefix.length),
      format: object.customMetadata?.format ?? 'unknown',
      size: object.size,
      url: this.publicBaseUrl ? `${this.publicBaseUrl}/${object.key}` : undefined,
      createdAt: object.uploaded
    }))
  }

  public async deleteVariantFiles(parentId: string): Promise<void> {
    SecurityValidator.validateDocumentId(parentId)

    const objects = await this.listAll(this.variantPrefix(parentId))
    if (objects.length === 0) return

    await this.deleteKeys(objects.map(object => object.key))

    if (!this.silent) {
      this.logger.debug('Variant files deleted', { parentId, count: objects.length })
    }
  }

  public async deleteVariant(parentId: string, variantName: string): Promise<void> {
    SecurityValidator.validateDocumentId(parentId)
    SecurityValidator.validateDocumentId(variantName)

    await this.bucket.delete(this.variantKey(parentId, variantName))
  }

  // ==========================================================================
  // UTILITY OPERATIONS
  // ==========================================================================

  public async healthCheck(): Promise<boolean> {
    try {
      // A head on a key that need not exist proves the binding answers without writing.
      await this.bucket.head(`${this.prefix}.trokky-health`)
      return true
    } catch (error) {
      this.logger.error('Health check failed', error)
      return false
    }
  }

  public async getStorageInfo(): Promise<{
    totalFiles: number
    totalSize: number
    availableSpace?: number
    usedSpace?: number
    [key: string]: unknown
  }> {
    const entries = await this.listIndex()
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0)

    return {
      totalFiles: entries.length,
      totalSize,
      // R2 is unmetered in size, so there is no quota to report and no free space to compute.
      usedSpace: totalSize
    }
  }

  /**
   * Delete blobs and variants no record points at any more.
   *
   * These accumulate when a delete or an upload is interrupted between its two writes. The
   * record objects are the authority: anything under `files/` or `variants/` whose id has no
   * record is unreachable and safe to drop.
   */
  public async cleanup(): Promise<number> {
    const live = new Set((await this.listIndex()).map(entry => entry.id))

    const orphans: string[] = []

    const filePrefix = `${this.prefix}files/`
    for (const object of await this.listAll(filePrefix)) {
      if (!live.has(object.key.slice(filePrefix.length))) orphans.push(object.key)
    }

    const variantRoot = `${this.prefix}variants/`
    for (const object of await this.listAll(variantRoot)) {
      const parentId = object.key.slice(variantRoot.length).split('/')[0]
      if (!live.has(parentId)) orphans.push(object.key)
    }

    if (orphans.length > 0) {
      await this.deleteKeys(orphans)
      if (!this.silent) {
        this.logger.info('Cleaned up orphaned objects', { count: orphans.length })
      }
    }

    return orphans.length
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async writeRecord(record: R2MediaRecord): Promise<void> {
    await this.bucket.put(this.recordKey(record.id), JSON.stringify(record), {
      httpMetadata: { contentType: 'application/json' },
      customMetadata: {
        id: record.id,
        filename: record.filename,
        contentType: record.contentType,
        size: String(record.size),
        createdAt: record.createdAt
      }
    })
  }

  private async readRecord(id: string): Promise<R2MediaRecord | null> {
    const object = (await this.bucket.get(this.recordKey(id))) as R2ObjectBody | null
    if (!object) return null

    const text = await object.text()
    try {
      const parsed = JSON.parse(text) as R2MediaRecord
      return { ...parsed, custom: parsed.custom ?? {} }
    } catch (error) {
      this.logger.warn(`Media record ${id} is not valid JSON`, error)
      return null
    }
  }

  /**
   * Every record in the bucket, read from the listing's customMetadata rather than from the
   * objects themselves. A record written without that index (an older adapter, a manual copy)
   * falls back to a real read so it is not silently invisible.
   */
  private async listIndex(): Promise<IndexEntry[]> {
    const recordPrefix = `${this.prefix}meta/`
    const objects = await this.listAll(recordPrefix, true)

    const entries: IndexEntry[] = []
    const needsRead: string[] = []

    for (const object of objects) {
      const id = object.key.slice(recordPrefix.length).replace(/\.json$/, '')
      const indexed = object.customMetadata
      if (indexed?.contentType && indexed.size !== undefined && indexed.createdAt) {
        entries.push({
          id,
          filename: indexed.filename ?? id,
          contentType: indexed.contentType,
          size: Number(indexed.size),
          createdAt: new Date(indexed.createdAt)
        })
      } else {
        needsRead.push(id)
      }
    }

    for (const record of await Promise.all(needsRead.map(id => this.readRecord(id)))) {
      if (!record) continue
      entries.push({
        id: record.id,
        filename: record.filename,
        contentType: record.contentType,
        size: record.size,
        createdAt: new Date(record.createdAt)
      })
    }

    return entries
  }

  /** Walk every page of a prefix; R2 truncates, and a partial listing would mis-count totals. */
  private async listAll(prefix: string, includeCustomMetadata = false): Promise<R2Object[]> {
    const objects: R2Object[] = []
    let cursor: string | undefined

    do {
      const page = await this.bucket.list({
        prefix,
        limit: LIST_PAGE_SIZE,
        cursor,
        ...(includeCustomMetadata ? { include: ['customMetadata' as const] } : {})
      })
      objects.push(...page.objects)
      cursor = page.truncated ? page.cursor : undefined
    } while (cursor)

    return objects
  }

  /** R2 accepts up to 1000 keys per delete; anything longer is chunked. */
  private async deleteKeys(keys: string[]): Promise<void> {
    for (let index = 0; index < keys.length; index += 1000) {
      await this.bucket.delete(keys.slice(index, index + 1000))
    }
  }

  private sortIndex(
    entries: IndexEntry[],
    sortBy: NonNullable<MediaListOptions['sort']>,
    direction: 'asc' | 'desc'
  ): void {
    const pick = (entry: IndexEntry): string | number => {
      switch (sortBy) {
        case 'name':
          return entry.filename.toLowerCase()
        case 'size':
          return entry.size
        case 'type':
          return entry.contentType
        case 'date':
        default:
          return entry.createdAt.getTime()
      }
    }

    entries.sort((a, b) => {
      const left = pick(a)
      const right = pick(b)
      let comparison = 0
      if (left < right) comparison = -1
      else if (left > right) comparison = 1
      return direction === 'desc' ? -comparison : comparison
    })
  }

  private toMediaFile(record: R2MediaRecord): MediaFile {
    return {
      id: record.id,
      filename: record.filename,
      contentType: record.contentType,
      size: record.size,
      metadata: {
        // Caller fields first: the derived ones below are facts about the object and must win.
        ...record.custom,
        path: this.fileKey(record.id),
        extension: record.extension,
        originalFilename: record.filename
      },
      _createdAt: new Date(record.createdAt)
    }
  }

  private validateMediaMetadata(metadata: MediaMetadata): void {
    if (!metadata || typeof metadata !== 'object') {
      throw new InvalidInputError('Media metadata is required', 'metadata')
    }

    // Rejects an empty, overlong or path-like id before it can become a key.
    SecurityValidator.validateDocumentId(metadata.id)

    if (!metadata.filename || typeof metadata.filename !== 'string') {
      throw new InvalidInputError('Media metadata must have a valid filename', 'filename')
    }

    if (!metadata.contentType || typeof metadata.contentType !== 'string') {
      throw new InvalidInputError('Media metadata must have a valid content type', 'contentType')
    }

    if (!metadata.extension || typeof metadata.extension !== 'string' || !EXTENSION_PATTERN.test(metadata.extension)) {
      throw new InvalidInputError('Media metadata must have a valid extension', 'extension')
    }

    if (typeof metadata.size !== 'number' || metadata.size <= 0) {
      throw new InvalidInputError('Media metadata must have a valid size', 'size')
    }
  }
}
