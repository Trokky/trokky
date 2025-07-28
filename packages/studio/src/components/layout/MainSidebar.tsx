import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  DocumentTextIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FolderIcon,
  TagIcon,
  UserIcon,
  DocumentIcon,
  Bars3Icon,
  HomeIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { useNavigation } from '@/hooks/useStructure';
import type { NavigationItem as StructureNavigationItem } from '@/types/structure';

interface MainSidebarProps {
  isMobile?: boolean;
  onItemClick?: () => void;
}

export function MainSidebar({ isMobile = false, onItemClick }: MainSidebarProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { navigation, loading, error } = useNavigation();

  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      'home': HomeIcon,
      'document-text': DocumentTextIcon,
      'document': DocumentIcon,
      'user': UserIcon,
      'folder': FolderIcon,
      'tag': TagIcon,
      'menu': Bars3Icon
    };
    return iconMap[iconName] || DocumentTextIcon;
  };

  const handleItemClick = () => {
    if (onItemClick) {
      onItemClick();
    }
  };

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
    // Save to localStorage
    try {
      localStorage.setItem('trokky_sidebar_collapsed', JSON.stringify(!isCollapsed));
    } catch (error) {
      console.warn('Failed to save sidebar state:', error);
    }
  };

  // Restore collapsed state from localStorage
  useEffect(() => {
    if (!isMobile) {
      try {
        const saved = localStorage.getItem('trokky_sidebar_collapsed');
        if (saved) {
          setIsCollapsed(JSON.parse(saved));
        }
      } catch (error) {
        console.warn('Failed to restore sidebar state:', error);
      }
    }
  }, [isMobile]);

  const isActiveRoute = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const renderNavigationItem = (item: StructureNavigationItem, depth = 0) => {
    const IconComponent = getIconComponent(item.icon || 'document-text');
    
    // Generate content path for document types
    let itemPath = item.path;
    if (!itemPath) {
      const schemaType = (item as any).schemaType;
      if (schemaType) {
        if (item.type === 'documentList') {
          // Collections: show list page
          itemPath = `/content/${schemaType}`;
        } else if (item.type === 'singleton') {
          // Singletons: link directly to edit the singleton document
          const documentId = (item as any).documentId || schemaType;
          itemPath = `/content/${schemaType}/${documentId}`;
        }
      }
    }
    
    const isActive = itemPath ? isActiveRoute(itemPath) : false;

    if (item.type === 'divider') {
      // In collapsed mode, show a subtle separator, otherwise show full divider
      if (isCollapsed) {
        return (
          <div key={item.id} className="mx-3 my-2 border-t border-gray-200 dark:border-gray-700" />
        );
      }
      
      return (
        <div key={item.id} className={cn(
          'border-t border-gray-200 dark:border-gray-700',
          depth === 0 ? 'mx-4 my-2' : 'mx-2 my-1'
        )}>
          {item.title && (
            <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {item.title}
            </div>
          )}
        </div>
      );
    }

    if (item.type === 'group') {
      return (
        <div key={item.id} className="space-y-1">
          {!isCollapsed && (
            <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {item.title}
            </div>
          )}
          {item.children?.map(child => renderNavigationItem(child, depth + 1))}
        </div>
      );
    }

    if (!itemPath) {
      return null;
    }

    return (
      <NavLink
        key={item.id}
        to={itemPath}
        onClick={handleItemClick}
        className={({ isActive: navIsActive }) => {
          const active = navIsActive || isActive;
          return cn(
            'flex items-center transition-colors group relative',
            isCollapsed 
              ? 'p-3 mx-2 rounded-lg justify-center' 
              : 'px-3 py-2 rounded-lg',
            depth > 0 && !isCollapsed && 'ml-4',
            active
              ? isCollapsed
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                : 'bg-primary-50 text-primary-700 border-r-2 border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
          );
        }}
        title={isCollapsed ? item.title : undefined}
      >
        <IconComponent 
          className={cn(
            'h-5 w-5 flex-shrink-0',
            isCollapsed ? '' : 'mr-3'
          )} 
        />
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <span className="font-medium block truncate">
              {item.title}
            </span>
          </div>
        )}
        
        {/* Tooltip for collapsed mode */}
        {isCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
            {item.title}
          </div>
        )}
      </NavLink>
    );
  };

  const sidebarWidth = isCollapsed ? 'w-16' : 'w-64';

  return (
    <div 
      className={cn(
        'h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-200',
        isMobile ? 'w-64' : sidebarWidth
      )}
    >
      {/* Header */}
      {!isMobile && (
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {!isCollapsed && (
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Navigation
            </h2>
          )}
          <button
            onClick={toggleCollapsed}
            className="p-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      )}

      {/* Navigation items */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
            {!isCollapsed && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading navigation...</span>
            )}
          </div>
        )}
        
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              Failed to load navigation
            </p>
          </div>
        )}
        
        {/* Structure-driven navigation - use if available */}
        {navigation && navigation.items.length > 0 ? (
          <>
            {/* Render user-provided structure */}
            {navigation.items.map(item => renderNavigationItem(item))}
          </>
        ) : (
          <>
            {/* Fallback navigation when no structure is provided */}
            {!isCollapsed && (
              <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Content
              </div>
            )}

            {/* Basic content navigation - only shown when no structure is available */}
            <NavLink
              to="/content"
              onClick={handleItemClick}
              className={({ isActive }) => cn(
                'flex items-center transition-colors group relative',
                isCollapsed 
                  ? 'p-3 mx-2 rounded-lg justify-center' 
                  : 'px-3 py-2 rounded-lg',
                isActive
                  ? isCollapsed
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'bg-primary-50 text-primary-700 border-r-2 border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
              )}
              title={isCollapsed ? 'Content' : undefined}
            >
              <DocumentTextIcon className={cn('h-5 w-5 flex-shrink-0', isCollapsed ? '' : 'mr-3')} />
              {!isCollapsed && (
                <span className="font-medium">Content</span>
              )}
              
              {/* Tooltip for collapsed mode */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                  Content
                </div>
              )}
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>Trokky Studio v2</p>
            <p>Zero-config CMS</p>
          </div>
        </div>
      )}
    </div>
  );
}