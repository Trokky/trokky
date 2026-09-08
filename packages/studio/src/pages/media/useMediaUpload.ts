import React, { useRef, useState } from 'react';
import { apiClient } from '@/services/api-client';
import type { StudioLogger } from '@/utils/logger';

interface UseMediaUploadOptions {
  canUpload: boolean;
  logger: StudioLogger;
  showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  setIsUploading: (uploading: boolean) => void;
  loadMediaFiles: () => Promise<void>;
}

/**
 * Getting bytes into the library: the drop zone, the file input, and the
 * upload itself with the messages an editor sees when it fails.
 */
export function useMediaUpload({
  canUpload,
  logger,
  showToast,
  setIsUploading,
  loadMediaFiles,
}: UseMediaUploadOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      showToast('You do not have permission to upload files', 'error');
      return;
    }

    // Check if media feature is available
    if (!apiClient.hasFeature('media')) {
      logger.warn('Upload attempted but media feature not available');
      showToast('Media upload feature is not available', 'error');
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
      showToast(toastMessage, 'success');
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

      showToast(errorMessage, 'error');
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
      showToast('You do not have permission to upload files', 'error');
      return;
    }
    if (!apiClient.hasFeature('media')) {
      logger.warn('Upload button clicked but media feature not available');
      showToast('Media upload feature is not available', 'error');
      return;
    }
    fileInputRef.current?.click();
  };

  return {
    isDragging,
    fileInputRef,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileInputChange,
    handleUploadClick,
  };
}
