import { useState, useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { MediaFile } from './types';

interface UseMediaSelectionOptions {
  filteredFiles: MediaFile[];
  selectedType: string;
  searchQuery: string;
  canDelete: boolean;
  isViewerOpen: boolean;
  isEditModalOpen: boolean;
  isDeleteModalOpen: boolean;
  isBulkDeleteModalOpen: boolean;
  setIsBulkDeleteModalOpen: Dispatch<SetStateAction<boolean>>;
}

/**
 * Which files are ticked, and the keyboard shortcuts that drive the selection:
 * select all, clear, delete.
 */
export function useMediaSelection({
  filteredFiles,
  selectedType,
  searchQuery,
  canDelete,
  isViewerOpen,
  isEditModalOpen,
  isDeleteModalOpen,
  isBulkDeleteModalOpen,
  setIsBulkDeleteModalOpen,
}: UseMediaSelectionOptions) {
  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

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

  return {
    selectedIds,
    handleItemSelect,
    handleSelectAll,
    clearSelection,
    handleBulkDelete,
  };
}
