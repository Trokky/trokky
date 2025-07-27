/**
 * Media Field Component
 * React component for media file upload and selection
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
// TODO: Add proper icon imports when Studio icons are available
// Using placeholder icons for now
const PhotoIcon = ({ className }: { className?: string }) => <div className={className}>📷</div>;
const DocumentIcon = ({ className }: { className?: string }) => <div className={className}>📄</div>;
const VideoCameraIcon = ({ className }: { className?: string }) => <div className={className}>🎥</div>;
const SpeakerWaveIcon = ({ className }: { className?: string }) => <div className={className}>🔊</div>;
const ArchiveBoxIcon = ({ className }: { className?: string }) => <div className={className}>📦</div>;
const PlusIcon = ({ className }: { className?: string }) => <div className={className}>➕</div>;
const XMarkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const EyeIcon = ({ className }: { className?: string }) => <div className={className}>👁️</div>;
const PencilIcon = ({ className }: { className?: string }) => <div className={className}>✏️</div>;
const CloudArrowUpIcon = ({ className }: { className?: string }) => <div className={className}>☁️</div>;
const FolderOpenIcon = ({ className }: { className?: string }) => <div className={className}>📁</div>;
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { MediaFieldDefinition, MediaFieldValue, MediaType } from './definition.js';
import { MediaBrowser } from './MediaBrowser.js';

type MediaFieldComponentProps = FieldComponentProps;

// Media type icon mapping
const MEDIA_TYPE_ICONS = {
  image: PhotoIcon,
  video: VideoCameraIcon, 
  audio: SpeakerWaveIcon,
  document: DocumentIcon,
  archive: ArchiveBoxIcon
};

// Get media type from MIME type
function getMediaTypeFromMime(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document';
  return 'archive';
}

// Format file size for display
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Media asset interface (from Studio API)
interface MediaAsset {
  id: string;
  filename: string;
  originalFilename?: string;
  contentType: string;
  size: number;
  url: string;
  uploadedAt: string;
  title?: string;
  description?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    title?: string;
    alt?: string;
    credit?: string;
    author?: string;
    tags?: string[];
    imageVariants?: Record<string, {
      url: string;
      width: number;
      height: number;
      format: string;
      size: number;
    }>;
    originalDimensions?: {
      width: number;
      height: number;
    };
  };
}

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
  } = props;

  const mediaDefinition = definition as MediaFieldDefinition;
  const options = mediaDefinition.options || {};
  const validation = mediaDefinition.validation || {};
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [showMetadataEditor, setShowMetadataEditor] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentAsset, setCurrentAsset] = useState<MediaAsset | null>(null);
  const [assetLoadError, setAssetLoadError] = useState<string | null>(null);
  
  // Debug Studio context availability using Studio logger
  if (studioContext?.logger) {
    studioContext.logger.debug('MediaField initialized', {
      hasStudioContext: !!studioContext,
      hasApiClient: !!studioContext?.apiClient,
      hasGetMedia: !!(studioContext?.apiClient?.getMedia),
      hasDocumentContext: !!documentContext,
      fieldId,
      fieldType: definition.type,
      options: options,
      enableUpload: options.enableUpload,
      enableBrowse: options.enableBrowse,
      enableDragDrop: options.enableDragDrop
    });
  }
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Load asset when value changes
  useEffect(() => {
    const loadAsset = async () => {
      if (!value?.asset?._ref || !studioContext?.apiClient) {
        setCurrentAsset(null);
        setAssetLoadError(null);
        return;
      }

      try {
        setAssetLoadError(null);
        studioContext.logger?.debug('Loading asset', { assetId: value.asset._ref });
        
        const response = await studioContext.apiClient.getMediaById(value.asset._ref);
        
        if (response.success && response.data?.file) {
          studioContext.logger?.info('Asset loaded successfully', { 
            assetId: value.asset._ref,
            filename: response.data.file.filename,
            contentType: response.data.file.contentType
          });
          setCurrentAsset(response.data.file);
        } else {
          studioContext.logger?.warn('Asset not found', { assetId: value.asset._ref });
          setAssetLoadError('Media asset no longer exists');
          setCurrentAsset(null);
        }
      } catch (error) {
        studioContext.logger?.error('Failed to load asset', error);
        setAssetLoadError('Failed to load media asset');
        setCurrentAsset(null);
      }
    };

    loadAsset();
  }, [value?.asset?._ref, studioContext?.apiClient]);

  // Cleanup object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (currentAsset?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(currentAsset.url);
      }
    };
  }, [currentAsset?.url]);

  // Handle file selection
  const handleFileSelect = useCallback(async (files: FileList) => {
    if (!files.length || isDisabled || isReadonly) return;

    const file = files[0]; // Single file for now
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      // Simulate upload progress (replace with actual upload logic)
      const uploadInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(uploadInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // Use secure upload implementation
      const uploadedAsset = await secureUpload(file);
      
      clearInterval(uploadInterval);
      setUploadProgress(100);
      
      // Create media field value
      const newValue: MediaFieldValue = {
        _type: 'media',
        asset: {
          _ref: uploadedAsset.id,
          _type: 'mediaAsset'
        },
        alt: '',
        caption: '',
        title: uploadedAsset.title || file.name
      };
      
      onChange(newValue);
      
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
      
    } catch (error) {
      studioContext?.logger?.error('Upload failed', error);
      setIsUploading(false);
      setUploadProgress(0);
      
      // Show user-friendly error message
      if (studioContext?.utils?.showToast) {
        studioContext.utils.showToast(
          error instanceof Error ? error.message : 'Upload failed. Please try again.',
          'error'
        );
      }
    }
  }, [onChange, isDisabled, isReadonly]);

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
      throw new Error('Upload functionality not implemented. Use existing media browser instead.');
    }
    
    try {
      const response = await studioContext.apiClient.uploadMedia(file, undefined, {
        // Add metadata for tracking
        uploadedAt: new Date().toISOString(),
        originalName: file.name,
        size: file.size,
        contentType: file.type
      });
      
      if (response.success && response.data) {
        return response.data;
      } else {
        throw new Error('Upload failed: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      studioContext?.logger?.error('Secure upload failed', error);
      throw new Error('Upload failed. Please try again or use the media browser to select existing files.');
    }
  };

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!options.enableDragDrop || isDisabled || isReadonly) return;
    setIsDragOver(true);
  }, [options.enableDragDrop, isDisabled, isReadonly]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (!options.enableDragDrop || isDisabled || isReadonly) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  }, [options.enableDragDrop, handleFileSelect, isDisabled, isReadonly]);

  // Handle click upload
  const handleUploadClick = useCallback(() => {
    if (options.enableUpload && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [options.enableUpload]);

  // Handle browse media
  const handleBrowseClick = useCallback(() => {
    if (options.enableBrowse) {
      setShowBrowser(true);
    }
  }, [options.enableBrowse]);

  // Handle media selection from browser
  const handleMediaSelected = useCallback((selectedValue: MediaFieldValue) => {
    onChange(selectedValue);
    setShowBrowser(false);
  }, [onChange]);

  // Handle remove media
  const handleRemove = useCallback(() => {
    onChange(null);
  }, [onChange]);

  // Handle metadata edit
  const handleMetadataEdit = useCallback(() => {
    setShowMetadataEditor(true);
  }, []);

  // Handle instance metadata change
  const handleInstanceMetadataChange = useCallback((field: string, newValue: string) => {
    if (!value) return;
    
    onChange({
      ...value,
      [field]: newValue
    });
  }, [value, onChange]);

  // Get accepted file types for input
  const getAcceptedTypes = () => {
    if (validation.allowedTypes) {
      return validation.allowedTypes.join(',');
    }
    if (validation.restrictToMediaType) {
      const typeMap = {
        image: 'image/*',
        video: 'video/*',
        audio: 'audio/*',
        document: '.pdf,.doc,.docx,.txt,.rtf',
        archive: '.zip,.rar,.7z,.tar,.gz'
      };
      return typeMap[validation.restrictToMediaType] || '*/*';
    }
    return '*/*';
  };

  // Get media type icon
  const getMediaIcon = (mimeType: string) => {
    const mediaType = getMediaTypeFromMime(mimeType);
    const IconComponent = MEDIA_TYPE_ICONS[mediaType] || DocumentIcon;
    return IconComponent;
  };

  // Render upload area
  const renderUploadArea = () => (
    <div
      ref={dropZoneRef}
      className={`
        relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
        ${isDragOver 
          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-300 dark:border-gray-600'
        }
        ${hasError ? '!border-red-400' : ''}
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
            <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
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
              {options.enableDragDrop ? 'Drop files here or click to upload' : 'Click to upload'}
            </h3>
            <p className="text-xs text-gray-500">
              {validation.maxFileSize 
                ? `Max size: ${formatFileSize(validation.maxFileSize)}`
                : 'Select a file to upload'
              }
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUploadClick();
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBrowseClick();
                  }}
                >
                  <FolderOpenIcon className="w-4 h-4 mr-1" />
                  Browse
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Render selected media preview with proper asset resolution
  const renderMediaPreview = () => {
    if (!value) return null;
    
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
      );
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
      );
    }
    
    // Show actual asset information
    const asset = currentAsset;
    const mediaType = asset ? getMediaTypeFromMime(asset.contentType) : 'document';
    const MediaIcon = MEDIA_TYPE_ICONS[mediaType] || DocumentIcon;
    
    return (
      <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center">
              {asset?.url && mediaType === 'image' ? (
                <img 
                  src={(() => {
                    // Try to use thumbnail variant if available
                    if (asset.metadata?.imageVariants?.thumbnail) {
                      return asset.metadata.imageVariants.thumbnail.url;
                    }
                    // Fallback to main URL
                    return asset.url;
                  })()} 
                  alt={value?.alt || asset.title || asset.filename}
                  className="w-full h-full object-cover rounded-md"
                  onError={(e) => {
                    // Fallback to icon if image fails to load
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <MediaIcon className={`w-8 h-8 text-gray-400 ${asset?.url && mediaType === 'image' ? 'hidden' : ''}`} />
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate" title={value?.title || asset?.title || asset?.filename || 'Media Asset'}>
                {value?.title || asset?.title || asset?.filename || 'Media Asset'}
              </h4>
              <div className="space-y-0.5">
                <p className="text-xs text-gray-500 truncate" title={asset?.filename}>
                  <span className="font-medium">File:</span> {asset?.filename || 'Unknown'}
                </p>
                <p className="text-xs text-gray-500">
                  <span className="font-medium">Size:</span> {asset ? formatFileSize(asset.size) : 'Unknown'}
                </p>
                {asset?.contentType && (
                  <p className="text-xs text-gray-500 truncate" title={asset.contentType}>
                    <span className="font-medium">Type:</span> {asset.contentType}
                  </p>
                )}
                {value?.variant && mediaType === 'image' && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    <span className="font-medium">Variant:</span> {value.variant}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-start space-x-2">
            {!isReadonly && (
              <button
                type="button"
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                onClick={handleRemove}
                title="Remove media"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Instance metadata editor */}
        {options.showMetadata && (
          <div className="space-y-3 pt-6 border-t border-gray-200 dark:border-gray-600">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alt text {options.requireAlt && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={value?.alt || ''}
                onChange={(e) => handleInstanceMetadataChange('alt', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Describe this image for accessibility"
                disabled={isDisabled || isReadonly}
              />
            </div>
            
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Caption {options.requireCaption && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={value?.caption || ''}
                onChange={(e) => handleInstanceMetadataChange('caption', e.target.value)}
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
                onChange={(e) => handleInstanceMetadataChange('title', e.target.value)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Override the asset title for this usage"
                disabled={isDisabled || isReadonly}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptedTypes()}
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        className="hidden"
        disabled={isDisabled || isReadonly}
      />

      {/* Render upload area or preview */}
      {value ? renderMediaPreview() : renderUploadArea()}

      {/* Media Browser Modal */}
      <MediaBrowser
        isOpen={showBrowser}
        onClose={() => setShowBrowser(false)}
        onSelect={handleMediaSelected}
        mediaTypeFilter={validation.restrictToMediaType}
        showVariantSelector={options.showVariantSelector}
        apiClient={studioContext?.apiClient}
        logger={studioContext?.logger}
      />

      {/* TODO: Add metadata editor modal */}
    </div>
  );
}