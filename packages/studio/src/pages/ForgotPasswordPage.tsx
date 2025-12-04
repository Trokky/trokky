import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';
import { ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { fetchBranding, applyBrandColors, BrandingConfig } from '@/utils/branding';
import { getStudioPath, navigateTo } from '@/utils/navigation';
import { CaptchaWidget } from '@/components/auth/CaptchaWidget';
import { useCaptcha } from '@/hooks/useCaptcha';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);

  // CAPTCHA state
  const captcha = useCaptcha({ endpoint: 'passwordResetRequest' });

  useEffect(() => {
    // Auto-detect system theme preference
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Fetch branding from API and apply brand colors
    const loadBranding = async () => {
      const fetchedBranding = await fetchBranding();
      setBranding(fetchedBranding);
      applyBrandColors(fetchedBranding);
    };

    loadBranding();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Validate CAPTCHA if required
    if (captcha.isRequired && !captcha.token) {
      setError('Please complete the CAPTCHA verification');
      setIsLoading(false);
      return;
    }

    try {
      const response = await apiClient.post('/auth/request-reset', {
        email,
        captchaToken: captcha.token || undefined,
      });

      if (response.success) {
        setIsSubmitted(true);
      } else {
        setError(response.error?.message || 'Failed to send reset email');
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send reset email');
    } finally {
      setIsLoading(false);
    }
  };

  // Use fetched branding or fallback
  const displayBranding = branding || { title: 'Trokky Studio' };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-700/20 p-8 shadow-xl">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircleIcon className="h-16 w-16 text-green-500 dark:text-green-400" />
              </div>
              <h2 className="text-2xl font-semibold text-primary-600 dark:text-primary-400 mb-3">
                Check your email
              </h2>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                If an account exists for <strong>{email}</strong>, you will receive a password reset link shortly.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                The link will expire in 1 hour.
              </p>
              <Button
                onClick={() => navigateTo('/')}
                className="w-full h-12 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg font-medium transition-colors"
              >
                Back to Sign In
              </Button>
            </div>
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-700/20 p-8 shadow-xl">
          <div className="mb-6">
            <a
              href={getStudioPath('/')}
              className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Sign In
            </a>
          </div>

          <h2 className="text-2xl font-semibold text-primary-600 dark:text-primary-400 mb-2">
            Forgot password?
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-50/80 dark:bg-red-900/20 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={isLoading}
                autoComplete="email"
                autoFocus
                className="w-full bg-transparent border-0 border-b-2 border-gray-200 dark:border-gray-600 rounded-none px-4 py-3 text-base placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:ring-0 transition-colors"
              />
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
              disabled={isLoading || !email || (captcha.isRequired && !captcha.token)}
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </Button>
          </form>
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
