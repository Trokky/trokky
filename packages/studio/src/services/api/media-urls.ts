/**
 * Media URL construction. The backend URL is passed in rather than read from
 * the client so these stay pure and testable.
 */

/**
 * Construct media URL for asset reference
 * This properly handles the configurable API base path
 */
export function buildMediaUrl(
  backendUrl: string,
  assetRef: string,
  variant?: string
): string {
  if (!assetRef) {
    return ''
  }

  // If no variant specified, return the original file URL
  if (!variant) {
    return `${backendUrl}/media/${assetRef}/file`
  }

  // Return variant URL
  return `${backendUrl}/media/${assetRef}/variants/${variant}`
}

/**
 * Transform media object to include constructed URLs
 */
export function transformMediaObject(backendUrl: string, media: any): any {
  if (!media || !media.id) {
    return media
  }

  return {
    ...media,
    url: buildMediaUrl(backendUrl, media.id), // Original file URL
    // Add variant URLs if they exist
    ...(media.variants && {
      variants: Object.keys(media.variants).reduce((acc, variantName) => {
        acc[variantName] = {
          ...media.variants[variantName],
          url: buildMediaUrl(backendUrl, media.id, variantName),
        }
        return acc
      }, {} as any),
    }),
  }
}
