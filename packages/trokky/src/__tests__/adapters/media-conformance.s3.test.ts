/**
 * The media conformance suite run against a REAL S3 endpoint.
 *
 * "Real" means workerd's own S3-compatible front end for local R2 buckets, which Miniflare 4
 * serves at `/cdn-cgi/local/r2/s3` when a bucket declares `s3Credentials`. So the adapter is
 * exercised over actual signed HTTP — SigV4, `ListObjectsV2` with continuation tokens,
 * `x-amz-meta-*` round-tripping, 404s — from an ordinary Node test run, with no service
 * container and nothing to skip around.
 *
 * MinIO would be higher fidelity and is worth adding behind a service container, but it must not
 * be the *only* place these run: the Postgres data runner skips silently when no server answers
 * and CI has no container for it, so those cases have never run there. This one always runs.
 *
 * Each test gets a fresh bucket, so isolation is total and teardown is disposal.
 */

import { describe, it, expect } from 'vitest'
import { Miniflare } from 'miniflare'
import type { R2Bucket } from '@cloudflare/workers-types'
import { CloudflareR2Adapter } from '../../adapters/cloudflare-r2/cloudflare-r2-adapter.js'
import { S3MediaAdapter } from '../../adapters/s3-media/s3-media-adapter.js'
import {
  encodeIndexKey,
  decodeIndexKey,
  entryPrefix,
  MAX_INDEX_KEY_BYTES
} from '../../adapters/s3-media/index-key.js'
import { parseListResponse } from '../../adapters/s3-media/s3-client.js'
import type { MediaStorageAdapter } from '../../core/types/storage-adapters.js'
import { describeMediaAdapterConformance } from './media-conformance.js'

/** Miniflare needs a script; nothing ever fetches it. We only want the bucket and its endpoint. */
const IDLE_WORKER = 'export default { fetch: () => new Response(null, { status: 204 }) }'

const CREDENTIALS = { accessKeyId: 'trokky-test', secretAccessKey: 'trokky-test-secret' }

const instancesByAdapter = new Map<MediaStorageAdapter, Miniflare>()

interface Bucket {
  mf: Miniflare
  endpoint: string
  bucket: string
}

async function createBucket(): Promise<Bucket> {
  // A unique name per test keeps two adapters from sharing storage.
  const bucket = `conformance-${Math.random().toString(36).slice(2)}`
  const mf = new Miniflare({
    modules: true,
    script: IDLE_WORKER,
    r2Buckets: { MEDIA: { id: bucket, s3Credentials: CREDENTIALS } }
  })
  const url = await mf.ready
  return { mf, endpoint: `${url.origin}/cdn-cgi/local/r2/s3`, bucket }
}

const adapterFor = (target: Bucket, overrides: Record<string, unknown> = {}): S3MediaAdapter =>
  new S3MediaAdapter({
    endpoint: target.endpoint,
    bucket: target.bucket,
    ...CREDENTIALS,
    silent: true,
    ...overrides
  })

async function createAdapter(): Promise<MediaStorageAdapter> {
  const target = await createBucket()
  const adapter = adapterFor(target)
  instancesByAdapter.set(adapter, target.mf)
  return adapter
}

async function teardown(adapter: MediaStorageAdapter): Promise<void> {
  const mf = instancesByAdapter.get(adapter)
  instancesByAdapter.delete(adapter)
  await adapter.close?.()
  await mf?.dispose()
}

describeMediaAdapterConformance('S3MediaAdapter', {
  createAdapter,
  teardown,
  capabilities: {
    fileExists: true,
    getFileSize: true,
    listVariants: true,
    deleteVariant: true,
    getStorageInfo: true,
    listFilters: true
  }
})

/**
 * Behaviour that is this adapter's alone: the key layout, presigned URLs, and the listing index
 * that only exists because `ListObjectsV2` carries no user metadata.
 */
describe('S3MediaAdapter specifics', () => {
  const upload = (adapter: MediaStorageAdapter, id: string, body = 'bytes', filename = 'photo.png') =>
    adapter.uploadFile(new File([body], filename, { type: 'image/png' }), {
      id,
      filename,
      contentType: 'image/png',
      size: body.length,
      extension: 'png'
    })

  const keys = async (target: Bucket, prefix = ''): Promise<string[]> => {
    const adapter = adapterFor(target)
    // Reach through the adapter's own client so the test signs requests the same way it does.
    const client = (adapter as unknown as { s3: { listAll(p: string): Promise<{ key: string }[]> } }).s3
    return (await client.listAll(prefix)).map(object => object.key).sort()
  }

  it('lays objects out exactly as the R2 adapter does', async () => {
    const target = await createBucket()
    try {
      const adapter = adapterFor(target)
      await upload(adapter, 'media_layout')
      await adapter.saveVariantFile('media_layout', 'thumbnail', Buffer.from('t'), 'webp')

      const all = await keys(target)
      expect(all).toContain('files/media_layout')
      expect(all).toContain('meta/media_layout.json')
      expect(all).toContain('variants/media_layout/thumbnail')
      expect(all.filter(key => key.startsWith('index/'))).toHaveLength(1)
    } finally {
      await target.mf.dispose()
    }
  })

  it('keeps every object under a configured prefix', async () => {
    const target = await createBucket()
    try {
      const adapter = adapterFor(target, { prefix: 'site-a' })
      await upload(adapter, 'media_prefixed')
      await adapter.saveVariantFile('media_prefixed', 'thumbnail', Buffer.from('t'), 'webp')

      expect((await keys(target)).every(key => key.startsWith('site-a/'))).toBe(true)
    } finally {
      await target.mf.dispose()
    }
  })

  it('isolates two installs sharing one bucket', async () => {
    const target = await createBucket()
    try {
      const a = adapterFor(target, { prefix: 'site-a' })
      const b = adapterFor(target, { prefix: 'site-b' })
      await upload(a, 'media_shared_id', 'from-a')
      await upload(b, 'media_shared_id', 'from-b')

      expect(new TextDecoder().decode((await a.getFileContent('media_shared_id'))!)).toBe('from-a')
      expect(new TextDecoder().decode((await b.getFileContent('media_shared_id'))!)).toBe('from-b')
      expect((await a.listMedia()).total).toBe(1)
    } finally {
      await target.mf.dispose()
    }
  })

  it('presigns a URL when there is no public base, because SigV4 can', async () => {
    const target = await createBucket()
    try {
      const adapter = adapterFor(target)
      await upload(adapter, 'media_presigned')
      await adapter.saveVariantFile('media_presigned', 'thumbnail', Buffer.from('t'), 'webp')

      const url = await adapter.getFileUrl('media_presigned', { expiresIn: 60 })
      expect(url).toContain('X-Amz-Signature=')
      expect(url).toContain('X-Amz-Expires=60')

      // The point of a presigned URL is that it works unsigned.
      const response = await fetch(url!)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('bytes')

      expect(await adapter.getVariantUrl('media_presigned', 'thumbnail')).toContain('X-Amz-Signature=')
      expect(await adapter.getFileUrl('media_never_stored')).toBeNull()
      expect(await adapter.getVariantUrl('media_presigned', 'missing')).toBeNull()
    } finally {
      await target.mf.dispose()
    }
  })

  it('prefers a configured public base over signing', async () => {
    const target = await createBucket()
    try {
      const adapter = adapterFor(target, { publicBaseUrl: 'https://media.example.org/' })
      await upload(adapter, 'media_public')

      expect(await adapter.getFileUrl('media_public')).toBe(
        'https://media.example.org/files/media_public'
      )
    } finally {
      await target.mf.dispose()
    }
  })

  it('reclaims bytes an interrupted delete left behind', async () => {
    const target = await createBucket()
    try {
      const adapter = adapterFor(target)
      await upload(adapter, 'media_orphan')
      await adapter.saveVariantFile('media_orphan', 'thumbnail', Buffer.from('t'), 'webp')
      await upload(adapter, 'media_kept')

      const bucket = await target.mf.getR2Bucket('MEDIA')
      // Exactly what a delete that died after the record left: no record, live bytes.
      await bucket.delete('meta/media_orphan.json')

      // Two orphaned blobs plus the index entry the record no longer backs.
      expect(await adapter.cleanup()).toBe(3)
      expect(await bucket.head('files/media_orphan')).toBeNull()
      expect(await bucket.head('variants/media_orphan/thumbnail')).toBeNull()
      expect(await adapter.getFile('media_kept')).not.toBeNull()
    } finally {
      await target.mf.dispose()
    }
  })

  it('drops stale variant bytes when the same id is re-uploaded', async () => {
    const target = await createBucket()
    try {
      const adapter = adapterFor(target)
      await upload(adapter, 'media_reupload')
      await adapter.saveVariantFile('media_reupload', 'thumbnail', Buffer.from('old'), 'webp')
      await upload(adapter, 'media_reupload', 'completely different')

      // The variant described the previous bytes, so it must not survive to describe these.
      expect(await adapter.getVariantContent('media_reupload', 'thumbnail')).toBeNull()
    } finally {
      await target.mf.dispose()
    }
  })

  it('cannot be constructed without an endpoint, a bucket or credentials', () => {
    const complete = { endpoint: 'https://s3.example', bucket: 'b', ...CREDENTIALS }
    for (const missing of ['endpoint', 'bucket', 'accessKeyId', 'secretAccessKey'] as const) {
      expect(() => new S3MediaAdapter({ ...complete, [missing]: '' })).toThrow()
    }
  })
})

/**
 * The index is a cache over the records, never the enumeration.
 *
 * These are the tests that hold that line. Get it wrong and an interrupted write produces a
 * ghost: a file `getFile` serves that no listing ever shows.
 */
describe('S3MediaAdapter listing index', () => {
  const upload = (adapter: MediaStorageAdapter, id: string, filename = 'photo.png') =>
    adapter.uploadFile(new File(['bytes'], filename, { type: 'image/png' }), {
      id,
      filename,
      contentType: 'image/png',
      size: 5,
      extension: 'png'
    })

  it('lists a file whose index entry was lost, and cleanup() rebuilds it', async () => {
    const target = await createBucket()
    try {
      const adapter = adapterFor(target)
      await upload(adapter, 'media_ghost')

      const bucket = await target.mf.getR2Bucket('MEDIA')
      const indexKey = (await bucket.list({ prefix: 'index/' })).objects[0].key
      // Exactly what an upload that died between the record and the index left behind.
      await bucket.delete(indexKey)

      // The record is the authority: the file is still listed, read back from it.
      const listed = await adapter.listMedia()
      expect(listed.total).toBe(1)
      expect(listed.items[0].filename).toBe('photo.png')

      expect(await adapter.cleanup()).toBe(1)
      expect((await bucket.list({ prefix: 'index/' })).objects).toHaveLength(1)
    } finally {
      await target.mf.dispose()
    }
  })

  it('lists a bucket that has no index at all, as one written by the R2 adapter does', async () => {
    const target = await createBucket()
    try {
      const adapter = adapterFor(target)
      await upload(adapter, 'media_a', 'a.png')
      await upload(adapter, 'media_b', 'b.png')

      const bucket = await target.mf.getR2Bucket('MEDIA')
      for (const object of (await bucket.list({ prefix: 'index/' })).objects) {
        await bucket.delete(object.key)
      }

      const listed = await adapter.listMedia({ sort: 'name' })
      expect(listed.total).toBe(2)
      expect(listed.items.map(item => item.filename)).toEqual(['a.png', 'b.png'])
    } finally {
      await target.mf.dispose()
    }
  })

  it('keeps the newest entry when an id is indexed twice', async () => {
    const target = await createBucket()
    try {
      const adapter = adapterFor(target)
      await upload(adapter, 'media_dup', 'current.png')

      // What a re-upload whose old-entry delete failed leaves: two entries, one id.
      const bucket = await target.mf.getR2Bucket('MEDIA')
      const stale = encodeIndexKey('', {
        id: 'media_dup',
        filename: 'stale.png',
        contentType: 'image/png',
        size: 5,
        createdAt: new Date(Date.now() - 60_000)
      })
      await bucket.put(stale, new Uint8Array(0))

      const listed = await adapter.listMedia()
      expect(listed.total).toBe(1)
      expect(listed.items[0].filename).toBe('current.png')

      // Cleanup removes the loser rather than leaving it to be re-decided every listing.
      expect(await adapter.cleanup()).toBe(1)
      expect((await bucket.list({ prefix: 'index/' })).objects).toHaveLength(1)
    } finally {
      await target.mf.dispose()
    }
  })

  it('rewrites the entry when updateFile changes an indexed field', async () => {
    const target = await createBucket()
    try {
      const adapter = adapterFor(target)
      await upload(adapter, 'media_renamed', 'before.png')

      // contentType and size are indexed too, and updateFile can change all three.
      await adapter.updateFile('media_renamed', {
        filename: 'after.png',
        contentType: 'image/webp',
        size: 4242
      })

      const bucket = await target.mf.getR2Bucket('MEDIA')
      const entries = (await bucket.list({ prefix: 'index/' })).objects
      expect(entries).toHaveLength(1)
      expect(decodeIndexKey('', entries[0].key)).toMatchObject({
        filename: 'after.png',
        contentType: 'image/webp',
        size: 4242
      })

      // And the filters that read the index agree with the record.
      expect((await adapter.listMedia({ contentType: 'image/webp' })).total).toBe(1)
      expect((await adapter.listMedia({ sizeRange: { min: 4000 } })).total).toBe(1)
    } finally {
      await target.mf.dispose()
    }
  })

  it('stores a file whose filename is too long to encode, truncating only the index', async () => {
    const target = await createBucket()
    try {
      const adapter = adapterFor(target)
      const filename = `${'a'.repeat(4000)}.png`
      await upload(adapter, 'media_long', filename)

      const bucket = await target.mf.getR2Bucket('MEDIA')
      const [entry] = (await bucket.list({ prefix: 'index/' })).objects
      expect(entry.key.length).toBeLessThanOrEqual(MAX_INDEX_KEY_BYTES)

      // The record keeps the real name; only `sort: 'name'` loses precision for this one entry.
      expect((await adapter.getFile('media_long'))!.filename).toBe(filename)
      expect((await adapter.listMedia()).total).toBe(1)
    } finally {
      await target.mf.dispose()
    }
  })

  it('ignores an unparseable object under index/ and cleans it away', async () => {
    const target = await createBucket()
    try {
      const adapter = adapterFor(target)
      await upload(adapter, 'media_real')

      const bucket = await target.mf.getR2Bucket('MEDIA')
      await bucket.put('index/not-a-real-entry', new Uint8Array(0))

      expect((await adapter.listMedia()).total).toBe(1)
      expect(await adapter.cleanup()).toBe(1)
      expect((await bucket.list({ prefix: 'index/' })).objects).toHaveLength(1)
    } finally {
      await target.mf.dispose()
    }
  })
})

describe('index key encoding', () => {
  const entry = {
    id: 'media_abc',
    filename: 'holiday photo (1).png',
    contentType: 'image/png',
    size: 12345,
    createdAt: new Date('2026-09-15T12:00:00.000Z')
  }

  it('round-trips every field', () => {
    expect(decodeIndexKey('', encodeIndexKey('', entry))).toEqual(entry)
  })

  it('round-trips a filename that is not latin-1', () => {
    const accented = { ...entry, filename: 'été — naïve 日本語.png' }
    expect(decodeIndexKey('', encodeIndexKey('', accented))).toEqual(accented)
  })

  it('gathers one file\'s entries under a prefix, so replacing them is one listing', () => {
    const older = encodeIndexKey('', { ...entry, createdAt: new Date('2026-01-01T00:00:00Z') })
    const newer = encodeIndexKey('', { ...entry, createdAt: new Date('2026-09-15T00:00:00Z') })
    const prefix = entryPrefix('', entry.id)

    expect(older.startsWith(prefix)).toBe(true)
    expect(newer.startsWith(prefix)).toBe(true)
    // Another file's entries are not under it, so a delete by prefix cannot overreach.
    expect(encodeIndexKey('', { ...entry, id: 'media_other' }).startsWith(prefix)).toBe(false)
  })

  it('refuses keys that are not its own', () => {
    expect(decodeIndexKey('', 'meta/media_abc.json')).toBeNull()
    expect(decodeIndexKey('', 'index/')).toBeNull()
    expect(decodeIndexKey('', 'index/id/nonsense/!!!')).toBeNull()
    expect(decodeIndexKey('site-a/', encodeIndexKey('site-b/', entry))).toBeNull()
  })
})

describe('ListObjectsV2 parsing', () => {
  it('decodes url-encoded keys and reports truncation', () => {
    const xml = `<?xml version="1.0"?><ListBucketResult>
      <Contents><Key>meta%2Fa%20b.json</Key><Size>8</Size><LastModified>2026-09-15T12:00:00.000Z</LastModified></Contents>
      <Contents><Key>meta%2Fc%26d.json</Key><Size>9</Size><LastModified>2026-09-15T12:00:01.000Z</LastModified></Contents>
      <IsTruncated>true</IsTruncated><NextContinuationToken>tok%2Fen</NextContinuationToken>
    </ListBucketResult>`

    const page = parseListResponse(xml)
    expect(page.objects.map(object => object.key)).toEqual(['meta/a b.json', 'meta/c&d.json'])
    expect(page.objects[0].size).toBe(8)
    expect(page.nextToken).toBe('tok/en')
  })

  it('reports no token when the listing is complete', () => {
    const xml = '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>'
    expect(parseListResponse(xml)).toEqual({ objects: [], nextToken: undefined })
  })
})

/**
 * The two adapters over one bucket.
 *
 * This is the migration story as a test: a Workers install that moves to Node keeps its bucket.
 * It is also the strongest statement of the rule in `listMedia` — an R2-written bucket contains
 * no `index/` objects at all, so every id here is a cache miss and the whole listing comes from
 * the records. If the index were ever the enumeration, this would return nothing.
 */
describe('R2 and S3 adapters over one bucket', () => {
  it('reads with the S3 adapter what the R2 adapter wrote', async () => {
    const target = await createBucket()
    try {
      const bucket = (await target.mf.getR2Bucket('MEDIA')) as unknown as R2Bucket
      const r2 = new CloudflareR2Adapter({ bucket, silent: true })
      const s3 = adapterFor(target)

      await r2.uploadFile(new File(['from-r2'], 'written-by-r2.png', { type: 'image/png' }), {
        id: 'media_interop',
        filename: 'written-by-r2.png',
        contentType: 'image/png',
        size: 7,
        extension: 'png'
      })
      await r2.saveVariantFile('media_interop', 'thumbnail', Buffer.from('thumb'), 'webp')

      expect((await bucket.list({ prefix: 'index/' })).objects).toHaveLength(0)

      const file = await s3.getFile('media_interop')
      expect(file?.filename).toBe('written-by-r2.png')
      expect(new TextDecoder().decode((await s3.getFileContent('media_interop'))!)).toBe('from-r2')

      const listed = await s3.listMedia()
      expect(listed.total).toBe(1)
      expect(listed.items[0].id).toBe('media_interop')

      const variants = await s3.listVariants('media_interop')
      expect(variants).toHaveLength(1)
      expect(variants[0]).toMatchObject({ name: 'thumbnail', format: 'webp' })

      // And the reverse: what S3 writes, R2 lists.
      await s3.uploadFile(new File(['from-s3'], 'written-by-s3.png', { type: 'image/png' }), {
        id: 'media_interop_back',
        filename: 'written-by-s3.png',
        contentType: 'image/png',
        size: 7,
        extension: 'png'
      })
      expect((await r2.listMedia()).total).toBe(2)
      expect((await r2.getFile('media_interop_back'))!.filename).toBe('written-by-s3.png')
    } finally {
      await target.mf.dispose()
    }
  })
})
