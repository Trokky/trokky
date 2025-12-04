import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';
import { CheckCircleIcon, XCircleIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { navigateTo } from '@/utils/navigation';
import { CaptchaWidget } from '@/components/auth/CaptchaWidget';
import { useCaptcha } from '@/hooks/useCaptcha';

export function ResetPasswordPage() {
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
      setError('No reset token provided');
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
          setError(response.data?.message || 'Invalid or expired reset token');
        }
      } catch (error) {
        setError('Failed to verify reset token');
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
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate CAPTCHA if required
    if (captcha.isRequired && !captcha.token) {
      setError('Please complete the CAPTCHA verification');
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
        setError(response.error?.message || 'Failed to reset password');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (pwd: string): string => {
    if (pwd.length < 8) return 'Too short';
    if (pwd.length < 12) return 'Weak';
    if (pwd.length < 16 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) return 'Good';
    if (pwd.length >= 16 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^A-Za-z0-9]/.test(pwd)) return 'Strong';
    return 'Medium';
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
          <p className="mt-4 text-gray-600 dark:text-gray-400">Verifying reset link...</p>
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
                Password Reset Successful
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-8">
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
              <Button
                onClick={() => navigateTo('/')}
                className="w-full h-12 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Sign In
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
                Invalid Reset Link
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-2">
                {error || 'This password reset link is invalid or has expired.'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                Reset links expire after 1 hour. Please request a new one.
              </p>
              <Button
                onClick={() => navigateTo('/forgot-password')}
                className="w-full h-12 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Request New Link
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
            Reset Password
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Enter your new password below.
          </p>

          {expiresIn && expiresIn < 10 && (
            <div className="mb-4 p-3 bg-yellow-50/80 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Link expires in {expiresIn} minute{expiresIn !== 1 ? 's' : ''}
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
                  placeholder="New password"
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
                  passwordStrength === 'Strong' ? 'text-green-600 dark:text-green-400' :
                  passwordStrength === 'Good' ? 'text-blue-600 dark:text-blue-400' :
                  passwordStrength === 'Medium' ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  Strength: {passwordStrength}
                </p>
              )}
            </div>

            <div>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
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
                  Passwords do not match
                </p>
              )}
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p>Password must:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li className={password.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}>
                  Be at least 8 characters long
                </li>
                <li className={/[A-Z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                  Contain an uppercase letter (recommended)
                </li>
                <li className={/[0-9]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                  Contain a number (recommended)
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
                  Resetting Password...
                </>
              ) : (
                'Reset Password'
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
