import React, { useState } from 'react';
import { PhotoIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';

export function MediaPage() {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Handle file upload
    console.log('Files dropped:', e.dataTransfer.files);
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Media Library
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Upload and manage your media files
        </p>
      </div>

      {/* Upload area */}
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
              <Button variant="ghost" className="text-primary-600 hover:text-primary-500">
                Click to upload
              </Button>{' '}
              or drag and drop files here
            </p>
            <p className="text-gray-500 dark:text-gray-400">
              PNG, JPG, GIF, MP4, PDF up to 100MB
            </p>
          </div>
        </div>
      </div>

      {/* Media grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <PhotoIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No media files yet
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Upload your first media files to get started.
        </p>
        <Button>
          <PlusIcon className="h-4 w-4 mr-2" />
          Upload Files
        </Button>
      </div>
    </div>
  );
}