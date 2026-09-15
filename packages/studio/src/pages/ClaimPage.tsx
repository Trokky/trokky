import React, { useState } from 'react';
import { useT } from '@trokky/trokky/i18n';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiClient } from '@/services/api-client';
import { authStore } from '@/services/auth-store';

interface ClaimPageProps {
  /** Whether the deployment was given a claim secret that must be presented. */
  secretRequired: boolean;
  /** Same contract as the login page: the claim signs the new administrator in. */
  onLoginSuccess: (token: string, user: any) => void;
  /** The instance was claimed but no session came back; fall through to the login form. */
  onClaimedWithoutSession?: () => void;
}

/**
 * The first screen of a fresh instance: nobody owns it yet, so whoever is here creates the
 * administrator. Shown instead of the login form while the API reports the instance claimable.
 */
export function ClaimPage({ secretRequired, onLoginSuccess, onClaimedWithoutSession }: ClaimPageProps) {
  const { t } = useT('auth');
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '', secret: '' });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError(t('claim.passwordMismatch'));
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.claimInstance({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        secret: secretRequired ? form.secret : undefined,
      });

      if (!response.success || !response.data?.claimed) {
        setError(response.error?.message || t('claim.failed'));
        return;
      }

      if (response.data.token && response.data.user) {
        authStore.persist(response.data.token, response.data.refreshToken);
        onLoginSuccess(response.data.token, response.data.user);
        return;
      }

      // Claimed, but the server chose not to open a session (an MFA policy, say).
      onClaimedWithoutSession?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('claim.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-2xl border border-white/20 dark:border-gray-700/20 p-8 shadow-xl">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">{t('claim.title')}</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('claim.subtitle')}</p>
          </div>

          {!secretRequired && (
            <div
              role="note"
              className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200"
            >
              {t('claim.openWarning')}
            </div>
          )}

          {error && (
            <div role="alert" className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label={t('claim.username')} name="username" autoComplete="username" required value={form.username} onChange={update('username')} />
            <Input label={t('claim.email')} name="email" type="email" autoComplete="email" required value={form.email} onChange={update('email')} />
            <Input label={t('claim.password')} name="password" type="password" autoComplete="new-password" required value={form.password} onChange={update('password')} />
            <Input label={t('claim.confirmPassword')} name="confirmPassword" type="password" autoComplete="new-password" required value={form.confirmPassword} onChange={update('confirmPassword')} />
            {secretRequired && (
              <Input
                label={t('claim.secret')}
                name="secret"
                type="password"
                autoComplete="off"
                required
                helperText={t('claim.secretHelp')}
                value={form.secret}
                onChange={update('secret')}
              />
            )}

            <Button type="submit" className="w-full" loading={isLoading} disabled={isLoading}>
              {isLoading ? t('claim.claiming') : t('claim.claim')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
