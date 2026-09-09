import { useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router';
import { useT } from '@trokky/trokky/i18n';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { useNavigation } from '@/hooks/useStructure';
import type { NavigationItem as StructureNavigationItem } from '@/types/structure';
import { renderIcon } from '@/utils/icons';

interface MainSidebarProps {
  isMobile?: boolean;
  onItemClick?: () => void;
}

export function MainSidebar({ isMobile = false, onItemClick }: MainSidebarProps) {
  const { t } = useT('studio');
  const { t: tCommon } = useT('common');
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const { navigation, loading, error } = useNavigation();

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
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Check if a group contains the active route
  const groupContainsActiveRoute = (item: StructureNavigationItem): boolean => {
    if (item.type !== 'group' || !item.children) return false;

    return item.children.some(child => {
      if (child.type === 'group') {
        return groupContainsActiveRoute(child);
      }

      // Generate path for the child
      let childPath = child.path;
      if (!childPath) {
        const schemaType = (child as any).schemaType;
        if (schemaType) {
          if (child.type === 'documentList') {
            childPath = `/content/${schemaType}`;
          } else if (child.type === 'singleton') {
            const documentId = (child as any).documentId || schemaType;
            childPath = `/content/${schemaType}/${documentId}`;
          }
        }
      }

      return childPath ? isActiveRoute(childPath) : false;
    });
  };

  // Toggle group expansion
  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Auto-expand groups containing active route on mount and route change
  useEffect(() => {
    if (!navigation) return;

    const groupsToExpand = new Set<string>();

    const findActiveGroups = (items: StructureNavigationItem[]) => {
      items.forEach(item => {
        if (item.type === 'group' && groupContainsActiveRoute(item)) {
          groupsToExpand.add(item.id);
          if (item.children) {
            findActiveGroups(item.children);
          }
        }
      });
    };

    findActiveGroups(navigation.items);
    setExpandedGroups(groupsToExpand);
  }, [location.pathname, navigation]);

  // Normalize string: remove accents and convert to lowercase
  const normalizeString = (str: string): string => {
    return str
      .normalize('NFD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .toLowerCase()
      .trim();
  };

  // Filter navigation items based on search query
  const filteredNavigation = useMemo(() => {
    if (!navigation || !searchQuery.trim()) return navigation;

    const query = normalizeString(searchQuery);

    const filterItems = (items: StructureNavigationItem[]): StructureNavigationItem[] => {
      return items.reduce((acc, item) => {
        // Check if item title matches (accent and case insensitive)
        const titleMatches = item.title ? normalizeString(item.title).includes(query) : false;

        if (item.type === 'group' && item.children) {
          // Filter children
          const filteredChildren = filterItems(item.children);

          // Include group if it has matching children or if its title matches
          if (filteredChildren.length > 0 || titleMatches) {
            acc.push({
              ...item,
              children: filteredChildren.length > 0 ? filteredChildren : item.children
            });
          }
        } else if (item.type === 'divider') {
          // Keep dividers if previous item exists
          if (acc.length > 0) {
            acc.push(item);
          }
        } else {
          // Include non-group items if they match
          if (titleMatches) {
            acc.push(item);
          }
        }

        return acc;
      }, [] as StructureNavigationItem[]);
    };

    return {
      ...navigation,
      items: filterItems(navigation.items)
    };
  }, [navigation, searchQuery]);

  // Auto-expand all groups when searching
  useEffect(() => {
    if (!filteredNavigation || !searchQuery.trim()) return;

    const allGroupIds = new Set<string>();

    const collectGroupIds = (items: StructureNavigationItem[]) => {
      items.forEach(item => {
        if (item.type === 'group') {
          allGroupIds.add(item.id);
          if (item.children) {
            collectGroupIds(item.children);
          }
        }
      });
    };

    collectGroupIds(filteredNavigation.items);
    setExpandedGroups(allGroupIds);
  }, [searchQuery, filteredNavigation]);

  const renderNavigationItem = (item: StructureNavigationItem, depth = 0) => {
    const iconName = item.icon || 'document';
    
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
      // Hide dividers in collapsed mode for cleaner icon list
      if (isCollapsed) {
        return null;
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
      // In collapsed mode, render children directly (flat list of icons)
      if (isCollapsed) {
        return (
          <div key={item.id}>
            {item.children?.map(child => renderNavigationItem(child, depth))}
          </div>
        );
      }

      const isExpanded = expandedGroups.has(item.id);
      const hasActiveChild = groupContainsActiveRoute(item);

      return (
        <div key={item.id} className="space-y-1">
          {/* Group header - clickable to toggle */}
          <button
            onClick={() => toggleGroup(item.id)}
            className={cn(
              'w-full flex items-center justify-between px-3 py-2 text-xs font-medium uppercase tracking-wider rounded-lg transition-colors',
              hasActiveChild
                ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <span>{item.title}</span>
            {isExpanded ? (
              <ChevronUpIcon className="h-4 w-4" />
            ) : (
              <ChevronDownIcon className="h-4 w-4" />
            )}
          </button>

          {/* Group children - only shown when expanded */}
          {isExpanded && item.children && (
            <div className="space-y-1">
              {item.children.map(child => renderNavigationItem(child, depth + 1))}
            </div>
          )}
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
            'flex items-center transition-colors',
            isCollapsed
              ? 'p-2 mx-1 rounded-lg justify-center'
              : 'px-3 py-1.5 rounded-lg text-sm',
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
        <span className={cn('flex-shrink-0', isCollapsed ? '' : 'mr-2')}>
          {renderIcon(iconName, 16)}
        </span>
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <span className="block truncate">
              {item.title}
            </span>
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
        <div className={cn(
          "flex items-center p-4 border-b border-gray-200 dark:border-gray-700",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          {!isCollapsed && (
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('sidebar.navigation')}
            </h2>
          )}
          <button
            onClick={toggleCollapsed}
            className="p-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 flex-shrink-0"
            title={isCollapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          >
            {isCollapsed ? (
              <ChevronRightIcon className="h-4 w-4" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      )}

      {/* Search/Filter */}
      {!isCollapsed && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('sidebar.searchNavigation')}
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                title={tCommon('actions.clear')}
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation items */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-1">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full"></div>
            {!isCollapsed && (
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">{t('sidebar.loadingNavigation')}</span>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              {t('sidebar.failedToLoad')}
            </p>
          </div>
        )}
        
        {/* Structure-driven navigation - use if available */}
        {filteredNavigation && filteredNavigation.items.length > 0 ? (
          <>
            {/* Render user-provided structure */}
            {filteredNavigation.items.map(item => renderNavigationItem(item))}
          </>
        ) : searchQuery && navigation ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('sidebar.noResultsFor', { query: searchQuery })}
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              {t('sidebar.clearSearch')}
            </button>
          </div>
        ) : (
          <>
            {/* Fallback navigation when no structure is provided */}
            {!isCollapsed && (
              <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {t('nav.content')}
              </div>
            )}

            {/* Basic content navigation - only shown when no structure is available */}
            <NavLink
              to="/content"
              onClick={handleItemClick}
              className={({ isActive }) => cn(
                'flex items-center transition-colors',
                isCollapsed
                  ? 'p-2 mx-1 rounded-lg justify-center'
                  : 'px-3 py-2 rounded-lg',
                isActive
                  ? isCollapsed
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                    : 'bg-primary-50 text-primary-700 border-r-2 border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                  : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white'
              )}
              title={isCollapsed ? t('nav.content') : undefined}
            >
              <DocumentTextIcon className={cn('h-5 w-5 flex-shrink-0', isCollapsed ? '' : 'mr-3')} />
              {!isCollapsed && (
                <span className="font-medium">{t('nav.content')}</span>
              )}
            </NavLink>
          </>
        )}
      </nav>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            <p>Trokky Studio</p>
          </div>
        </div>
      )}
    </div>
  );
}