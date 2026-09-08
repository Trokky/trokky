/**
 * Media helpers shared by the media library page and the media browser, which
 * hold their own copies of the asset shape but agree on the variant naming.
 */

interface MediaWithVariants {
  metadata?: {
    imageVariants?: Record<string, unknown>
  }
}

/**
 * Get the best available variant for preview.
 */
export function getBestPreviewVariant(media: MediaWithVariants): string | undefined {
  // For image media with variants, prefer thumbnail > small > original
  if (media.metadata?.imageVariants) {
    const variants = media.metadata.imageVariants
    if (variants.thumbnail) return 'thumbnail'
    if (variants.small) return 'small'
    // If no small variants, use original (undefined means original)
  }
  // For non-image media or media without variants, use original
  return undefined
}
