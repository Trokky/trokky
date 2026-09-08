import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useT } from '@trokky/trokky/i18n';
import { useContextSidebar } from '@/contexts/ContextSidebarContext';
import { useStudioContext } from '@/contexts/StudioContext';
import {
  PhotoIcon,
  PlusIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog.js';
import { isEscapeOwnedByDialog } from '@/components/ui/dialogInternals.js';
import { apiClient } from '@/services/api-client';
import { formatFileSize } from '@/utils/format';
import { usePermissions } from '@/hooks/usePermissions';
import { MEDIA_PERMISSIONS } from '@/constants/permissions';
import type {
  MediaFile,
  MediaType,
  MediaTypeInfo,
  SortDirection,
  SortField,
} from './media/types';
import {
  MEDIA_TYPE_ICONS,
  countByMediaType,
  getFileIcon,
} from './media/mediaFilters';
import { useMediaLibrary } from './media/useMediaLibrary';
import { useMediaSelection } from './media/useMediaSelection';
import { useMediaUpload } from './media/useMediaUpload';
import { useMediaActions } from './media/useMediaActions';
import { MediaUploadArea } from './media/MediaUploadArea';
import { MediaToolbar } from './media/MediaToolbar';
import { MediaTypeSidebar } from './media/MediaTypeSidebar';
import { MediaBulkActionsBar } from './media/MediaBulkActionsBar';
import { MediaItemCard } from './media/MediaItemCard';
import {
  MediaEditModal,
  MediaDeleteModal,
  MediaBulkDeleteModal,
} from './media/MediaMetadataDialogs';

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
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [isFilterSidebarOpen, setIsFilterSidebarOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<MediaFile | null>(null);
  const [currentViewerIndex, setCurrentViewerIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const { hasPermission } = usePermissions();
  const canUpload = hasPermission(MEDIA_PERMISSIONS.UPLOAD);
  const canEdit = hasPermission(MEDIA_PERMISSIONS.EDIT);
  const canDelete = hasPermission(MEDIA_PERMISSIONS.DELETE);

  const [searchParams, setSearchParams] = useSearchParams();

  const {
    mediaFiles,
    setMediaFiles,
    filteredFiles,
    isUploading,
    setIsUploading,
    viewMode,
    updateViewMode,
    searchQuery,
    setSearchQuery,
    selectedType,
    setSelectedType,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    updateItemsPerPage,
    sortBy,
    setSortBy,
    sortDirection,
    setSortDirection,
    totalPages,
    startIndex,
    endIndex,
    paginatedFiles,
    loadMediaFiles,
    logger,
  } = useMediaLibrary();

  const {
    selectedIds,
    handleItemSelect,
    handleSelectAll,
    clearSelection,
    handleBulkDelete,
  } = useMediaSelection({
    filteredFiles,
    selectedType,
    searchQuery,
    canDelete,
    isViewerOpen,
    isEditModalOpen,
    isDeleteModalOpen,
    isBulkDeleteModalOpen,
    setIsBulkDeleteModalOpen,
  });

  const {
    isDragging,
    fileInputRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    handleUploadClick,
  } = useMediaUpload({
    canUpload,
    logger,
    showToast: (message, type) => studioContext?.utils.showToast(message, type),
    setIsUploading,
    loadMediaFiles,
  });

  // Media type definitions
  const mediaTypes: Record<MediaType, MediaTypeInfo> = {
    all: { label: t('media.types.all'), icon: MEDIA_TYPE_ICONS.all, count: countByMediaType(mediaFiles, 'all') },
    images: { label: t('media.types.images'), icon: MEDIA_TYPE_ICONS.images, count: countByMediaType(mediaFiles, 'images') },
    videos: { label: t('media.types.videos'), icon: MEDIA_TYPE_ICONS.videos, count: countByMediaType(mediaFiles, 'videos') },
    audio: { label: t('media.types.audio'), icon: MEDIA_TYPE_ICONS.audio, count: countByMediaType(mediaFiles, 'audio') },
    documents: { label: t('media.types.documents'), icon: MEDIA_TYPE_ICONS.documents, count: countByMediaType(mediaFiles, 'documents') },
    archives: { label: t('media.types.archives'), icon: MEDIA_TYPE_ICONS.archives, count: countByMediaType(mediaFiles, 'archives') }
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

  const {
    handleEdit,
    handleDelete,
    confirmDelete,
    saveEdit,
    handleRegenerateVariants,
    confirmBulkDelete,
  } = useMediaActions({
    canEdit,
    canDelete,
    logger,
    loadMediaFiles,
    setMediaFiles,
    selectedFile,
    setSelectedFile,
    editingFile,
    setEditingFile,
    isViewerOpen,
    setIsViewerOpen,
    setIsEditModalOpen,
    setIsDeleteModalOpen,
    setIsBulkDeleteModalOpen,
    selectedIds,
    clearSelection,
    isDeleting,
    setIsDeleting,
    showToast: (message, type) => studioContext?.utils.showToast(message, type),
  });

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
        <MediaUploadArea
          isDragging={isDragging}
          isUploading={isUploading}
          fileInputRef={fileInputRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onUploadClick={handleUploadClick}
          onFileInputChange={handleFileInputChange}
        />
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
      <MediaToolbar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onToggleFilterSidebar={() => setIsFilterSidebarOpen(!isFilterSidebarOpen)}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={(field: SortField, dir: SortDirection) => {
          setSortBy(field);
          setSortDirection(dir);
        }}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={updateItemsPerPage}
        viewMode={viewMode}
        onViewModeChange={updateViewMode}
      />

      {/* Bulk Actions Toolbar - appears when items are selected */}
      {selectedIds.size > 0 && canDelete && (
        <MediaBulkActionsBar
          selectedCount={selectedIds.size}
          totalCount={filteredFiles.length}
          isDeleting={isDeleting}
          onSelectAll={handleSelectAll}
          onClearSelection={clearSelection}
          onBulkDelete={handleBulkDelete}
        />
      )}

      <div className="flex gap-4 lg:gap-6">
        {/* Sidebar with media type filters */}
        <MediaTypeSidebar
          isOpen={isFilterSidebarOpen}
          onClose={() => setIsFilterSidebarOpen(false)}
          mediaTypes={mediaTypes}
          selectedType={selectedType}
          onSelectType={(type) => {
            setSelectedType(type);
            // Close mobile filter on selection
            if (window.innerWidth < 1024) {
              setIsFilterSidebarOpen(false);
            }
          }}
        />

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
                {paginatedFiles.map((file) => (
                  <MediaItemCard
                    key={file.id}
                    file={file}
                    viewMode={viewMode}
                    isSelected={selectedIds.has(file.id)}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    getMediaUrl={getMediaUrl}
                    onItemSelect={handleItemSelect}
                    onOpenViewer={openViewer}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
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
        <MediaEditModal
          isOpen={isEditModalOpen}
          editingFile={editingFile}
          onEditingFileChange={setEditingFile}
          onClose={() => setIsEditModalOpen(false)}
          onSave={saveEdit}
        />
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && editingFile && (
        <MediaDeleteModal
          isOpen={isDeleteModalOpen}
          editingFile={editingFile}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={confirmDelete}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && selectedIds.size > 0 && (
        <MediaBulkDeleteModal
          isOpen={isBulkDeleteModalOpen}
          selectedCount={selectedIds.size}
          isDeleting={isDeleting}
          onClose={() => setIsBulkDeleteModalOpen(false)}
          onConfirm={confirmBulkDelete}
        />
      )}
    </div>
  );
}
