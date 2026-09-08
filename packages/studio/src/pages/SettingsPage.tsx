import { useState, useEffect } from 'react';
import { useT } from 'trokky/i18n';
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
  const { t } = useT('studio');
  const contextSidebar = useContextSidebar({
    page: 'settings',
    title: t('settings.title')
  });
  const { hasPermission } = usePermissions();
  const { branding } = useStudioBranding();
  const studioContext = useStudioContext();
  const showToast = studioContext?.utils?.showToast || ((msg: string, type: string) => console.log(`Toast: ${type} - ${msg}`));
  
  // All hooks must be called before any conditional logic
  const [publicUrl, setPublicUrl] = useState('');
  const [studioTitle, setStudioTitle] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [logo, setLogo] = useState('');
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // MFA/Security settings
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaEnforcedRoles, setMfaEnforcedRoles] = useState<string[]>([]);
  const [mfaAllowedMethods, setMfaAllowedMethods] = useState<string[]>(['totp', 'email']);

  // Check if user has settings access
  const canReadSettings = hasPermission(SETTINGS_PERMISSIONS.READ);
  const canWriteSettings = hasPermission(SETTINGS_PERMISSIONS.WRITE);

  // Configure context sidebar for settings page (disabled)
  useEffect(() => {
    contextSidebar.configure({
      page: 'settings',
      title: t('settings.title'),
      defaultVisible: false  // Hide context sidebar for settings
    });
  }, [contextSidebar.configure, t]);

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
            {t('settings.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('settings.subtitle')}
          </p>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                {t('settings.accessDenied')}
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {t('settings.accessDeniedMessage')}
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
      
      const response = await apiClient.get<{
        settings?: Record<string, any>
      }>('/config/settings');
      
      if (response.success && response.data?.settings) {
        const settings = response.data.settings;
        setPublicUrl(settings.publicUrl || getDefaultPublicUrl());
        setStudioTitle(settings.studioTitle || 'Trokky Studio');
        setOrganizationName(settings.organizationName || '');
        setPrimaryColor(settings.primaryColor || '');
        setSecondaryColor(settings.secondaryColor || '');
        setLogo(settings.logo || '');
        setTheme(settings.defaultTheme || 'system');

        // MFA settings
        setMfaRequired(settings.mfaRequired || false);
        setMfaEnforcedRoles(settings.mfaEnforcedRoles || []);
        setMfaAllowedMethods(settings.mfaAllowedMethods || ['totp', 'email']);

        logger.info('Settings loaded successfully', { settings });
      } else {
        // Use defaults if no settings found
        setPublicUrl(getDefaultPublicUrl());
        setStudioTitle(branding?.title || 'Trokky Studio');
        setOrganizationName('');
        setPrimaryColor('');
        setSecondaryColor('');
        setLogo('');
        setTheme('system');
        setMfaRequired(false);
        setMfaEnforcedRoles([]);
        setMfaAllowedMethods(['totp', 'email']);

        logger.warn('No settings found, using defaults');
      }
    } catch (error) {
      logger.error('Failed to load settings', error);

      // Fallback to defaults
      setPublicUrl(getDefaultPublicUrl());
      setStudioTitle(branding?.title || 'Trokky Studio');
      setOrganizationName('');
      setPrimaryColor('');
      setSecondaryColor('');
      setLogo('');
      setTheme('system');
      setMfaRequired(false);
      setMfaEnforcedRoles([]);
      setMfaAllowedMethods(['totp', 'email']);

      showToast(t('settings.loadError'), 'error');
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
        organizationName,
        primaryColor,
        secondaryColor,
        logo,
        defaultTheme: theme,
        // MFA settings
        mfaRequired,
        mfaEnforcedRoles,
        mfaAllowedMethods
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
        showToast(t('settings.saveSuccess'), 'success');
      } else {
        throw new Error(response.error?.message || 'Failed to save settings');
      }
    } catch (error) {
      logger.error('Failed to save settings', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showToast(t('settings.saveError', { error: errorMessage }), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('settings.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('settings.subtitle')}
          </p>
        </div>
        <div className="max-w-4xl">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500 dark:text-gray-400">{t('settings.loading')}</div>
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
          {t('settings.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('settings.subtitle')}
        </p>
      </div>

      <div className="max-w-4xl">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            {t('settings.generalSettings')}
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.studioTitle')}
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
                {t('settings.studioTitleDescription')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.organizationName')}
              </label>
              <input
                type="text"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                disabled={!canWriteSettings}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Your Organization Name"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('settings.organizationNameDescription')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.primaryColor')}
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={primaryColor || '#3B82F6'}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  disabled={!canWriteSettings}
                  className="h-10 w-16 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  disabled={!canWriteSettings}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="#3B82F6"
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('settings.primaryColorDescription')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.secondaryColor')}
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={secondaryColor || '#6B7280'}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  disabled={!canWriteSettings}
                  className="h-10 w-16 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  disabled={!canWriteSettings}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="#6B7280"
                />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('settings.secondaryColorDescription')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.logoUrl')}
              </label>
              <input
                type="url"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                disabled={!canWriteSettings}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="https://yoursite.com/logo.png"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('settings.logoUrlDescription')}
              </p>
              {logo && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{t('settings.logoPreview')}</p>
                  <img src={logo} alt="Logo preview" className="h-16 w-auto object-contain" />
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.publicUrl')}
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
                {t('settings.publicUrlDescription')}
              </p>
            </div>


            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.defaultTheme')}
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'system' | 'light' | 'dark')}
                disabled={!canWriteSettings}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="system">{t('theme.system')}</option>
                <option value="light">{t('theme.light')}</option>
                <option value="dark">{t('theme.dark')}</option>
              </select>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t('settings.defaultThemeDescription')}
              </p>
            </div>

          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
            {t('settings.securitySettings')}
          </h2>

          <div className="space-y-6">
            {/* MFA Enforcement */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                {t('settings.mfa.title')}
              </h3>

              {/* Require for all users */}
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="mfaRequired"
                  checked={mfaRequired}
                  onChange={(e) => setMfaRequired(e.target.checked)}
                  disabled={!canWriteSettings}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50"
                />
                <label htmlFor="mfaRequired" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  {t('settings.mfa.requireAll')}
                </label>
              </div>

              {/* Role-based enforcement */}
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t('settings.mfa.requireRoles')}
                </p>
                <div className="space-y-2 ml-4">
                  {['admin', 'editor', 'author', 'viewer'].map((role) => (
                    <div key={role} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`mfa-role-${role}`}
                        checked={mfaEnforcedRoles.includes(role)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setMfaEnforcedRoles([...mfaEnforcedRoles, role]);
                          } else {
                            setMfaEnforcedRoles(mfaEnforcedRoles.filter(r => r !== role));
                          }
                        }}
                        disabled={!canWriteSettings || mfaRequired}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50"
                      />
                      <label htmlFor={`mfa-role-${role}`} className="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {role}
                      </label>
                    </div>
                  ))}
                </div>
                {mfaRequired && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-4">
                    {t('settings.mfa.roleDisabledNote')}
                  </p>
                )}
              </div>
            </div>

            {/* Allowed MFA Methods */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                {t('settings.mfa.allowedMethods')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {t('settings.mfa.allowedMethodsDescription')}
              </p>
              <div className="space-y-2 ml-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="mfa-method-totp"
                    checked={mfaAllowedMethods.includes('totp')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setMfaAllowedMethods([...mfaAllowedMethods, 'totp']);
                      } else {
                        // Don't allow removing if it's the only method
                        if (mfaAllowedMethods.length > 1) {
                          setMfaAllowedMethods(mfaAllowedMethods.filter(m => m !== 'totp'));
                        }
                      }
                    }}
                    disabled={!canWriteSettings || (mfaAllowedMethods.length === 1 && mfaAllowedMethods.includes('totp'))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50"
                  />
                  <label htmlFor="mfa-method-totp" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t('settings.mfa.totp')}
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="mfa-method-email"
                    checked={mfaAllowedMethods.includes('email')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setMfaAllowedMethods([...mfaAllowedMethods, 'email']);
                      } else {
                        // Don't allow removing if it's the only method
                        if (mfaAllowedMethods.length > 1) {
                          setMfaAllowedMethods(mfaAllowedMethods.filter(m => m !== 'email'));
                        }
                      }
                    }}
                    disabled={!canWriteSettings || (mfaAllowedMethods.length === 1 && mfaAllowedMethods.includes('email'))}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50"
                  />
                  <label htmlFor="mfa-method-email" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    {t('settings.mfa.email')}
                  </label>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-4">
                {t('settings.mfa.atLeastOne')}
              </p>
            </div>

            {/* Info box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>{t('common.note')}</strong> {t('settings.mfa.enforcementNote')}
              </p>
            </div>
          </div>
        </div>

        {/* Save button section */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={saving || !canWriteSettings}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('settings.saving') : t('settings.saveChanges')}
          </button>
          {!canWriteSettings && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {t('settings.readOnlyMessage')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}