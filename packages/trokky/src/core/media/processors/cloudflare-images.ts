/**
 * Cloudflare Images processor — variants made by the Images binding at upload time.
 *
 * Why this shape and not the URL API or `fetch(cf.image)`: the binding takes raw bytes, so the
 * R2 bucket behind Trokky never has to be public; and a binding call bills every time while a
 * URL transformation bills once per unique transformation per calendar month — so calling it
 * once per variant at upload and storing the output is a one-time cost, and it slots straight
 * into MediaService's existing `saveVariantFile` pipeline with no architectural change.
 *
 * Measured against the real service, roughly one call in fifteen of a 6MB JPEG fails
 * transiently ("Network connection lost", "internal error; reference = …"), so every variant
 * is retried here. MediaService retries the whole `processImage` too, as a second net.
 *
 * `env.IMAGES` is passed through `media.imageProcessorOptions.images` — it is an object from
 * the Worker's environment, and TrokkyConfig is plain data, so the options bag is where a
 * binding can travel.
 */

import type { ImagesBinding } from '@cloudflare/workers-types'
import { InvalidInputError } from '../../errors/index.js'
import { withRetry } from '../../utils/retry.js'
import {
  ImageProcessor,
  DEFAULT_IMAGE_VARIANTS,
  type ImageProcessorConfig,
  type ImageVariant,
  type ProcessedImage,
  type ProcessedImageVariant
} from './types.js'

export interface CloudflareImagesOptions {
  /** The Images binding from the Worker environment, e.g. `env.IMAGES`. */
  images: ImagesBinding
  /** Attempts per variant before giving up on it. @default 3 */
  attempts?: number
}

/** Cloudflare has no stretch; `fill` and `outside` fall back to the nearest crop behaviour. */
const FIT: Record<NonNullable<ImageVariant['fit']>, 'scale-down' | 'contain' | 'cover'> = {
  cover: 'cover',
  contain: 'contain',
  inside: 'scale-down',
  outside: 'cover',
  fill: 'cover'
}

/** A fresh stream over the same bytes; the binding consumes each one it is given. */
const streamOf = (bytes: Uint8Array): ReadableStream<Uint8Array> => new Blob([bytes]).stream()

async function collect(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  return Buffer.from(await new Response(stream).arrayBuffer())
}

export class CloudflareImagesProcessor extends ImageProcessor {
  private readonly images: ImagesBinding
  private readonly attempts: number

  constructor(config: ImageProcessorConfig) {
    super(config)
    const options = (config.options ?? {}) as Partial<CloudflareImagesOptions>
    if (!options.images || typeof options.images.input !== 'function') {
      throw new InvalidInputError(
        'The cloudflare-images processor needs the Images binding: media.imageProcessorOptions.images = env.IMAGES',
        'images'
      )
    }
    this.images = options.images
    this.attempts = options.attempts ?? 3
  }

  async processImage(
    file: File,
    metadata: { id: string; filename: string; path: string }
  ): Promise<ProcessedImage> {
    const bytes = new Uint8Array(await file.arrayBuffer())

    // Metadata only; not a transformation.
    const info = await withRetry(() => this.images.info(streamOf(bytes)), { attempts: this.attempts })
    const original: ProcessedImageVariant = {
      url: this.getImageUrl(metadata.id, 'original'),
      width: 'width' in info ? info.width : 0,
      height: 'height' in info ? info.height : 0,
      format: file.type,
      size: bytes.byteLength
    }

    const variants: Record<string, ProcessedImageVariant> = {}
    for (const variant of this.config.variants?.length ? this.config.variants : DEFAULT_IMAGE_VARIANTS) {
      const format = variant.format ?? 'webp'
      const produced = await withRetry(async () => {
        const result = await this.images
          .input(streamOf(bytes))
          .transform({ width: variant.width, height: variant.height, fit: FIT[variant.fit ?? 'inside'] })
          .output({ format: `image/${format}`, quality: variant.quality })
        const buffer = await collect(result.image())
        // The service reports output dimensions only through info(); metadata, not billed work.
        const dims = await this.images.info(streamOf(new Uint8Array(buffer)))
        return { buffer, dims }
      }, { attempts: this.attempts })

      variants[variant.name] = {
        url: this.getImageUrl(metadata.id, variant.name),
        width: 'width' in produced.dims ? produced.dims.width : 0,
        height: 'height' in produced.dims ? produced.dims.height : 0,
        format,
        size: produced.buffer.length,
        buffer: produced.buffer
      }
    }

    return { original, variants }
  }

  getImageUrl(imageId: string, variantName?: string): string {
    // The frontend builds real URLs from the media record; this is the same placeholder the
    // other processors return.
    return variantName && variantName !== 'original' ? `/media/${imageId}/${variantName}` : `/media/${imageId}`
  }

  async deleteImage(): Promise<void> {
    // Variants live in the media storage adapter, which deletes them with the original.
  }

  async healthCheck(): Promise<boolean> {
    return typeof this.images?.input === 'function'
  }
}
