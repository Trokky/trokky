/**
 * Media Browser Component
 * Lightweight media selection modal for field components
 * Now using global Modal component for consistency
 */

import React from 'react';
import type { MediaFieldValue, MediaType } from './definition.js';
import { MediaBrowserContent } from './MediaBrowserContent.js';

// Custom modal component with proper backdrop
const CustomModal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Full screen backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" 
          onClick={onClose}
        />
        
        {/* Modal content */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-full flex flex-col animate-in fade-in slide-in-from-bottom duration-200">
          {title && (
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-1">
                {title}
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="sr-only">Close</span>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <div className="flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  );
};

// API client interface (matching StudioContext.apiClient structure)
interface MediaBrowserAPI {
  getMedia: (options?: any) => Promise<any>;
  getMediaById?: (id: string) => Promise<any>;
  uploadMedia?: (file: File, collection?: string, metadata?: any) => Promise<any>;
  deleteMedia?: (id: string) => Promise<any>;
  updateMedia?: (id: string, metadata: any) => Promise<any>;
}

interface MediaBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (value: MediaFieldValue) => void;
  mediaTypeFilter?: MediaType;
  showVariantSelector?: boolean;
  context?: string;
  apiClient?: MediaBrowserAPI;
  // Studio logger for consistent logging
  logger?: {
    debug: (message: string, data?: any) => void;
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, error?: Error | any) => void;
  };
}

export function MediaBrowser({ 
  isOpen, 
  onClose, 
  onSelect, 
  mediaTypeFilter, 
  showVariantSelector = false,
  context,
  apiClient,
  logger
}: MediaBrowserProps) {
  const handleSelect = (value: MediaFieldValue) => {
    onSelect(value);
    onClose();
  };

  const modalTitle = mediaTypeFilter
    ? `Select ${mediaTypeFilter === 'audio' ? 'an' : 'a'} ${mediaTypeFilter} from your media library`
    : 'Select a file from your media library';

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Browse Media</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {modalTitle}
          </p>
        </div>
      }
    >
      <MediaBrowserContent
        onSelect={handleSelect}
        mediaTypeFilter={mediaTypeFilter}
        showVariantSelector={showVariantSelector}
        context={context}
        apiClient={apiClient}
        logger={logger}
      />
    </CustomModal>
  );
}