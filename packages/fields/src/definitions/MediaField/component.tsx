/**
 * Media Field Component
 * React component for media file upload and selection
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import type { FieldComponentProps } from '../../base/FieldPlugin'
import type { MediaFieldDefinition } from './definition'
import type { MediaFieldValue, MediaType, MediaAsset } from '@trokky/types'
import { MEDIA_FIELD_DEFAULTS } from './definition'

// Heroicons imports - using icons that are available
import {
  PhotoIcon,
  XMarkIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'

// Custom SVG icons for compatibility
const DocumentIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
)

const VideoCameraIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

const SpeakerWaveIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
  </svg>
)

const ArchiveBoxIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
)

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const PencilIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
)

const CloudArrowUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
)

const FolderIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
)

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

type MediaFieldComponentProps = FieldComponentProps

// Media type icon mapping
const MEDIA_TYPE_ICONS = {
  image: PhotoIcon,
  video: VideoCameraIcon,
  audio: SpeakerWaveIcon,
  document: DocumentIcon,
  archive: ArchiveBoxIcon,
}

// Get media type from MIME type
function getMediaTypeFromMime(mimeType: string | undefined | null): MediaType {
  // Guard against undefined/null mimeType
  if (!mimeType || typeof mimeType !== 'string') {
    return 'document' // Default fallback
  }

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

// Get human-readable media type label
function getMediaTypeLabel(mediaType: MediaType): string {
  const labels: Record<MediaType, string> = {
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    document: 'Document',
    archive: 'Archive',
  }
  return labels[mediaType] || 'Media'
}

// Format file size for display
function formatFileSize(bytes: number | undefined | null): string {
  // Guard against undefined/null bytes
  if (bytes === undefined || bytes === null || typeof bytes !== 'number') {
    return 'Unknown size'
  }

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
function truncateText(text: string, maxLength: number = 50): string {
  if (!text || text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

// MediaAsset is now imported from @trokky/core

export function MediaFieldComponent(props: MediaFieldComponentProps) {
  const {
    fieldId,
    value,
    onChange,
    definition,
    hasError,
    isDisabled,
    isReadonly,
    documentContext,
    studioContext,
    ...restProps
  } = props

  const mediaDefinition = definition as MediaFieldDefinition
  const options = {
    ...MEDIA_FIELD_DEFAULTS.options,
    ...mediaDefinition.options,
  }
  const validation = {
    ...MEDIA_FIELD_DEFAULTS.validation,
    ...mediaDefinition.validation,
  }

  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showMetadataEditor, setShowMetadataEditor] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [currentAsset, setCurrentAsset] = useState<MediaAsset | null>(null)
  const [assetLoadError, setAssetLoadError] = useState<string | null>(null)
  const [isMetadataExpanded, setIsMetadataExpanded] = useState(false) // Collapsed by default

  // Debug Studio context availability using Studio logger
  if (studioContext?.logger) {
    studioContext.logger.debug('MediaField initialized', {
      hasStudioContext: !!studioContext,
      hasApiClient: !!studioContext?.apiClient,
      fieldId,
      enableUpload: options.enableUpload,
      enableBrowse: options.enableBrowse,
    })
  }

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)

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

        const response = await studioContext.apiClient.getMediaById(
          value.asset._ref
        )

        if (response.success && response.data?.file) {
          studioContext.logger?.info('Asset loaded successfully', {
            assetId: value.asset._ref,
            filename: response.data.file.filename,
            contentType: response.data.file.contentType,
          })
          setCurrentAsset(response.data.file)
        } else {
          studioContext.logger?.warn('Asset not found', {
            assetId: value.asset._ref,
          })
          setAssetLoadError('Media asset no longer exists')
          setCurrentAsset(null)
        }
      } catch (error) {
        studioContext.logger?.error('Failed to load asset', error)
        setAssetLoadError('Failed to load media asset')
        setCurrentAsset(null)
      }
    }

    loadAsset()
  }, [value?.asset?._ref, studioContext?.apiClient])

  // Cleanup object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (currentAsset?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(currentAsset.url)
      }
    }
  }, [currentAsset?.url])

  // Handle file selection
  const handleFileSelect = useCallback(
    async (files: FileList) => {
      if (!files.length || isDisabled || isReadonly) return

      const file = files[0] // Single file for now

      try {
        setIsUploading(true)
        setUploadProgress(0)

        // Simulate upload progress (replace with actual upload logic)
        const uploadInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) {
              clearInterval(uploadInterval)
              return 90
            }
            return prev + 10
          })
        }, 100)

        // Use secure upload implementation
        const uploadResponse: any = await secureUpload(file)

        clearInterval(uploadInterval)
        setUploadProgress(100)

        // Extract the actual asset from the response (API returns {files: [asset], meta: {...}})
        const uploadedAsset: MediaAsset = uploadResponse.files?.[0] || uploadResponse

        // Enhance the uploaded asset with file properties if missing
        const enrichedAsset: MediaAsset = {
          ...uploadedAsset,
          filename: uploadedAsset.filename || file.name,
          size: uploadedAsset.size || file.size,
          contentType: uploadedAsset.contentType || file.type,
          title: uploadedAsset.title || file.name,
        }

        // Set the enriched asset immediately to avoid loading state
        setCurrentAsset(enrichedAsset)
        setAssetLoadError(null)

        // Create media field value
        const newValue: MediaFieldValue = {
          _type: 'media',
          asset: {
            _ref: uploadedAsset.id,
            _type: 'mediaAsset',
          },
          // Don't set variant - let it default to 'thumbnail' which is a proper variant
          // 'original' is NOT a variant in Trokky, it's the actual file at /file endpoint
          alt: '',
          caption: '',
          title: uploadedAsset.title || file.name,
        }

        onChange(newValue)

        setTimeout(() => {
          setIsUploading(false)
          setUploadProgress(0)
          setShowUploadDialog(false) // Close modal after successful upload
        }, 500)
      } catch (error) {
        studioContext?.logger?.error('Upload failed', error)
        setIsUploading(false)
        setUploadProgress(0)

        // Show user-friendly error message
        if (studioContext?.utils?.showToast) {
          studioContext.utils.showToast(
            error instanceof Error
              ? error.message
              : 'Upload failed. Please try again.',
            'error'
          )
        }
      }
    },
    [onChange, isDisabled, isReadonly]
  )

  // SECURITY: Replace with actual server-side upload implementation
  // This is a placeholder that should be replaced with proper upload API
  const secureUpload = async (file: File): Promise<MediaAsset> => {
    // TODO: Implement proper server-side upload with:
    // 1. File validation on server
    // 2. Virus scanning
    // 3. Content type verification
    // 4. Safe file storage (not in web-accessible directory)
    // 5. Proper asset management

    if (!studioContext?.apiClient?.uploadMedia) {
      throw new Error(
        'Upload functionality not implemented. Use existing media browser instead.'
      )
    }

    try {
      const response = await studioContext.apiClient.uploadMedia(
        file,
        undefined,
        {
          // Add metadata for tracking
          uploadedAt: new Date().toISOString(),
          originalName: file.name,
          size: file.size,
          contentType: file.type,
        }
      )

      if (response.success && response.data) {
        return response.data
      } else {
        throw new Error('Upload failed: ' + (response.error || 'Unknown error'))
      }
    } catch (error) {
      studioContext?.logger?.error('Secure upload failed', error)
      throw new Error(
        'Upload failed. Please try again or use the media browser to select existing files.'
      )
    }
  }

  // Handle drag events
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (!options.enableDragDrop || isDisabled || isReadonly) return
      setIsDragOver(true)
    },
    [options.enableDragDrop, isDisabled, isReadonly]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)

      if (!options.enableDragDrop || isDisabled || isReadonly) return

      const files = e.dataTransfer.files
      if (files.length > 0) {
        handleFileSelect(files)
      }
    },
    [options.enableDragDrop, handleFileSelect, isDisabled, isReadonly]
  )

  // Handle click upload
  const handleUploadClick = useCallback(() => {
    if (options.enableUpload && fileInputRef.current) {
      fileInputRef.current.click()
    }
  }, [options.enableUpload])

  // Handle browse media
  const handleBrowseClick = useCallback(() => {
    if (options.enableBrowse && studioContext?.utils?.showMediaBrowser) {
      studioContext.utils.showMediaBrowser({
        onSelect: (selectedValue: MediaFieldValue) => {
          onChange(selectedValue)
          setShowUploadDialog(false) // Close modal after selecting from browser
        },
        mediaTypeFilter: validation.restrictToMediaType,
        showVariantSelector: options.showVariantSelector,
        context: fieldId,
      })
    }
  }, [
    options.enableBrowse,
    studioContext,
    onChange,
    validation.restrictToMediaType,
    options.showVariantSelector,
    fieldId,
  ])

  // Handle remove media
  const handleRemove = useCallback(() => {
    onChange(null)
  }, [onChange])

  // Handle metadata edit
  const handleMetadataEdit = useCallback(() => {
    setShowMetadataEditor(true)
  }, [])

  // Handle instance metadata change
  const handleInstanceMetadataChange = useCallback(
    (field: string, newValue: string) => {
      if (!value) return

      onChange({
        ...value,
        [field]: newValue,
      })
    },
    [value, onChange]
  )

  // Get accepted file types for input
  const getAcceptedTypes = () => {
    if (validation.allowedTypes) {
      return validation.allowedTypes.join(',')
    }
    if (validation.restrictToMediaType) {
      const typeMap = {
        image: 'image/*',
        video: 'video/*',
        audio: 'audio/*',
        document: '.pdf,.doc,.docx,.txt,.rtf',
        archive: '.zip,.rar,.7z,.tar,.gz',
      }
      return typeMap[validation.restrictToMediaType] || '*/*'
    }
    return '*/*'
  }

  // Get media type icon
  const getMediaIcon = (mimeType: string) => {
    const mediaType = getMediaTypeFromMime(mimeType)
    const IconComponent = MEDIA_TYPE_ICONS[mediaType] || DocumentIcon
    return IconComponent
  }

  // Get image URL with fallback logic for variants
  const getImageUrl = useCallback((assetRef: string, preferredVariant?: string): string => {
    const asset = currentAsset

    // Special case: "original" variant should use the base asset URL directly
    if (preferredVariant === 'original' && asset?.url) {
      return asset.url
    }

    // Try to get URL from mediaUrlGenerator or apiClient
    if (studioContext?.mediaUrlGenerator) {
      const variant = preferredVariant || 'thumbnail'
      const generatedUrl = studioContext.mediaUrlGenerator.getMediaUrl(assetRef, variant)
      if (generatedUrl) {
        return generatedUrl
      }
    }

    if (studioContext?.apiClient?.getMediaUrl) {
      const variant = preferredVariant || 'thumbnail'
      const generatedUrl = studioContext.apiClient.getMediaUrl(assetRef, variant)
      if (generatedUrl) {
        return generatedUrl
      }
    }

    // Fallback to metadata variants in order: preferred → thumbnail → original → any available → base URL
    if (asset?.metadata?.imageVariants) {
      const variants = asset.metadata.imageVariants

      // Try preferred variant first
      if (preferredVariant && variants[preferredVariant]?.url) {
        return variants[preferredVariant].url
      }

      // Try thumbnail
      if (variants.thumbnail?.url) {
        return variants.thumbnail.url
      }

      // Try original
      if (variants.original?.url) {
        return variants.original.url
      }

      // Try any available variant
      const anyVariant = Object.values(variants).find(v => v?.url)
      if (anyVariant?.url) {
        return anyVariant.url
      }
    }

    // Final fallback to base asset URL
    return asset?.url || ''
  }, [currentAsset, studioContext])

  // Check if value represents an empty/unset media field
  // This handles cases where value is { _type: 'media' } without an actual asset reference
  const isEmptyMediaValue = !value || !value.asset || !value.asset._ref;

  // Render compact button for empty state - matches the filled state style
  const renderCompactButton = () => {
    // Get the appropriate icon based on media type restriction
    const mediaType = validation.restrictToMediaType || 'image'
    const IconComponent = MEDIA_TYPE_ICONS[mediaType] || PhotoIcon
    const typeLabel = getMediaTypeLabel(mediaType)

    return (
      <div
        className={`
          border rounded-lg bg-white dark:bg-gray-800 overflow-hidden transition-colors
          ${hasError ? 'border-red-300 dark:border-red-600' : 'border-gray-200 dark:border-gray-700'}
          ${isDisabled || isReadonly ? 'opacity-50' : ''}
        `}
      >
        <button
          type="button"
          onClick={() => setShowUploadDialog(true)}
          disabled={isDisabled || isReadonly}
          className={`
            w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
            ${isDisabled || isReadonly ? 'cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          {/* Thumbnail placeholder */}
          <div className="w-12 h-12 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
            <IconComponent className="w-6 h-6 text-gray-400" />
          </div>

          {/* Text content */}
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {options.placeholder || `Select ${typeLabel.toLowerCase()}`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Click to upload or browse
            </p>
          </div>

        </button>
      </div>
    )
  }

  // Render upload dialog (modal)
  const renderUploadDialog = () => {
    if (!showUploadDialog) return null

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowUploadDialog(false)}>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 border-2 border-gray-300 dark:border-gray-600 shadow-xl" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {validation.restrictToMediaType ? `Add ${validation.restrictToMediaType}` : 'Add media'}
            </h3>
            <button
              type="button"
              onClick={() => setShowUploadDialog(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div
            ref={dropZoneRef}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${
                isDragOver
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-gray-600'
              }
              ${isDisabled || isReadonly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={!isDisabled && !isReadonly ? handleUploadClick : undefined}
          >
            {isUploading ? (
              <div className="space-y-4">
                <CloudArrowUpIcon className="mx-auto h-12 w-12 text-blue-500 animate-pulse" />
                <div className="space-y-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Uploading...
                  </p>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">{uploadProgress}%</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    {options.enableDragDrop
                      ? 'Drop files here or click to upload'
                      : 'Click to upload'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {validation.maxFileSize
                      ? `Max size: ${formatFileSize(validation.maxFileSize)}`
                      : 'Select a file to upload'}
                  </p>
                  {validation.allowedExtensions && (
                    <p className="text-xs text-gray-500">
                      Allowed: {validation.allowedExtensions.join(', ')}
                    </p>
                  )}
                </div>

                {(options.enableUpload || options.enableBrowse) && (
                  <div className="flex justify-center space-x-3">
                    {options.enableUpload && (
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 dark:bg-blue-900/50 dark:border-blue-700 dark:text-blue-400"
                        onClick={e => {
                          e.stopPropagation()
                          handleUploadClick()
                        }}
                      >
                        <PlusIcon className="w-4 h-4 mr-1" />
                        Upload
                      </button>
                    )}

                    {options.enableBrowse && (
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400"
                        onClick={e => {
                          e.stopPropagation()
                          handleBrowseClick()
                        }}
                      >
                        <FolderIcon className="w-4 h-4 mr-1" />
                        Browse
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setShowUploadDialog(false)}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render selected media preview with proper asset resolution
  const renderMediaPreview = () => {
    if (!value) return null

    // Show error state if asset failed to load
    if (assetLoadError) {
      return (
        <div className="border border-red-200 dark:border-red-600 rounded-lg p-4 space-y-3 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-700 rounded-md flex items-center justify-center">
                <XMarkIcon className="w-8 h-8 text-red-400" />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-red-900 dark:text-red-300 truncate">
                  {value?.title || 'Media Asset'}
                </h4>
                <p className="text-xs text-red-600 dark:text-red-400">
                  {assetLoadError}
                </p>
                <p className="text-xs text-red-500 dark:text-red-500 truncate">
                  Asset ID: {value.asset._ref}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {!isReadonly && (
                <button
                  type="button"
                  className="p-1 text-red-400 hover:text-red-600"
                  onClick={handleRemove}
                  title="Remove broken media reference"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }

    // Show loading state while asset is being loaded
    if (!currentAsset && !assetLoadError) {
      return (
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center animate-pulse">
                <PhotoIcon className="w-8 h-8 text-gray-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4"></div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Show actual asset information
    const asset = currentAsset
    const mediaType = asset
      ? getMediaTypeFromMime(asset.contentType)
      : 'document'
    const MediaIcon = MEDIA_TYPE_ICONS[mediaType] || DocumentIcon

    return (
      <div className="border border-gray-200 dark:border-gray-600 rounded-md p-3 space-y-3">
        <div className="flex items-center gap-3">
          {/* Compact Thumbnail */}
          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
            {mediaType === 'image' && (() => {
              const imgUrl = getImageUrl(value.asset._ref, value.variant)

              return imgUrl ? (
                <img
                  src={imgUrl}
                  alt={value?.alt || asset?.title || asset?.filename}
                  className="w-full h-full object-cover rounded"
                  onError={e => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null
            })()}
            <MediaIcon
              className={`w-6 h-6 text-gray-400 ${mediaType === 'image' && getImageUrl(value.asset._ref, value.variant) ? 'hidden' : ''}`}
            />
          </div>

          {/* File Info - Compact */}
          <div className="min-w-0 flex-1">
            <h4
              className="text-sm font-medium text-gray-900 dark:text-white truncate"
              title={value?.title || asset?.title || asset?.filename || 'Media Asset'}
            >
              {truncateText(
                value?.title || asset?.title || asset?.filename || 'Media Asset',
                40
              )}
            </h4>
            <p className="text-xs text-gray-500 truncate" title={asset?.filename}>
              {getMediaTypeLabel(mediaType)} • {truncateText(asset?.filename || 'Unknown', 30)} • {asset ? formatFileSize(asset.size) : 'Unknown'}
            </p>
          </div>

          {/* Actions - Compact */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isReadonly && (
              <>
                <button
                  type="button"
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors text-xs"
                  onClick={() => setShowUploadDialog(true)}
                  title="Change media"
                >
                  Change
                </button>
                <button
                  type="button"
                  className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors text-xs"
                  onClick={handleRemove}
                  title="Remove media"
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </div>

        {/* Instance metadata editor */}
        {options.showMetadata && (
          <div className="pt-6 border-t border-gray-200 dark:border-gray-600">
            {/* Collapsible header */}
            <button
              type="button"
              onClick={() => setIsMetadataExpanded(!isMetadataExpanded)}
              className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-3"
            >
              <span>Media Details</span>
              {isMetadataExpanded ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </button>

            {/* Collapsible content */}
            {isMetadataExpanded && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Alt text{' '}
                    {options.requireAlt && <span className="text-red-500">*</span>}
                  </label>
              <input
                type="text"
                value={value?.alt || ''}
                onChange={e =>
                  handleInstanceMetadataChange('alt', e.target.value)
                }
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Describe this image for accessibility"
                disabled={isDisabled || isReadonly}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Caption{' '}
                {options.requireCaption && (
                  <span className="text-red-500">*</span>
                )}
              </label>
              <input
                type="text"
                value={value?.caption || ''}
                onChange={e =>
                  handleInstanceMetadataChange('caption', e.target.value)
                }
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Add a caption"
                disabled={isDisabled || isReadonly}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title override
              </label>
              <input
                type="text"
                value={value?.title || ''}
                onChange={e =>
                  handleInstanceMetadataChange('title', e.target.value)
                }
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder={
                  asset?.title
                    ? truncateText(asset.title, 40)
                    : asset?.filename
                      ? truncateText(asset.filename, 40)
                      : 'Override the asset title for this usage'
                }
                title={asset?.title || asset?.filename || 'Asset title'}
                disabled={isDisabled || isReadonly}
              />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptedTypes()}
        onChange={e => e.target.files && handleFileSelect(e.target.files)}
        className="hidden"
        disabled={isDisabled || isReadonly}
      />

      {/* Render compact button or preview */}
      {isEmptyMediaValue ? renderCompactButton() : renderMediaPreview()}

      {/* Upload dialog modal */}
      {renderUploadDialog()}

      {/* TODO: Add metadata editor modal */}
    </div>
  )
}
