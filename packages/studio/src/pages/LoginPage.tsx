import React, { useState, useEffect } from 'react';
import { useT } from '@trokky/i18n';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';
import { storageService, STORAGE_KEYS } from '@/utils/storage';
import { getStudioPath } from '@/utils/navigation';
import { ChevronDownIcon, ChevronRightIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { fetchBranding, applyBrandColors, BrandingConfig } from '@/utils/branding';
import { GoogleLoginButton } from '@/components/auth/GoogleLoginButton';
import { MFAVerification } from '@/components/auth/MFAVerification';
import { CaptchaWidget } from '@/components/auth/CaptchaWidget';
import { useCaptcha } from '@/hooks/useCaptcha';

type MFAMethod = 'totp' | 'email';

interface MFAState {
  required: boolean;
  setupRequired: boolean;
  mfaToken?: string;
  setupToken?: string;
  methods?: MFAMethod[];
  allowedMethods?: MFAMethod[];
  message?: string;
}

type SetupStep = 'select' | 'totp-setup' | 'email-setup' | 'verify' | 'backup-codes';

interface MFASetupState {
  step: SetupStep;
  selectedMethod?: MFAMethod;
  totpSecret?: string;
  totpQrCode?: string;
  verificationCode: string;
  isLoading: boolean;
  error?: string;
  backupCodes?: string[];
  // Store pending login data while showing backup codes
  pendingToken?: string;
  pendingRefreshToken?: string;
  pendingUser?: any;
}

interface LoginPageProps {
  onLoginSuccess: (token: string, user: any) => void;
  onMFASetupRequired?: (setupToken: string, allowedMethods: MFAMethod[]) => void;
}

export function LoginPage({ onLoginSuccess, onMFASetupRequired }: LoginPageProps) {
  const { t } = useT('auth');
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [backendUrl, setBackendUrl] = useState('');
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);
  const [mfaState, setMfaState] = useState<MFAState>({
    required: false,
    setupRequired: false,
  });
  const [setupState, setSetupState] = useState<MFASetupState>({
    step: 'select',
    verificationCode: '',
    isLoading: false,
  });

  // CAPTCHA state
  const captcha = useCaptcha({ endpoint: 'login' });

  // MFA Setup functions
  const initiateTOTPSetup = async () => {
    if (!mfaState.setupToken) return;

    setSetupState(prev => ({ ...prev, isLoading: true, error: undefined }));
    try {
      const response = await apiClient.post('/auth/mfa/setup/totp', {}, {
        headers: { 'X-MFA-Setup-Token': mfaState.setupToken }
      });

      if (response.success && response.data) {
        const data = response.data as any;
        setSetupState(prev => ({
          ...prev,
          step: 'totp-setup',
          selectedMethod: 'totp',
          totpSecret: data.secret,
          totpQrCode: data.qrCode,
          isLoading: false,
        }));
      } else {
        throw new Error(response.error?.message || 'Failed to initialize TOTP setup');
      }
    } catch (err) {
      setSetupState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Setup failed',
      }));
    }
  };

  const initiateEmailSetup = async () => {
    if (!mfaState.setupToken) return;

    setSetupState(prev => ({ ...prev, isLoading: true, error: undefined }));
    try {
      const response = await apiClient.post('/auth/mfa/setup/email', {}, {
        headers: { 'X-MFA-Setup-Token': mfaState.setupToken }
      });

      if (response.success) {
        setSetupState(prev => ({
          ...prev,
          step: 'email-setup',
          selectedMethod: 'email',
          isLoading: false,
        }));
      } else {
        throw new Error(response.error?.message || 'Failed to send verification email');
      }
    } catch (err) {
      setSetupState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Setup failed',
      }));
    }
  };

  const completeLoginAfterBackupCodes = () => {
    if (setupState.pendingToken && setupState.pendingUser) {
      localStorage.setItem('trokky_auth_token', setupState.pendingToken);
      if (setupState.pendingRefreshToken) {
        localStorage.setItem('trokky_refresh_token', setupState.pendingRefreshToken);
      }
      apiClient.setAuthToken(setupState.pendingToken);
      onLoginSuccess(setupState.pendingToken, setupState.pendingUser);
    }
  };

  const copyBackupCodes = () => {
    if (setupState.backupCodes) {
      const codesText = setupState.backupCodes.join('\n');
      navigator.clipboard.writeText(codesText);
    }
  };

  const verifyAndCompleteSetup = async () => {
    if (!mfaState.setupToken || !setupState.verificationCode) return;

    setSetupState(prev => ({ ...prev, isLoading: true, error: undefined }));
    try {
      const endpoint = setupState.selectedMethod === 'totp'
        ? '/auth/mfa/setup/totp/verify'
        : '/auth/mfa/setup/email/verify';

      const response = await apiClient.post(endpoint, {
        code: setupState.verificationCode,
      }, {
        headers: { 'X-MFA-Setup-Token': mfaState.setupToken }
      });

      if (response.success && response.data) {
        const data = response.data as any;

        // If we got backup codes, show them first before completing login
        if (data.backupCodes && data.backupCodes.length > 0) {
          setSetupState(prev => ({
            ...prev,
            step: 'backup-codes',
            backupCodes: data.backupCodes,
            pendingToken: data.token,
            pendingRefreshToken: data.refreshToken,
            pendingUser: data.user,
            isLoading: false,
          }));
        } else if (data.token && data.user) {
          // No backup codes, complete login immediately
          localStorage.setItem('trokky_auth_token', data.token);
          if (data.refreshToken) {
            localStorage.setItem('trokky_refresh_token', data.refreshToken);
          }
          apiClient.setAuthToken(data.token);
          onLoginSuccess(data.token, data.user);
        } else {
          // Fallback
          setSetupState(prev => ({
            ...prev,
            step: 'verify',
            isLoading: false,
          }));
        }
      } else {
        throw new Error(response.error?.message || 'Verification failed');
      }
    } catch (err) {
      setSetupState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Verification failed',
      }));
    }
  };

  useEffect(() => {
    // Auto-detect system theme preference
    const detectTheme = () => {
      const savedTheme = localStorage.getItem('theme');
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

      if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    detectTheme();

    // Fetch branding from API and apply brand colors
    const loadBranding = async () => {
      const fetchedBranding = await fetchBranding();
      setBranding(fetchedBranding);
      applyBrandColors(fetchedBranding);
    };

    loadBranding();

    // Check OAuth status
    const checkOAuthStatus = async () => {
      try {
        const response = await apiClient.get<{ providers: { google: boolean } }>('/auth/oauth/status');
        if (response.success && response.data?.providers?.google) {
          setGoogleOAuthEnabled(true);
        }
      } catch (error) {
        // OAuth not configured or error - just don't show the button
        console.debug('OAuth status check failed:', error);
      }
    };

    checkOAuthStatus();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = () => {
      if (!localStorage.getItem('theme')) {
        detectTheme();
      }
    };
    mediaQuery.addEventListener('change', handleThemeChange);

    // Check if backend URL is configured via server injection or build time
    const windowConfig = (window as any).TROKKY_CONFIG;
    const injectedBackendUrl = windowConfig?.backendUrl;
    const buildTimeBackendUrl = import.meta.env.VITE_BACKEND_URL;
    
    if (injectedBackendUrl || buildTimeBackendUrl) {
      // Hide advanced section since backend is pre-configured
      setBackendUrl(injectedBackendUrl || buildTimeBackendUrl);
    } else {
      // Load from localStorage or default but keep panel closed
      const savedUrl = storageService.get<string>(STORAGE_KEYS.BACKEND_URL);
      if (savedUrl) {
        setBackendUrl(savedUrl);
      } else {
        // Default to current origin with /api
        const defaultUrl = `${window.location.origin}/api`;
        setBackendUrl(defaultUrl);
      }
    }

    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);

  // Check for OAuth MFA state from sessionStorage (when redirected from OAuth callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mfaParam = urlParams.get('mfa');

    if (mfaParam === 'verify') {
      // OAuth requires MFA verification
      const mfaToken = sessionStorage.getItem('oauth_mfa_token');
      const methodsStr = sessionStorage.getItem('oauth_mfa_methods');

      if (mfaToken && methodsStr) {
        const methods = JSON.parse(methodsStr) as MFAMethod[];
        sessionStorage.removeItem('oauth_mfa_token');
        sessionStorage.removeItem('oauth_mfa_methods');

        setMfaState({
          required: true,
          setupRequired: false,
          mfaToken,
          methods,
        });

        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    } else if (mfaParam === 'setup') {
      // OAuth requires MFA setup
      const setupToken = sessionStorage.getItem('oauth_mfa_setup_token');
      const allowedMethodsStr = sessionStorage.getItem('oauth_mfa_allowed_methods');
      const message = sessionStorage.getItem('oauth_mfa_message');

      if (setupToken && allowedMethodsStr) {
        const allowedMethods = JSON.parse(allowedMethodsStr) as MFAMethod[];
        sessionStorage.removeItem('oauth_mfa_setup_token');
        sessionStorage.removeItem('oauth_mfa_allowed_methods');
        sessionStorage.removeItem('oauth_mfa_message');

        setMfaState({
          required: false,
          setupRequired: true,
          setupToken,
          allowedMethods,
          message: message || 'Your organization requires MFA. Please set up multi-factor authentication.',
        });

        // Clean URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validate CAPTCHA if required
    if (captcha.isRequired && !captcha.token) {
      setError(t('errors.captchaRequired'));
      setIsLoading(false);
      return;
    }

    try {
      // Save backend URL to localStorage and reinitialize API client (only if not pre-configured)
      const config = (window as any).TROKKY_CONFIG;
      const isPreConfigured = import.meta.env.VITE_BACKEND_URL || config?.backendUrl;

      if (backendUrl && !isPreConfigured) {
        storageService.set(STORAGE_KEYS.BACKEND_URL, backendUrl);
        // Reinitialize API client with new backend URL
        apiClient.setBackendUrl(backendUrl);
      }
      // Get device ID for trusted device checking
      const deviceId = getDeviceId();
      const response = await apiClient.login(credentials.username, credentials.password, rememberMe, deviceId, captcha.token || undefined);

      if (response.success && response.data) {
        const loginData = response.data as any;

        // Check for MFA verification required
        if (loginData.requiresMFA && loginData.mfaToken) {
          setMfaState({
            required: true,
            setupRequired: false,
            mfaToken: loginData.mfaToken,
            methods: loginData.methods || ['totp'],
          });
          return;
        }

        // Check for MFA setup required
        if (loginData.requiresMFASetup && loginData.setupToken) {
          setMfaState({
            required: false,
            setupRequired: true,
            setupToken: loginData.setupToken,
            allowedMethods: loginData.allowedMethods || ['totp', 'email'],
            message: loginData.message,
          });
          // If callback provided, trigger MFA setup flow
          if (onMFASetupRequired) {
            onMFASetupRequired(loginData.setupToken, loginData.allowedMethods || ['totp', 'email']);
          }
          return;
        }

        // Normal successful login
        if (loginData.token && loginData.user) {
          // Token is already stored by the login method
          // Call success callback
          onLoginSuccess(loginData.token, loginData.user);
        } else {
          setError('Invalid login response');
        }
      } else {
        setError(response.error?.message || 'Login failed');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFASuccess = (token: string, user: any) => {
    onLoginSuccess(token, user);
  };

  const handleMFABack = () => {
    setMfaState({ required: false, setupRequired: false });
    setCredentials({ username: credentials.username, password: '' });
  };

  const handleInputChange = (field: 'username' | 'password') => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  // Use fetched branding or fallback
  const displayBranding = branding || { title: 'Trokky Studio' };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-sm">

        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-700/20 p-8 shadow-xl">
          {/* Branding Header - always show unless in MFA verification */}
          {!mfaState.required && (
            <div className="mb-8 text-center">
              {displayBranding.logo ? (
                <div className="flex justify-center">
                  <img
                    src={displayBranding.logo}
                    alt={displayBranding.organizationName || displayBranding.title}
                    className="h-20 w-auto object-contain"
                  />
                </div>
              ) : (
                <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {displayBranding.organizationName || displayBranding.title}
                </h1>
              )}
            </div>
          )}

          {/* MFA Verification Step */}
          {mfaState.required && mfaState.mfaToken && mfaState.methods && (
            <MFAVerification
              mfaToken={mfaState.mfaToken}
              methods={mfaState.methods}
              onSuccess={handleMFASuccess}
              onBack={handleMFABack}
              onError={setError}
            />
          )}

          {/* MFA Setup Required Step - Inline Wizard */}
          {mfaState.setupRequired && (
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <h2 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-2">
                  {t('mfa.required')}
                </h2>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {mfaState.message || t('mfa.setupRequired')}
                </p>
              </div>

              {/* Error display */}
              {setupState.error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-600 dark:text-red-400">{setupState.error}</p>
                </div>
              )}

              {/* Step: Method Selection */}
              {setupState.step === 'select' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    {t('mfa.chooseMethod')}
                  </p>

                  {mfaState.allowedMethods?.includes('totp') && (
                    <button
                      onClick={initiateTOTPSetup}
                      disabled={setupState.isLoading}
                      className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-left disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{t('mfa.authenticatorApp')}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{t('mfa.authenticatorAppDesc')}</div>
                        </div>
                      </div>
                    </button>
                  )}

                  {mfaState.allowedMethods?.includes('email') && (
                    <button
                      onClick={initiateEmailSetup}
                      disabled={setupState.isLoading}
                      className="w-full p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 transition-colors text-left disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{t('mfa.emailCode')}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{t('mfa.emailCodeDesc')}</div>
                        </div>
                      </div>
                    </button>
                  )}

                  {setupState.isLoading && (
                    <div className="flex justify-center py-4">
                      <LoadingSpinner size="md" />
                    </div>
                  )}
                </div>
              )}

              {/* Step: TOTP Setup - Show QR Code */}
              {setupState.step === 'totp-setup' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {t('mfa.scanQR')}
                    </p>
                    {setupState.totpQrCode && (
                      <div className="flex justify-center mb-4">
                        <img
                          src={setupState.totpQrCode}
                          alt="TOTP QR Code"
                          className="w-48 h-48 bg-white p-2 rounded-lg"
                        />
                      </div>
                    )}
                    {setupState.totpSecret && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('mfa.manualEntry')}</p>
                        <code className="text-sm bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded font-mono">
                          {setupState.totpSecret}
                        </code>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('mfa.enterCode')}
                    </label>
                    <Input
                      type="text"
                      value={setupState.verificationCode}
                      onChange={(e) => setSetupState(prev => ({ ...prev, verificationCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                      placeholder="000000"
                      maxLength={6}
                      className="text-center text-2xl tracking-widest font-mono"
                      autoFocus
                    />
                  </div>

                  <Button
                    onClick={verifyAndCompleteSetup}
                    disabled={setupState.isLoading || setupState.verificationCode.length !== 6}
                    className="w-full h-12 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    {setupState.isLoading ? <LoadingSpinner size="sm" /> : t('mfa.verifyComplete')}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setSetupState(prev => ({ ...prev, step: 'select', verificationCode: '', error: undefined }))}
                    className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {t('mfa.chooseDifferent')}
                  </button>
                </div>
              )}

              {/* Step: Email Setup - Enter Code */}
              {setupState.step === 'email-setup' && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('mfa.emailSent')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('mfa.enterEmailCode')}
                    </label>
                    <Input
                      type="text"
                      value={setupState.verificationCode}
                      onChange={(e) => setSetupState(prev => ({ ...prev, verificationCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                      placeholder="000000"
                      maxLength={6}
                      className="text-center text-2xl tracking-widest font-mono"
                      autoFocus
                    />
                  </div>

                  <Button
                    onClick={verifyAndCompleteSetup}
                    disabled={setupState.isLoading || setupState.verificationCode.length !== 6}
                    className="w-full h-12 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    {setupState.isLoading ? <LoadingSpinner size="sm" /> : t('mfa.verifyComplete')}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setSetupState(prev => ({ ...prev, step: 'select', verificationCode: '', error: undefined }))}
                    className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    {t('mfa.chooseDifferent')}
                  </button>
                </div>
              )}

              {/* Step: Backup Codes - Save before completing login */}
              {setupState.step === 'backup-codes' && setupState.backupCodes && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {t('mfa.backupCodes.title')}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('mfa.backupCodes.description')}
                    </p>
                  </div>

                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                      {setupState.backupCodes.map((code, index) => (
                        <div key={index} className="text-center py-1 px-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={copyBackupCodes}
                      variant="outline"
                      className="flex-1 h-10"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {t('mfa.backupCodes.copy')}
                    </Button>
                  </div>

                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      <strong>{t('mfa.backupCodes.warning').split(':')[0]}:</strong> {t('mfa.backupCodes.warning').split(':').slice(1).join(':')}
                    </p>
                  </div>

                  <Button
                    onClick={completeLoginAfterBackupCodes}
                    className="w-full h-12 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
                  >
                    {t('mfa.backupCodes.continue')}
                  </Button>
                </div>
              )}

              {/* Back to login button - hide when showing backup codes */}
              {setupState.step !== 'backup-codes' && (
                <button
                  type="button"
                  onClick={handleMFABack}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  {t('login.backToLogin')}
                </button>
              )}
            </div>
          )}

          {/* Normal Login Form */}
          {!mfaState.required && !mfaState.setupRequired && (
            <>
              {error && (
                <div className="mb-6 p-3 bg-red-50/80 dark:bg-red-900/20 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Input
                  type="text"
                  value={credentials.username}
                  onChange={handleInputChange('username')}
                  placeholder={t('login.emailOrUsername')}
                  required
                  disabled={isLoading}
                  autoComplete="username"
                  autoFocus
                  className="w-full bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-600 rounded-none px-4 py-3 text-base placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:ring-0 transition-colors"
                />
              </div>

              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={credentials.password}
                  onChange={handleInputChange('password')}
                  placeholder={t('login.password')}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  className="w-full bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-600 rounded-none px-4 py-3 pr-12 text-base placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:ring-0 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onChange={setRememberMe}
                  className="mr-2"
                />
                <span className="text-gray-600 dark:text-gray-400">{t('login.rememberMe')}</span>
              </label>

              <a
                href={getStudioPath('/forgot-password')}
                className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                {t('login.forgotPassword')}
              </a>
            </div>

            {/* Advanced settings toggle */}
            {!import.meta.env.VITE_BACKEND_URL && !(window as any).TROKKY_CONFIG?.backendUrl && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  {showAdvanced ? (
                    <ChevronDownIcon className="h-3 w-3 mr-1" />
                  ) : (
                    <ChevronRightIcon className="h-3 w-3 mr-1" />
                  )}
                  {t('advanced.title')}
                </button>
              </div>
            )}

            {/* Advanced settings panel */}
            {!import.meta.env.VITE_BACKEND_URL && !(window as any).TROKKY_CONFIG?.backendUrl && showAdvanced && (
              <div className="mt-4 p-4 bg-gray-50/50 dark:bg-gray-900/30 rounded-lg border border-gray-200/30 dark:border-gray-700/30">
                <Input
                  type="url"
                  value={backendUrl}
                  onChange={(e) => setBackendUrl(e.target.value)}
                  placeholder={t('advanced.backendUrl')}
                  disabled={isLoading}
                  className="text-sm bg-transparent border-gray-300 dark:border-gray-600 px-4 py-2"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {t('advanced.customEndpoint')}
                </p>
              </div>
            )}

            {/* CAPTCHA Widget */}
            {captcha.isRequired && captcha.config && (
              <div className="flex justify-center my-4">
                <CaptchaWidget
                  provider={captcha.config.provider}
                  siteKey={captcha.config.siteKey}
                  options={captcha.config.options}
                  onVerify={captcha.onVerify}
                  onError={captcha.onError}
                  onExpire={captcha.onExpire}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg font-medium text-base transition-colors"
              disabled={isLoading || !credentials.username || !credentials.password || (captcha.isRequired && !captcha.token)}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  {t('login.signingIn')}
                </>
              ) : (
                t('login.signIn')
              )}
            </Button>

            {/* OAuth Login Options */}
            {googleOAuthEnabled && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      {t('login.orContinueWith')}
                    </span>
                  </div>
                </div>

                <GoogleLoginButton
                  mode="login"
                  onError={(err) => setError(err)}
                  disabled={isLoading}
                />
              </>
            )}
              </form>
            </>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {displayBranding.title}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Get or generate a persistent device ID for trusted device feature.
 * This ID is stored in localStorage and persists across sessions.
 */
function getDeviceId(): string {
  const stored = localStorage.getItem('trokky_device_id');
  if (stored) return stored;

  const id = crypto.randomUUID();
  localStorage.setItem('trokky_device_id', id);
  return id;
}