
import { useState, useEffect } from 'react';
import { useContextSidebar } from '@/contexts/ContextSidebarContext';
import { usePermissions } from '@/hooks/usePermissions';
import { SETTINGS_PERMISSIONS } from '@/constants/permissions';
import { useStudioBranding } from '@/hooks/useStudioConfig';
import { useStudioContext } from '@/contexts/StudioContext';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const logger = createStudioLogger('SettingsPage');

export function SettingsPage() {
  const contextSidebar = useContextSidebar({
    page: 'settings',
    title: 'Studio Settings'
  });
  const { hasPermission } = usePermissions();
  const { branding } = useStudioBranding();
  const studioContext = useStudioContext();
  const showToast = studioContext?.utils?.showToast || ((msg: string, type: string) => console.log(`Toast: ${type} - ${msg}`));
  
  // All hooks must be called before any conditional logic
  const [publicUrl, setPublicUrl] = useState('');
  const [studioTitle, setStudioTitle] = useState('');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Check if user has settings access
  const canReadSettings = hasPermission(SETTINGS_PERMISSIONS.READ);
  const canWriteSettings = hasPermission(SETTINGS_PERMISSIONS.WRITE);

  // Hide context sidebar for settings page
  useEffect(() => {
    contextSidebar.hide();
  }, [contextSidebar]);

  // Load settings from API on mount
  useEffect(() => {
    if (canReadSettings) {
      loadSettings();
    }
  }, [canReadSettings]);

  if (!canReadSettings) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Studio Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure your Studio settings and preferences
          </p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Access Denied
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                You don't have permission to access Studio settings. Contact your administrator for access.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const loadSettings = async () => {
    try {
      setLoading(true);
      logger.debug('Loading settings from API');
      
      const response = await apiClient.get('/config/settings');
      
      if (response.success && response.data?.settings) {
        const settings = response.data.settings;
        setPublicUrl(settings.publicUrl || getDefaultPublicUrl());
        setStudioTitle(settings.studioTitle || 'Trokky Studio');
        setTheme(settings.defaultTheme || 'system');
        
        logger.info('Settings loaded successfully', { settings });
      } else {
        // Use defaults if no settings found
        setPublicUrl(getDefaultPublicUrl());
        setStudioTitle(branding?.title || 'Trokky Studio');
        setTheme('system');
        
        logger.warn('No settings found, using defaults');
      }
    } catch (error) {
      logger.error('Failed to load settings', error);
      
      // Fallback to defaults
      setPublicUrl(getDefaultPublicUrl());
      setStudioTitle(branding?.title || 'Trokky Studio');
      setTheme('system');
      
      showToast('Failed to load settings. Using defaults.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getDefaultPublicUrl = () => {
    // Infer from current domain, removing /studio if present
    const currentOrigin = window.location.origin;
    const currentPath = window.location.pathname;
    
    // If we're in /studio, use the base domain
    if (currentPath.includes('/studio')) {
      return currentOrigin;
    }
    
    return currentOrigin;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Normalize the public URL by removing trailing slash
      const normalizedPublicUrl = publicUrl.replace(/\/$/, '');
      
      const settingsData = {
        publicUrl: normalizedPublicUrl,
        studioTitle,
        defaultTheme: theme
      };
      
      logger.debug('Saving settings via API', settingsData);
      
      const response = await apiClient.put('/config/settings', {
        settings: settingsData
      });
      
      if (response.success) {
        // Update state with normalized URL
        setPublicUrl(normalizedPublicUrl);
        
        // Emit custom event for other components to react to settings changes
        window.dispatchEvent(new CustomEvent('trokky:settings:updated', {
          detail: { settings: settingsData }
        }));
        
        logger.info('Settings saved successfully', { settings: settingsData });
        showToast('Settings saved successfully!', 'success');
      } else {
        throw new Error(response.error?.message || 'Failed to save settings');
      }
    } catch (error) {
      logger.error('Failed to save settings', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save settings';
      showToast(`Failed to save settings: ${errorMessage}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Configure your Trokky Studio and content management
          </p>
        </div>
        <div className="max-w-4xl">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500 dark:text-gray-400">Loading settings...</div>
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
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure your Trokky Studio and content management
        </p>
      </div>

      <div className="max-w-4xl">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            General Settings
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Studio Title
              </label>
              <input
                type="text"
                value={studioTitle}
                onChange={(e) => setStudioTitle(e.target.value)}
                disabled={!canWriteSettings}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Trokky Studio"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                The title displayed in the Studio interface
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Public Website URL
              </label>
              <input
                type="url"
                value={publicUrl}
                onChange={(e) => setPublicUrl(e.target.value)}
                disabled={!canWriteSettings}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="https://yourwebsite.com"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                The public URL where your content will be displayed. Used for "View Live" links.
              </p>
            </div>


            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Theme
              </label>
              <select 
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'system' | 'light' | 'dark')}
                disabled={!canWriteSettings}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Choose the default theme for new users
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button 
                onClick={handleSave}
                disabled={saving || !canWriteSettings}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {!canWriteSettings && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  You have read-only access to settings. Contact your administrator to make changes.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}