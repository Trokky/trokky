import type { Dispatch, SetStateAction } from 'react';
import { apiClient } from '@/services/api-client';
import type { StudioLogger } from '@/utils/logger';
import type { MediaFile } from './types';

interface UseMediaActionsOptions {
  canEdit: boolean;
  canDelete: boolean;
  logger: StudioLogger;
  loadMediaFiles: () => Promise<void>;
  setMediaFiles: Dispatch<SetStateAction<MediaFile[]>>;
  selectedFile: MediaFile | null;
  setSelectedFile: Dispatch<SetStateAction<MediaFile | null>>;
  editingFile: MediaFile | null;
  setEditingFile: Dispatch<SetStateAction<MediaFile | null>>;
  isViewerOpen: boolean;
  setIsViewerOpen: Dispatch<SetStateAction<boolean>>;
  setIsEditModalOpen: Dispatch<SetStateAction<boolean>>;
  setIsDeleteModalOpen: Dispatch<SetStateAction<boolean>>;
  setIsBulkDeleteModalOpen: Dispatch<SetStateAction<boolean>>;
  selectedIds: Set<string>;
  clearSelection: () => void;
  isDeleting: boolean;
  setIsDeleting: Dispatch<SetStateAction<boolean>>;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

/**
 * Everything that changes a media file: opening the edit dialog with fresh
 * metadata, saving it, deleting one file or the whole selection, and asking
 * the server to rebuild image variants.
 */
export function useMediaActions({
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
  showToast,
}: UseMediaActionsOptions) {
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
          showToast(
            `Deleted ${successCount} file(s), ${errorCount} failed`,
            'warning'
          );
        } else {
          showToast(
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
      showToast('Failed to delete files', 'error');
    } finally {
      setIsDeleting(false);
      setIsBulkDeleteModalOpen(false);
    }
  };

  return {
    handleEdit,
    handleDelete,
    confirmDelete,
    saveEdit,
    handleRegenerateVariants,
    confirmBulkDelete,
  };
}
