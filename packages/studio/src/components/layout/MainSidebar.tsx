import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  DocumentTextIcon,
  PhotoIcon,
  UsersIcon,
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import type { NavigationItem } from '@/types';

interface MainSidebarProps {
  isMobile?: boolean;
  onItemClick?: () => void;
}

export function MainSidebar({ isMobile = false, onItemClick }: MainSidebarProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [navigationItems, setNavigationItems] = useState<NavigationItem[]>([]);

  // Load navigation items on mount
  useEffect(() => {
    loadNavigationItems();
  }, []);

  const loadNavigationItems = async () => {
    // For now, use default navigation
    // In the future, this will be structure-driven
    const defaultItems: NavigationItem[] = [
      {
        id: 'dashboard',
        title: 'Dashboard',
        href: '/',
        icon: 'home',
        description: 'Overview & analytics'
      },
      {
        id: 'content',
        title: 'Content',
        href: '/content',
        icon: 'document-text',
        description: 'All your content'
      },
      {
        id: 'media',
        title: 'Media',
        href: '/media',
        icon: 'photo',
        description: 'Images & files'
      },
      {
        id: 'users',
        title: 'Users',
        href: '/users',
        icon: 'users',
        description: 'User management'
      },
      {
        id: 'settings',
        title: 'Settings',
        href: '/settings',
        icon: 'cog',
        description: 'Studio settings'
      }
    ];

    setNavigationItems(defaultItems);
  };

  const getIconComponent = (iconName: string) => {
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      'home': HomeIcon,
      'document-text': DocumentTextIcon,
      'photo': PhotoIcon,
      'users': UsersIcon,
      'cog': Cog6ToothIcon
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

  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
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
        {navigationItems.map((item) => {
          const IconComponent = getIconComponent(item.icon);
          const isActive = isActiveRoute(item.href);

          return (
            <NavLink
              key={item.id}
              to={item.href}
              onClick={handleItemClick}
              className={({ isActive: navIsActive }) => {
                const active = navIsActive || isActive;
                return cn(
                  'flex items-center px-3 py-2 rounded-lg transition-colors group',
                  active
                    ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
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
                  {item.description && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">
                      {item.description}
                    </span>
                  )}
                </div>
              )}
              {!isCollapsed && item.badge && (
                <span className={cn(
                  'ml-auto text-xs px-2 py-1 rounded-full',
                  item.badge.variant === 'primary' && 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300',
                  item.badge.variant === 'secondary' && 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
                  item.badge.variant === 'success' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                  item.badge.variant === 'warning' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
                  item.badge.variant === 'danger' && 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                )}>
                  {item.badge.text}
                </span>
              )}
            </NavLink>
          );
        })}
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