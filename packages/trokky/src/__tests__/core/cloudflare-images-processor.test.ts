/**
 * The Cloudflare Images processor makes variants at upload time through the Images binding.
 * The contract pinned here: every configured variant comes back with real bytes and the
 * dimensions the service reports, a transient failure on one variant is retried rather than
 * losing the thumbnail, the binding is required and named when missing, and — against
 * Miniflare's emulation of the binding — a real transform actually happens.
 */
import { describe, it, expect, vi } from 'vitest'
import { Miniflare } from 'miniflare'
import { CloudflareImagesProcessor, type ImagesBindingLike } from '../../core/media/processors/cloudflare-images.js'
import { createImageProcessor } from '../../core/media/image-processor.js'

/** A binding that "transforms" by returning bytes tagged with the requested size. */
function fakeBinding(failFirst = 0) {
  let failures = failFirst
  const transformCalls: unknown[] = []
  const images = {
    info: vi.fn(async () => ({ format: 'image/png', fileSize: 10, width: 4032, height: 3024 })),
    input: vi.fn(() => {
      let requested: { width?: number; height?: number } = {}
      const transformer = {
        transform: vi.fn((t: { width?: number; height?: number }) => { requested = t; transformCalls.push(t); return transformer }),
        draw: vi.fn(() => transformer),
        output: vi.fn(async (o: { format: string }) => {
          if (failures > 0) { failures--; throw new Error('Network connection lost.') }
          const bytes = new TextEncoder().encode(`${o.format}:${requested.width}x${requested.height}`)
          return {
            image: () => new Blob([bytes]).stream(),
            contentType: () => o.format,
            response: () => new Response(bytes)
          }
        })
      }
      return transformer
    })
  }
  return { images: images as unknown as ImagesBindingLike, transformCalls, mocks: images }
}

const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'photo.png', { type: 'image/png' })
const meta = { id: 'media_1', filename: 'photo.png', path: 'photo.png' }

describe('CloudflareImagesProcessor', () => {
  it('requires the binding and says where to put it', () => {
    expect(() => new CloudflareImagesProcessor({ type: 'cloudflare-images', options: {} }))
      .toThrow('media.imageProcessorOptions.images = env.IMAGES')
  })

  it('is reachable through the factory', async () => {
    const { images } = fakeBinding()
    const processor = await createImageProcessor({ type: 'cloudflare-images', options: { images } })
    expect(processor).toBeInstanceOf(CloudflareImagesProcessor)
  })

  it('produces every configured variant with bytes, format and reported dimensions', async () => {
    const { images, transformCalls } = fakeBinding()
    const processor = new CloudflareImagesProcessor({
      type: 'cloudflare-images',
      options: { images },
      variants: [
        { name: 'thumbnail', width: 150, height: 150, format: 'webp', fit: 'cover' },
        { name: 'large', width: 1600, height: 1200, format: 'jpeg', fit: 'inside' }
      ]
    })

    const result = await processor.processImage(png(), meta)

    expect(result.original).toMatchObject({ width: 4032, height: 3024, format: 'image/png' })
    expect(Object.keys(result.variants)).toEqual(['thumbnail', 'large'])
    expect(result.variants.thumbnail.buffer?.toString()).toBe('image/webp:150x150')
    expect(result.variants.thumbnail).toMatchObject({ format: 'webp', size: 'image/webp:150x150'.length })
    expect(result.variants.large.buffer?.toString()).toBe('image/jpeg:1600x1200')
    // fit is translated to what the service understands
    expect(transformCalls[0]).toMatchObject({ fit: 'cover' })
    expect(transformCalls[1]).toMatchObject({ fit: 'scale-down' })
  })

  it('falls back to the default variants when none are configured', async () => {
    const { images } = fakeBinding()
    const processor = new CloudflareImagesProcessor({ type: 'cloudflare-images', options: { images } })
    const result = await processor.processImage(png(), meta)
    expect(Object.keys(result.variants).sort()).toEqual(['large', 'preview', 'thumbnail'])
  })

  it('retries a transient failure on a variant instead of losing it', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => { fn(); return 0 }) as never)
    const { images, mocks } = fakeBinding(1)
    const processor = new CloudflareImagesProcessor({
      type: 'cloudflare-images',
      options: { images },
      variants: [{ name: 'thumbnail', width: 150, height: 150, format: 'webp' }]
    })

    const result = await processor.processImage(png(), meta)

    expect(result.variants.thumbnail.buffer?.toString()).toBe('image/webp:150x150')
    expect(mocks.input).toHaveBeenCalledTimes(2)
    vi.restoreAllMocks()
  })

  it('gives up on a variant after the configured attempts', async () => {
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void) => { fn(); return 0 }) as never)
    const { images } = fakeBinding(5)
    const processor = new CloudflareImagesProcessor({
      type: 'cloudflare-images',
      options: { images, attempts: 2 },
      variants: [{ name: 'thumbnail', width: 150, height: 150 }]
    })

    await expect(processor.processImage(png(), meta)).rejects.toThrow('Network connection lost')
    vi.restoreAllMocks()
  })

  it('really transforms an image through the emulated binding', async () => {
    // Miniflare backs env.IMAGES with sharp locally, so this proves the wiring against the
    // binding's real API shape, not Cloudflare's encoder.
    const mf = new Miniflare({
      modules: true,
      script: 'export default { fetch: () => new Response(null, { status: 204 }) }',
      images: { binding: 'IMAGES' }
    })
    try {
      const { IMAGES } = (await mf.getBindings()) as { IMAGES: ImagesBindingLike }
      const sharp = (await import('sharp')).default
      const source = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#2b6cb0' } }).png().toBuffer()
      const processor = new CloudflareImagesProcessor({
        type: 'cloudflare-images',
        options: { images: IMAGES },
        variants: [{ name: 'thumbnail', width: 150, height: 150, format: 'webp', fit: 'inside' }]
      })

      const result = await processor.processImage(new File([source], 'photo.png', { type: 'image/png' }), meta)

      expect(result.original).toMatchObject({ width: 800, height: 600 })
      const thumb = await sharp(result.variants.thumbnail.buffer!).metadata()
      expect(thumb.format).toBe('webp')
      expect(thumb.width).toBe(150)
      expect(thumb.height).toBe(113)
      expect(result.variants.thumbnail).toMatchObject({ width: 150, height: 113 })
    } finally {
      await mf.dispose()
    }
  }, 60_000)
})
