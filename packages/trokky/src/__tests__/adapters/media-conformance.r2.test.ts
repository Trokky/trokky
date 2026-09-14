/**
 * The media conformance suite run against a REAL R2 bucket.
 *
 * "Real" means workerd's own R2 implementation via Miniflare, not a Map standing in for one:
 * the suite exercises actual R2 semantics — listing pagination and truncation, customMetadata
 * round-tripping, multi-key delete, `get` returning null rather than throwing — from an
 * ordinary Node test run, exactly as the D1 runner does for data.
 *
 * Each test gets a fresh bucket, so isolation is total and teardown is disposal. There is
 * nothing to skip around: no external dependency, so this always runs.
 */

import { describe, it, expect } from 'vitest'
import { Miniflare } from 'miniflare'
import type { R2Bucket } from '@cloudflare/workers-types'
import { CloudflareR2Adapter } from '../../adapters/cloudflare-r2/cloudflare-r2-adapter.js'
import type { MediaStorageAdapter } from '../../core/types/storage-adapters.js'
import { describeMediaAdapterConformance } from './media-conformance.js'

/** Miniflare needs a script; nothing ever fetches it. We only want the binding. */
const IDLE_WORKER = 'export default { fetch: () => new Response(null, { status: 204 }) }'

const instancesByAdapter = new Map<MediaStorageAdapter, Miniflare>()

async function createBucket(): Promise<{ mf: Miniflare; bucket: R2Bucket }> {
  const mf = new Miniflare({
    modules: true,
    script: IDLE_WORKER,
    // A unique name per test keeps two adapters from sharing storage.
    r2Buckets: { MEDIA: `conformance-${Math.random().toString(36).slice(2)}` }
  })
  return { mf, bucket: (await mf.getR2Bucket('MEDIA')) as unknown as R2Bucket }
}

async function createAdapter(): Promise<MediaStorageAdapter> {
  const { mf, bucket } = await createBucket()
  const adapter = new CloudflareR2Adapter({ bucket, silent: true })
  instancesByAdapter.set(adapter, mf)
  return adapter
}

async function teardown(adapter: MediaStorageAdapter): Promise<void> {
  const mf = instancesByAdapter.get(adapter)
  instancesByAdapter.delete(adapter)
  await adapter.close?.()
  await mf?.dispose()
}

describeMediaAdapterConformance('CloudflareR2Adapter', {
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
 * Behaviour that is R2's alone, so it has no place in the shared contract: key layout,
 * public URLs, and reclaiming what an interrupted write left behind.
 */
describe('CloudflareR2Adapter specifics', () => {
  const upload = (adapter: MediaStorageAdapter, id: string, body = 'bytes'): Promise<unknown> =>
    adapter.uploadFile(new File([body], 'photo.png', { type: 'image/png' }), {
      id,
      filename: 'photo.png',
      contentType: 'image/png',
      size: body.length,
      extension: 'png'
    })

  it('keeps every object under a configured prefix', async () => {
    const { mf, bucket } = await createBucket()
    try {
      const adapter = new CloudflareR2Adapter({ bucket, prefix: 'site-a', silent: true })
      await upload(adapter, 'media_prefixed')
      await adapter.saveVariantFile('media_prefixed', 'thumbnail', Buffer.from('t'), 'webp')

      const keys = (await bucket.list({ limit: 100 })).objects.map(object => object.key)
      expect(keys.every(key => key.startsWith('site-a/'))).toBe(true)
      expect(keys.sort()).toEqual([
        'site-a/files/media_prefixed',
        'site-a/meta/media_prefixed.json',
        'site-a/variants/media_prefixed/thumbnail'
      ])
    } finally {
      await mf.dispose()
    }
  })

  it('isolates two installs sharing one bucket', async () => {
    const { mf, bucket } = await createBucket()
    try {
      const a = new CloudflareR2Adapter({ bucket, prefix: 'site-a', silent: true })
      const b = new CloudflareR2Adapter({ bucket, prefix: 'site-b', silent: true })
      await upload(a, 'media_shared_id', 'from-a')
      await upload(b, 'media_shared_id', 'from-b')

      expect(new TextDecoder().decode((await a.getFileContent('media_shared_id'))!)).toBe('from-a')
      expect(new TextDecoder().decode((await b.getFileContent('media_shared_id'))!)).toBe('from-b')
      expect((await a.listMedia()).total).toBe(1)
    } finally {
      await mf.dispose()
    }
  })

  it('has no URL to give without a public base, because a binding cannot presign', async () => {
    const { mf, bucket } = await createBucket()
    try {
      const adapter = new CloudflareR2Adapter({ bucket, silent: true })
      await upload(adapter, 'media_no_url')
      await adapter.saveVariantFile('media_no_url', 'thumbnail', Buffer.from('t'), 'webp')

      expect(await adapter.getFileUrl('media_no_url')).toBeNull()
      expect(await adapter.getVariantUrl('media_no_url', 'thumbnail')).toBeNull()
    } finally {
      await mf.dispose()
    }
  })

  it('builds public URLs from the configured base, and only for objects that exist', async () => {
    const { mf, bucket } = await createBucket()
    try {
      const adapter = new CloudflareR2Adapter({
        bucket,
        publicBaseUrl: 'https://media.example.org/',
        silent: true
      })
      await upload(adapter, 'media_public')
      await adapter.saveVariantFile('media_public', 'thumbnail', Buffer.from('t'), 'webp')

      expect(await adapter.getFileUrl('media_public')).toBe(
        'https://media.example.org/files/media_public'
      )
      expect(await adapter.getVariantUrl('media_public', 'thumbnail')).toBe(
        'https://media.example.org/variants/media_public/thumbnail'
      )
      expect(await adapter.getFileUrl('media_never_stored')).toBeNull()
      expect(await adapter.getVariantUrl('media_public', 'missing')).toBeNull()
    } finally {
      await mf.dispose()
    }
  })

  it('lists past R2 pagination, so the total is the whole bucket and not the first page', async () => {
    const { mf, bucket } = await createBucket()
    try {
      const adapter = new CloudflareR2Adapter({ bucket, silent: true })
      // LIST_PAGE_SIZE is 500; 520 records force a second page and a cursor.
      const ids = Array.from({ length: 520 }, (_, index) => `media_page_${String(index).padStart(4, '0')}`)
      for (const id of ids) {
        await upload(adapter, id)
      }

      const listed = await adapter.listMedia({ limit: 10 })
      expect(listed.total).toBe(520)
      expect(listed.items).toHaveLength(10)
    } finally {
      await mf.dispose()
    }
  }, 120_000)

  it('reclaims bytes an interrupted delete left behind', async () => {
    const { mf, bucket } = await createBucket()
    try {
      const adapter = new CloudflareR2Adapter({ bucket, silent: true })
      await upload(adapter, 'media_orphan')
      await adapter.saveVariantFile('media_orphan', 'thumbnail', Buffer.from('t'), 'webp')
      await upload(adapter, 'media_kept')

      // Exactly what a delete that died between its two writes leaves: no record, live bytes.
      await bucket.delete('meta/media_orphan.json')

      expect(await adapter.cleanup()).toBe(2)
      expect(await bucket.head('files/media_orphan')).toBeNull()
      expect(await bucket.head('variants/media_orphan/thumbnail')).toBeNull()
      expect(await adapter.getFile('media_kept')).not.toBeNull()
    } finally {
      await mf.dispose()
    }
  })

  it('cleans up nothing when every object has a record', async () => {
    const { mf, bucket } = await createBucket()
    try {
      const adapter = new CloudflareR2Adapter({ bucket, silent: true })
      await upload(adapter, 'media_intact')
      await adapter.saveVariantFile('media_intact', 'thumbnail', Buffer.from('t'), 'webp')

      expect(await adapter.cleanup()).toBe(0)
      expect(await adapter.getFileContent('media_intact')).not.toBeNull()
    } finally {
      await mf.dispose()
    }
  })

  it('drops stale variant bytes when the same id is re-uploaded', async () => {
    const { mf, bucket } = await createBucket()
    try {
      const adapter = new CloudflareR2Adapter({ bucket, silent: true })
      await upload(adapter, 'media_reupload')
      await adapter.saveVariantFile('media_reupload', 'thumbnail', Buffer.from('old'), 'webp')
      await upload(adapter, 'media_reupload', 'completely different')

      // The variant described the previous bytes, so it must not survive to describe these.
      expect(await adapter.getVariantContent('media_reupload', 'thumbnail')).toBeNull()
    } finally {
      await mf.dispose()
    }
  })

  it('cannot be constructed without a bucket binding', () => {
    expect(() => new CloudflareR2Adapter({ bucket: undefined as never })).toThrow()
  })
})
