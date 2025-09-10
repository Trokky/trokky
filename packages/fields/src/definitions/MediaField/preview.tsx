/**
 * Media Field Preview Component
 * Read-only display component for media fields
 */

import React, { useState, useEffect } from 'react'
// TODO: Add proper icon imports when Studio icons are available
// Using placeholder icons for now
const PhotoIcon = ({ className }: { className?: string }) => (
  <div className={className}>📷</div>
)
const DocumentIcon = ({ className }: { className?: string }) => (
  <div className={className}>📄</div>
)
const VideoCameraIcon = ({ className }: { className?: string }) => (
  <div className={className}>🎥</div>
)
const SpeakerWaveIcon = ({ className }: { className?: string }) => (
  <div className={className}>🔊</div>
)
const ArchiveBoxIcon = ({ className }: { className?: string }) => (
  <div className={className}>📦</div>
)
const EyeIcon = ({ className }: { className?: string }) => (
  <div className={className}>👁️</div>
)
const ArrowDownTrayIcon = ({ className }: { className?: string }) => (
  <div className={className}>⬇️</div>
)
import type { FieldComponentProps } from '../../base/FieldPlugin'
import type {
  MediaFieldDefinition,
  MediaFieldValue,
  MediaType,
} from './definition'

type MediaFieldPreviewProps = FieldComponentProps

// Media type icon mapping
const MEDIA_TYPE_ICONS = {
  image: PhotoIcon,
  video: VideoCameraIcon,
  audio: SpeakerWaveIcon,
  document: DocumentIcon,
  archive: ArchiveBoxIcon,
}

// Get media type from MIME type
function getMediaTypeFromMime(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('text')
  )
    return 'document'
  return 'archive'
}

// Format file size for display
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

// Truncate text for display with ellipsis
function truncateText(text: string, maxLength: number = 30): string {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// Media asset interface (from Studio API)
interface MediaAsset {
  id: string
  filename: string
  originalFilename?: string
  contentType: string
  size: number
  url: string
  uploadedAt: string
  title?: string
  description?: string
  metadata?: {
    width?: number
    height?: number
    duration?: number
    title?: string
    alt?: string
    credit?: string
    author?: string
    tags?: string[]
  }
}

// Format duration for display
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

export function MediaFieldPreview(props: MediaFieldPreviewProps) {
  const { value, definition, documentContext, studioContext, ...restProps } =
    props

  const mediaDefinition = definition as MediaFieldDefinition
  const options = mediaDefinition.options || {}

  const [currentAsset, setCurrentAsset] = useState<MediaAsset | null>(null)
  const [assetLoadError, setAssetLoadError] = useState<string | null>(null)

  // Cross-platform development check
  const isDevelopment =
    typeof window !== 'undefined' && (window as any).__TROKKY_DEV__ === true

  // Load asset when value changes
  useEffect(() => {
    const loadAsset = async () => {
      if (!value?.asset?._ref || !studioContext?.apiClient) {
        setCurrentAsset(null)
        setAssetLoadError(null)
        return
      }

      try {
        setAssetLoadError(null)
        studioContext.logger?.debug('MediaFieldPreview: Loading asset', {
          assetId: value.asset._ref,
        })

        const response = await studioContext.apiClient.getMediaById(
          value.asset._ref
        )

        if (response.success && response.data?.file) {
          studioContext.logger?.info(
            'MediaFieldPreview: Asset loaded successfully',
            {
              assetId: value.asset._ref,
              filename: response.data.file.filename,
              contentType: response.data.file.contentType,
            }
          )
          setCurrentAsset(response.data.file)
        } else {
          studioContext.logger?.warn('MediaFieldPreview: Asset not found', {
            assetId: value.asset._ref,
          })
          setAssetLoadError('Media asset no longer exists')
          setCurrentAsset(null)
        }
      } catch (error) {
        studioContext.logger?.error(
          'MediaFieldPreview: Failed to load asset',
          error
        )
        setAssetLoadError('Failed to load media asset')
        setCurrentAsset(null)
      }
    }

    loadAsset()
  }, [value?.asset?._ref, studioContext?.apiClient])

  // If no value, show empty state
  if (!value) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 italic">
        No media selected
      </div>
    )
  }

  const mediaValue = value as MediaFieldValue

  // Show error state if asset failed to load
  if (assetLoadError) {
    return (
      <div className="space-y-3">
        {/* Error icon on its own line */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-red-100 dark:bg-red-700 rounded-md border border-red-200 dark:border-red-600 flex items-center justify-center">
            <DocumentIcon className="w-8 h-8 text-red-400" />
          </div>
        </div>

        {/* Error information below */}
        <div className="space-y-2 text-center">
          <h4 className="text-sm font-medium text-red-900 dark:text-red-300">
            {mediaValue.title || 'Media Asset'}
          </h4>

          <div className="text-xs text-red-600 dark:text-red-400">
            {assetLoadError}
          </div>

          <div className="text-xs text-red-500 dark:text-red-500">
            Asset ID: {mediaValue.asset._ref}
          </div>
        </div>
      </div>
    )
  }

  // Show loading state while asset is being loaded
  if (!currentAsset && !assetLoadError) {
    return (
      <div className="space-y-3">
        {/* Loading icon on its own line */}
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 flex items-center justify-center animate-pulse">
            <PhotoIcon className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        {/* Loading placeholders below */}
        <div className="space-y-2 text-center">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto w-32"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto w-24"></div>
        </div>
      </div>
    )
  }

  // Show actual asset preview
  const asset = currentAsset
  const mediaType = asset ? getMediaTypeFromMime(asset.contentType) : 'document'
  const MediaIcon = MEDIA_TYPE_ICONS[mediaType] || DocumentIcon

  return (
    <div className="space-y-3">
      {/* Image/Icon on its own line */}
      <div className="flex justify-center">
        <div className="w-24 h-24 bg-gray-100 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 flex items-center justify-center overflow-hidden">
          {asset?.url && mediaType === 'image' ? (
            <img
              src={(() => {
                // Use MediaUrlGenerator if available from Studio Context
                if (studioContext?.mediaUrlGenerator) {
                  return studioContext.mediaUrlGenerator.getMediaUrl(
                    mediaValue.asset._ref,
                    mediaValue.variant || 'thumbnail'
                  )
                }
                // Fallback to apiClient.getMediaUrl if available
                if (studioContext?.apiClient?.getMediaUrl) {
                  return studioContext.apiClient.getMediaUrl(
                    mediaValue.asset._ref,
                    mediaValue.variant || 'thumbnail'
                  )
                }
                // Fallback to main URL
                return asset.url
              })()}
              alt={mediaValue?.alt || asset.title || asset.filename}
              className="w-full h-full object-cover"
              onError={e => {
                // Fallback to icon if image fails to load
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextElementSibling?.classList.remove('hidden')
              }}
            />
          ) : null}
          <MediaIcon
            className={`w-8 h-8 text-gray-400 ${asset?.url && mediaType === 'image' ? 'hidden' : ''}`}
          />
        </div>
      </div>

      {/* Information below the image */}
      <div className="space-y-2 text-center">
        <h4
          className="text-sm font-medium text-gray-900 dark:text-white"
          title={
            mediaValue.title || asset?.title || asset?.filename || 'Media Asset'
          }
        >
          {truncateText(
            mediaValue.title ||
              asset?.title ||
              asset?.filename ||
              'Media Asset',
            40
          )}
        </h4>

        {asset && (
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex items-center justify-center space-x-2">
              <span title={asset.filename}>
                {truncateText(asset.filename, 25)}
              </span>
              <span>•</span>
              <span>{formatFileSize(asset.size)}</span>
              {asset.contentType && (
                <>
                  <span>•</span>
                  <span>{asset.contentType.split('/')[1]?.toUpperCase()}</span>
                </>
              )}
            </div>

            {/* Asset dimensions or duration */}
            {asset?.metadata?.width && asset?.metadata?.height && (
              <div>
                {asset.metadata.width} × {asset.metadata.height}px
              </div>
            )}

            {asset?.metadata?.duration && (
              <div>Duration: {formatDuration(asset.metadata.duration)}</div>
            )}
          </div>
        )}

        {/* Instance metadata */}
        {mediaValue.caption && (
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {mediaValue.caption}
          </p>
        )}

        {mediaValue.alt && (
          <p className="text-xs text-gray-500 italic">Alt: {mediaValue.alt}</p>
        )}
      </div>
    </div>
  )
}
