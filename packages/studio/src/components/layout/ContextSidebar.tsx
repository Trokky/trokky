import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

interface ContextSidebarProps {
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export function ContextSidebar({
  defaultWidth = 320,
  minWidth = 250,
  maxWidth = 600
}: ContextSidebarProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = () => {
    setIsResizing(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  const getContextContent = () => {
    const path = location.pathname;
    
    if (path === '/') {
      return <DashboardContext />;
    }
    
    if (path.startsWith('/content')) {
      return <ContentContext />;
    }
    
    if (path.startsWith('/media')) {
      return <MediaContext />;
    }
    
    if (path.startsWith('/users')) {
      return <UsersContext />;
    }
    
    if (path.startsWith('/settings')) {
      return <SettingsContext />;
    }
    
    return <DefaultContext />;
  };

  if (isCollapsed) {
    return (
      <div className="w-12 h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-2">
          <button
            onClick={toggleCollapsed}
            className="w-8 h-8 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 flex items-center justify-center"
            title="Expand context sidebar"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col relative',
        isResizing && 'select-none'
      )}
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">
          Context
        </h2>
        <button
          onClick={toggleCollapsed}
          className="p-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
          title="Collapse context sidebar"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {getContextContent()}
      </div>

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary-500 transition-colors"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}

// Context components for different pages
function DashboardContext() {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        Quick Actions
      </h3>
      <div className="space-y-2">
        <button className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
          <div className="font-medium text-gray-900 dark:text-white">Create Content</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Start with a new document</div>
        </button>
        <button className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
          <div className="font-medium text-gray-900 dark:text-white">Upload Media</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Add images and files</div>
        </button>
      </div>
      
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 mt-6">
        Recent Activity
      </h3>
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No recent activity
      </div>
    </div>
  );
}

function ContentContext() {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        Content Types
      </h3>
      <div className="space-y-1">
        <div className="p-2 text-sm text-gray-600 dark:text-gray-400">
          Loading content types...
        </div>
      </div>
    </div>
  );
}

function MediaContext() {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        Media Library
      </h3>
      <div className="space-y-2">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Upload and manage your media files
        </div>
      </div>
    </div>
  );
}

function UsersContext() {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        User Management
      </h3>
      <div className="space-y-2">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Manage users and permissions
        </div>
      </div>
    </div>
  );
}

function SettingsContext() {
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        Studio Settings
      </h3>
      <div className="space-y-2">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Configure your studio
        </div>
      </div>
    </div>
  );
}

function DefaultContext() {
  return (
    <div className="p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Context information will appear here based on the current page.
      </div>
    </div>
  );
}