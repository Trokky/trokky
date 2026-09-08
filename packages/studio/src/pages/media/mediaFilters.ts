import type React from 'react';
import {
  PhotoIcon,
  DocumentIcon,
  VideoCameraIcon,
  SpeakerWaveIcon,
  ArchiveBoxIcon,
} from '@heroicons/react/24/outline';
import type { MediaFile, MediaType, SortDirection, SortField } from './types';

/**
 * The pure part of the media library: which files a filter keeps, how they
 * sort, and which icon a content type gets.
 */

/**
 * Does a file belong to the selected media type tab.
 */
export function matchesMediaType(file: MediaFile, selectedType: MediaType): boolean {
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
}

/**
 * Does a file match the search box. The query is already lower-cased.
 */
export function matchesSearchQuery(file: MediaFile, query: string): boolean {
  return Boolean(
    file.filename.toLowerCase().includes(query) ||
    file.metadata?.title?.toLowerCase().includes(query) ||
    file.metadata?.alt?.toLowerCase().includes(query) ||
    file.metadata?.author?.toLowerCase().includes(query) ||
    file.metadata?.credit?.toLowerCase().includes(query) ||
    file.metadata?.tags?.some(tag => tag.toLowerCase().includes(query))
  );
}

/**
 * Apply the type tab, the search box and the sort order, in that order.
 */
export function filterAndSortMedia(
  mediaFiles: MediaFile[],
  selectedType: MediaType,
  searchQuery: string,
  sortBy: SortField,
  sortDirection: SortDirection
): MediaFile[] {
  let filtered = mediaFiles;

  // Filter by type
  if (selectedType !== 'all') {
    filtered = filtered.filter(file => matchesMediaType(file, selectedType));
  }

  // Filter by search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(file => matchesSearchQuery(file, query));
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

  return filtered;
}

/**
 * Get file type icon
 */
export function getFileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return PhotoIcon;
  if (contentType.startsWith('video/')) return VideoCameraIcon;
  if (contentType.startsWith('audio/')) return SpeakerWaveIcon;
  if (contentType.includes('zip') || contentType.includes('rar') || contentType.includes('tar')) {
    return ArchiveBoxIcon;
  }
  return DocumentIcon;
}

/**
 * The icon each media type tab shows.
 */
export const MEDIA_TYPE_ICONS: Record<MediaType, React.ComponentType<{ className?: string }>> = {
  all: DocumentIcon,
  images: PhotoIcon,
  videos: VideoCameraIcon,
  audio: SpeakerWaveIcon,
  documents: DocumentIcon,
  archives: ArchiveBoxIcon,
};

/**
 * How many of the loaded files fall into each media type tab.
 */
export function countByMediaType(mediaFiles: MediaFile[], type: MediaType): number {
  if (type === 'all') return mediaFiles.length;
  return mediaFiles.filter(file => matchesMediaType(file, type)).length;
}

/**
 * Get variant count for a media file
 */
export function getVariantCount(file: MediaFile): number {
  return file.metadata?.imageVariants ? Object.keys(file.metadata.imageVariants).length : 0;
}
