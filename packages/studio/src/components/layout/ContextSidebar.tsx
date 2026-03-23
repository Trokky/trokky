import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';
import { useDocumentTypes } from '@/hooks/useStructure';
import { apiClient } from '@/services/api-client';
import { fieldRegistry } from '../../fields/index';
import { useContextSidebar } from '@/contexts/ContextSidebarContext';
import { StructureContextSidebar } from '@/components/context/StructureContextSidebar';
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
  const location = useLocation();
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

// Context components for different pages
function DashboardContext() {
  const { t } = useT('studio');
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        {t('contextSidebar.quickActions')}
      </h3>
      <div className="space-y-2">
        <button className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
          <div className="font-medium text-gray-900 dark:text-white">{t('contextSidebar.createContent')}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('contextSidebar.createContentDesc')}</div>
        </button>
        <button className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
          <div className="font-medium text-gray-900 dark:text-white">{t('contextSidebar.uploadMedia')}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{t('contextSidebar.uploadMediaDesc')}</div>
        </button>
      </div>

      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3 mt-6">
        {t('contextSidebar.recentActivity')}
      </h3>
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {t('contextSidebar.noRecentActivity')}
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
        <StructureContextSidebar schemaName={schemaName} />
      ) : (
        <ContentOverviewContext />
      )}
    </div>
  );
}

function ContentOverviewContext() {
  const { t } = useT('studio');
  const { documentTypes } = useDocumentTypes();

  return (
    <>
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        {t('contextSidebar.contentTypes')}
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
            {t('contextSidebar.noContentTypes')}
          </div>
        )}
      </div>
    </>
  );
}


function MediaContext() {
  const { t } = useT('studio');
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        {t('contextSidebar.mediaLibrary')}
      </h3>
      <div className="space-y-2">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {t('contextSidebar.mediaLibraryDesc')}
        </div>
      </div>
    </div>
  );
}

function UsersContext() {
  const { t } = useT('studio');
  const navigate = useNavigate();
  const [userStats, setUserStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      const response = await apiClient.get('/users');
      if (response.success && response.data && (response.data as any).users) {
        const users = (response.data as any).users;
        
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
        {t('contextSidebar.userOverview')}
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
                {t('contextSidebar.totalUsers')}
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                {userStats.active}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {t('contextSidebar.active')}
              </div>
            </div>
          </div>

          {/* Role Distribution */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('contextSidebar.roles')}
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
              {t('contextSidebar.recentActivity')}
            </h4>
            <div className="space-y-1 text-sm">
              <div className="text-gray-600 dark:text-gray-400">
                {t('contextSidebar.usersLoggedInWeek', { count: userStats.recentLogins })}
              </div>
              {userStats.neverLoggedIn > 0 && (
                <div className="text-amber-600 dark:text-amber-400">
                  {t('contextSidebar.usersNeverLoggedIn', { count: userStats.neverLoggedIn })}
                </div>
              )}
              {userStats.inactive > 0 && (
                <div className="text-red-600 dark:text-red-400">
                  {t('contextSidebar.inactiveUsers', { count: userStats.inactive })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              {t('contextSidebar.quickActions')}
            </h4>
            <div className="space-y-2">
              <button
                onClick={handleAddUser}
                className="w-full text-left p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-sm"
              >
                {t('contextSidebar.addNewUser')}
              </button>
              <button
                onClick={handleManageTokens}
                className="w-full text-left p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-sm"
              >
                {t('contextSidebar.manageApiTokens')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsContext() {
  const { t } = useT('studio');
  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        {t('contextSidebar.studioSettings')}
      </h3>
      <div className="space-y-2">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {t('contextSidebar.configureStudio')}
        </div>
      </div>
    </div>
  );
}

function FieldsDemoContext() {
  const { t } = useT('studio');
  const registryStats = fieldRegistry.getStats();
  const availableTypes = fieldRegistry.getTypes();

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
        {t('contextSidebar.fieldsRegistry')}
      </h3>

      {/* Registry Status */}
      <div className="mb-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {registryStats.total || 0}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('contextSidebar.totalFields')}
            </div>
          </div>
          <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className={`text-sm font-medium ${
              registryStats.initialized
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {registryStats.initialized ? t('contextSidebar.yes') : t('contextSidebar.no')}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {t('contextSidebar.initialized')}
            </div>
          </div>
        </div>
      </div>

      {/* Available Field Types */}
      <div className="mb-6">
        <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          {t('contextSidebar.availableTypes')}
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
          {t('contextSidebar.documentation')}
        </h4>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div>• {t('contextSidebar.docSelectFields')}</div>
          <div>• {t('contextSidebar.docEditPreview')}</div>
          <div>• {t('contextSidebar.docUseExamples')}</div>
          <div>• {t('contextSidebar.docShowErrors')}</div>
        </div>
      </div>
    </div>
  );
}

function DefaultContext() {
  const { t } = useT('studio');
  return (
    <div className="p-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {t('contextSidebar.defaultContextInfo')}
      </div>
    </div>
  );
}