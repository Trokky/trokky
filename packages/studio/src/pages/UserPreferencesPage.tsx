import { useState, useEffect } from 'react';
import { PaintBrushIcon, BellIcon, LinkIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { useT, useLocale, type SupportedLocale } from '@trokky/trokky/i18n';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { useContextSidebar } from '@/contexts/ContextSidebarContext';
import { useStudioContext } from '@/contexts/StudioContext';
import { createStudioLogger } from '@/utils/logger';
import { OAuthProvidersList } from '@/components/auth/OAuthProvidersList';
import { MFASettings } from '@/components/settings/MFASettings';
import { PasskeyManager } from '@/components/auth/PasskeyManager';

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
  const { t } = useT('studio');
  const { locale, setLocale, locales, getLocaleName } = useLocale();
  const contextSidebar = useContextSidebar({
    page: 'user-preferences',
    title: t('preferences.title')
  });
  const studioContext = useStudioContext();
  const showToast = studioContext?.utils?.showToast || ((msg: string, type: string) => console.log(`Toast: ${type} - ${msg}`));
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'system',
    language: locale,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    emailNotifications: true,
    pushNotifications: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Configure context sidebar for user preferences page (disabled)
  useEffect(() => {
    contextSidebar.configure({
      page: 'user-preferences',
      title: t('preferences.title'),
      defaultVisible: false  // Hide context sidebar for user preferences
    });
  }, [contextSidebar.configure, t]);

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

      // Apply language immediately
      if (preferences.language && preferences.language !== locale) {
        setLocale(preferences.language);
      }

      setMessage({ type: 'success', text: t('preferences.saveSuccess') });

      // TODO: When user preferences API is available, update server
      // const response = await apiClient.put(`/api/users/${user?.id}`, { preferences });

    } catch (error) {
      logger.error('Failed to update preferences', error);
      setMessage({ type: 'error', text: t('preferences.saveError') });
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('preferences.title')}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('preferences.subtitle')}
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
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('preferences.appearance')}</h2>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('preferences.theme')}
              </label>
              <select
                value={preferences.theme}
                onChange={(e) => setPreferences(prev => ({ ...prev, theme: e.target.value as 'light' | 'dark' | 'system' }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="system">{t('preferences.themeSystem')}</option>
                <option value="light">{t('preferences.themeLight')}</option>
                <option value="dark">{t('preferences.themeDark')}</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('language.title')}
              </label>
              <select
                value={preferences.language}
                onChange={(e) => setPreferences(prev => ({ ...prev, language: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {locales.map((loc) => (
                  <option key={loc} value={loc}>
                    {getLocaleName(loc)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('language.current')}: {getLocaleName(locale as SupportedLocale)}
              </p>
            </div>
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <BellIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('preferences.notifications')}</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">{t('preferences.emailNotifications')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('preferences.emailNotificationsDescription')}</p>
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
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">{t('preferences.pushNotifications')}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('preferences.pushNotificationsDescription')}</p>
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

        {/* Connected Accounts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <LinkIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('preferences.connectedAccounts')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('preferences.connectedAccountsDescription')}
              </p>
            </div>
          </div>

          <OAuthProvidersList />
        </div>

        {/* Security - Two-Factor Authentication */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <ShieldCheckIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('preferences.security')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('preferences.securityDescription')}
              </p>
            </div>
          </div>

          <MFASettings onToast={showToast} />

          {/* Passkeys Section */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {t('preferences.passkeys', 'Passkeys')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {t('preferences.passkeysDescription', 'Sign in securely without a password using your fingerprint, face, or security key.')}
            </p>
            <PasskeyManager />
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSavePreferences} disabled={isLoading}>
            {isLoading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
            {t('preferences.savePreferences')}
          </Button>
        </div>
      </div>
    </div>
  );
}