/**
 * Media Browser Content Component
 * Content for the media selection modal using global Modal component
 */

import React, { useState, useEffect } from 'react';
import type { MediaFieldValue, MediaType } from '../types.js';

// Types for Studio API integration
interface MediaFile {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  uploadedAt: string;
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

// API client interface (matching StudioContext.apiClient structure)
interface MediaBrowserAPI {
  getMedia: (options?: any) => Promise<any>;
  getMediaById?: (id: string) => Promise<any>;
  getMediaUrl?: (assetRef: string, variant?: string) => string;
  uploadMedia?: (file: File, collection?: string, metadata?: any) => Promise<any>;
  deleteMedia?: (id: string) => Promise<any>;
  updateMedia?: (id: string, metadata: any) => Promise<any>;
}

// SVG Icons
const MagnifyingGlassIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const PhotoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

interface MediaBrowserContentProps {
  onSelect: (value: MediaFieldValue) => void;
  mediaTypeFilter?: MediaType;
  showVariantSelector?: boolean;
  context?: string;
  // TODO: Add API client when Studio context is available
  apiClient?: MediaBrowserAPI;
  // Studio logger for consistent logging
  logger?: {
    debug: (message: string, data?: any) => void;
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, error?: Error | any) => void;
  };
}

// Helper functions
function getMediaTypeFromMime(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word') || 
      mimeType.includes('excel') || mimeType.includes('powerpoint') || mimeType === 'text/plain') return 'document';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || 
      mimeType.includes('tar') || mimeType.includes('gzip')) return 'archive';
  return 'document'; // fallback
}

function getMediaTypeIcon(mediaType: string): React.ReactElement {
  const iconClass = "w-full h-full";
  switch (mediaType) {
    case 'image': return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
    case 'video': return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
    case 'audio': return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    );
    case 'document': return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
    case 'archive': return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
    );
    default: return (
      <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    );
  }
}

function getImageUrl(
  media: MediaFile, 
  variant: 'thumbnail' | 'small' | 'medium' | 'large' | 'original' = 'original',
  apiClient?: MediaBrowserAPI
): string {
  // Check for specific variant in imageVariants metadata
  if (variant !== 'original' && media.metadata?.imageVariants?.[variant]) {
    return media.metadata.imageVariants[variant].url;
  }
  
  // Use API client if available to get proper media URL
  if (apiClient && typeof apiClient.getMediaUrl === 'function') {
    return apiClient.getMediaUrl(media.id);
  }
  
  // Fallback to main URL or relative path (without /api prefix)
  return media.url || `/media/${media.id}/file`;
}

function formatFileSize(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

export function MediaBrowserContent({ 
  onSelect, 
  mediaTypeFilter, 
  showVariantSelector = false,
  context,
  apiClient,
  logger
}: MediaBrowserContentProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>('original');
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');
  
  // Cross-platform development check
  const isDevelopment = typeof window !== 'undefined' && (window as any).__TROKKY_DEV__ === true;

  // Load media files when component mounts
  useEffect(() => {
    loadMediaFiles();
  }, []);

  const loadMediaFiles = async () => {
    setIsLoading(true);
    try {
      logger?.debug('MediaBrowser: apiClient received', { 
        apiClient: !!apiClient, 
        type: typeof apiClient, 
        hasGetMedia: !!(apiClient?.getMedia) 
      });
      
      if (apiClient && typeof apiClient.getMedia === 'function') {
        // Use real API when available
        logger?.debug('MediaBrowser: Loading media from API...');
        const response = await apiClient.getMedia();
        
        logger?.debug('MediaBrowser: API response received', response);
        
        // Handle v2 API response format only
        if (response?.success && Array.isArray(response.data)) {
          logger?.info('MediaBrowser: Loaded media files from API', { count: response.data.length });
          setMediaFiles(response.data);
        } else {
          logger?.warn('MediaBrowser: Invalid API response format', response);
          setMediaFiles([]);
        }
      } else {
        // Fallback to mock data for development/demo
        logger?.warn('MediaBrowser: No API client provided, using mock data');
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
              author: 'John Photographer'
            }
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
              title: 'Product Demo Video'
            }
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
              title: 'Background Music Track'
            }
          },
          {
            id: 'asset-4',
            filename: 'user-manual.pdf',
            contentType: 'application/pdf',
            size: 1048576,
            url: '#',
            uploadedAt: new Date().toISOString(),
            metadata: {
              title: 'User Manual Document'
            }
          }
        ];
        
        setMediaFiles(mockData);
      }
    } catch (error) {
      logger?.error('Failed to load media files', error);
      setMediaFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter media files
  const filteredMedia = mediaFiles.filter(media => {
    // Apply media type filter
    if (mediaTypeFilter && getMediaTypeFromMime(media.contentType) !== mediaTypeFilter) {
      return false;
    }
    
    // Apply search filter
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      media.filename.toLowerCase().includes(search) ||
      media.id.toLowerCase().includes(search) ||
      (media.metadata?.title && media.metadata.title.toLowerCase().includes(search)) ||
      (media.metadata?.author && media.metadata.author.toLowerCase().includes(search)) ||
      (media.metadata?.credit && media.metadata.credit.toLowerCase().includes(search))
    );
  });

  const handleSelect = () => {
    if (selectedMedia) {
      // Create MediaFieldValue
      const mediaValue: MediaFieldValue = {
        _type: 'media',
        asset: {
          _ref: selectedMedia.id,
          _type: 'mediaAsset'
        },
        alt: '',
        caption: '',
        title: selectedMedia.metadata?.title || selectedMedia.filename,
        variant: selectedVariant
      };
      
      onSelect(mediaValue);
      setSelectedMedia(null);
      setSelectedVariant('original');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar - Only show in grid view */}
      {viewMode === 'grid' && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-600">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by filename, title, author, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              onClick={() => setViewMode('grid')}
              className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Grid
            </button>
          </div>

          {/* Single Media Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-col lg:flex-row gap-6">
                {/* Large Preview */}
                <div className="flex-1">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex items-center justify-center" style={{ maxHeight: '400px', height: '400px' }}>
                    {(() => {
                      const mediaType = getMediaTypeFromMime(selectedMedia.contentType);
                      
                      if (mediaType === 'image') {
                        const previewUrl = selectedVariant === 'original' 
                          ? selectedMedia.url 
                          : getImageUrl(selectedMedia, selectedVariant as any, apiClient);
                        
                        return (
                          <img
                            src={previewUrl}
                            alt={selectedMedia.metadata?.title || selectedMedia.filename}
                            className="max-w-full max-h-full object-contain"
                          />
                        );
                      }
                      
                      return (
                        <div className="w-16 h-16 opacity-50">{getMediaTypeIcon(mediaType)}</div>
                      );
                    })()}
                  </div>
                </div>

                {/* Media Info & Variants */}
                <div className="lg:w-80">
                  {/* File Name */}
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white" title={selectedMedia.filename}>
                      {selectedMedia.filename}
                    </h3>
                  </div>

                  {/* Properties and Variants Side by Side */}
                  <div className="flex gap-6">
                    {/* Properties (Left) */}
                    <div className={getMediaTypeFromMime(selectedMedia.contentType) === 'image' && selectedMedia.metadata?.imageVariants && Object.keys(selectedMedia.metadata.imageVariants).length > 0 ? 'w-1/3' : 'flex-1'}>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Properties</h4>
                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <p>
                          <span className="font-medium">Dimensions:</span>{' '}
                          {(() => {
                            // Try originalDimensions first (for images with variants)
                            if (selectedMedia.metadata?.originalDimensions) {
                              return `${selectedMedia.metadata.originalDimensions.width} × ${selectedMedia.metadata.originalDimensions.height}`;
                            }
                            // Fallback to regular width/height (for images without variants)
                            if (selectedMedia.metadata?.width && selectedMedia.metadata?.height) {
                              return `${selectedMedia.metadata.width} × ${selectedMedia.metadata.height}`;
                            }
                            // For non-image files or files without dimensions
                            return 'Not available';
                          })()}
                        </p>
                        <p>
                          <span className="font-medium">Size:</span> {formatFileSize(selectedMedia.size)} MB
                        </p>
                        <p>
                          <span className="font-medium">Type:</span> <span className="capitalize">{getMediaTypeFromMime(selectedMedia.contentType)}</span>
                        </p>
                        <p>
                          <span className="font-medium">Format:</span> {selectedMedia.contentType}
                        </p>
                        {selectedMedia.metadata?.title && (
                          <p>
                            <span className="font-medium">Title:</span> {selectedMedia.metadata.title}
                          </p>
                        )}
                        {selectedMedia.metadata?.author && (
                          <p>
                            <span className="font-medium">Author:</span> {selectedMedia.metadata.author}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Variant Selection (Right) */}
                    {getMediaTypeFromMime(selectedMedia.contentType) === 'image' && selectedMedia.metadata?.imageVariants && Object.keys(selectedMedia.metadata.imageVariants).length > 0 && (
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Choose Variant</h4>
                        <div className="flex flex-wrap gap-2">
                          {/* Original variant */}
                          <label className={`cursor-pointer px-1.5 py-3 rounded border transition-colors flex-1 min-w-0 ${
                            selectedVariant === 'original'
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}>
                            <input
                              type="radio"
                              name="singleVariant"
                              value="original"
                              checked={selectedVariant === 'original'}
                              onChange={(e) => setSelectedVariant(e.target.value)}
                              className="sr-only"
                            />
                            <div className="text-center">
                              <div className="text-xs font-medium text-gray-900 dark:text-white truncate">Original</div>
                              {selectedMedia.metadata?.originalDimensions && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {selectedMedia.metadata.originalDimensions.width}×{selectedMedia.metadata.originalDimensions.height}
                                </div>
                              )}
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {formatFileSize(selectedMedia.size)}MB
                              </div>
                            </div>
                          </label>

                          {/* Available variants */}
                          {Object.entries(selectedMedia.metadata.imageVariants).map(([variantName, variant]) => (
                            <label 
                              key={variantName}
                              className={`cursor-pointer px-1.5 py-3 rounded border transition-colors flex-1 min-w-0 ${
                                selectedVariant === variantName
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                            >
                              <input
                                type="radio"
                                name="singleVariant"
                                value={variantName}
                                checked={selectedVariant === variantName}
                                onChange={(e) => setSelectedVariant(e.target.value)}
                                className="sr-only"
                              />
                              <div className="text-center">
                                <div className="text-xs font-medium text-gray-900 dark:text-white capitalize truncate">{variantName}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {variant.width}×{variant.height}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {formatFileSize(variant.size)}MB
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Selected Media Info in Grid View */}
          {selectedMedia && viewMode === 'grid' && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-600">
          <div className="flex items-start space-x-4">
            {/* Media preview */}
            <div className="w-16 h-16 rounded overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
              {(() => {
                const mediaType = getMediaTypeFromMime(selectedMedia.contentType);
                
                if (mediaType === 'image') {
                  return (
                    <img
                      src={getImageUrl(selectedMedia, 'thumbnail', apiClient)}
                      alt={selectedMedia.filename}
                      className="w-full h-full object-cover"
                    />
                  );
                }
                
                return (
                  <div className="w-6 h-6 text-gray-500 dark:text-gray-400">
                    {getMediaTypeIcon(mediaType)}
                  </div>
                );
              })()} 
            </div>
            
            {/* Media info and variants */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate" title={selectedMedia.filename}>
                    {selectedMedia.filename}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedMedia.metadata?.width && selectedMedia.metadata?.height 
                      ? `${selectedMedia.metadata.width} × ${selectedMedia.metadata.height} • `
                      : ''
                    }{formatFileSize(selectedMedia.size)} MB
                  </p>
                </div>
                
                {/* Variant Selector for Images */}
                {getMediaTypeFromMime(selectedMedia.contentType) === 'image' && selectedMedia.metadata?.imageVariants && Object.keys(selectedMedia.metadata.imageVariants).length > 0 && (
                  <div className="flex-shrink-0">
                    <label className="block text-xs font-medium text-gray-700 dark:text-white mb-1">
                      Variant
                    </label>
                    <div className="flex items-center space-x-1">
                      {/* Original variant */}
                      <label className={`cursor-pointer flex flex-col items-center px-2 py-1 rounded border text-xs transition-colors ${
                        selectedVariant === 'original' 
                          ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}>
                        <input
                          type="radio"
                          name="variant"
                          value="original"
                          checked={selectedVariant === 'original'}
                          onChange={(e) => setSelectedVariant(e.target.value)}
                          className="sr-only"
                        />
                        <div className="font-medium">Original</div>
                        {selectedMedia.metadata?.originalDimensions && (
                          <div className="text-gray-500 dark:text-gray-400">
                            {selectedMedia.metadata.originalDimensions.width}×{selectedMedia.metadata.originalDimensions.height}
                          </div>
                        )}
                      </label>
                      
                      {/* Available variants */}
                      {Object.entries(selectedMedia.metadata.imageVariants).map(([variantName, variant]) => (
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
                            onChange={(e) => setSelectedVariant(e.target.value)}
                            className="sr-only"
                          />
                          <div className="font-medium capitalize">{variantName}</div>
                          <div className="text-gray-500 dark:text-gray-400">
                            {variant.width}×{variant.height}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Media Grid */}
      <div className="flex-1 overflow-y-auto p-4 max-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredMedia.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredMedia.map((media) => (
              <div
                key={media.id}
                className={`relative cursor-pointer rounded-xl border transition-all duration-200 group overflow-hidden ${
                  selectedMedia?.id === media.id
                    ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/50 shadow-lg transform scale-[1.02]'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md hover:transform hover:scale-[1.01]'
                } bg-white dark:bg-gray-800 shadow-sm`}
                onClick={() => {
                  setSelectedMedia(media);
                  setSelectedVariant('original'); // Reset to original when selecting new media
                  
                  // Only switch to single view for image types
                  const mediaType = getMediaTypeFromMime(media.contentType);
                  if (mediaType === 'image') {
                    setViewMode('single');
                  }
                }}
              >
                <div className="aspect-square relative overflow-hidden">
                  {/* Variant count badge */}
                  {(() => {
                    const variantCount = media.metadata?.imageVariants ? Object.keys(media.metadata.imageVariants).length : 0;
                    return variantCount > 0 ? (
                      <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full z-10 font-medium shadow-sm">
                        {variantCount}
                      </div>
                    ) : null;
                  })()}
                  {(() => {
                    const mediaType = getMediaTypeFromMime(media.contentType);
                    
                    if (mediaType === 'image') {
                      return (
                        <img
                          src={getImageUrl(media, 'thumbnail', apiClient)}
                          alt={media.metadata?.title || media.filename}
                          className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      );
                    }
                    
                    if (mediaType === 'video') {
                      return (
                        <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center relative">
                          <div className="text-4xl text-white opacity-80">{getMediaTypeIcon(mediaType)}</div>
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md font-medium">
                            VIDEO
                          </div>
                        </div>
                      );
                    }
                    
                    if (mediaType === 'audio') {
                      return (
                        <div className="w-full h-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 dark:from-purple-600/30 dark:to-blue-600/30 flex flex-col items-center justify-center p-3">
                          <div className="text-3xl mb-2 opacity-80">{getMediaTypeIcon(mediaType)}</div>
                          <div className="text-xs text-gray-700 dark:text-gray-200 text-center font-medium">
                            {media.contentType.split('/')[1]?.toUpperCase() || 'AUDIO'}
                          </div>
                        </div>
                      );
                    }
                    
                    // For documents and other files
                    return (
                      <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 flex flex-col items-center justify-center p-3">
                        <div className="text-3xl mb-2 opacity-80">{getMediaTypeIcon(mediaType)}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 text-center font-medium">
                          {media.contentType.split('/')[1]?.toUpperCase() || 'FILE'}
                        </div>
                      </div>
                    );
                  })()}
                  
                  {selectedMedia?.id === media.id && (
                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center backdrop-blur-sm">
                      <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-2">
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate" title={media.filename}>
                    {media.filename}
                  </p>
                  {media.metadata?.title && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5" title={media.metadata.title}>
                      {media.metadata.title}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {formatFileSize(media.size)}MB
                    </p>
                    {media.metadata?.width && media.metadata?.height && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {media.metadata.width}×{media.metadata.height}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : searchTerm ? (
          <div className="text-center py-12">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No results found</h3>
            <p className="text-gray-600 dark:text-gray-400">Try a different search term</p>
          </div>
        ) : (
          <div className="text-center py-12">
            <PhotoIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No {mediaTypeFilter ? `${mediaTypeFilter} files` : 'media files'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Upload some {mediaTypeFilter ? `${mediaTypeFilter} files` : 'media files'} to get started
            </p>
          </div>
        )}
      </div>
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-600">
        <button
          onClick={handleSelect}
          disabled={!selectedMedia}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mediaTypeFilter ? `Select ${mediaTypeFilter.charAt(0).toUpperCase() + mediaTypeFilter.slice(1)}` : 'Select Media'}
        </button>
      </div>
    </div>
  );
}
