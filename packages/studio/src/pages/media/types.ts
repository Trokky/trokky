import React from 'react';

export interface MediaFile {
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

export type ViewMode = 'grid' | 'list';
export type MediaType = 'all' | 'images' | 'videos' | 'audio' | 'documents' | 'archives';

export interface MediaTypeInfo {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
}

export type SortField = 'date' | 'name' | 'size';
export type SortDirection = 'asc' | 'desc';
