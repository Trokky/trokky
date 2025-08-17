import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useContextSidebar } from '@/contexts/ContextSidebarContext';
import { useStudioContext } from '@/contexts/StudioContext';
import { 
  PhotoIcon, 
  PlusIcon, 
  MagnifyingGlassIcon,
  FunnelIcon,
  ViewColumnsIcon,
  Bars3Icon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  DocumentIcon,
  VideoCameraIcon,
  SpeakerWaveIcon,
  ArchiveBoxIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useApiClient } from '@/hooks/useApiClient';
import { createStudioLogger } from '@/utils/logger';
import { usePermissions } from '@/hooks/usePermissions';
import { MEDIA_PERMISSIONS } from '@/constants/permissions';

interface MediaFile {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  uploadedAt: string;
  _createdAt: string;
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
  };
}

type ViewMode = 'grid' | 'list';
type MediaType = 'all' | 'images' | 'videos' | 'audio' | 'documents' | 'archives';

interface MediaTypeInfo {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
}

export function MediaPage() {
  // Declarative context sidebar configuration for media page
  const contextSidebar = useContextSidebar({
    page: 'media',
    title: 'Media Library',
    defaultVisible: false,
    defaultPosition: 'left'
  });
  const studioContext = useStudioContext();
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<MediaFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Try to get saved view mode from localStorage
    try {
      const saved = localStorage.getItem('trokky-media-view-mode');
      return (saved === 'list' || saved === 'grid') ? saved : 'grid';
    } catch {
      return 'grid';
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MediaType>('all');
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<MediaFile | null>(null);
  const [currentViewerIndex, setCurrentViewerIndex] = useState(0);
  const { hasPermission } = usePermissions();
  const canRead = hasPermission(MEDIA_PERMISSIONS.READ);
  const canUpload = hasPermission(MEDIA_PERMISSIONS.UPLOAD);
  const canEdit = hasPermission(MEDIA_PERMISSIONS.EDIT);
  const canDelete = hasPermission(MEDIA_PERMISSIONS.DELETE);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadingRef = useRef(false);
  const apiClient = useApiClient();
  const logger = createStudioLogger('MediaPage');
  const [searchParams, setSearchParams] = useSearchParams();

  // Example: You can control the context sidebar from any page
  // Uncomment these to test the API:
  // useEffect(() => {
  //   // Custom content example
  //   contextSidebar.setContent(
  //     <div className="p-4">
  //       <h3 className="font-medium mb-2">Custom Media Context</h3>
  //       <p className="text-sm text-gray-600">This is custom content set via the API!</p>
  //       <button 
  //         onClick={() => contextSidebar.hide()}
  //         className="mt-2 px-2 py-1 bg-red-500 text-white rounded text-xs"
  //       >
  //         Hide Sidebar
  //       </button>
  //     </div>
  //   );
  // }, []);

  // Example: Hide sidebar on mobile for more space
  // useEffect(() => {
  //   const handleResize = () => {
  //     if (window.innerWidth < 1024) {
  //       contextSidebar.hide();
  //     } else {
  //       contextSidebar.show();
  //     }
  //   };
  //   handleResize();
  //   window.addEventListener('resize', handleResize);
  //   return () => window.removeEventListener('resize', handleResize);
  // }, []);

  // Function to update view mode and persist to localStorage
  const updateViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('trokky-media-view-mode', mode);
    } catch (error) {
      logger.warn('Failed to save view mode to localStorage:', error);
    }
  }, [logger]);

  // Media type definitions
  const mediaTypes: Record<MediaType, MediaTypeInfo> = {
    all: { label: 'All Files', icon: DocumentIcon, count: mediaFiles.length },
    images: { 
      label: 'Images', 
      icon: PhotoIcon, 
      count: mediaFiles.filter(f => f.contentType.startsWith('image/')).length 
    },
    videos: { 
      label: 'Videos', 
      icon: VideoCameraIcon, 
      count: mediaFiles.filter(f => f.contentType.startsWith('video/')).length 
    },
    audio: { 
      label: 'Audio', 
      icon: SpeakerWaveIcon, 
      count: mediaFiles.filter(f => f.contentType.startsWith('audio/')).length 
    },
    documents: { 
      label: 'Documents', 
      icon: DocumentIcon, 
      count: mediaFiles.filter(f => 
        f.contentType.includes('pdf') || 
        f.contentType.includes('text/') ||
        f.contentType.includes('application/')
      ).length 
    },
    archives: { 
      label: 'Archives', 
      icon: ArchiveBoxIcon, 
      count: mediaFiles.filter(f => 
        f.contentType.includes('zip') || 
        f.contentType.includes('rar') ||
        f.contentType.includes('tar')
      ).length 
    }
  };

  // Load media files
  const loadMediaFiles = useCallback(async () => {
    if (loadingRef.current) return; // Prevent multiple simultaneous requests
    
    loadingRef.current = true;
    setIsUploading(true);
    try {
      // Check if media feature is available
      if (!apiClient.hasFeature('media')) {
        logger.info('Media feature not available, using empty state');
        setMediaFiles([]);
        return;
      }

      const response = await apiClient.getMedia();
      setMediaFiles(response.data || []);
      logger.info('Media files loaded successfully', { count: response.data?.length || 0 });
    } catch (error) {
      logger.error('Failed to load media files:', error);
      setMediaFiles([]);
    } finally {
      loadingRef.current = false;
      setIsUploading(false);
    }
  }, [apiClient]); // Stable dependencies only

  // Filter files based on search and type
  useEffect(() => {
    let filtered = mediaFiles;

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(file => {
        switch (selectedType) {
          case 'images':
            return file.contentType.startsWith('image/');
          case 'videos':
            return file.contentType.startsWith('video/');
          case 'audio':
            return file.contentType.startsWith('audio/');
          case 'documents':
            return file.contentType.includes('pdf') || 
                   file.contentType.includes('text/') ||
                   file.contentType.includes('application/');
          case 'archives':
            return file.contentType.includes('zip') || 
                   file.contentType.includes('rar') ||
                   file.contentType.includes('tar');
          default:
            return true;
        }
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(file => 
        file.filename.toLowerCase().includes(query) ||
        file.metadata?.title?.toLowerCase().includes(query) ||
        file.metadata?.alt?.toLowerCase().includes(query) ||
        file.metadata?.author?.toLowerCase().includes(query) ||
        file.metadata?.credit?.toLowerCase().includes(query) ||
        file.metadata?.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    setFilteredFiles(filtered);
  }, [mediaFiles, selectedType, searchQuery]);

  // Load files on mount
  useEffect(() => {
    loadMediaFiles();
  }, []); // Empty dependency array - only run on mount

  // Hide context sidebar for Media Page (filters are in main area)

  // Handle URL parameter for opening specific file
  useEffect(() => {
    const fileId = searchParams.get('file');
    
    if (fileId && mediaFiles.length > 0) {
      const file = mediaFiles.find(f => f.id === fileId);
      
      if (file && (!selectedFile || selectedFile.id !== fileId)) {
        // Only open if we don't already have this file selected
        openViewer(file);
        logger.debug('Opening media file from URL parameter', { fileId, filename: file.filename });
      }
    }
  }, [searchParams, mediaFiles]);

  // Update URL when viewer opens/closes
  useEffect(() => {
    if (isViewerOpen && selectedFile) {
      // Add file parameter to URL without triggering navigation
      const newParams = new URLSearchParams(searchParams);
      newParams.set('file', selectedFile.id);
      setSearchParams(newParams, { replace: true });
    } else if (!isViewerOpen && mediaFiles.length > 0) {
      // Remove file parameter when viewer is closed AND we have loaded files
      // This prevents removing the parameter during initial load
      const newParams = new URLSearchParams(searchParams);
      if (newParams.has('file')) {
        newParams.delete('file');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [isViewerOpen, selectedFile, mediaFiles.length]);

  // Keyboard navigation for viewer
  useEffect(() => {
    if (!isViewerOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsViewerOpen(false);
      } else if (e.key === 'ArrowLeft') {
        navigateViewer('prev');
      } else if (e.key === 'ArrowRight') {
        navigateViewer('next');
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isViewerOpen, currentViewerIndex, filteredFiles]);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!canUpload || !apiClient.hasFeature('media')) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only set dragging to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (!canUpload || !apiClient.hasFeature('media')) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await uploadFiles(files);
    }
  };

  // File upload
  const uploadFiles = async (files: File[]) => {
    if (!canUpload) {
      studioContext?.utils.showToast('You do not have permission to upload files', 'error');
      return;
    }
    
    // Check if media feature is available
    if (!apiClient.hasFeature('media')) {
      logger.warn('Upload attempted but media feature not available');
      studioContext?.utils.showToast('Media upload feature is not available', 'error');
      return;
    }
    
    setIsUploading(true);
    try {
      for (const file of files) {
        await apiClient.uploadMedia(file);
      }
      
      await loadMediaFiles();
      const successMessage = files.length === 1 
        ? `Successfully uploaded "${files[0].name}"` 
        : `Successfully uploaded ${files.length} files`;
      logger.info(successMessage);
      
      // Show discrete success message
      const toastMessage = files.length === 1 ? 'Uploaded' : `${files.length} files uploaded`;
      studioContext?.utils.showToast(toastMessage, 'success');
    } catch (error) {
      // Note: HTTP 400 errors from fetch() are automatically logged by the browser.
      // This is expected behavior for upload validation errors and cannot be suppressed.
      // We provide user-friendly toast notifications instead of relying on console logs.
      
      // Extract meaningful error message for user notification
      let errorMessage = 'Upload failed. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('File size exceeds')) {
          errorMessage = 'File size exceeds 100MB limit. Please choose a smaller file.';
        } else if (error.message.includes('File type') && error.message.includes('not allowed')) {
          errorMessage = 'File type not supported. Please choose a different file format.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      studioContext?.utils.showToast(errorMessage, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      uploadFiles(files);
    }
  };

  const handleUploadClick = () => {
    if (!canUpload) {
      studioContext?.utils.showToast('You do not have permission to upload files', 'error');
      return;
    }
    if (!apiClient.hasFeature('media')) {
      logger.warn('Upload button clicked but media feature not available');
      studioContext?.utils.showToast('Media upload feature is not available', 'error');
      return;
    }
    fileInputRef.current?.click();
  };

  // Media viewer navigation
  const openViewer = (file: MediaFile) => {
    const index = filteredFiles.findIndex(f => f.id === file.id);
    // If file is not in filtered list (e.g., when coming from URL), use -1
    setCurrentViewerIndex(index >= 0 ? index : -1);
    setSelectedFile(file);
    setIsViewerOpen(true);
  };

  const navigateViewer = (direction: 'prev' | 'next') => {
    // If currentViewerIndex is -1, start from beginning or end
    if (currentViewerIndex === -1) {
      const newIndex = direction === 'prev' ? filteredFiles.length - 1 : 0;
      if (filteredFiles[newIndex]) {
        setCurrentViewerIndex(newIndex);
        setSelectedFile(filteredFiles[newIndex]);
      }
      return;
    }
    
    const newIndex = direction === 'prev' 
      ? Math.max(0, currentViewerIndex - 1)
      : Math.min(filteredFiles.length - 1, currentViewerIndex + 1);
    
    if (filteredFiles[newIndex]) {
      setCurrentViewerIndex(newIndex);
      setSelectedFile(filteredFiles[newIndex]);
    }
  };

  // Media actions
  const handleEdit = async (file: MediaFile) => {
    try {
      // Fetch the latest file data to ensure we have up-to-date metadata
      const response = await apiClient.getMediaFile(file.id);
      if (response.success && response.data?.file) {
        setEditingFile({ ...response.data.file });
      } else {
        // Fallback to the file passed in if API call fails
        setEditingFile({ ...file });
      }
      setIsEditModalOpen(true);
    } catch (error) {
      logger.error('Failed to fetch latest file data for editing:', error);
      // Fallback to the file passed in if API call fails
      setEditingFile({ ...file });
      setIsEditModalOpen(true);
    }
  };

  const handleDelete = (file: MediaFile) => {
    setEditingFile(file);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!editingFile || !canDelete) return;
    
    if (!apiClient.hasFeature('media')) {
      logger.warn('Delete attempted but media feature not available');
      return;
    }
    
    try {
      await apiClient.deleteMedia(editingFile.id);
      await loadMediaFiles();
      setIsDeleteModalOpen(false);
      setEditingFile(null);
      
      if (isViewerOpen && selectedFile?.id === editingFile.id) {
        setIsViewerOpen(false);
      }
      
      logger.info(`Successfully deleted media file: ${editingFile.filename}`);
    } catch (error) {
      logger.error('Delete failed:', error);
    }
  };

  const saveEdit = async () => {
    if (!editingFile || !canEdit) return;
    
    if (!apiClient.hasFeature('media')) {
      logger.warn('Edit save attempted but media feature not available');
      return;
    }
    
    try {
      // Update media metadata via API
      const response = await apiClient.updateMedia(editingFile.id, {
        title: editingFile.metadata?.title || '',
        alt: editingFile.metadata?.alt || '',
        author: editingFile.metadata?.author || '',
        credit: editingFile.metadata?.credit || ''
      });
      
      logger.info('Media metadata updated successfully:', response.data?.file);
      
      // Update the local state to reflect the changes
      setMediaFiles(prevFiles => 
        prevFiles.map(file => 
          file.id === editingFile.id 
            ? { ...file, metadata: response.data?.file?.metadata || file.metadata }
            : file
        )
      );
      
      // Update selectedFile if it's the same one
      if (selectedFile?.id === editingFile.id) {
        setSelectedFile({ ...selectedFile, metadata: response.data?.file?.metadata || selectedFile.metadata });
      }
      
      setIsEditModalOpen(false);
      setEditingFile(null);
    } catch (error) {
      logger.error('Save failed:', error);
      // TODO: Add error toast notification
    }
  };

  const handleRegenerateVariants = async (file: MediaFile) => {
    if (!canDelete) return;
    
    if (!apiClient.hasFeature('media')) {
      logger.warn('Regenerate variants attempted but media feature not available');
      return;
    }
    
    // Check if it's an image file
    if (!file.contentType.startsWith('image/')) {
      logger.warn('Regenerate variants attempted on non-image file');
      return;
    }
    
    try {
      logger.info('Regenerating variants for:', file.filename);
      
      const response = await apiClient.regenerateMediaVariants(file.id);
      
      if (response.success && response.data?.file) {
        // Update the file in the media files list
        setMediaFiles(prevFiles => 
          prevFiles.map(f => 
            f.id === file.id ? (response.data?.file || f) : f
          )
        );
        
        // Update selectedFile if it's the same one
        if (selectedFile?.id === file.id) {
          if (response.data?.file) {
            setSelectedFile(response.data.file);
          }
        }
        
        logger.info('Variants regenerated successfully');
        // TODO: Add success toast notification
      }
    } catch (error) {
      logger.error('Failed to regenerate variants:', error);
      // TODO: Add error toast notification
    }
  };

  // Get file type icon
  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith('image/')) return PhotoIcon;
    if (contentType.startsWith('video/')) return VideoCameraIcon;
    if (contentType.startsWith('audio/')) return SpeakerWaveIcon;
    if (contentType.includes('zip') || contentType.includes('rar') || contentType.includes('tar')) {
      return ArchiveBoxIcon;
    }
    return DocumentIcon;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get variant count for a media file
  const getVariantCount = (file: MediaFile) => {
    return file.metadata?.imageVariants ? Object.keys(file.metadata.imageVariants).length : 0;
  };

  // Render media item
  const renderMediaItem = (file: MediaFile) => {
    const FileIcon = getFileIcon(file.contentType);
    const isImage = file.contentType.startsWith('image/');
    const variantCount = getVariantCount(file);

    if (viewMode === 'grid') {
      return (
        <div
          key={file.id}
          className="group relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => openViewer(file)}
        >
          <div className="aspect-square flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            {isImage ? (
              <img
                src={file.url}
                alt={file.metadata?.alt || file.filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <FileIcon className="h-12 w-12 text-gray-400" />
            )}
          </div>
          
          {/* Variant count badge */}
          {variantCount > 0 && (
            <div className="absolute top-2 right-2 bg-primary-600 text-white text-xs px-2 py-1 rounded-full">
              {variantCount}
            </div>
          )}
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  openViewer(file);
                }}
              >
                <EyeIcon className="h-4 w-4" />
              </Button>
              {(canEdit || canDelete) && (
                <>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(file);
                      }}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file);
                      }}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Info */}
          <div className="p-3">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {file.metadata?.title || file.filename}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatFileSize(file.size)}
              </p>
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div
          key={file.id}
          className="flex items-center space-x-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-sm transition-shadow cursor-pointer"
          onClick={() => openViewer(file)}
        >
          <div className="flex-shrink-0">
            {isImage ? (
              <img
                src={file.url}
                alt={file.metadata?.alt || file.filename}
                className="w-12 h-12 object-cover rounded"
                loading="lazy"
              />
            ) : (
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                <FileIcon className="h-6 w-6 text-gray-400" />
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {file.metadata?.title || file.filename}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(file.size)} • {file.contentType}
            </p>
            {file.metadata?.alt && (
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                {file.metadata.alt}
              </p>
            )}
          </div>
          
          {(canEdit || canDelete) && (
            <div className="flex space-x-1">
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(file);
                  }}
                >
                  <PencilIcon className="h-4 w-4" />
                </Button>
              )}
              {canDelete && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(file);
                  }}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Media Library
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Upload and manage your media files
        </p>
      </div>

      {/* Upload area */}
      {canUpload && apiClient.hasFeature('media') && (
        <div className="mb-8">
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <PhotoIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                <Button 
                  variant="ghost" 
                  className="text-primary-600 hover:text-primary-500"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                >
                  {isUploading ? 'Uploading...' : 'Click to upload'}
                </Button>{' '}
                or drag and drop files here
              </p>
              <p className="text-gray-500 dark:text-gray-400">
                PNG, JPG, GIF, MP4, PDF up to 100MB
              </p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.txt,.doc,.docx"
              onChange={handleFileInputChange}
            />
          </div>
        </div>
      )}

      {/* Media feature not available message */}
      {!apiClient.hasFeature('media') && (
        <div className="mb-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Media Management Not Available
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Media upload and management features are not enabled in this Studio instance. 
                Contact your administrator to enable media capabilities.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search media files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Controls */}
        <div className="flex gap-2">
          {/* Filter toggle for mobile */}
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setIsFilterSidebarOpen(!isFilterSidebarOpen)}
          >
            <FunnelIcon className="h-4 w-4" />
          </Button>
          
          {/* View mode toggle */}
          <div className="flex border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            <button
              onClick={() => updateViewMode('grid')}
              className={`px-3 py-2 text-sm transition-colors ${
                viewMode === 'grid'
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <ViewColumnsIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => updateViewMode('list')}
              className={`px-3 py-2 text-sm transition-colors border-l border-gray-200 dark:border-gray-600 ${
                viewMode === 'list'
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <Bars3Icon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-4 lg:gap-6">
        {/* Sidebar with media type filters */}
        <div className={`${isFilterSidebarOpen ? 'block' : 'hidden'} lg:block w-48 lg:w-56 flex-shrink-0`}>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-900 dark:text-white uppercase tracking-wide">
                <FunnelIcon className="h-3 w-3 inline mr-1" />
                Filter by Type
              </h3>
              <button
                onClick={() => setIsFilterSidebarOpen(false)}
                className="lg:hidden p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            </div>
            <div className="space-y-0.5">
              {Object.entries(mediaTypes).map(([type, info]) => {
                const Icon = info.icon;
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedType(type as MediaType);
                      // Close mobile filter on selection
                      if (window.innerWidth < 1024) {
                        setIsFilterSidebarOpen(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-md transition-colors ${
                      selectedType === type
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center">
                      <Icon className="h-3 w-3 mr-1.5" />
                      {info.label}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      {info.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1">
          {filteredFiles.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
              <PhotoIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {searchQuery || selectedType !== 'all' ? 'No matching files' : 'No media files yet'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchQuery || selectedType !== 'all' 
                  ? 'Try adjusting your search or filter criteria.' 
                  : 'Upload your first media files to get started.'
                }
              </p>
              {canUpload && apiClient.hasFeature('media') && (!searchQuery && selectedType === 'all') && (
                <Button onClick={handleUploadClick}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Upload Files
                </Button>
              )}
            </div>
          ) : (
            <div className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 lg:gap-4'
                : 'space-y-2'
            }>
              {filteredFiles.map(renderMediaItem)}
            </div>
          )}
        </div>
      </div>

      {/* Media Viewer Modal */}
      {isViewerOpen && selectedFile && (
        <Modal
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          size="xl"
        >
          <div className="flex flex-col -m-6 h-[calc(90vh-8rem)]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-4 min-w-0 flex-1">
                <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {currentViewerIndex + 1} of {filteredFiles.length}
                </span>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {selectedFile.metadata?.title || selectedFile.filename}
                </h2>
              </div>
              <div className="flex items-center space-x-2">
                {/* Navigation */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateViewer('prev')}
                  disabled={currentViewerIndex === 0}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateViewer('next')}
                  disabled={currentViewerIndex === filteredFiles.length - 1}
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
                
                {/* Actions */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = selectedFile.url;
                    link.download = selectedFile.filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                </Button>
                {(canEdit || canDelete) && (
                  <>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleEdit(selectedFile);
                          setIsViewerOpen(false);
                        }}
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                    )}
                    {canEdit && selectedFile.contentType.startsWith('image/') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerateVariants(selectedFile)}
                        title="Regenerate image variants"
                      >
                        <ArrowPathIcon className="h-4 w-4" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          handleDelete(selectedFile);
                          setIsViewerOpen(false);
                        }}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsViewerOpen(false)}
                >
                  <XMarkIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex">
              {/* Left section: Media preview + variants */}
              <div className="flex-1 flex flex-col">
                {/* Media preview */}
                <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-8">
                  {selectedFile.contentType.startsWith('image/') ? (
                  <img
                    src={selectedFile.url}
                    alt={selectedFile.metadata?.alt || selectedFile.filename}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : selectedFile.contentType.startsWith('video/') ? (
                  <video
                    src={selectedFile.url}
                    controls
                    className="max-w-full max-h-full"
                  />
                ) : selectedFile.contentType.startsWith('audio/') ? (
                  <audio
                    src={selectedFile.url}
                    controls
                    className="w-full max-w-md"
                  />
                ) : (
                  <div className="text-center">
                    {React.createElement(getFileIcon(selectedFile.contentType), {
                      className: "h-24 w-24 text-gray-400 mx-auto mb-4"
                    })}
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      Preview not available for this file type
                    </p>
                    <Button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = selectedFile.url;
                        link.download = selectedFile.filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                      Download File
                    </Button>
                  </div>
                  )}
                </div>
                
                {/* Image Variants Section */}
                {selectedFile.contentType.startsWith('image/') && selectedFile.metadata?.imageVariants && Object.keys(selectedFile.metadata.imageVariants).length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        Image Variants
                      </h3>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRegenerateVariants(selectedFile)}
                          title="Regenerate all variants"
                          className="text-xs"
                        >
                          <ArrowPathIcon className="h-3 w-3 mr-1" />
                          Regenerate
                        </Button>
                      )}
                    </div>
                    <div className="flex space-x-3 overflow-x-auto pb-2">
                      {Object.entries(selectedFile.metadata.imageVariants).map(([variantName, variant]) => {
                        // Use thumbnail for display in Studio, but original variant URL for copy/view actions
                        const thumbnailUrl = selectedFile.metadata?.imageVariants?.thumbnail?.url || variant.url;
                        
                        return (
                          <div key={variantName} className="flex-shrink-0 group relative">
                            <img
                              src={thumbnailUrl}
                              alt={`${variantName} variant`}
                              className="w-20 h-20 object-cover rounded border border-gray-200 dark:border-gray-600"
                              loading="lazy"
                            />
                            {/* Hover overlay with buttons */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(variant.url);
                                  }}
                                  className="text-[10px] bg-white bg-opacity-90 text-gray-800 px-1.5 py-0.5 rounded hover:bg-opacity-100 transition-all"
                                  title="Copy URL"
                                >
                                  Copy
                                </button>
                                <a
                                  href={variant.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] bg-primary-600 bg-opacity-90 text-white px-1.5 py-0.5 rounded hover:bg-opacity-100 transition-all"
                                >
                                  View
                                </a>
                              </div>
                            </div>
                            {/* Variant label and dimensions */}
                            <div className="mt-1 text-center">
                              <div className="text-xs text-gray-600 dark:text-gray-400 capitalize truncate">
                                {variantName}
                              </div>
                              <div className="text-[10px] text-gray-500 dark:text-gray-500">
                                {variant.width} × {variant.height}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* No variants section for images without variants */}
                {selectedFile.contentType.startsWith('image/') && 
                 (!selectedFile.metadata?.imageVariants || Object.keys(selectedFile.metadata.imageVariants).length === 0) && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                    <div className="text-center">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Image Variants
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        No variants generated for this image.
                      </p>
                      {canEdit && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleRegenerateVariants(selectedFile)}
                          className="text-xs"
                        >
                          <ArrowPathIcon className="h-4 w-4 mr-2" />
                          Generate Variants
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata sidebar */}
              <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  File Details
                </h3>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Filename
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {selectedFile.filename}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Size
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {formatFileSize(selectedFile.size)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Type
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {selectedFile.contentType}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Uploaded
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {new Date(selectedFile._createdAt).toLocaleString()}
                    </dd>
                  </div>
                  {selectedFile.metadata?.width && selectedFile.metadata?.height && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Dimensions
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {selectedFile.metadata.width} × {selectedFile.metadata.height}
                      </dd>
                    </div>
                  )}
                  {selectedFile.metadata?.title && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Title
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {selectedFile.metadata.title}
                      </dd>
                    </div>
                  )}
                  {selectedFile.metadata?.alt && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Alt Text
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {selectedFile.metadata.alt}
                      </dd>
                    </div>
                  )}
                  {selectedFile.metadata?.author && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Author
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {selectedFile.metadata.author}
                      </dd>
                    </div>
                  )}
                  {selectedFile.metadata?.credit && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Credit
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {selectedFile.metadata.credit}
                      </dd>
                    </div>
                  )}
                  {selectedFile.metadata?.width && selectedFile.metadata?.height && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        Dimensions
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {selectedFile.metadata.width} × {selectedFile.metadata.height}px
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingFile && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Media"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title
              </label>
              <Input
                value={editingFile.metadata?.title || ''}
                onChange={(e) => setEditingFile({
                  ...editingFile,
                  metadata: { ...editingFile.metadata, title: e.target.value }
                })}
                placeholder="Enter a title for this media"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alt Text
              </label>
              <Input
                value={editingFile.metadata?.alt || ''}
                onChange={(e) => setEditingFile({
                  ...editingFile,
                  metadata: { ...editingFile.metadata, alt: e.target.value }
                })}
                placeholder="Describe this media for accessibility"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Author
              </label>
              <Input
                value={editingFile.metadata?.author || ''}
                onChange={(e) => setEditingFile({
                  ...editingFile,
                  metadata: { ...editingFile.metadata, author: e.target.value }
                })}
                placeholder="Who created this media?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Credit
              </label>
              <Input
                value={editingFile.metadata?.credit || ''}
                onChange={(e) => setEditingFile({
                  ...editingFile,
                  metadata: { ...editingFile.metadata, credit: e.target.value }
                })}
                placeholder="Photo credit or attribution"
              />
            </div>
            <div className="flex space-x-3 pt-4">
              <Button onClick={saveEdit} className="flex-1">
                Save Changes
              </Button>
              <Button
                variant="secondary"
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && editingFile && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Delete Media"
        >
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mt-1" />
              <div>
                <p className="text-gray-900 dark:text-white">
                  Are you sure you want to delete this media file?
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <strong>{editingFile.metadata?.title || editingFile.filename}</strong>
                </p>
                <p className="text-sm text-red-600 mt-2">
                  This action cannot be undone. The file will be permanently removed
                  and any content using this media may be affected.
                </p>
              </div>
            </div>
            <div className="flex space-x-3 pt-4">
              <Button
                variant="danger"
                onClick={confirmDelete}
                className="flex-1"
              >
                Delete Permanently
              </Button>
              <Button
                variant="secondary"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}