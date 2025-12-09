import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';
import { CheckCircleIcon, XCircleIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { navigateTo } from '@/utils/navigation';
import { CaptchaWidget } from '@/components/auth/CaptchaWidget';
import { useCaptcha } from '@/hooks/useCaptcha';
import { useT } from '@trokky/i18n';

export function ResetPasswordPage() {
  const { t } = useT('studio');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  // CAPTCHA state
  const captcha = useCaptcha({ endpoint: 'passwordResetVerify' });

  // Ensure dark mode is applied on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('trokky_theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (savedTheme === 'system' && systemPrefersDark) || (!savedTheme && systemPrefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    if (!tokenFromUrl) {
      setError(t('auth.resetPassword.noToken'));
      setIsVerifying(false);
      return;
    }

    setToken(tokenFromUrl);

    // Verify token validity
    const verifyToken = async () => {
      try {
        const response = await apiClient.post('/auth/verify-reset-token', {
          token: tokenFromUrl,
        });

        if (response.success && response.data?.valid) {
          setTokenValid(true);
          setExpiresIn(response.data.expiresIn);
        } else {
          setError(response.data?.message || t('auth.resetPassword.tokenInvalid'));
        }
      } catch (error) {
        setError(t('auth.resetPassword.tokenVerifyError'));
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (password.length < 8) {
      setError(t('auth.resetPassword.passwordMinLength'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.resetPassword.passwordMismatch'));
      return;
    }

    // Validate CAPTCHA if required
    if (captcha.isRequired && !captcha.token) {
      setError(t('auth.resetPassword.captchaRequired'));
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.post('/auth/reset-password', {
        token,
        newPassword: password,
        captchaToken: captcha.token || undefined,
      });

      if (response.success) {
        setIsSuccess(true);
      } else {
        setError(response.error?.message || t('auth.resetPassword.resetError'));
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : t('auth.resetPassword.resetError'));
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (pwd: string): string => {
    if (pwd.length < 8) return t('auth.resetPassword.strengthTooShort');
    if (pwd.length < 12) return t('auth.resetPassword.strengthWeak');
    if (pwd.length < 16 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) return t('auth.resetPassword.strengthGood');
    if (pwd.length >= 16 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) return t('auth.resetPassword.strengthStrong');
    return t('auth.resetPassword.strengthMedium');
  };

  const passwordStrength = password ? getPasswordStrength(password) : null;

  // Get branding from config
  const config = (window as any).TROKKY_CONFIG;
  const branding = config?.branding || { title: 'Trokky Studio' };

  // Loading state while verifying token
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">{t('auth.resetPassword.verifying')}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-700/20 p-8 shadow-xl">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircleIcon className="h-16 w-16 text-green-500 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                {t('auth.resetPassword.success')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                {t('auth.resetPassword.successMessage')}
              </p>
              <Button
                onClick={() => navigateTo('/')}
                className="w-full h-12 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                {t('auth.resetPassword.signIn')}
              </Button>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {branding.title}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-700/20 p-8 shadow-xl">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <XCircleIcon className="h-16 w-16 text-red-500 dark:text-red-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
                {t('auth.resetPassword.invalidLink')}
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                {error || t('auth.resetPassword.invalidLinkMessage')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                {t('auth.resetPassword.linkExpireNote')}
              </p>
              <Button
                onClick={() => navigateTo('/forgot-password')}
                className="w-full h-12 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                {t('auth.resetPassword.requestNewLink')}
              </Button>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {branding.title}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-700/20 p-8 shadow-xl">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            {t('auth.resetPassword.title')}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            {t('auth.resetPassword.subtitle')}
          </p>

          {expiresIn && expiresIn < 10 && (
            <div className="mb-4 p-3 bg-yellow-50/80 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {t('auth.resetPassword.linkExpiresIn', { minutes: expiresIn, count: expiresIn })}
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3 bg-red-50/80 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.resetPassword.newPassword')}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  autoFocus
                  className="w-full bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-600 rounded-none px-4 py-3 pr-12 text-base placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:ring-0 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              {password && (
                <p className={`mt-2 text-xs ${
                  passwordStrength === t('auth.resetPassword.strengthStrong') ? 'text-green-600 dark:text-green-400' :
                  passwordStrength === t('auth.resetPassword.strengthGood') ? 'text-blue-600 dark:text-blue-400' :
                  passwordStrength === t('auth.resetPassword.strengthMedium') ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {t('auth.resetPassword.strength')}: {passwordStrength}
                </p>
              )}
            </div>

            <div>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.resetPassword.confirmPassword')}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  className="w-full bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-600 rounded-none px-4 py-3 pr-12 text-base placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:ring-0 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              {confirmPassword && confirmPassword !== password && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {t('auth.resetPassword.passwordMismatch')}
                </p>
              )}
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p>{t('auth.resetPassword.requirements')}</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li className={password.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}>
                  {t('auth.resetPassword.requireLength')}
                </li>
                <li className={/[A-Z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                  {t('auth.resetPassword.requireUppercase')}
                </li>
                <li className={/[0-9]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                  {t('auth.resetPassword.requireNumber')}
                </li>
              </ul>
            </div>

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
              disabled={isLoading || !password || !confirmPassword || password !== confirmPassword || (captcha.isRequired && !captcha.token)}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  {t('auth.resetPassword.resetting')}
                </>
              ) : (
                t('auth.resetPassword.resetButton')
              )}
            </Button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {branding.title}
          </p>
        </div>
      </div>
    </div>
  );
}
