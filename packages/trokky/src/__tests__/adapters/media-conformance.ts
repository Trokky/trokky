/**
 * Media storage adapter conformance suite — the executable form of the media contract.
 *
 * Like `conformance.ts`, this file is deliberately NOT named `*.test.ts`: vitest picks up only
 * `src/**\/*.test.ts`, so the spec runs solely through the thin per-adapter runners
 * (`media-conformance.filesystem.test.ts`, `media-conformance.r2.test.ts`).
 *
 * What is pinned here is what `MediaService` and the media routes actually depend on, not
 * whatever the filesystem adapter happens to do today. Where the two would differ, the caller's
 * need wins — for example `getVariantContent` is specified against the real upload flow
 * (saveVariantFile, then updateFile recording `imageVariants`) because that is the only order
 * the service ever produces.
 *
 * Optional interface methods are NOT probed at runtime. An adapter declares its capabilities in
 * the runner, so a method quietly going missing turns into a failing runner rather than a
 * silently skipped test.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type {
  MediaStorageAdapter,
  MediaListOptions
} from '../../core/types/storage-adapters.js'
import type { MediaFile, MediaMetadata } from '../../core/types/index.js'

/**
 * What the adapter under test implements beyond the required surface.
 *
 * Every flag defaults to false: a runner must opt in, so adding a capability to an adapter
 * without claiming it here shows up as untested rather than as a pass.
 */
export interface MediaAdapterCapabilities {
  /** `fileExists(id)` */
  fileExists?: boolean
  /** `getFileSize(id)` */
  getFileSize?: boolean
  /** `listVariants(parentId)` */
  listVariants?: boolean
  /** `deleteVariant(parentId, name)` */
  deleteVariant?: boolean
  /** `getStorageInfo()` */
  getStorageInfo?: boolean
  /**
   * `listMedia` honours `sizeRange` / `dateRange` / `contentType`. Backends that page through
   * an object listing without an index may serve filters only over the current page.
   */
  listFilters?: boolean
}

export interface MediaAdapterConformanceHooks {
  /** A brand new, completely empty adapter. Called before every test. */
  createAdapter: () => Promise<MediaStorageAdapter>
  /** Dispose of everything the matching createAdapter() produced. Called after every test. */
  teardown: (adapter: MediaStorageAdapter) => Promise<void>
  /** Optional methods this adapter implements. Anything unset is treated as not implemented. */
  capabilities?: MediaAdapterCapabilities
}

/** Object stores are network-backed and every test starts from an empty bucket. */
const TEST_TIMEOUT = 60_000

/** Creation timestamps are compared for ordering, so fixtures need distinguishable times. */
const TIME_GAP_MS = 20

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

/** Bytes that are not valid UTF-8, so a backend that round-trips through a string corrupts them. */
const BINARY_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0xfe, 0x00, 0x01])

function bytes(content: string | Uint8Array): Uint8Array {
  return typeof content === 'string' ? new TextEncoder().encode(content) : content
}

function fileFrom(content: string | Uint8Array, name: string, type: string): File {
  const data = bytes(content)
  // Copy into a standalone ArrayBuffer so the File owns bytes no test can mutate underneath it.
  const copy = new Uint8Array(data.length)
  copy.set(data)
  return new File([copy], name, { type })
}

function metadataFor(
  id: string,
  content: string | Uint8Array,
  overrides: Partial<MediaMetadata> = {}
): MediaMetadata {
  const data = bytes(content)
  return {
    id,
    filename: 'photo.png',
    contentType: 'image/png',
    size: data.length,
    extension: 'png',
    ...overrides
  }
}

/** Read a field off the free-form `metadata` bag a MediaFile carries. */
const meta = (file: MediaFile | null, key: string): unknown => file?.metadata?.[key]

function expectSameBytes(actual: ArrayBuffer | null, expected: string | Uint8Array): void {
  expect(actual).not.toBeNull()
  expect(Array.from(new Uint8Array(actual as ArrayBuffer))).toEqual(Array.from(bytes(expected)))
}

export function describeMediaAdapterConformance(
  adapterName: string,
  hooks: MediaAdapterConformanceHooks
): void {
  const can: Required<MediaAdapterCapabilities> = {
    fileExists: false,
    getFileSize: false,
    listVariants: false,
    deleteVariant: false,
    getStorageInfo: false,
    listFilters: false,
    ...hooks.capabilities
  }

  describe(`${adapterName} media conformance`, () => {
    let adapter: MediaStorageAdapter

    beforeEach(async () => {
      adapter = await hooks.createAdapter()
    }, TEST_TIMEOUT)

    afterEach(async () => {
      await hooks.teardown(adapter)
    }, TEST_TIMEOUT)

    /** Upload a file and hand back both the record and the bytes that went in. */
    async function upload(
      id: string,
      content: string | Uint8Array = 'hello',
      overrides: Partial<MediaMetadata> = {}
    ): Promise<MediaFile> {
      const metadata = metadataFor(id, content, overrides)
      return adapter.uploadFile(
        fileFrom(content, metadata.filename, metadata.contentType),
        metadata
      )
    }

    // ========================================================================
    // UPLOAD
    // ========================================================================

    describe('uploadFile', () => {
      it('returns a record echoing the metadata it was given', async () => {
        const uploaded = await upload('media_upload_echo', 'hello world', {
          filename: 'greeting.txt',
          contentType: 'text/plain',
          extension: 'txt'
        })

        expect(uploaded.id).toBe('media_upload_echo')
        expect(uploaded.filename).toBe('greeting.txt')
        expect(uploaded.contentType).toBe('text/plain')
        expect(uploaded.size).toBe('hello world'.length)
        expect(uploaded._createdAt).toBeInstanceOf(Date)
        expect(Number.isNaN(uploaded._createdAt.getTime())).toBe(false)
      }, TEST_TIMEOUT)

      it('carries the extension and original filename in the metadata bag', async () => {
        const uploaded = await upload('media_upload_bag', 'x', {
          filename: 'Vue d’ensemble.png'
        })

        expect(meta(uploaded, 'extension')).toBe('png')
        expect(meta(uploaded, 'originalFilename')).toBe('Vue d’ensemble.png')
      }, TEST_TIMEOUT)

      it('stores the bytes so they read back identically', async () => {
        await upload('media_upload_roundtrip', 'the quick brown fox')
        expectSameBytes(await adapter.getFileContent('media_upload_roundtrip'), 'the quick brown fox')
      }, TEST_TIMEOUT)

      it('stores binary content without passing it through a text encoding', async () => {
        await upload('media_upload_binary', BINARY_BYTES)
        expectSameBytes(await adapter.getFileContent('media_upload_binary'), BINARY_BYTES)
      }, TEST_TIMEOUT)

      it('makes the file retrievable by id', async () => {
        await upload('media_upload_get', 'content')
        const stored = await adapter.getFile('media_upload_get')

        expect(stored).not.toBeNull()
        expect(stored!.id).toBe('media_upload_get')
        expect(stored!.filename).toBe('photo.png')
        expect(stored!.contentType).toBe('image/png')
        expect(stored!.size).toBe('content'.length)
      }, TEST_TIMEOUT)

      it('replaces content when the same id is uploaded again', async () => {
        await upload('media_upload_replace', 'first')
        await upload('media_upload_replace', 'second', { filename: 'second.png' })

        expectSameBytes(await adapter.getFileContent('media_upload_replace'), 'second')
        const stored = await adapter.getFile('media_upload_replace')
        expect(stored!.filename).toBe('second.png')

        // One id is one file: re-uploading must not leave a second listing behind.
        const listed = await adapter.listMedia()
        expect(listed.items.filter(item => item.id === 'media_upload_replace')).toHaveLength(1)
      }, TEST_TIMEOUT)

      it('clears derived metadata when the same id is uploaded again', async () => {
        await upload('media_upload_reset')
        await adapter.updateFile('media_upload_reset', {
          title: 'about the old bytes',
          imageVariants: { thumbnail: { width: 150, height: 150, format: 'webp', size: 10 } }
        })
        await upload('media_upload_reset', 'different bytes entirely')

        // New content, so anything derived from the old content must not survive to describe it.
        const stored = await adapter.getFile('media_upload_reset')
        expect(meta(stored, 'imageVariants')).toBeUndefined()
        expect(meta(stored, 'title')).toBeUndefined()
      }, TEST_TIMEOUT)

      it('rejects metadata missing an id', async () => {
        await expect(
          adapter.uploadFile(fileFrom('x', 'a.png', 'image/png'), metadataFor('', 'x'))
        ).rejects.toThrow()
      }, TEST_TIMEOUT)

      it('rejects metadata missing a filename', async () => {
        await expect(
          adapter.uploadFile(
            fileFrom('x', 'a.png', 'image/png'),
            metadataFor('media_no_filename', 'x', { filename: '' })
          )
        ).rejects.toThrow()
      }, TEST_TIMEOUT)

      it('rejects metadata missing a content type', async () => {
        await expect(
          adapter.uploadFile(
            fileFrom('x', 'a.png', 'image/png'),
            metadataFor('media_no_type', 'x', { contentType: '' })
          )
        ).rejects.toThrow()
      }, TEST_TIMEOUT)

      it('rejects metadata missing an extension', async () => {
        await expect(
          adapter.uploadFile(
            fileFrom('x', 'a.png', 'image/png'),
            metadataFor('media_no_ext', 'x', { extension: '' })
          )
        ).rejects.toThrow()
      }, TEST_TIMEOUT)

      it('rejects a non-positive size', async () => {
        await expect(
          adapter.uploadFile(
            fileFrom('x', 'a.png', 'image/png'),
            metadataFor('media_no_size', 'x', { size: 0 })
          )
        ).rejects.toThrow()
      }, TEST_TIMEOUT)

      it('rejects an id that tries to escape the media root', async () => {
        await expect(
          adapter.uploadFile(
            fileFrom('x', 'a.png', 'image/png'),
            metadataFor('../../etc/passwd', 'x')
          )
        ).rejects.toThrow()
      }, TEST_TIMEOUT)

      it('rejects an extension that tries to escape the media root', async () => {
        await expect(
          adapter.uploadFile(
            fileFrom('x', 'a.png', 'image/png'),
            metadataFor('media_bad_ext', 'x', { extension: '../../../etc/passwd' })
          )
        ).rejects.toThrow()
      }, TEST_TIMEOUT)
    })

    // ========================================================================
    // READ
    // ========================================================================

    describe('getFile', () => {
      it('returns null for an unknown id', async () => {
        expect(await adapter.getFile('media_never_stored')).toBeNull()
      }, TEST_TIMEOUT)

      it('rejects an id that tries to escape the media root', async () => {
        await expect(adapter.getFile('../../etc/passwd')).rejects.toThrow()
      }, TEST_TIMEOUT)

      it('returns a Date, not a string, for _createdAt', async () => {
        await upload('media_created_at')
        const stored = await adapter.getFile('media_created_at')
        expect(stored!._createdAt).toBeInstanceOf(Date)
      }, TEST_TIMEOUT)
    })

    describe('getFileContent', () => {
      it('returns null for an unknown id', async () => {
        expect(await adapter.getFileContent('media_never_stored')).toBeNull()
      }, TEST_TIMEOUT)

      it('returns an ArrayBuffer of exactly the stored length', async () => {
        await upload('media_content_length', BINARY_BYTES)
        const content = await adapter.getFileContent('media_content_length')
        expect(content).toBeInstanceOf(ArrayBuffer)
        expect(content!.byteLength).toBe(BINARY_BYTES.length)
      }, TEST_TIMEOUT)
    })

    // ========================================================================
    // METADATA UPDATE
    // ========================================================================

    describe('updateFile', () => {
      it('merges new fields into the metadata bag', async () => {
        await upload('media_update_merge')
        await adapter.updateFile('media_update_merge', {
          title: 'Séance plénière',
          alt: 'Les magistrats en séance',
          author: 'Service communication',
          credit: 'CdC',
          tags: ['plénière', '2026']
        })

        const stored = await adapter.getFile('media_update_merge')
        expect(meta(stored, 'title')).toBe('Séance plénière')
        expect(meta(stored, 'alt')).toBe('Les magistrats en séance')
        expect(meta(stored, 'author')).toBe('Service communication')
        expect(meta(stored, 'credit')).toBe('CdC')
        expect(meta(stored, 'tags')).toEqual(['plénière', '2026'])
      }, TEST_TIMEOUT)

      it('leaves fields it was not given alone', async () => {
        await upload('media_update_partial')
        await adapter.updateFile('media_update_partial', { title: 'first' })
        await adapter.updateFile('media_update_partial', { alt: 'second' })

        const stored = await adapter.getFile('media_update_partial')
        expect(meta(stored, 'title')).toBe('first')
        expect(meta(stored, 'alt')).toBe('second')
      }, TEST_TIMEOUT)

      it('returns the updated record', async () => {
        await upload('media_update_returns')
        const returned = await adapter.updateFile('media_update_returns', { title: 'returned' })

        expect(returned.id).toBe('media_update_returns')
        expect(meta(returned, 'title')).toBe('returned')
      }, TEST_TIMEOUT)

      it('refuses to change the id', async () => {
        await upload('media_update_id')
        const returned = await adapter.updateFile('media_update_id', { id: 'media_somewhere_else' })

        expect(returned.id).toBe('media_update_id')
        expect(await adapter.getFile('media_somewhere_else')).toBeNull()
      }, TEST_TIMEOUT)

      it('does not disturb the stored bytes', async () => {
        await upload('media_update_bytes', BINARY_BYTES)
        await adapter.updateFile('media_update_bytes', { title: 'still binary' })

        expectSameBytes(await adapter.getFileContent('media_update_bytes'), BINARY_BYTES)
      }, TEST_TIMEOUT)

      it('throws for an unknown id', async () => {
        await expect(adapter.updateFile('media_never_stored', { title: 'x' })).rejects.toThrow()
      }, TEST_TIMEOUT)

      it('round-trips the nested shapes the image pipeline writes', async () => {
        await upload('media_update_variants')
        await adapter.updateFile('media_update_variants', {
          imageVariants: {
            thumbnail: { width: 150, height: 150, format: 'webp', size: 4096 },
            large: { width: 1600, height: 900, format: 'webp', size: 204800 }
          },
          originalDimensions: { width: 4032, height: 3024 }
        })

        const stored = await adapter.getFile('media_update_variants')
        const variants = meta(stored, 'imageVariants') as Record<string, Record<string, unknown>>
        expect(Object.keys(variants).sort()).toEqual(['large', 'thumbnail'])
        expect(variants.thumbnail.width).toBe(150)
        expect(variants.thumbnail.format).toBe('webp')
        expect(variants.large.size).toBe(204800)
        expect(meta(stored, 'originalDimensions')).toEqual({ width: 4032, height: 3024 })
      }, TEST_TIMEOUT)
    })

    // ========================================================================
    // DELETE
    // ========================================================================

    describe('deleteFile', () => {
      it('removes the record and the bytes', async () => {
        await upload('media_delete_both')
        await adapter.deleteFile('media_delete_both')

        expect(await adapter.getFile('media_delete_both')).toBeNull()
        expect(await adapter.getFileContent('media_delete_both')).toBeNull()
      }, TEST_TIMEOUT)

      it('removes it from the listing', async () => {
        await upload('media_delete_listed')
        await upload('media_delete_kept')
        await adapter.deleteFile('media_delete_listed')

        const listed = await adapter.listMedia()
        expect(listed.items.map(item => item.id)).toEqual(['media_delete_kept'])
        expect(listed.total).toBe(1)
      }, TEST_TIMEOUT)

      it('throws for an unknown id', async () => {
        await expect(adapter.deleteFile('media_never_stored')).rejects.toThrow()
      }, TEST_TIMEOUT)

      it('frees the id for reuse', async () => {
        await upload('media_delete_reuse', 'before')
        await adapter.deleteFile('media_delete_reuse')
        await upload('media_delete_reuse', 'after')

        expectSameBytes(await adapter.getFileContent('media_delete_reuse'), 'after')
      }, TEST_TIMEOUT)
    })

    // ========================================================================
    // LISTING
    // ========================================================================

    describe('listMedia', () => {
      /** Three files, distinguishable on every sortable axis, created oldest-first. */
      async function seedThree(): Promise<void> {
        await upload('media_list_c', 'ccc', {
          filename: 'charlie.png',
          contentType: 'image/png',
          extension: 'png'
        })
        await sleep(TIME_GAP_MS)
        await upload('media_list_a', 'a', {
          filename: 'alpha.pdf',
          contentType: 'application/pdf',
          extension: 'pdf'
        })
        await sleep(TIME_GAP_MS)
        await upload('media_list_b', 'bb', {
          filename: 'bravo.jpg',
          contentType: 'image/jpeg',
          extension: 'jpg'
        })
      }

      const ids = (result: { items: MediaFile[] }): string[] => result.items.map(item => item.id)

      it('returns an empty result for an empty store', async () => {
        expect(await adapter.listMedia()).toEqual({ items: [], total: 0 })
      }, TEST_TIMEOUT)

      it('returns every file with a total', async () => {
        await seedThree()
        const listed = await adapter.listMedia()

        expect(listed.items).toHaveLength(3)
        expect(listed.total).toBe(3)
        expect(ids(listed).sort()).toEqual(['media_list_a', 'media_list_b', 'media_list_c'])
      }, TEST_TIMEOUT)

      it('defaults to newest first', async () => {
        await seedThree()
        expect(ids(await adapter.listMedia())).toEqual([
          'media_list_b',
          'media_list_a',
          'media_list_c'
        ])
      }, TEST_TIMEOUT)

      it('sorts by name', async () => {
        await seedThree()
        expect(ids(await adapter.listMedia({ sort: 'name', sortDirection: 'asc' }))).toEqual([
          'media_list_a',
          'media_list_b',
          'media_list_c'
        ])
        expect(ids(await adapter.listMedia({ sort: 'name', sortDirection: 'desc' }))).toEqual([
          'media_list_c',
          'media_list_b',
          'media_list_a'
        ])
      }, TEST_TIMEOUT)

      it('sorts by size', async () => {
        await seedThree()
        expect(ids(await adapter.listMedia({ sort: 'size', sortDirection: 'asc' }))).toEqual([
          'media_list_a',
          'media_list_b',
          'media_list_c'
        ])
      }, TEST_TIMEOUT)

      it('sorts by content type', async () => {
        await seedThree()
        // application/pdf, image/jpeg, image/png
        expect(ids(await adapter.listMedia({ sort: 'type', sortDirection: 'asc' }))).toEqual([
          'media_list_a',
          'media_list_b',
          'media_list_c'
        ])
      }, TEST_TIMEOUT)

      it('sorts by date ascending when asked', async () => {
        await seedThree()
        expect(ids(await adapter.listMedia({ sort: 'date', sortDirection: 'asc' }))).toEqual([
          'media_list_c',
          'media_list_a',
          'media_list_b'
        ])
      }, TEST_TIMEOUT)

      it('applies limit and offset against the sorted order', async () => {
        await seedThree()
        const page = await adapter.listMedia({ sort: 'name', sortDirection: 'asc', limit: 2 })
        expect(ids(page)).toEqual(['media_list_a', 'media_list_b'])

        const next = await adapter.listMedia({
          sort: 'name',
          sortDirection: 'asc',
          limit: 2,
          offset: 2
        })
        expect(ids(next)).toEqual(['media_list_c'])
      }, TEST_TIMEOUT)

      it('reports the unpaginated total alongside a page', async () => {
        await seedThree()
        const page = await adapter.listMedia({ limit: 1 })

        expect(page.items).toHaveLength(1)
        expect(page.total).toBe(3)
      }, TEST_TIMEOUT)

      it('returns an empty page past the end without failing', async () => {
        await seedThree()
        const page = await adapter.listMedia({ offset: 99 })

        expect(page.items).toEqual([])
        expect(page.total).toBe(3)
      }, TEST_TIMEOUT)

      if (can.listFilters) {
        it('filters by content type prefix', async () => {
          await seedThree()
          const images = await adapter.listMedia({ contentType: 'image/' })

          expect(ids(images).sort()).toEqual(['media_list_b', 'media_list_c'])
          expect(images.total).toBe(2)
        }, TEST_TIMEOUT)

        it('filters by an exact content type', async () => {
          await seedThree()
          expect(ids(await adapter.listMedia({ contentType: 'application/pdf' }))).toEqual([
            'media_list_a'
          ])
        }, TEST_TIMEOUT)

        it('filters by size range', async () => {
          await seedThree()
          const mid = await adapter.listMedia({ sizeRange: { min: 2, max: 2 } })

          expect(ids(mid)).toEqual(['media_list_b'])
          expect(mid.total).toBe(1)
        }, TEST_TIMEOUT)

        it('filters by date range', async () => {
          await seedThree()
          const all = await adapter.listMedia({ sort: 'date', sortDirection: 'asc' })
          const secondCreatedAt = all.items[1]._createdAt

          const fromSecond = await adapter.listMedia({ dateRange: { from: secondCreatedAt } })
          expect(ids(fromSecond).sort()).toEqual(['media_list_a', 'media_list_b'])

          const toSecond = await adapter.listMedia({ dateRange: { to: secondCreatedAt } })
          expect(ids(toSecond).sort()).toEqual(['media_list_a', 'media_list_c'])
        }, TEST_TIMEOUT)

        it('counts the filtered set, not the whole store, when paginating', async () => {
          await seedThree()
          const page = await adapter.listMedia({ contentType: 'image/', limit: 1 })

          expect(page.items).toHaveLength(1)
          expect(page.total).toBe(2)
        }, TEST_TIMEOUT)

        it('returns nothing when a filter matches nothing', async () => {
          await seedThree()
          const none = await adapter.listMedia({ contentType: 'video/mp4' } as MediaListOptions)

          expect(none.items).toEqual([])
          expect(none.total).toBe(0)
        }, TEST_TIMEOUT)
      }

      it('carries the metadata bag into listed items', async () => {
        await upload('media_list_meta')
        await adapter.updateFile('media_list_meta', { title: 'listed title' })

        const listed = await adapter.listMedia()
        const item = listed.items.find(entry => entry.id === 'media_list_meta')
        expect(meta(item ?? null, 'title')).toBe('listed title')
      }, TEST_TIMEOUT)
    })

    // ========================================================================
    // VARIANTS
    // ========================================================================

    describe('variants', () => {
      const VARIANT_BYTES = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0xff, 0x10])

      /**
       * Attach a variant to a parent that is already uploaded, in the only order MediaService
       * ever produces: save the variant bytes, then record the variant in the parent's metadata.
       */
      async function addVariant(
        id: string,
        variantName = 'thumbnail',
        buffer: Buffer = VARIANT_BYTES,
        format = 'webp'
      ): Promise<void> {
        await adapter.saveVariantFile(id, variantName, buffer, format)
        const existing = (await adapter.getFile(id))?.metadata?.imageVariants as
          | Record<string, unknown>
          | undefined
        await adapter.updateFile(id, {
          imageVariants: {
            ...(existing ?? {}),
            [variantName]: { width: 150, height: 150, format, size: buffer.length }
          }
        })
      }

      /** Upload a parent and give it one variant. */
      async function uploadWithVariant(
        id: string,
        variantName = 'thumbnail',
        buffer: Buffer = VARIANT_BYTES,
        format = 'webp'
      ): Promise<void> {
        await upload(id)
        await addVariant(id, variantName, buffer, format)
      }

      it('saveVariantFile returns a non-empty locator', async () => {
        await upload('media_variant_locator')
        const locator = await adapter.saveVariantFile(
          'media_variant_locator',
          'thumbnail',
          VARIANT_BYTES,
          'webp'
        )

        expect(typeof locator).toBe('string')
        expect(locator.length).toBeGreaterThan(0)
      }, TEST_TIMEOUT)

      it('reads a saved variant back byte for byte', async () => {
        await uploadWithVariant('media_variant_bytes')
        expectSameBytes(
          await adapter.getVariantContent('media_variant_bytes', 'thumbnail'),
          VARIANT_BYTES
        )
      }, TEST_TIMEOUT)

      it('returns null for a variant that was never saved', async () => {
        await upload('media_variant_missing')
        expect(await adapter.getVariantContent('media_variant_missing', 'thumbnail')).toBeNull()
      }, TEST_TIMEOUT)

      it('returns null for a variant of an unknown parent', async () => {
        expect(await adapter.getVariantContent('media_never_stored', 'thumbnail')).toBeNull()
      }, TEST_TIMEOUT)

      it('keeps variants of different parents apart', async () => {
        const first = Buffer.from('first-variant')
        const second = Buffer.from('second-variant')
        await uploadWithVariant('media_variant_parent_a', 'thumbnail', first)
        await uploadWithVariant('media_variant_parent_b', 'thumbnail', second)

        expectSameBytes(
          await adapter.getVariantContent('media_variant_parent_a', 'thumbnail'),
          first
        )
        expectSameBytes(
          await adapter.getVariantContent('media_variant_parent_b', 'thumbnail'),
          second
        )
      }, TEST_TIMEOUT)

      it('keeps several variants of one parent apart', async () => {
        const thumb = Buffer.from('thumb-bytes')
        const large = Buffer.from('large-bytes-are-longer')
        await uploadWithVariant('media_variant_many', 'thumbnail', thumb)
        await addVariant('media_variant_many', 'large', large)

        expectSameBytes(await adapter.getVariantContent('media_variant_many', 'thumbnail'), thumb)
        expectSameBytes(await adapter.getVariantContent('media_variant_many', 'large'), large)
      }, TEST_TIMEOUT)

      it('overwrites a variant re-saved under the same name', async () => {
        await uploadWithVariant('media_variant_overwrite', 'thumbnail', Buffer.from('old'))
        await adapter.saveVariantFile(
          'media_variant_overwrite',
          'thumbnail',
          Buffer.from('new'),
          'webp'
        )

        expectSameBytes(
          await adapter.getVariantContent('media_variant_overwrite', 'thumbnail'),
          Buffer.from('new')
        )
      }, TEST_TIMEOUT)

      it('does not touch the original when a variant is saved', async () => {
        await upload('media_variant_original', BINARY_BYTES)
        await adapter.saveVariantFile(
          'media_variant_original',
          'thumbnail',
          VARIANT_BYTES,
          'webp'
        )

        expectSameBytes(await adapter.getFileContent('media_variant_original'), BINARY_BYTES)
      }, TEST_TIMEOUT)

      it('rejects a parent id that tries to escape the media root', async () => {
        await expect(
          adapter.saveVariantFile('../../etc', 'thumbnail', VARIANT_BYTES, 'webp')
        ).rejects.toThrow()
      }, TEST_TIMEOUT)

      it('rejects a variant name that tries to escape the media root', async () => {
        await upload('media_variant_escape')
        await expect(
          adapter.saveVariantFile('media_variant_escape', '../../etc/passwd', VARIANT_BYTES, 'webp')
        ).rejects.toThrow()
      }, TEST_TIMEOUT)

      it('deleteVariantFiles removes every variant of a parent', async () => {
        await uploadWithVariant('media_variant_purge', 'thumbnail')
        await addVariant('media_variant_purge', 'large')
        await adapter.deleteVariantFiles('media_variant_purge')

        expect(await adapter.getVariantContent('media_variant_purge', 'thumbnail')).toBeNull()
        expect(await adapter.getVariantContent('media_variant_purge', 'large')).toBeNull()
      }, TEST_TIMEOUT)

      it('deleteVariantFiles leaves the original alone', async () => {
        await uploadWithVariant('media_variant_purge_keep')
        await adapter.deleteVariantFiles('media_variant_purge_keep')

        expect(await adapter.getFile('media_variant_purge_keep')).not.toBeNull()
        expectSameBytes(await adapter.getFileContent('media_variant_purge_keep'), 'hello')
      }, TEST_TIMEOUT)

      it('deleteVariantFiles is a no-op for a parent with no variants', async () => {
        await upload('media_variant_purge_none')
        await expect(adapter.deleteVariantFiles('media_variant_purge_none')).resolves.toBeUndefined()
      }, TEST_TIMEOUT)

      it('deleteVariantFiles is a no-op for an unknown parent', async () => {
        await expect(adapter.deleteVariantFiles('media_never_stored')).resolves.toBeUndefined()
      }, TEST_TIMEOUT)

      it('deleting the original takes its variants with it', async () => {
        await uploadWithVariant('media_variant_cascade')
        await adapter.deleteFile('media_variant_cascade')

        expect(await adapter.getVariantContent('media_variant_cascade', 'thumbnail')).toBeNull()
      }, TEST_TIMEOUT)

      if (can.deleteVariant) {
        it('deleteVariant removes one variant and leaves the rest', async () => {
          await uploadWithVariant('media_variant_one', 'thumbnail')
          await addVariant('media_variant_one', 'large')
          await adapter.deleteVariant!('media_variant_one', 'thumbnail')

          expect(await adapter.getVariantContent('media_variant_one', 'thumbnail')).toBeNull()
          expect(await adapter.getVariantContent('media_variant_one', 'large')).not.toBeNull()
        }, TEST_TIMEOUT)
      }

      if (can.listVariants) {
        it('listVariants reports what was saved', async () => {
          await uploadWithVariant('media_variant_list', 'thumbnail')
          await addVariant('media_variant_list', 'large')

          const variants = await adapter.listVariants!('media_variant_list')
          expect(variants.map(variant => variant.name).sort()).toEqual(['large', 'thumbnail'])
          for (const variant of variants) {
            expect(variant.format).toBe('webp')
            expect(variant.size).toBeGreaterThan(0)
            expect(variant.createdAt).toBeInstanceOf(Date)
          }
        }, TEST_TIMEOUT)

        it('listVariants returns nothing for a parent with no variants', async () => {
          await upload('media_variant_list_none')
          expect(await adapter.listVariants!('media_variant_list_none')).toEqual([])
        }, TEST_TIMEOUT)
      }
    })

    // ========================================================================
    // OPTIONAL SURFACE
    // ========================================================================

    if (can.fileExists) {
      describe('fileExists', () => {
        it('is true for a stored file and false otherwise', async () => {
          await upload('media_exists')

          expect(await adapter.fileExists!('media_exists')).toBe(true)
          expect(await adapter.fileExists!('media_never_stored')).toBe(false)
        }, TEST_TIMEOUT)

        it('goes false once the file is deleted', async () => {
          await upload('media_exists_deleted')
          await adapter.deleteFile('media_exists_deleted')

          expect(await adapter.fileExists!('media_exists_deleted')).toBe(false)
        }, TEST_TIMEOUT)
      })
    }

    if (can.getFileSize) {
      describe('getFileSize', () => {
        it('reports the stored byte length', async () => {
          await upload('media_size', BINARY_BYTES)
          expect(await adapter.getFileSize!('media_size')).toBe(BINARY_BYTES.length)
        }, TEST_TIMEOUT)

        it('returns null for an unknown id', async () => {
          expect(await adapter.getFileSize!('media_never_stored')).toBeNull()
        }, TEST_TIMEOUT)
      })
    }

    if (can.getStorageInfo) {
      describe('getStorageInfo', () => {
        it('counts the files and their bytes', async () => {
          await upload('media_info_one', 'aaaa')
          await upload('media_info_two', 'bb')

          const info = await adapter.getStorageInfo!()
          expect(info.totalFiles).toBe(2)
          expect(info.totalSize).toBeGreaterThanOrEqual(6)
        }, TEST_TIMEOUT)
      })
    }

    // ========================================================================
    // LIFECYCLE
    // ========================================================================

    describe('healthCheck', () => {
      it('reports a usable store', async () => {
        expect(await adapter.healthCheck()).toBe(true)
      }, TEST_TIMEOUT)
    })
  })
}
