/**
 * Media Browser Content Component
 * Content for the media selection modal using global Modal component
 */

import React, { useState, useEffect } from 'react'
import type { MediaFieldValue, MediaType } from '../types'

// Types for Studio API integration
interface MediaFile {
  id: string
  filename: string
  contentType: string
  size: number
  url: string
  uploadedAt: string
  metadata?: {
    width?: number
    height?: number
    duration?: number
    title?: string
    alt?: string
    credit?: string
    author?: string
    tags?: string[]
    imageVariants?: Record<
      string,
      {
        url: string
        width: number
        height: number
        format: string
        size: number
      }
    >
    originalDimensions?: {
      width: number
      height: number
    }
  }
}

// API client interface (matching StudioContext.apiClient structure)
interface MediaBrowserAPI {
  getMedia: (options?: any) => Promise<any>
  getMediaById?: (id: string) => Promise<any>
  getMediaUrl?: (assetRef: string, variant?: string) => string
  uploadMedia?: (
    file: File,
    collection?: string,
    metadata?: any
  ) => Promise<any>
  deleteMedia?: (id: string) => Promise<any>
  updateMedia?: (id: string, metadata: any) => Promise<any>
}

// SVG Icons
const MagnifyingGlassIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
)

interface MediaBrowserContentProps {
  onSelect: (value: MediaFieldValue) => void
  mediaTypeFilter?: MediaType
  showVariantSelector?: boolean
  context?: string
  // TODO: Add API client when Studio context is available
  apiClient?: MediaBrowserAPI
  // Studio logger for consistent logging
  logger?: {
    debug: (message: string, data?: any) => void
    info: (message: string, data?: any) => void
    warn: (message: string, data?: any) => void
    error: (message: string, error?: Error | any) => void
  }
  // MediaUrlGenerator for proper URL construction
  mediaUrlGenerator?: {
    getMediaUrl: (mediaId: string, variant?: string) => string
  } | null
}

// Helper functions
function getMediaTypeFromMime(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('powerpoint') ||
    mimeType === 'text/plain'
  )
    return 'document'
  if (
    mimeType.includes('zip') ||
    mimeType.includes('rar') ||
    mimeType.includes('7z') ||
    mimeType.includes('tar') ||
    mimeType.includes('gzip')
  )
    return 'archive'
  return 'document' // fallback
}

function getMediaTypeIcon(mediaType: string): React.ReactElement {
  const iconClass = 'w-full h-full'
  switch (mediaType) {
    case 'image':
      return (
        <svg
          className={iconClass}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      )
    case 'video':
      return (
        <svg
          className={iconClass}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )
    case 'audio':
      return (
        <svg
          className={iconClass}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
          />
        </svg>
      )
    case 'document':
      return (
        <svg
          className={iconClass}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      )
    case 'archive':
      return (
        <svg
          className={iconClass}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
          />
        </svg>
      )
    default:
      return (
        <svg
          className={iconClass}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
      )
  }
}

// Helper function to get the best available variant for preview
function getBestPreviewVariant(media: MediaFile): string | undefined {
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

// Helper function to get media URL using the new MediaUrlGenerator
function getMediaUrl(
  media: MediaFile,
  variant?: string,
  mediaUrlGenerator?: {
    getMediaUrl: (mediaId: string, variant?: string) => string
  } | null,
  apiClient?: MediaBrowserAPI
): string {
  // Use MediaUrlGenerator if available (preferred method)
  if (mediaUrlGenerator) {
    return mediaUrlGenerator.getMediaUrl(media.id, variant)
  }

  // Fallback to apiClient.getMediaUrl if available
  if (apiClient?.getMediaUrl) {
    return apiClient.getMediaUrl(media.id, variant)
  }

  // If we have a direct URL on the media object, use it
  if (media.url) {
    return media.url
  }

  // ERROR: No way to generate URL

  throw new Error(
    `Cannot generate URL for media ${media.id}${variant ? ` variant ${variant}` : ''}`
  )
}

function formatFileSize(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1)
}

export function MediaBrowserContent({
  onSelect,
  mediaTypeFilter,
  showVariantSelector = false,
  context,
  apiClient,
  logger,
  mediaUrlGenerator,
}: MediaBrowserContentProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<string>('original')
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid')

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20 // Show 20 items per page (4 rows of 5)

  // Cross-platform development check
  const isDevelopment =
    typeof window !== 'undefined' && (window as any).__TROKKY_DEV__ === true

  // Load media files when component mounts
  useEffect(() => {
    loadMediaFiles()
  }, [])

  const loadMediaFiles = async () => {
    setIsLoading(true)
    try {
      logger?.debug('MediaBrowser: apiClient received', {
        apiClient: !!apiClient,
        type: typeof apiClient,
        hasGetMedia: !!apiClient?.getMedia,
      })

      if (apiClient && typeof apiClient.getMedia === 'function') {
        // Use real API when available
        logger?.debug('MediaBrowser: Loading media from API...')
        const response = await apiClient.getMedia()

        logger?.debug('MediaBrowser: API response received', response)

        // Handle v2 API response format only
        if (response?.success && Array.isArray(response.data)) {
          logger?.info('MediaBrowser: Loaded media files from API', {
            count: response.data.length,
          })
          setMediaFiles(response.data)
        } else {
          logger?.warn('MediaBrowser: Invalid API response format', response)
          setMediaFiles([])
        }
      } else {
        // Fallback to mock data for development/demo
        logger?.warn('MediaBrowser: No API client provided, using mock data')
        const mockData: MediaFile[] = [
          {
            id: 'asset-1',
            filename: 'hero-image.jpg',
            contentType: 'image/jpeg',
            size: 2048000,
            url: 'https://picsum.photos/800/600?random=1',
            uploadedAt: new Date().toISOString(),
            metadata: {
              width: 1920,
              height: 1080,
              title: 'Hero Banner Image',
              author: 'John Photographer',
              originalDimensions: { width: 1920, height: 1080 },
              imageVariants: {
                thumbnail: {
                  url: 'https://picsum.photos/150/150?random=1',
                  width: 150,
                  height: 150,
                  format: 'jpeg',
                  size: 12000,
                },
                small: {
                  url: 'https://picsum.photos/400/300?random=1',
                  width: 400,
                  height: 300,
                  format: 'jpeg',
                  size: 45000,
                },
                medium: {
                  url: 'https://picsum.photos/800/600?random=1',
                  width: 800,
                  height: 600,
                  format: 'jpeg',
                  size: 120000,
                },
                large: {
                  url: 'https://picsum.photos/1200/900?random=1',
                  width: 1200,
                  height: 900,
                  format: 'jpeg',
                  size: 280000,
                },
              },
            },
          },
          {
            id: 'asset-2',
            filename: 'product-demo.mp4',
            contentType: 'video/mp4',
            size: 15728640,
            url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
            uploadedAt: new Date().toISOString(),
            metadata: {
              width: 1280,
              height: 720,
              duration: 30,
              title: 'Product Demo Video',
            },
          },
          {
            id: 'asset-3',
            filename: 'background-music.mp3',
            contentType: 'audio/mp3',
            size: 5242880,
            url: '#',
            uploadedAt: new Date().toISOString(),
            metadata: {
              duration: 180,
              title: 'Background Music Track',
            },
          },
          {
            id: 'asset-4',
            filename: 'user-manual.pdf',
            contentType: 'application/pdf',
            size: 1048576,
            url: '#',
            uploadedAt: new Date().toISOString(),
            metadata: {
              title: 'User Manual Document',
            },
          },
        ]

        setMediaFiles(mockData)
      }
    } catch (error) {
      logger?.error('Failed to load media files', error)
      setMediaFiles([])
    } finally {
      setIsLoading(false)
    }
  }

  // Filter media files
  const filteredMedia = mediaFiles.filter(media => {
    // Apply media type filter
    if (
      mediaTypeFilter &&
      getMediaTypeFromMime(media.contentType) !== mediaTypeFilter
    ) {
      return false
    }

    // Apply search filter
    if (!searchTerm) return true
    const search = searchTerm.toLowerCase()
    return (
      media.filename.toLowerCase().includes(search) ||
      media.id.toLowerCase().includes(search) ||
      (media.metadata?.title &&
        media.metadata.title.toLowerCase().includes(search)) ||
      (media.metadata?.author &&
        media.metadata.author.toLowerCase().includes(search)) ||
      (media.metadata?.credit &&
        media.metadata.credit.toLowerCase().includes(search))
    )
  })

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, mediaTypeFilter])

  // Pagination calculations
  const totalPages = Math.ceil(filteredMedia.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedMedia = filteredMedia.slice(startIndex, endIndex)

  const handleSelect = () => {
    if (selectedMedia) {
      // Create MediaFieldValue
      const mediaValue: MediaFieldValue = {
        _type: 'media',
        asset: {
          _ref: selectedMedia.id,
          _type: 'mediaAsset',
        },
        alt: '',
        caption: '',
        title: '', // Leave empty by default - users can add their own meaningful title
        variant: selectedVariant,
      }

      onSelect(mediaValue)
      setSelectedMedia(null)
      setSelectedVariant('original')
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Search Bar - Only show in grid view */}
      {viewMode === 'grid' && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search media..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Single Media View */}
      {viewMode === 'single' && selectedMedia ? (
        <div className="flex-1 flex flex-col">
          {/* Back Navigation */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
            <button
              onClick={() => {
                setViewMode('grid')
                setSelectedMedia(null)
                setSelectedVariant('original')
              }}
              className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Grid
            </button>
          </div>

          {/* MediaPage-style Viewer Content */}
          <div className="flex-1 flex flex-col md:flex-row overflow-y-auto">
            {/* Left section: Media preview + variants */}
            <div className="flex-1 flex flex-col min-h-0">
              {/* Media preview */}
              <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 min-h-[200px]">
                {(() => {
                  const mediaType = getMediaTypeFromMime(
                    selectedMedia.contentType
                  )

                  if (mediaType === 'image') {
                    const previewUrl =
                      selectedVariant === 'original'
                        ? getMediaUrl(
                            selectedMedia,
                            undefined,
                            mediaUrlGenerator,
                            apiClient
                          )
                        : getMediaUrl(
                            selectedMedia,
                            selectedVariant,
                            mediaUrlGenerator,
                            apiClient
                          )

                    return (
                      <div className="w-full h-full max-w-[800px] max-h-[400px] flex items-center justify-center">
                        {previewUrl ? (
                          <img
                            key={`${selectedMedia.id}-${selectedVariant}-${previewUrl}`} // Use URL in key for proper re-render
                            src={previewUrl}
                            alt={
                              selectedMedia.metadata?.title ||
                              selectedMedia.filename
                            }
                            className="max-w-full max-h-full object-contain"
                            loading="eager" // Force immediate loading
                            onLoad={() => {
                              // Image loaded successfully
                            }}
                            onError={e => {
                              // Try fallback URL if available
                              if (
                                selectedMedia.url &&
                                e.currentTarget.src !== selectedMedia.url
                              ) {
                                e.currentTarget.src = selectedMedia.url
                              } else {
                                // Prevent error propagation that might break React rendering
                                e.currentTarget.onerror = null
                              }
                            }}
                          />
                        ) : (
                          <div className="text-gray-500">
                            No preview URL available
                          </div>
                        )}
                      </div>
                    )
                  } else if (mediaType === 'video') {
                    return (
                      <video
                        src={getMediaUrl(
                          selectedMedia,
                          undefined,
                          mediaUrlGenerator,
                          apiClient
                        )}
                        controls
                        className="max-w-full max-h-full"
                      />
                    )
                  } else if (mediaType === 'audio') {
                    return (
                      <audio
                        src={getMediaUrl(
                          selectedMedia,
                          undefined,
                          mediaUrlGenerator,
                          apiClient
                        )}
                        controls
                        className="w-full max-w-md"
                      />
                    )
                  }

                  return (
                    <div className="text-center">
                      <div className="w-24 h-24 mx-auto mb-4 opacity-50">
                        {getMediaTypeIcon(mediaType)}
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Preview not available for this file type
                      </p>
                    </div>
                  )
                })()}
              </div>

              {/* Image Variants Section */}
              {getMediaTypeFromMime(selectedMedia.contentType) === 'image' &&
                selectedMedia.metadata?.imageVariants &&
                Object.keys(selectedMedia.metadata.imageVariants).length >
                  0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        Image Variants
                      </h3>
                      {apiClient?.regenerateVariants && (
                        <button
                          onClick={async () => {
                            try {
                              logger?.info('Regenerating variants for', {
                                mediaId: selectedMedia.id,
                              })
                              await apiClient.regenerateVariants(
                                selectedMedia.id
                              )
                              // Refresh media list to get updated variants
                              loadMediaFiles()
                            } catch (error) {
                              logger?.error(
                                'Failed to regenerate variants',
                                error
                              )
                            }
                          }}
                          className="text-xs px-2 py-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-600 dark:border-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          Regenerate
                        </button>
                      )}
                    </div>
                    <div className="flex space-x-2 overflow-x-auto pb-1">
                      {/* Original variant */}
                      <div className="flex-shrink-0 group relative">
                        <div
                          className={`cursor-pointer rounded border-2 transition-all ${
                            selectedVariant === 'original'
                              ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                          onClick={() => setSelectedVariant('original')}
                        >
                          <img
                            src={getMediaUrl(
                              selectedMedia,
                              undefined,
                              mediaUrlGenerator,
                              apiClient
                            )}
                            alt="Original"
                            className="w-16 h-16 object-cover rounded"
                            loading="lazy"
                          />
                        </div>
                        <div className="mt-1 text-center">
                          <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            Original
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-500">
                            {selectedMedia.metadata?.width} ×{' '}
                            {selectedMedia.metadata?.height}
                          </div>
                        </div>
                      </div>
                      {/* Available variants */}
                      {Object.entries(selectedMedia.metadata.imageVariants).map(
                        ([variantName, variant]) => (
                          <div
                            key={variantName}
                            className="flex-shrink-0 group relative"
                          >
                            <div
                              className={`cursor-pointer rounded border-2 transition-all ${
                                selectedVariant === variantName
                                  ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                              onClick={() => setSelectedVariant(variantName)}
                            >
                              <img
                                src={getMediaUrl(
                                  selectedMedia,
                                  variantName,
                                  mediaUrlGenerator,
                                  apiClient
                                )}
                                alt={`${variantName} variant`}
                                className="w-16 h-16 object-cover rounded"
                                loading="lazy"
                              />
                            </div>
                            <div className="mt-1 text-center">
                              <div className="text-xs text-gray-600 dark:text-gray-400 capitalize truncate">
                                {variantName}
                              </div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-500">
                                {variant.width} × {variant.height}
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              {/* No variants section for images without variants */}
              {getMediaTypeFromMime(selectedMedia.contentType) === 'image' &&
                (!selectedMedia.metadata?.imageVariants ||
                  Object.keys(selectedMedia.metadata.imageVariants).length ===
                    0) && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
                    <div className="text-center">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Image Variants
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        No variants available for this image.
                      </p>
                    </div>
                  </div>
                )}
            </div>

            {/* Right sidebar: File Details */}
            <div className="w-full md:w-64 bg-white dark:bg-gray-800 border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0">
              {/* File Details Section - Compact on mobile */}
              <div className="p-3 md:p-4 flex-1">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  File Details
                </h3>
                <dl className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <dt className="font-medium text-gray-500 dark:text-gray-400">
                      Filename
                    </dt>
                    <dd className="text-gray-900 dark:text-white truncate ml-2 max-w-[150px]" title={selectedMedia.filename}>
                      {selectedMedia.filename}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium text-gray-500 dark:text-gray-400">
                      Size
                    </dt>
                    <dd className="text-gray-900 dark:text-white">
                      {formatFileSize(selectedMedia.size)} MB
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="font-medium text-gray-500 dark:text-gray-400">
                      Type
                    </dt>
                    <dd className="text-gray-900 dark:text-white truncate ml-2 max-w-[100px]" title={selectedMedia.contentType}>
                      {selectedMedia.contentType.split('/')[1] || selectedMedia.contentType}
                    </dd>
                  </div>
                  {selectedMedia.metadata?.width &&
                    selectedMedia.metadata?.height && (
                      <div className="flex justify-between">
                        <dt className="font-medium text-gray-500 dark:text-gray-400">
                          Dimensions
                        </dt>
                        <dd className="text-gray-900 dark:text-white">
                          {selectedMedia.metadata.width} × {selectedMedia.metadata.height}
                        </dd>
                      </div>
                    )}
                </dl>
              </div>

              {/* Select Button */}
              <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
                <button
                  onClick={handleSelect}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                >
                  Select {selectedVariant === 'original' ? 'Original' : selectedVariant}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Selected Media Info in Grid View - Only for images with variants */}
          {selectedMedia &&
            viewMode === 'grid' &&
            getMediaTypeFromMime(selectedMedia.contentType) === 'image' &&
            selectedMedia.metadata?.imageVariants &&
            Object.keys(selectedMedia.metadata.imageVariants).length > 0 && (
              <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-600">
                <div className="flex items-start space-x-4">
                  {/* Media preview */}
                  <div className="w-16 h-16 rounded overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    {(() => {
                      const mediaType = getMediaTypeFromMime(
                        selectedMedia.contentType
                      )

                      if (mediaType === 'image') {
                        return (
                          <img
                            src={getMediaUrl(
                              selectedMedia,
                              getBestPreviewVariant(selectedMedia),
                              mediaUrlGenerator,
                              apiClient
                            )}
                            alt={selectedMedia.filename}
                            className="w-full h-full object-cover"
                          />
                        )
                      }

                      return (
                        <div className="w-6 h-6 text-gray-500 dark:text-gray-400">
                          {getMediaTypeIcon(mediaType)}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Media info and variants */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <p
                          className="font-medium text-gray-900 dark:text-white truncate"
                          title={selectedMedia.filename}
                        >
                          {selectedMedia.filename}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {selectedMedia.metadata?.width &&
                          selectedMedia.metadata?.height
                            ? `${selectedMedia.metadata.width} × ${selectedMedia.metadata.height} • `
                            : ''}
                          {formatFileSize(selectedMedia.size)} MB
                        </p>
                      </div>

                      {/* Variant Selector for Images */}
                      {getMediaTypeFromMime(selectedMedia.contentType) ===
                        'image' &&
                        selectedMedia.metadata?.imageVariants &&
                        Object.keys(selectedMedia.metadata.imageVariants)
                          .length > 0 && (
                          <div className="flex-shrink-0">
                            <label className="block text-xs font-medium text-gray-700 dark:text-white mb-1">
                              Variant
                            </label>
                            <div className="flex items-center space-x-1">
                              {/* Original variant */}
                              <label
                                className={`cursor-pointer flex flex-col items-center px-2 py-1 rounded border text-xs transition-colors ${
                                  selectedVariant === 'original'
                                    ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="variant"
                                  value="original"
                                  checked={selectedVariant === 'original'}
                                  onChange={e => {
                                    console.log(
                                      '📝 Variant selection changed:',
                                      {
                                        from: selectedVariant,
                                        to: e.target.value,
                                      }
                                    )
                                    setSelectedVariant(e.target.value)
                                  }}
                                  className="sr-only"
                                />
                                <div className="font-medium">Original</div>
                                {selectedMedia.metadata?.originalDimensions && (
                                  <div className="text-gray-500 dark:text-gray-400">
                                    {
                                      selectedMedia.metadata.originalDimensions
                                        .width
                                    }
                                    ×
                                    {
                                      selectedMedia.metadata.originalDimensions
                                        .height
                                    }
                                  </div>
                                )}
                              </label>

                              {/* Available variants */}
                              {Object.entries(
                                selectedMedia.metadata.imageVariants
                              ).map(([variantName, variant]) => (
                                <label
                                  key={variantName}
                                  className={`cursor-pointer flex flex-col items-center px-2 py-1 rounded border text-xs transition-colors ${
                                    selectedVariant === variantName
                                      ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="variant"
                                    value={variantName}
                                    checked={selectedVariant === variantName}
                                    onChange={e => {
                                      console.log(
                                        '📝 Variant selection changed:',
                                        {
                                          from: selectedVariant,
                                          to: e.target.value,
                                        }
                                      )
                                      setSelectedVariant(e.target.value)
                                    }}
                                    className="sr-only"
                                  />
                                  <div className="font-medium capitalize">
                                    {variantName}
                                  </div>
                                  <div className="text-gray-500 dark:text-gray-400">
                                    {variant.width}×{variant.height}
                                  </div>
                                </label>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Select Button */}
                      <div className="flex-shrink-0">
                        <button
                          onClick={handleSelect}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          {/* Media Grid */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredMedia.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {paginatedMedia.map(media => (
                  <div
                    key={media.id}
                    className={`relative cursor-pointer rounded-lg border transition-all duration-150 group overflow-hidden ${
                      selectedMedia?.id === media.id
                        ? 'border-blue-500 ring-1 ring-blue-200 dark:ring-blue-900/50 shadow-md'
                        : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm'
                    } bg-white dark:bg-gray-800`}
                    onClick={() => {
                      const mediaType = getMediaTypeFromMime(media.contentType)

                      if (mediaType === 'image') {
                        // For images, show single view (variant selector only appears if variants exist)
                        setSelectedMedia(media)
                        setSelectedVariant('original')
                        setViewMode('single')
                      } else {
                        // For non-image files, directly select
                        const mediaValue: MediaFieldValue = {
                          _type: 'media',
                          asset: {
                            _ref: media.id,
                            _type: 'mediaAsset',
                          },
                          alt: '',
                          caption: '',
                          title: '', // Leave empty by default - users can add their own meaningful title
                          variant: 'original',
                        }
                        onSelect(mediaValue)
                      }
                    }}
                  >
                    <div className="h-20 relative overflow-hidden bg-gray-50 dark:bg-gray-900">
                      {/* Variant count badge */}
                      {(() => {
                        const variantCount = media.metadata?.imageVariants
                          ? Object.keys(media.metadata.imageVariants).length
                          : 0
                        return variantCount > 0 ? (
                          <div className="absolute top-1 right-1 bg-blue-600 text-white text-[10px] px-1 py-0.5 rounded-full z-10 font-medium">
                            {variantCount}
                          </div>
                        ) : null
                      })()}
                      {(() => {
                        const mediaType = getMediaTypeFromMime(
                          media.contentType
                        )

                        if (mediaType === 'image') {
                          return (
                            <img
                              src={getMediaUrl(
                                media,
                                getBestPreviewVariant(media),
                                mediaUrlGenerator,
                                apiClient
                              )}
                              alt={media.metadata?.title || media.filename}
                              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                            />
                          )
                        }

                        return (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-6 h-6 text-gray-400 dark:text-gray-500">
                              {getMediaTypeIcon(mediaType)}
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Media info */}
                    <div className="px-1.5 py-1">
                      <p
                        className="text-[10px] font-medium text-gray-900 dark:text-white truncate leading-tight"
                        title={media.filename}
                      >
                        {media.filename}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                        {formatFileSize(media.size)} MB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-500 dark:text-gray-400">
                <div className="w-12 h-12 mb-3 opacity-50">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-center">
                  {mediaTypeFilter
                    ? `No ${mediaTypeFilter} files found${searchTerm ? ' matching your search' : ''}`
                    : `No media files found${searchTerm ? ' matching your search' : ''}`}
                </p>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {filteredMedia.length > itemsPerPage && viewMode === 'grid' && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <div className="text-[10px] text-gray-500 dark:text-gray-400">
                {startIndex + 1}-{Math.min(endIndex, filteredMedia.length)} of {filteredMedia.length}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-0.5 text-[10px] font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <span className="text-[10px] text-gray-600 dark:text-gray-300 px-1">
                  {currentPage}/{totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-0.5 text-[10px] font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
