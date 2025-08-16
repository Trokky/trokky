import { useState, useEffect } from 'react';
import { PaintBrushIcon, BellIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useContextSidebar } from '@/contexts/ContextSidebarContext';
import { createStudioLogger } from '@/utils/logger';

const logger = createStudioLogger('UserPreferences');

interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  timezone?: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  [key: string]: any;
}

export function UserPreferencesPage() {
  const { user } = useAuth();
  const contextSidebar = useContextSidebar();
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'system',
    language: 'en',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    emailNotifications: true,
    pushNotifications: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Hide context sidebar on this page
  useEffect(() => {
    contextSidebar.hide();
    
    // Show it again when leaving the page
    return () => {
      contextSidebar.show();
    };
  }, [contextSidebar]);

  useEffect(() => {
    if (user) {
      setPreferences(prev => ({
        ...prev,
        ...(user as any).preferences
      }));
    }
  }, [user]);

  const handleSavePreferences = async () => {
    setIsLoading(true);
    setMessage(null);
    
    try {
      // Apply theme immediately
      if (preferences.theme) {
        if (preferences.theme === 'system') {
          document.documentElement.classList.remove('light', 'dark');
        } else {
          document.documentElement.classList.remove('light', 'dark');
          document.documentElement.classList.add(preferences.theme);
        }
        localStorage.setItem('trokky_theme', preferences.theme);
      }
      
      setMessage({ type: 'success', text: 'Preferences updated successfully' });
      
      // TODO: When user preferences API is available, update server
      // const response = await apiClient.put(`/api/users/${user?.id}`, { preferences });
      
    } catch (error) {
      logger.error('Failed to update preferences', error);
      setMessage({ type: 'error', text: 'Failed to update preferences' });
    } finally {
      setIsLoading(false);
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-2xl space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Preferences</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Customize your Studio experience
          </p>
        </div>

        {/* Success/Error Messages */}
        {message && (
          <div className={`p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
              : 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Display Preferences */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <PaintBrushIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Appearance</h2>
          </div>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Theme
              </label>
              <select
                value={preferences.theme}
                onChange={(e) => setPreferences(prev => ({ ...prev, theme: e.target.value as 'light' | 'dark' | 'system' }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="system">System Default</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Language
              </label>
              <select
                value={preferences.language}
                onChange={(e) => setPreferences(prev => ({ ...prev, language: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
              </select>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <BellIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Notifications</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Email Notifications</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Receive notifications via email</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.emailNotifications}
                onChange={(e) => setPreferences(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">Push Notifications</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Receive browser push notifications</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.pushNotifications}
                onChange={(e) => setPreferences(prev => ({ ...prev, pushNotifications: e.target.checked }))}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSavePreferences} disabled={isLoading}>
            {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
            Save Preferences
          </Button>
        </div>
      </div>
    </div>
  );
}