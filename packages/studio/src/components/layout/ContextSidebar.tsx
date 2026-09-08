import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { useContextSidebar } from '@/contexts/ContextSidebarContext';
import { useT } from 'trokky/i18n';

interface ContextSidebarProps {
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  position?: 'left' | 'right';
}

export function ContextSidebar({
  defaultWidth = 256,
  minWidth = 200,
  maxWidth = 500,
  position = 'left'
}: ContextSidebarProps) {
  const { t } = useT('studio');
  const contextAPI = useContextSidebar();
  const [isResizing, setIsResizing] = useState(false);
  
  // Use context API state, fallback to local state for backwards compatibility
  const isCollapsed = contextAPI.isCollapsed;
  const width = contextAPI.width || defaultWidth;
  const isVisible = contextAPI.isVisible;

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startWidth = width;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      // For right sidebar, reverse the delta calculation
      const newWidth = position === 'right' 
        ? startWidth - deltaX 
        : startWidth + deltaX;
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        contextAPI.setWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    // Prevent text selection and set cursor
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const toggleCollapsed = () => {
    contextAPI.toggleCollapse();
  };

  const getContextContent = () => {
    // Only show content if explicitly set via API
    if (contextAPI.content) {
      return contextAPI.content;
    }
    
    // By default, show no content (empty sidebar)
    return null;
  };

  // Hide the entire sidebar if not visible
  if (!isVisible) {
    return null;
  }

  if (isCollapsed) {
    return (
      <div className={cn(
        "w-12 h-full bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 flex flex-col",
        position === 'left' ? 'border-r' : 'border-l'
      )}>
        {/* Expand button */}
        <div className="p-2 flex-shrink-0">
          <button
            onClick={toggleCollapsed}
            className="w-8 h-8 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 flex items-center justify-center"
            title={t('layout.expandContext')}
          >
            {position === 'left' ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4" />
            )}
          </button>
        </div>
        
        {/* Vertical title */}
        <div className="flex-1 flex items-center justify-center py-4">
          <div
            className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap"
            style={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              transform: 'rotate(180deg)'
            }}
            title={contextAPI.title}
          >
            {contextAPI.title}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn(
        'h-full bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 flex flex-col relative',
        position === 'left' ? 'border-r' : 'border-l',
        isResizing && 'select-none'
      )}
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">
          {contextAPI.title}
        </h2>
        <button
          onClick={toggleCollapsed}
          className="p-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
          title={t('layout.collapseContext')}
        >
          {position === 'left' ? (
            <ChevronLeftIcon className="h-4 w-4" />
          ) : (
            <ChevronRightIcon className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {getContextContent()}
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          "absolute top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 hover:w-1.5 transition-all duration-150",
          position === 'left' ? 'right-0' : 'left-0'
        )}
        onMouseDown={handleMouseDown}
        title={t('layout.resizeSidebar')}
      />
    </div>
  );
}
