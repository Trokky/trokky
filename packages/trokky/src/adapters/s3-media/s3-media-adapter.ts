/**
 * S3-compatible media storage adapter.
 *
 * Talks SigV4 over HTTP, so it reaches R2 from a Node process, and MinIO, Backblaze B2, Spaces,
 * Ceph or AWS from anywhere. `CloudflareR2Adapter` is the better choice *inside* a Worker — a
 * binding is faster and needs no credentials — and the two share a key layout on purpose, so
 * one bucket can be handed from a Worker to a Node server and back.
 *
 * The layout, identical to the R2 adapter's:
 *
 *   files/<id>              the bytes
 *   meta/<id>.json          the record — the only authority for existence
 *   variants/<id>/<name>    variant bytes, format in user metadata
 *   index/...               the listing cache, see index-key.ts
 *
 * What differs, and why:
 *
 *  - **The listing is a join, not a sweep.** R2's `list()` can return `customMetadata`;
 *    `ListObjectsV2` cannot return user metadata at all. So the sortable fields are encoded into
 *    keys under `index/`, and `listMedia` enumerates ids from `meta/`, reads fields from the
 *    index, and falls back to reading the record for any id the index does not cover.
 *  - **The index must never be the enumeration.** Writes go bytes → record → index and deletes
 *    reverse that, so an interrupted operation leaves a record with no index entry. If the index
 *    were authoritative that file would exist and never be listed — a ghost. Enumerating from
 *    `meta/` makes a missing entry cost one GET instead of hiding a file, and `cleanup()`
 *    rebuilds it.
 *  - **`listVariants` HEADs each variant.** The format lives in user metadata and a listing does
 *    not carry it. A file has a handful of variants, so this is a handful of requests, and it
 *    keeps the R2 invariant that variant keys carry no format — re-encoding a variant to another
 *    format overwrites it instead of leaving both behind.
 */

import { InvalidInputError, SecurityValidator, createLogger } from '../../core/index.js'
import type { MediaFile, MediaMetadata } from '../../core/types/index.js'
import type {
  MediaListOptions,
  MediaListResult,
  MediaStorageAdapter,
  MediaVariant
} from '../../core/types/storage-adapters.js'
import { S3Client } from './s3-client.js'
import {
  decodeIndexKey,
  encodeIndexKey,
  entryPrefix,
  indexPrefix,
  type IndexEntry
} from './index-key.js'
import type { S3MediaAdapterConfig, S3MediaRecord } from './types.js'

/** Matches the other media adapters' ceiling, so a file that uploads on one uploads on all. */
const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024

/** Long enough to be useful in a page, short enough that a leaked URL expires. */
const DEFAULT_URL_EXPIRY_SECONDS = 900

/** An extension goes into no key, but it is still validated so every adapter rejects the same input. */
const EXTENSION_PATTERN = /^[A-Za-z0-9]{1,10}$/

/** Fields the caller may set through `updateFile` that belong to the record, not to `custom`. */
const RECORD_FIELDS = new Set(['filename', 'contentType', 'size', 'extension'])

/** Reads that fan out (records behind a listing, variant HEADs) run this many at a time. */
const READ_CONCURRENCY = 16

export class S3MediaAdapter implements MediaStorageAdapter {
  private readonly s3: S3Client
  private readonly prefix: string
  private readonly publicBaseUrl?: string
  private readonly urlExpiry: number
  private readonly maxFileSize: number
  private readonly silent: boolean
  private readonly logger = createLogger('adapter', 'S3MediaAdapter')

  constructor(config: S3MediaAdapterConfig) {
    for (const field of ['endpoint', 'bucket', 'accessKeyId', 'secretAccessKey'] as const) {
      if (!config?.[field] || typeof config[field] !== 'string') {
        throw new InvalidInputError(`S3MediaAdapter requires a ${field}`, field)
      }
    }

    this.s3 = new S3Client({
      endpoint: config.endpoint,
      bucket: config.bucket,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region ?? 'auto',
      forcePathStyle: config.forcePathStyle ?? true
    })

    this.prefix = config.prefix ? config.prefix.replace(/\/*$/, '/') : ''
    this.publicBaseUrl = config.publicBaseUrl?.replace(/\/+$/, '')
    this.urlExpiry = config.defaultUrlExpirySeconds ?? DEFAULT_URL_EXPIRY_SECONDS
    this.maxFileSize = config.maxFileSize ?? DEFAULT_MAX_FILE_SIZE
    this.silent = config.silent ?? false

    if (!this.silent) {
      this.logger.info('S3MediaAdapter initialized', {
        bucket: config.bucket,
        prefix: this.prefix || '(none)'
      })
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

  private recordPrefix(): string {
    return `${this.prefix}meta/`
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
    // The previous index entry described the previous upload; its epoch no longer matches.
    await this.deleteIndexEntries(metadata.id)

    const now = new Date()
    const record: S3MediaRecord = {
      id: metadata.id,
      filename: metadata.filename,
      contentType: metadata.contentType,
      size: metadata.size,
      extension: metadata.extension,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      custom: {}
    }

    await this.s3.put(this.fileKey(metadata.id), buffer, { contentType: metadata.contentType })
    // The record lands before the index: until it does, nothing lists the file as present.
    await this.writeRecord(record)
    await this.writeIndexEntry(record)

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

    const updated: S3MediaRecord = {
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

    // The index encodes filename, contentType and size — `updateFile` can change all three, and
    // a stale entry means a wrong filter, a wrong sort and a wrong total with nothing to heal it.
    if (
      updated.filename !== record.filename ||
      updated.contentType !== record.contentType ||
      updated.size !== record.size
    ) {
      await this.deleteIndexEntries(id)
      await this.writeIndexEntry(updated)
    }

    if (!this.silent) {
      this.logger.info('File metadata updated', { id })
    }

    return this.toMediaFile(updated)
  }

  public async getFileContent(id: string): Promise<ArrayBuffer | null> {
    SecurityValidator.validateDocumentId(id)

    const response = await this.s3.get(this.fileKey(id))
    return response ? response.arrayBuffer() : null
  }

  public async getFileUrl(id: string, options: { expiresIn?: number } = {}): Promise<string | null> {
    SecurityValidator.validateDocumentId(id)

    if (!(await this.fileExists(id))) return null
    if (this.publicBaseUrl) return `${this.publicBaseUrl}/${this.fileKey(id)}`
    // Unlike a bucket binding, SigV4 can sign a URL — so an install with no public base still
    // has one to give.
    return this.s3.presign(this.fileKey(id), options.expiresIn ?? this.urlExpiry)
  }

  public async fileExists(id: string): Promise<boolean> {
    SecurityValidator.validateDocumentId(id)
    return (await this.s3.head(this.recordKey(id))) !== null
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
    // Index first, then the record, then the bytes: every step makes the file less visible than
    // the last, so an interruption can only leave something cleanup() can reclaim.
    await this.deleteIndexEntries(id)
    await this.s3.delete(this.recordKey(id))
    await this.s3.delete(this.fileKey(id))

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

    // No sort means newest first, matching the other media adapters and what the Studio shows.
    this.sortIndex(entries, options.sort ?? 'date', options.sortDirection ?? (options.sort ? 'asc' : 'desc'))

    const total = entries.length
    const offset = options.offset ?? 0
    const page = options.limit === undefined
      ? entries.slice(offset)
      : entries.slice(offset, offset + options.limit)

    // Only the page is read in full; the filters and the total came from the two listings alone.
    const records = await this.mapWithConcurrency(page, entry => this.readRecord(entry.id))
    const items = records
      .filter((record): record is S3MediaRecord => record !== null)
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
    // Buffer is a Uint8Array view; copy out so the store gets exactly this variant's bytes and
    // never a window onto a larger pooled allocation.
    const bytes = new Uint8Array(buffer.byteLength)
    bytes.set(buffer)

    await this.s3.put(key, bytes, {
      contentType: `image/${format}`,
      metadata: { format }
    })

    if (!this.silent) {
      this.logger.info('Variant file saved', { parentId, variantName, format })
    }

    return key
  }

  public async getVariantContent(parentId: string, variantName: string): Promise<ArrayBuffer | null> {
    SecurityValidator.validateDocumentId(parentId)
    SecurityValidator.validateDocumentId(variantName)

    const response = await this.s3.get(this.variantKey(parentId, variantName))
    return response ? response.arrayBuffer() : null
  }

  public async getVariantUrl(
    parentId: string,
    variantName: string,
    options: { expiresIn?: number } = {}
  ): Promise<string | null> {
    SecurityValidator.validateDocumentId(parentId)
    SecurityValidator.validateDocumentId(variantName)

    const key = this.variantKey(parentId, variantName)
    if (!(await this.s3.head(key))) return null
    if (this.publicBaseUrl) return `${this.publicBaseUrl}/${key}`
    return this.s3.presign(key, options.expiresIn ?? this.urlExpiry)
  }

  public async listVariants(parentId: string): Promise<MediaVariant[]> {
    SecurityValidator.validateDocumentId(parentId)

    const prefix = this.variantPrefix(parentId)
    const objects = await this.s3.listAll(prefix)

    // A listing carries no user metadata, and the format lives there. A file has a handful of
    // variants, so a HEAD each is proportionate — and the alternative, putting the format in the
    // key, would let one variant exist twice in two formats.
    return this.mapWithConcurrency(objects, async object => {
      const head = await this.s3.head(object.key)
      return {
        name: object.key.slice(prefix.length),
        format: head?.metadata.format ?? 'unknown',
        size: object.size,
        url: this.publicBaseUrl ? `${this.publicBaseUrl}/${object.key}` : undefined,
        createdAt: object.lastModified
      }
    })
  }

  public async deleteVariantFiles(parentId: string): Promise<void> {
    SecurityValidator.validateDocumentId(parentId)

    const objects = await this.s3.listAll(this.variantPrefix(parentId))
    if (objects.length === 0) return

    await this.s3.deleteMany(objects.map(object => object.key))

    if (!this.silent) {
      this.logger.debug('Variant files deleted', { parentId, count: objects.length })
    }
  }

  public async deleteVariant(parentId: string, variantName: string): Promise<void> {
    SecurityValidator.validateDocumentId(parentId)
    SecurityValidator.validateDocumentId(variantName)

    await this.s3.delete(this.variantKey(parentId, variantName))
  }

  // ==========================================================================
  // UTILITY OPERATIONS
  // ==========================================================================

  public async healthCheck(): Promise<boolean> {
    try {
      // A HEAD on a key that need not exist proves the endpoint answers and the credentials
      // sign, without writing anything.
      await this.s3.head(`${this.prefix}.trokky-health`)
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
      // Object storage is unmetered in size, so there is no quota and no free space to compute.
      usedSpace: totalSize
    }
  }

  /**
   * Reconcile the bucket against its records, which are the only authority.
   *
   * Three jobs, and the order they are listed in is the order of how much they matter:
   *
   *  1. **Rebuild missing index entries.** An upload interrupted after the record but before the
   *     index — or a delete interrupted the other way — leaves a file that `getFile` serves and
   *     no listing shows. `listMedia` already heals the symptom by reading the record; this
   *     removes the cost.
   *  2. **Drop orphaned bytes.** Anything under `files/` or `variants/` whose id has no record.
   *  3. **Drop stale index entries.** Unreachable by an interruption under these write orders,
   *     but reachable by a partial restore or by a re-upload whose old-entry delete failed.
   *
   * Returns the number of objects written or deleted.
   */
  public async cleanup(): Promise<number> {
    const records = await this.listRecordIds()
    const live = new Set(records)
    let touched = 0

    // 1. Rebuild.
    const indexed = new Map<string, IndexEntry[]>()
    for (const object of await this.s3.listAll(indexPrefix(this.prefix))) {
      const entry = decodeIndexKey(this.prefix, object.key)
      if (!entry) continue
      indexed.set(entry.id, [...(indexed.get(entry.id) ?? []), entry])
    }

    const missing = records.filter(id => !indexed.has(id))
    for (const record of await this.mapWithConcurrency(missing, id => this.readRecord(id))) {
      if (!record) continue
      await this.writeIndexEntry(record)
      touched++
    }

    // 2. Orphaned bytes.
    const orphans: string[] = []

    const filePrefix = `${this.prefix}files/`
    for (const object of await this.s3.listAll(filePrefix)) {
      if (!live.has(object.key.slice(filePrefix.length))) orphans.push(object.key)
    }

    const variantRoot = `${this.prefix}variants/`
    for (const object of await this.s3.listAll(variantRoot)) {
      const parentId = object.key.slice(variantRoot.length).split('/')[0]
      if (!live.has(parentId)) orphans.push(object.key)
    }

    // 3. Stale or duplicated index entries: anything with no record, and every entry for an id
    //    except the newest.
    for (const object of await this.s3.listAll(indexPrefix(this.prefix))) {
      const entry = decodeIndexKey(this.prefix, object.key)
      if (!entry) {
        orphans.push(object.key)
        continue
      }
      if (!live.has(entry.id)) {
        orphans.push(object.key)
        continue
      }
      const newest = Math.max(...(indexed.get(entry.id) ?? []).map(e => e.createdAt.getTime()))
      if (entry.createdAt.getTime() < newest) orphans.push(object.key)
    }

    if (orphans.length > 0) {
      await this.s3.deleteMany(orphans)
      touched += orphans.length
    }

    if (touched > 0 && !this.silent) {
      this.logger.info('Cleanup reconciled the bucket', {
        rebuilt: missing.length,
        deleted: orphans.length
      })
    }

    return touched
  }

  // ==========================================================================
  // PRIVATE HELPERS
  // ==========================================================================

  private async writeRecord(record: S3MediaRecord): Promise<void> {
    await this.s3.put(this.recordKey(record.id), JSON.stringify(record), {
      contentType: 'application/json'
    })
  }

  private async readRecord(id: string): Promise<S3MediaRecord | null> {
    const response = await this.s3.get(this.recordKey(id))
    if (!response) return null

    const text = await response.text()
    try {
      const parsed = JSON.parse(text) as S3MediaRecord
      return { ...parsed, custom: parsed.custom ?? {} }
    } catch (error) {
      this.logger.warn(`Media record ${id} is not valid JSON`, error)
      return null
    }
  }

  private async writeIndexEntry(record: S3MediaRecord): Promise<void> {
    await this.s3.put(
      encodeIndexKey(this.prefix, {
        id: record.id,
        filename: record.filename,
        contentType: record.contentType,
        size: record.size,
        createdAt: new Date(record.createdAt)
      }),
      new Uint8Array(0)
    )
  }

  /**
   * Every index key for an id, whatever epoch it carries.
   *
   * One prefix listing rather than a sweep of the whole index — which is the entire reason the
   * key puts the id before the timestamp. This runs on every upload.
   */
  private async deleteIndexEntries(id: string): Promise<void> {
    const keys = (await this.s3.listAll(entryPrefix(this.prefix, id))).map(object => object.key)
    if (keys.length > 0) await this.s3.deleteMany(keys)
  }

  private async listRecordIds(): Promise<string[]> {
    const prefix = this.recordPrefix()
    return (await this.s3.listAll(prefix))
      .map(object => object.key.slice(prefix.length))
      .filter(name => name.endsWith('.json'))
      .map(name => name.slice(0, -'.json'.length))
  }

  /**
   * Every record in the bucket, with its listable fields.
   *
   * Two key-only listings — `meta/` for the ids, `index/` for the fields — joined by id. The
   * records are the authority for *which* files exist; the index only saves reading them. An id
   * the index does not cover (a bucket written by the R2 adapter, a hand-copied object, an
   * interrupted upload) falls back to a real read, so it is never silently invisible.
   */
  private async listIndex(): Promise<IndexEntry[]> {
    const [ids, indexObjects] = await Promise.all([
      this.listRecordIds(),
      this.s3.listAll(indexPrefix(this.prefix))
    ])

    const byId = new Map<string, IndexEntry>()
    for (const object of indexObjects) {
      const entry = decodeIndexKey(this.prefix, object.key)
      if (!entry) continue
      // A re-upload whose old entry outlived its delete leaves two; the newest describes the
      // bytes that are actually there.
      const existing = byId.get(entry.id)
      if (!existing || existing.createdAt < entry.createdAt) byId.set(entry.id, entry)
    }

    const entries: IndexEntry[] = []
    const needsRead: string[] = []

    for (const id of ids) {
      const entry = byId.get(id)
      if (entry) entries.push(entry)
      else needsRead.push(id)
    }

    for (const record of await this.mapWithConcurrency(needsRead, id => this.readRecord(id))) {
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

  /** Every request here is a network round trip, so fan out — but not without a ceiling. */
  private async mapWithConcurrency<T, R>(
    items: T[],
    map: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = []
    for (let index = 0; index < items.length; index += READ_CONCURRENCY) {
      results.push(...(await Promise.all(items.slice(index, index + READ_CONCURRENCY).map(map))))
    }
    return results
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

  private toMediaFile(record: S3MediaRecord): MediaFile {
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

    if (
      !metadata.extension ||
      typeof metadata.extension !== 'string' ||
      !EXTENSION_PATTERN.test(metadata.extension)
    ) {
      throw new InvalidInputError('Media metadata must have a valid extension', 'extension')
    }

    if (typeof metadata.size !== 'number' || metadata.size <= 0) {
      throw new InvalidInputError('Media metadata must have a valid size', 'size')
    }
  }
}
