import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { useStructureItem, useDocumentTypes } from '@/hooks/useStructure';
import { apiClient } from '@/services/api-client';
import { fieldRegistry } from '@trokky/fields';
import { useContextSidebar } from '@/contexts/ContextSidebarContext';

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
  const contextAPI = useContextSidebar();
  const [isResizing, setIsResizing] = useState(false);
  
  // Use context API state, fallback to local state for backwards compatibility
  const isCollapsed = contextAPI.isCollapsed;
  const width = contextAPI.width || defaultWidth;
  const isVisible = contextAPI.isVisible;

  const handleMouseDown = () => {
    setIsResizing(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        contextAPI.setWidth(newWidth);
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
    contextAPI.toggleCollapse();
  };

  const getContextContent = () => {
    // If custom content is set via API, use that instead
    if (contextAPI.content) {
      return contextAPI.content;
    }
    
    // Otherwise, use route-based content (default behavior)
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
    
    if (path.startsWith('/fields-demo')) {
      return <FieldsDemoContext />;
    }
    
    return <DefaultContext />;
  };

  // Hide the entire sidebar if not visible
  if (!isVisible) {
    return null;
  }

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
  const location = useLocation();
  const pathParts = location.pathname.split('/');
  const schemaName = pathParts[2];
  
  return (
    <div className="p-4">
      {schemaName ? (
        <SchemaContentContext schemaName={schemaName} />
      ) : (
        <ContentOverviewContext />
      )}
    </div>
  );
}

function ContentOverviewContext() {
  const { documentTypes } = useDocumentTypes();
  
  return (
    <>
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        Content Types
      </h3>
      <div className="space-y-2">
        {documentTypes.map((type) => (
          <div
            key={type.name}
            className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900 dark:text-white text-sm">
                  {type.title}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {type.name}
                </div>
              </div>
              {type.badge && (
                <span className={cn(
                  "inline-flex px-2 py-1 text-xs font-semibold rounded-full",
                  `bg-${type.badge.color}-100 text-${type.badge.color}-800 dark:bg-${type.badge.color}-800 dark:text-${type.badge.color}-100`
                )}>
                  {type.badge.count}
                </span>
              )}
            </div>
          </div>
        ))}
        
        {documentTypes.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            No content types available
          </div>
        )}
      </div>
    </>
  );
}

function SchemaContentContext({ schemaName }: { schemaName: string }) {
  const structureItem = useStructureItem(schemaName);
  const [stats, setStats] = useState<any>(null);
  
  useEffect(() => {
    loadSchemaStats();
  }, [schemaName]);
  
  const loadSchemaStats = async () => {
    try {
      if (!apiClient.isInitialized) {
        await apiClient.initialize();
      }
      
      const response = await apiClient.getCollectionStats(schemaName);
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      // Stats are optional, don't show error
    }
  };
  
  return (
    <>
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        {structureItem?.title || schemaName}
      </h3>
      
      {/* Schema stats */}
      {stats && (
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {stats.total || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Total
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {stats.published || 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Published
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Available views */}
      {structureItem?.views && (
        <div className="mb-6">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Available Views
          </h4>
          <div className="space-y-1">
            {structureItem.views.map((view) => (
              <div
                key={view.type}
                className="flex items-center space-x-2 p-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              >
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span>{view.title || view.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Available filters */}
      {structureItem?.options?.filters && (
        <div className="mb-6">
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Available Filters
          </h4>
          <div className="space-y-1">
            {structureItem.options.filters.map((filter) => (
              <div
                key={filter.id}
                className="text-sm text-gray-600 dark:text-gray-400"
              >
                {filter.label}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Bulk actions */}
      {structureItem?.bulkActions && (
        <div>
          <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Bulk Actions
          </h4>
          <div className="space-y-1">
            {structureItem.bulkActions.map((action) => (
              <div
                key={action.action}
                className="text-sm text-gray-600 dark:text-gray-400"
              >
                {action.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
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
  const navigate = useNavigate();
  const [userStats, setUserStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      const response = await apiClient.get('/api/users');
      if (response.success && response.data && response.data.users) {
        const users = response.data.users;
        
        // Calculate recent logins more accurately
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const stats = {
          total: users.length,
          active: users.filter((u: any) => u.isActive !== false).length, // Default to active if not specified
          inactive: users.filter((u: any) => u.isActive === false).length,
          roles: users.reduce((acc: any, user: any) => {
            acc[user.role] = (acc[user.role] || 0) + 1;
            return acc;
          }, {}),
          recentLogins: users.filter((u: any) => {
            if (!u.lastLoginAt) return false;
            try {
              const loginDate = new Date(u.lastLoginAt);
              return !isNaN(loginDate.getTime()) && loginDate > weekAgo;
            } catch {
              return false;
            }
          }).length,
          neverLoggedIn: users.filter((u: any) => !u.lastLoginAt).length
        };
        setUserStats(stats);
      }
    } catch (error) {
      console.error('Failed to load user stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = () => {
    // Navigate to users page and trigger add user modal
    navigate('/users?action=add');
  };

  const handleManageTokens = () => {
    // Navigate to API tokens management
    navigate('/settings/tokens');
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        User Overview
      </h3>
      
      {userStats && (
        <div className="space-y-4">
          {/* User Statistics */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {userStats.total}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Total Users
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                {userStats.active}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Active
              </div>
            </div>
          </div>

          {/* Role Distribution */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Roles
            </h4>
            <div className="space-y-1">
              {Object.entries(userStats.roles).map(([role, count]: [string, any]) => (
                <div key={role} className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400 capitalize">
                    {role}
                  </span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Recent Activity
            </h4>
            <div className="space-y-1 text-sm">
              <div className="text-gray-600 dark:text-gray-400">
                {userStats.recentLogins} user{userStats.recentLogins !== 1 ? 's' : ''} logged in this week
              </div>
              {userStats.neverLoggedIn > 0 && (
                <div className="text-amber-600 dark:text-amber-400">
                  {userStats.neverLoggedIn} user{userStats.neverLoggedIn !== 1 ? 's' : ''} never logged in
                </div>
              )}
              {userStats.inactive > 0 && (
                <div className="text-red-600 dark:text-red-400">
                  {userStats.inactive} inactive user{userStats.inactive !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              Quick Actions
            </h4>
            <div className="space-y-2">
              <button 
                onClick={handleAddUser}
                className="w-full text-left p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-sm"
              >
                Add New User
              </button>
              <button 
                onClick={handleManageTokens}
                className="w-full text-left p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-sm"
              >
                Manage API Tokens
              </button>
            </div>
          </div>
        </div>
      )}
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

function FieldsDemoContext() {
  const registryStats = fieldRegistry.getStats();
  const availableTypes = fieldRegistry.getTypes();
  
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        Fields Registry
      </h3>
      
      {/* Registry Status */}
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {registryStats.total || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Total Fields
            </div>
          </div>
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className={`text-sm font-medium ${
              registryStats.initialized 
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {registryStats.initialized ? 'Yes' : 'No'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Initialized
            </div>
          </div>
        </div>
      </div>
      
      {/* Available Field Types */}
      <div className="mb-6">
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Available Types
        </h4>
        <div className="space-y-2">
          {availableTypes.map((type) => (
            <div
              key={type}
              className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
            >
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-sm text-gray-700 dark:text-gray-300 font-mono">
                {type}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Help */}
      <div>
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Documentation
        </h4>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div>• Select fields from the sidebar to test different types</div>
          <div>• Use the Edit/Preview tabs to see both modes</div>
          <div>• Click example "Use" buttons to try different values</div>
          <div>• Toggle "Show Errors" to test validation</div>
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