import { useState, useEffect } from 'react';
import { useT } from '@trokky/i18n';
import { useContextSidebar } from '@/contexts/ContextSidebarContext';
import { usePermissions } from '@/hooks/usePermissions';
import { USER_PERMISSIONS, TOKEN_PERMISSIONS, WEBHOOK_PERMISSIONS } from '@/constants/permissions';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { UserManagement } from '@/components/users/UserManagement';
import { AppTokenManagement } from '@/components/users/AppTokenManagement';
import { WebhookManagement } from '@/components/users/WebhookManagement';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

export function UsersPage() {
  const { t } = useT('studio');

  // Declarative context sidebar configuration for users page
  const contextSidebar = useContextSidebar({
    page: 'users',
    title: t('users.title'),
    defaultVisible: false,
    defaultPosition: 'left'
  });
  const { hasPermission } = usePermissions();
  
  // Check if user has access to any users functionality
  const canReadUsers = hasPermission(USER_PERMISSIONS.READ);
  const canReadTokens = hasPermission(TOKEN_PERMISSIONS.READ);
  const canReadWebhooks = hasPermission(WEBHOOK_PERMISSIONS.READ);
  
  const hasAnyAccess = canReadUsers || canReadTokens || canReadWebhooks;

  const [activeTab, setActiveTab] = useState<'users' | 'tokens' | 'webhooks'>('users');
  const [hasSetDefaultTab, setHasSetDefaultTab] = useState(false);
  
  // Set default active tab based on permissions (only once)
  useEffect(() => {
    if (!hasSetDefaultTab) {
      if (canReadUsers) {
        setActiveTab('users');
      } else if (canReadTokens) {
        setActiveTab('tokens');
      } else if (canReadWebhooks) {
        setActiveTab('webhooks');
      }
      setHasSetDefaultTab(true);
    }
  }, [canReadUsers, canReadTokens, canReadWebhooks, hasSetDefaultTab]);
  
  // Hide context sidebar for users page

  if (!hasAnyAccess) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('usersPage.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('usersPage.subtitle')}
          </p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {t('usersPage.accessDenied')}
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {t('usersPage.accessDeniedMessage')}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('usersPage.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('usersPage.subtitle')}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex">
            {canReadUsers && (
              <button
                onClick={() => setActiveTab('users')}
                className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'users'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t('usersPage.tabs.users')}
              </button>
            )}
            {canReadTokens && (
              <button
                onClick={() => setActiveTab('tokens')}
                className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'tokens'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t('usersPage.tabs.tokens')}
              </button>
            )}
            {canReadWebhooks && (
              <button
                onClick={() => setActiveTab('webhooks')}
                className={`py-3 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'webhooks'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {t('usersPage.tabs.webhooks')}
              </button>
            )}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'users' && canReadUsers && (
            <UserManagement />
          )}
          {activeTab === 'tokens' && canReadTokens && (
            <AppTokenManagement />
          )}
          {activeTab === 'webhooks' && canReadWebhooks && (
            <WebhookManagement />
          )}
        </div>
      </div>
    </div>
  );
}