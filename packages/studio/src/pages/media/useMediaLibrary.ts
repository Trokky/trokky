import { useState, useRef, useEffect, useCallback } from 'react';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import { filterAndSortMedia } from './mediaFilters';
import type {
  MediaFile,
  MediaType,
  SortDirection,
  SortField,
  ViewMode,
} from './types';

/**
 * The media list itself: what is loaded, what the search box and the type tabs
 * keep, how it sorts, which page is showing, and the two preferences that
 * survive a reload.
 */
export function useMediaLibrary() {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<MediaFile[]>([]);
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
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const loadingRef = useRef(false);
  const logger = createStudioLogger('MediaPage');

  // Function to update view mode and persist to localStorage
  const updateViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('trokky-media-view-mode', mode);
    } catch (error) {
      logger.warn('Failed to save view mode to localStorage:', error);
    }
  }, [logger]);

  const updateItemsPerPage = useCallback((value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
    try {
      localStorage.setItem('trokky-media-items-per-page', String(value));
    } catch {}
  }, []);

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
    setFilteredFiles(
      filterAndSortMedia(mediaFiles, selectedType, searchQuery, sortBy, sortDirection)
    );
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

  return {
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
  };
}
