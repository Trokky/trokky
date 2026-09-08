import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useT } from '@trokky/trokky/i18n';
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
import { Dialog } from '@/components/ui/Dialog.js';
import { isEscapeOwnedByDialog } from '@/components/ui/dialogInternals.js';
import { Checkbox } from '@/components/ui/Checkbox';
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
  const { t } = useT('studio');
  // Declarative context sidebar configuration for media page
  useContextSidebar({
    page: 'media',
    title: t('media.title'),
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
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<MediaFile | null>(null);
  const [currentViewerIndex, setCurrentViewerIndex] = useState(0);

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [, setTotalMediaCount] = useState(0); // Total from server
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    const validOptions = [28, 56, 84, 112];
    try {
      const saved = localStorage.getItem('trokky-media-items-per-page');
      const parsed = saved ? parseInt(saved, 10) : 56;
      return validOptions.includes(parsed) ? parsed : 56;
    } catch {
      return 56;
    }
  });

  // Sort state
  type SortField = 'date' | 'name' | 'size';
  type SortDirection = 'asc' | 'desc';
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { hasPermission } = usePermissions();
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
    all: { label: t('media.types.all'), icon: DocumentIcon, count: mediaFiles.length },
    images: {
      label: t('media.types.images'),
      icon: PhotoIcon,
      count: mediaFiles.filter(f => f.contentType.startsWith('image/')).length
    },
    videos: {
      label: t('media.types.videos'),
      icon: VideoCameraIcon,
      count: mediaFiles.filter(f => f.contentType.startsWith('video/')).length
    },
    audio: {
      label: t('media.types.audio'),
      icon: SpeakerWaveIcon,
      count: mediaFiles.filter(f => f.contentType.startsWith('audio/')).length
    },
    documents: {
      label: t('media.types.documents'),
      icon: DocumentIcon,
      count: mediaFiles.filter(f =>
        f.contentType.includes('pdf') ||
        f.contentType.includes('text/') ||
        f.contentType.includes('application/')
      ).length
    },
    archives: {
      label: t('media.types.archives'),
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

      // Fetch all media files - use high limit for client-side filtering/pagination
      // Server provides default sorting by date descending (newest first)
      const response = await apiClient.getMedia({ limit: 10000 });
      setMediaFiles(response.data || []);
      // Store total from server response for accurate pagination display
      setTotalMediaCount(response.meta?.total || response.data?.length || 0);
      logger.info('Media files loaded successfully', {
        count: response.data?.length || 0,
        total: response.meta?.total
      });
    } catch (error) {
      logger.error('Failed to load media files:', error);
      setMediaFiles([]);
    } finally {
      loadingRef.current = false;
      setIsUploading(false);
    }
  }, [apiClient]); // Stable dependencies only

  // Filter and sort files based on search, type, and sort options
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

    // Sort files
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(b._createdAt).getTime() - new Date(a._createdAt).getTime();
          break;
        case 'name':
          comparison = a.filename.localeCompare(b.filename);
          break;
        case 'size':
          comparison = b.size - a.size;
          break;
      }
      return sortDirection === 'asc' ? -comparison : comparison;
    });

    setFilteredFiles(filtered);
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [mediaFiles, selectedType, searchQuery, sortBy, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredFiles.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFiles = filteredFiles.slice(startIndex, endIndex);

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
        // The dialog stack owns Escape: the viewer is itself a Dialog and
        // closing it here as well would also close whatever sits on top of it.
        if (isEscapeOwnedByDialog(e)) return;
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

  // Selection helpers
  const handleItemSelect = useCallback((id: string, selected: boolean, shiftKey = false) => {
    setSelectedIds(prev => {
      const next = new Set(prev);

      if (shiftKey && lastSelectedId && selected) {
        // Range selection with shift key
        const currentIndex = filteredFiles.findIndex(f => f.id === id);
        const lastIndex = filteredFiles.findIndex(f => f.id === lastSelectedId);

        if (currentIndex !== -1 && lastIndex !== -1) {
          const start = Math.min(currentIndex, lastIndex);
          const end = Math.max(currentIndex, lastIndex);

          for (let i = start; i <= end; i++) {
            next.add(filteredFiles[i].id);
          }
        }
      } else {
        if (selected) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }

      return next;
    });

    if (selected) {
      setLastSelectedId(id);
    }
  }, [filteredFiles, lastSelectedId]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredFiles.length) {
      // All selected, deselect all
      setSelectedIds(new Set());
    } else {
      // Select all
      setSelectedIds(new Set(filteredFiles.map(f => f.id)));
    }
  }, [filteredFiles, selectedIds.size]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedId(null);
  }, []);

  // Bulk delete handler
  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0 || !canDelete) return;
    setIsBulkDeleteModalOpen(true);
  }, [selectedIds.size, canDelete]);

  const confirmBulkDelete = async () => {
    if (selectedIds.size === 0 || !canDelete || isDeleting) return;

    if (!apiClient.hasFeature('media')) {
      logger.warn('Bulk delete attempted but media feature not available');
      return;
    }

    setIsDeleting(true);
    try {
      const idsToDelete = Array.from(selectedIds);
      const response = await apiClient.bulkDeleteMedia(idsToDelete);

      if (response.success) {
        const { successCount, errorCount } = response.data || { successCount: 0, errorCount: 0 };

        if (errorCount > 0) {
          studioContext?.utils.showToast(
            `Deleted ${successCount} file(s), ${errorCount} failed`,
            'warning'
          );
        } else {
          studioContext?.utils.showToast(
            successCount === 1 ? 'File deleted' : `${successCount} files deleted`,
            'success'
          );
        }

        await loadMediaFiles();
        clearSelection();

        // Close viewer if the current file was deleted
        if (isViewerOpen && selectedFile && selectedIds.has(selectedFile.id)) {
          setIsViewerOpen(false);
        }
      }
    } catch (error) {
      logger.error('Bulk delete failed:', error);
      studioContext?.utils.showToast('Failed to delete files', 'error');
    } finally {
      setIsDeleting(false);
      setIsBulkDeleteModalOpen(false);
    }
  };

  // Clear selection when filters change
  useEffect(() => {
    clearSelection();
  }, [selectedType, searchQuery, clearSelection]);

  // Keyboard shortcuts for selection and bulk operations
  useEffect(() => {
    // Don't handle keyboard shortcuts when viewer is open or when typing in an input
    if (isViewerOpen || isEditModalOpen || isDeleteModalOpen || isBulkDeleteModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Cmd/Ctrl + A to select all
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        handleSelectAll();
        return;
      }

      // Escape to clear selection
      if (e.key === 'Escape' && selectedIds.size > 0) {
        e.preventDefault();
        clearSelection();
        return;
      }

      // Delete/Backspace to delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0 && canDelete) {
        e.preventDefault();
        handleBulkDelete();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isViewerOpen, isEditModalOpen, isDeleteModalOpen, isBulkDeleteModalOpen, selectedIds.size, canDelete, handleSelectAll, clearSelection, handleBulkDelete]);

  // Get variant count for a media file
  const getVariantCount = (file: MediaFile) => {
    return file.metadata?.imageVariants ? Object.keys(file.metadata.imageVariants).length : 0;
  };

  // Get the best available variant for preview
  const getBestPreviewVariant = (media: MediaFile): string | undefined => {
    // For image media with variants, prefer thumbnail > small > original
    if (media.metadata?.imageVariants) {
      const variants = media.metadata.imageVariants;
      if (variants.thumbnail) return 'thumbnail';
      if (variants.small) return 'small';
      // If no small variants, use original (undefined means original)
    }
    // For non-image media or media without variants, use original
    return undefined;
  };

  // Get media URL using MediaUrlGenerator (similar to MediaBrowser pattern)
  const getMediaUrl = (media: MediaFile, variant?: string): string => {
    const mediaUrlGenerator = (studioContext as any)?.mediaUrlGenerator;
    
    if (mediaUrlGenerator) {
      return mediaUrlGenerator.getMediaUrl(media.id, variant);
    }
    
    // Fallback to media.url if MediaUrlGenerator not available
    logger.warn('MediaUrlGenerator not available in MediaPage, using fallback URL', { 
      mediaId: media.id, 
      variant 
    });
    return media.url;
  };

  // Render media item
  const renderMediaItem = (file: MediaFile, _index: number) => {
    const FileIcon = getFileIcon(file.contentType);
    const isImage = file.contentType.startsWith('image/');
    const variantCount = getVariantCount(file);
    const isSelected = selectedIds.has(file.id);

    if (viewMode === 'grid') {
      return (
        <div
          key={file.id}
          className={`group relative bg-white dark:bg-gray-800 rounded-lg border overflow-hidden hover:shadow-md transition-all cursor-pointer ${
            isSelected
              ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg'
              : 'border-gray-200 dark:border-gray-700'
          }`}
          onClick={(e) => {
            if (e.shiftKey && canDelete) {
              e.preventDefault();
              handleItemSelect(file.id, true, true);
            } else {
              openViewer(file);
            }
          }}
        >
          {/* Checkbox - always visible when delete permission */}
          {canDelete && (
            <div
              className="absolute top-2 left-2 z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={isSelected}
                onChange={(checked) => handleItemSelect(file.id, checked)}
                aria-label={`Select ${file.metadata?.title || file.filename}`}
              />
            </div>
          )}

          <div className="aspect-square flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            {isImage ? (
              <img
                src={getMediaUrl(file, getBestPreviewVariant(file))}
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
          className={`flex items-center space-x-4 p-4 bg-white dark:bg-gray-800 rounded-lg border hover:shadow-sm transition-all cursor-pointer ${
            isSelected
              ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg'
              : 'border-gray-200 dark:border-gray-700'
          }`}
          onClick={(e) => {
            if (e.shiftKey && canDelete) {
              e.preventDefault();
              handleItemSelect(file.id, true, true);
            } else {
              openViewer(file);
            }
          }}
        >
          {/* Checkbox for list view */}
          {canDelete && (
            <div
              className="flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkbox
                checked={isSelected}
                onChange={(checked) => handleItemSelect(file.id, checked)}
                aria-label={`Select ${file.metadata?.title || file.filename}`}
              />
            </div>
          )}

          <div className="flex-shrink-0">
            {isImage ? (
              <img
                src={getMediaUrl(file, getBestPreviewVariant(file))}
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
          {t('media.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('media.subtitle')}
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
                  {isUploading ? t('common.loading') : t('media.browseFiles')}
                </Button>{' '}
                {t('media.or')} {t('media.dragAndDrop')}
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
            placeholder={t('media.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Controls */}
        <div className="flex gap-2 flex-wrap">
          {/* Filter toggle for mobile */}
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setIsFilterSidebarOpen(!isFilterSidebarOpen)}
          >
            <FunnelIcon className="h-4 w-4" />
          </Button>

          {/* Sort dropdown */}
          <select
            value={`${sortBy}-${sortDirection}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split('-') as [SortField, SortDirection];
              setSortBy(field);
              setSortDirection(dir);
            }}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date-desc">{t('media.sort.dateDesc')}</option>
            <option value="date-asc">{t('media.sort.dateAsc')}</option>
            <option value="name-asc">{t('media.sort.nameAsc')}</option>
            <option value="name-desc">{t('media.sort.nameDesc')}</option>
            <option value="size-desc">{t('media.sort.sizeDesc')}</option>
            <option value="size-asc">{t('media.sort.sizeAsc')}</option>
          </select>

          {/* Items per page selector */}
          <select
            value={itemsPerPage}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              setItemsPerPage(value);
              setCurrentPage(1);
              try {
                localStorage.setItem('trokky-media-items-per-page', String(value));
              } catch {}
            }}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="28">28 {t('media.perPage')}</option>
            <option value="56">56 {t('media.perPage')}</option>
            <option value="84">84 {t('media.perPage')}</option>
            <option value="112">112 {t('media.perPage')}</option>
          </select>

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

      {/* Bulk Actions Toolbar - appears when items are selected */}
      {selectedIds.size > 0 && canDelete && (
        <div className="mb-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={selectedIds.size === filteredFiles.length}
                indeterminate={selectedIds.size > 0 && selectedIds.size < filteredFiles.length}
                onChange={handleSelectAll}
                aria-label={t('common.selectAll')}
              />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                {t('media.selected', { count: selectedIds.size })}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
            >
              {t('media.clearFilters')}
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="text-blue-600 dark:text-blue-400"
            >
              {selectedIds.size === filteredFiles.length ? t('common.deselectAll') : t('common.selectAll')}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isDeleting}
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              {isDeleting ? t('common.loading') : t('media.deleteSelected')}
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-4 lg:gap-6">
        {/* Sidebar with media type filters */}
        <div className={`${isFilterSidebarOpen ? 'block' : 'hidden'} lg:block w-48 lg:w-56 flex-shrink-0`}>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-gray-900 dark:text-white uppercase tracking-wide">
                <FunnelIcon className="h-3 w-3 inline mr-1" />
                {t('media.filters')}
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
                {searchQuery || selectedType !== 'all' ? t('media.noResults') : t('media.noMedia')}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {searchQuery || selectedType !== 'all'
                  ? t('media.noResults')
                  : t('media.subtitle')
                }
              </p>
              {canUpload && apiClient.hasFeature('media') && (!searchQuery && selectedType === 'all') && (
                <Button onClick={handleUploadClick}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  {t('media.uploadFiles')}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className={
                viewMode === 'grid'
                  ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 lg:gap-4'
                  : 'space-y-2'
              }>
                {paginatedFiles.map((file, index) => renderMediaItem(file, index))}
              </div>

              {/* Pagination Controls */}
              {filteredFiles.length > itemsPerPage && (
                <div className="mt-6 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {startIndex + 1}-{Math.min(endIndex, filteredFiles.length)} / {filteredFiles.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeftIcon className="h-4 w-4 mr-1" />
                      {t('common.previous')}
                    </Button>
                    <span className="text-sm text-gray-600 dark:text-gray-300 px-3">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      {t('common.next')}
                      <ChevronRightIcon className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Media Viewer Modal */}
      {isViewerOpen && selectedFile && (
        <Dialog
          open={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          variant="center"
          size="xl"
          height="tall"
          className="overflow-hidden"
          ariaLabel={selectedFile.metadata?.title || selectedFile.filename}
        >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
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
                    link.href = getMediaUrl(selectedFile);
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
            <Dialog.Body scroll={false} padded={false} className="flex flex-col md:flex-row">
              {/* Left section: Media preview + variants */}
              <div className="flex-1 flex flex-col min-h-0 min-w-0">
                {/* Media preview */}
                <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                  {selectedFile.contentType.startsWith('image/') ? (
                  <img
                    src={getMediaUrl(selectedFile)}
                    alt={selectedFile.metadata?.alt || selectedFile.filename}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : selectedFile.contentType.startsWith('video/') ? (
                  <video
                    src={getMediaUrl(selectedFile)}
                    controls
                    className="max-w-full max-h-full"
                  />
                ) : selectedFile.contentType.startsWith('audio/') ? (
                  <audio
                    src={getMediaUrl(selectedFile)}
                    controls
                    className="w-full max-w-md"
                  />
                ) : (
                  <div className="text-center">
                    {React.createElement(getFileIcon(selectedFile.contentType), {
                      className: "h-24 w-24 text-gray-400 mx-auto mb-4"
                    })}
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {t('media.preview')}
                    </p>
                    <Button
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = getMediaUrl(selectedFile);
                        link.download = selectedFile.filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                      {t('media.download')}
                    </Button>
                  </div>
                  )}
                </div>
                
                {/* Image Variants Section */}
                {selectedFile.contentType.startsWith('image/') && selectedFile.metadata?.imageVariants && Object.keys(selectedFile.metadata.imageVariants).length > 0 && (
                  <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
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
                        // Use thumbnail variant for display in Studio
                        
                        return (
                          <div key={variantName} className="flex-shrink-0 group relative">
                            <img
                              src={getMediaUrl(selectedFile, variantName)}
                              alt={`${variantName} variant`}
                              className="w-20 h-20 object-cover rounded border border-gray-200 dark:border-gray-600"
                              loading="lazy"
                            />
                            {/* Hover overlay with buttons */}
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity rounded flex items-center justify-center opacity-0 group-hover:opacity-100">
                              <div className="flex space-x-1">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(getMediaUrl(selectedFile, variantName));
                                  }}
                                  className="text-[10px] bg-white bg-opacity-90 text-gray-800 px-1.5 py-0.5 rounded hover:bg-opacity-100 transition-all"
                                  title="Copy URL"
                                >
                                  Copy
                                </button>
                                <a
                                  href={getMediaUrl(selectedFile, variantName)}
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
                  <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
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
              <div className="w-full md:w-80 shrink-0 overflow-y-auto bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 md:p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {t('media.details')}
                </h3>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('media.filename')}
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {selectedFile.filename}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('media.filesize')}
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {formatFileSize(selectedFile.size)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('media.mimeType')}
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {selectedFile.contentType}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {t('media.uploadedAt')}
                    </dt>
                    <dd className="text-sm text-gray-900 dark:text-white">
                      {new Date(selectedFile._createdAt).toLocaleString()}
                    </dd>
                  </div>
                  {selectedFile.metadata?.width && selectedFile.metadata?.height && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                        {t('media.dimensions')}
                      </dt>
                      <dd className="text-sm text-gray-900 dark:text-white">
                        {selectedFile.metadata.width} × {selectedFile.metadata.height}px
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </Dialog.Body>
        </Dialog>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingFile && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={t('media.editMetadata')}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('common.title') || 'Title'}
              </label>
              <Input
                value={editingFile.metadata?.title || ''}
                onChange={(e) => setEditingFile({
                  ...editingFile,
                  metadata: { ...editingFile.metadata, title: e.target.value }
                })}
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
              />
            </div>
            <div className="flex space-x-3 pt-4">
              <Button onClick={saveEdit} className="flex-1">
                {t('common.save')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1"
              >
                {t('common.cancel')}
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
          title={t('media.delete')}
        >
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mt-1" />
              <div>
                <p className="text-gray-900 dark:text-white">
                  {t('media.confirmDelete')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <strong>{editingFile.metadata?.title || editingFile.filename}</strong>
                </p>
              </div>
            </div>
            <div className="flex space-x-3 pt-4">
              <Button
                variant="danger"
                onClick={confirmDelete}
                className="flex-1"
              >
                {t('common.delete')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1"
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && selectedIds.size > 0 && (
        <Modal
          isOpen={isBulkDeleteModalOpen}
          onClose={() => setIsBulkDeleteModalOpen(false)}
          title={t('media.deleteSelected')}
        >
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mt-1" />
              <div>
                <p className="text-gray-900 dark:text-white">
                  {t('media.confirmBulkDelete', { count: selectedIds.size })}
                </p>
              </div>
            </div>
            <div className="flex space-x-3 pt-4">
              <Button
                variant="danger"
                onClick={confirmBulkDelete}
                className="flex-1"
                disabled={isDeleting}
              >
                {isDeleting ? t('common.loading') : t('common.delete')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="flex-1"
                disabled={isDeleting}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}