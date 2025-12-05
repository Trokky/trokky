/**
 * Fluent Image URL Builder
 * Provides a chainable API for building media URLs with transformations
 *
 * Inspired by Sanity's @sanity/image-url builder
 */

import type { MediaFieldValue } from '@trokky/types'

export interface ImageUrlBuilderOptions {
  /** Base URL for media API */
  baseUrl: string
  /** Use proxy path instead of direct API URL */
  proxyPath?: string
}

export type ImageFormat = 'webp' | 'jpeg' | 'jpg' | 'png' | 'avif' | 'auto'
export type ImageFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside'

/**
 * Fluent builder for constructing media URLs with transformations
 *
 * @example
 * ```typescript
 * const url = client.imageUrl(article.featuredImage)
 *   .width(800)
 *   .height(400)
 *   .format('webp')
 *   .quality(85)
 *   .url()
 * ```
 */
export class ImageUrlBuilder {
  private mediaId: string | null = null
  private _width?: number
  private _height?: number
  private _format?: ImageFormat
  private _quality?: number
  private _fit?: ImageFit
  private _variant?: string
  private _blur?: number
  private _sharpen?: number
  private _grayscale?: boolean

  constructor(private options: ImageUrlBuilderOptions) {}

  /**
   * Set the image source from a media field value
   */
  image(source: MediaFieldValue | string | null | undefined): this {
    if (!source) {
      this.mediaId = null
      return this
    }

    if (typeof source === 'string') {
      this.mediaId = source
    } else if (source.asset?._ref) {
      this.mediaId = source.asset._ref
    } else {
      this.mediaId = null
    }

    return this
  }

  /**
   * Set image width
   */
  width(w: number): this {
    this._width = Math.round(w)
    return this
  }

  /**
   * Set image height
   */
  height(h: number): this {
    this._height = Math.round(h)
    return this
  }

  /**
   * Set both width and height
   */
  size(w: number, h: number): this {
    this._width = Math.round(w)
    this._height = Math.round(h)
    return this
  }

  /**
   * Set image format
   */
  format(fmt: ImageFormat): this {
    this._format = fmt
    return this
  }

  /**
   * Set image quality (1-100)
   */
  quality(q: number): this {
    this._quality = Math.max(1, Math.min(100, Math.round(q)))
    return this
  }

  /**
   * Set image fit mode
   */
  fit(mode: ImageFit): this {
    this._fit = mode
    return this
  }

  /**
   * Use a predefined variant (e.g., 'thumbnail', 'medium', 'large')
   * When a variant is set, other transformations are ignored
   */
  variant(name: string): this {
    this._variant = name
    return this
  }

  /**
   * Apply blur effect (0-100)
   */
  blur(amount: number): this {
    this._blur = Math.max(0, Math.min(100, amount))
    return this
  }

  /**
   * Apply sharpening (0-100)
   */
  sharpen(amount: number): this {
    this._sharpen = Math.max(0, Math.min(100, amount))
    return this
  }

  /**
   * Convert to grayscale
   */
  grayscale(): this {
    this._grayscale = true
    return this
  }

  // Convenience presets

  /**
   * Preset for thumbnail size (200x200 cover)
   */
  thumbnail(): this {
    return this.variant('thumbnail')
  }

  /**
   * Preset for medium size
   */
  medium(): this {
    return this.variant('medium')
  }

  /**
   * Preset for large size
   */
  large(): this {
    return this.variant('large')
  }

  /**
   * Get the original file without transformations
   */
  original(): this {
    this._variant = 'original'
    return this
  }

  /**
   * Auto-select best format for browser
   */
  auto(): this {
    this._format = 'auto'
    return this
  }

  /**
   * Build and return the URL string
   */
  url(): string | null {
    if (!this.mediaId) {
      return null
    }

    const isProxy = !!this.options.proxyPath
    // When using proxyPath, it replaces the full path (e.g., '/media')
    // When using baseUrl, we need to add /media prefix
    const basePath = isProxy
      ? this.options.proxyPath
      : `${this.options.baseUrl}/media`

    // Build URL with transformation parameters
    const params = new URLSearchParams()

    // For proxy mode with variants, convert to width params
    if (isProxy && this._variant && this._variant !== 'original') {
      const variantWidths: Record<string, number> = {
        thumbnail: 300,
        medium: 800,
        large: 1200
      }
      const width = variantWidths[this._variant]
      if (width) {
        params.set('w', width.toString())
      }
    } else {
      // Use explicit width/height if set
      if (this._width) params.set('w', this._width.toString())
      if (this._height) params.set('h', this._height.toString())
    }

    if (this._format && this._format !== 'auto') params.set('fm', this._format)
    if (this._quality) params.set('q', this._quality.toString())
    if (this._fit) params.set('fit', this._fit)
    if (this._blur) params.set('blur', this._blur.toString())
    if (this._sharpen) params.set('sharp', this._sharpen.toString())
    if (this._grayscale) params.set('grayscale', '1')

    const queryString = params.toString()

    // For non-proxy mode with variants, use the /variants/ path
    if (!isProxy && this._variant) {
      if (this._variant === 'original') {
        return `${basePath}/${this.mediaId}/file`
      }
      return `${basePath}/${this.mediaId}/variants/${this._variant}`
    }

    // Return URL with query params
    return `${basePath}/${this.mediaId}/file${queryString ? `?${queryString}` : ''}`
  }

  /**
   * Build URL string (alias for url())
   */
  toString(): string {
    return this.url() || ''
  }
}

/**
 * Create an image URL builder factory
 */
export function createImageUrlBuilder(options: ImageUrlBuilderOptions) {
  return function urlFor(source: MediaFieldValue | string | null | undefined): ImageUrlBuilder {
    return new ImageUrlBuilder(options).image(source)
  }
}

/**
 * Get responsive srcset for an image
 *
 * @example
 * ```typescript
 * const srcset = getSrcSet(article.image, {
 *   baseUrl: 'http://localhost:3000/api',
 *   widths: [400, 800, 1200]
 * })
 * // Returns: "/media/abc123/file?w=400 400w, /media/abc123/file?w=800 800w, ..."
 * ```
 */
export function getSrcSet(
  source: MediaFieldValue | null | undefined,
  options: {
    baseUrl: string
    proxyPath?: string
    widths?: number[]
    variants?: string[]
  }
): string | null {
  if (!source?.asset?._ref) {
    return null
  }

  const mediaId = source.asset._ref
  const isProxy = !!options.proxyPath
  // When using proxyPath, it replaces the full path (e.g., '/media')
  // When using baseUrl, we need to add /media prefix
  const basePath = isProxy
    ? options.proxyPath
    : `${options.baseUrl}/media`

  // If using named variants (only for non-proxy mode)
  if (options.variants && !isProxy) {
    const variantWidths: Record<string, number> = {
      thumbnail: 300,
      medium: 800,
      large: 1200,
      original: 1920
    }

    return options.variants
      .map(variant => {
        const width = variantWidths[variant] || 800
        const url = variant === 'original'
          ? `${basePath}/${mediaId}/file`
          : `${basePath}/${mediaId}/variants/${variant}`
        return `${url} ${width}w`
      })
      .join(', ')
  }

  // Use custom widths or defaults (works for both proxy and non-proxy)
  const widths = options.widths || [400, 800, 1200, 1920]

  return widths
    .map(w => `${basePath}/${mediaId}/file?w=${w} ${w}w`)
    .join(', ')
}

/**
 * Get the best variant for a given viewport width
 */
export function getBestVariant(maxWidth: number): string {
  if (maxWidth <= 200) return 'thumbnail'
  if (maxWidth <= 800) return 'medium'
  if (maxWidth <= 1200) return 'large'
  return 'original'
}
