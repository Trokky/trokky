/**
 * Media Browser Content Component
 * Content for the media selection modal using global Modal component
 */

import React, { useState, useEffect } from 'react';
import type { MediaFieldValue, MediaType } from './definition.js';

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
  };
}

// API client interface (matching StudioContext.apiClient structure)
interface MediaBrowserAPI {
  getMedia: (options?: any) => Promise<any>;
  getMediaById?: (id: string) => Promise<any>;
  uploadMedia?: (file: File, collection?: string, metadata?: any) => Promise<any>;
  deleteMedia?: (id: string) => Promise<any>;
  updateMedia?: (id: string, metadata: any) => Promise<any>;
}

// TODO: Replace with proper icon imports when available
const MagnifyingGlassIcon = ({ className }: { className?: string }) => <div className={className}>🔍</div>;
const PhotoIcon = ({ className }: { className?: string }) => <div className={className}>📷</div>;

interface MediaBrowserContentProps {
  onSelect: (value: MediaFieldValue) => void;
  mediaTypeFilter?: MediaType;
  showVariantSelector?: boolean;
  context?: string;
  // TODO: Add API client when Studio context is available
  apiClient?: MediaBrowserAPI;
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

function getMediaTypeIcon(mediaType: string): string {
  switch (mediaType) {
    case 'image': return '🖼️';
    case 'video': return '🎥';
    case 'audio': return '🎵';
    case 'document': return '📄';
    case 'archive': return '📦';
    default: return '📁';
  }
}

function getImageUrl(media: MediaFile, variant: 'thumbnail' | 'small' | 'medium' | 'large' | 'original' = 'original'): string {
  // For now, use the main URL as variants aren't implemented in MediaFile interface
  return media.url || `/api/media/${media.id}/file`;
}

function formatFileSize(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

export function MediaBrowserContent({ 
  onSelect, 
  mediaTypeFilter, 
  showVariantSelector = false,
  context,
  apiClient
}: MediaBrowserContentProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<MediaFile | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string>('medium');
  
  // Cross-platform development check
  const isDevelopment = typeof window !== 'undefined' && (window as any).__TROKKY_DEV__ === true;

  // Load media files when component mounts
  useEffect(() => {
    loadMediaFiles();
  }, []);

  const loadMediaFiles = async () => {
    setIsLoading(true);
    try {
      if (isDevelopment) {
        console.log('MediaBrowser: apiClient received:', apiClient);
        console.log('MediaBrowser: apiClient type:', typeof apiClient);
        console.log('MediaBrowser: apiClient.getMedia available:', !!(apiClient?.getMedia));
      }
      
      if (apiClient && typeof apiClient.getMedia === 'function') {
        // Use real API when available
        if (isDevelopment) {
          console.log('MediaBrowser: Loading media from API...');
        }
        const response = await apiClient.getMedia();
        
        if (isDevelopment) {
          console.log('MediaBrowser: API response:', response);
        }
        
        // Handle v2 API response format only
        if (response?.success && Array.isArray(response.data)) {
          if (isDevelopment) {
            console.log('MediaBrowser: Loaded', response.data.length, 'media files from API');
          }
          setMediaFiles(response.data);
        } else {
          if (isDevelopment) {
            console.warn('MediaBrowser: Invalid API response format', response);
          }
          setMediaFiles([]);
        }
      } else {
        // Fallback to mock data for development/demo
        if (isDevelopment) {
          console.warn('MediaBrowser: No API client provided, using mock data');
        }
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
      console.error('Failed to load media files:', error);
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
        title: selectedMedia.metadata?.title || selectedMedia.filename
      };
      
      onSelect(mediaValue);
      setSelectedMedia(null);
      setSelectedVariant('medium');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Bar */}
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

      {/* Media Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredMedia.length > 0 ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredMedia.map((media) => (
              <div
                key={media.id}
                className={`relative cursor-pointer rounded-lg border-2 transition-all group ${
                  selectedMedia?.id === media.id
                    ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800'
                    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
                onClick={() => setSelectedMedia(media)}
              >
                <div className="aspect-square rounded-lg overflow-hidden relative">
                  {(() => {
                    const mediaType = getMediaTypeFromMime(media.contentType);
                    
                    if (mediaType === 'image') {
                      return (
                        <img
                          src={media.url}
                          alt={media.metadata?.title || media.filename}
                          className="w-full h-full object-cover"
                        />
                      );
                    }
                    
                    if (mediaType === 'video') {
                      return (
                        <div className="w-full h-full bg-black flex items-center justify-center relative">
                          <div className="text-4xl text-white">{getMediaTypeIcon(mediaType)}</div>
                          <div className="absolute bottom-1 right-1 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
                            VIDEO
                          </div>
                        </div>
                      );
                    }
                    
                    if (mediaType === 'audio') {
                      return (
                        <div className="w-full h-full bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/50 dark:to-blue-900/50 flex flex-col items-center justify-center p-2">
                          <div className="text-2xl mb-1">{getMediaTypeIcon(mediaType)}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-300 text-center truncate max-w-full">
                            {media.contentType.split('/')[1]?.toUpperCase() || 'AUDIO'}
                          </div>
                        </div>
                      );
                    }
                    
                    // For documents and other files
                    return (
                      <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center p-2">
                        <div className="text-2xl mb-1">{getMediaTypeIcon(mediaType)}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 text-center truncate max-w-full">
                          {media.contentType.split('/')[1]?.toUpperCase() || 'FILE'}
                        </div>
                      </div>
                    );
                  })()}
                  
                  {selectedMedia?.id === media.id && (
                    <div className="absolute inset-0 bg-blue-500 bg-opacity-20 rounded-lg flex items-center justify-center">
                      <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                        ✓
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-1 px-1">
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {media.filename}
                  </p>
                  {media.metadata?.title && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 truncate" title={media.metadata.title}>
                      {media.metadata.title}
                    </p>
                  )}
                  {media.metadata?.author && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      by {media.metadata.author}
                    </p>
                  )}
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

      {/* Selected Media Info */}
      {selectedMedia && (
        <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                {(() => {
                  const mediaType = getMediaTypeFromMime(selectedMedia.contentType);
                  
                  if (mediaType === 'image') {
                    return (
                      <img
                        src={getImageUrl(selectedMedia, 'thumbnail')}
                        alt={selectedMedia.filename}
                        className="w-full h-full object-cover"
                      />
                    );
                  }
                  
                  return (
                    <div className="text-gray-500 dark:text-gray-400 text-xl">
                      {getMediaTypeIcon(mediaType)}
                    </div>
                  );
                })()}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">{selectedMedia.filename}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedMedia.metadata?.width && selectedMedia.metadata?.height 
                    ? `${selectedMedia.metadata.width} × ${selectedMedia.metadata.height} • `
                    : ''
                  }{formatFileSize(selectedMedia.size)} MB
                </p>
                {selectedMedia.metadata?.title && (
                  <p className="text-sm text-gray-500 dark:text-gray-500">Title: {selectedMedia.metadata.title}</p>
                )}
                {selectedMedia.metadata?.author && (
                  <p className="text-sm text-gray-500 dark:text-gray-500">Author: {selectedMedia.metadata.author}</p>
                )}
              </div>
            </div>
            
            {/* Variant Selector for Images - Note: MediaFile interface doesn't include variants yet */}
            {showVariantSelector && getMediaTypeFromMime(selectedMedia.contentType) === 'image' && (
              <div className="ml-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-white mb-2">
                  Image Size
                </label>
                <div className="flex items-center space-x-2">
                  <label className="cursor-pointer flex flex-col items-center p-2 rounded-md border border-blue-500 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                    <input
                      type="radio"
                      name="variant"
                      value="original"
                      checked={true}
                      readOnly
                      className="sr-only"
                    />
                    <div className="text-xs font-medium capitalize text-gray-900 dark:text-white">Original</div>
                    {selectedMedia.metadata?.width && selectedMedia.metadata?.height && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedMedia.metadata.width}×{selectedMedia.metadata.height}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(selectedMedia.size)}MB
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
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