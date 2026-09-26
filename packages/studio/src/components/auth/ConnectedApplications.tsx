/**
 * The applications a person has signed in to Trokky with (the Trokky CLI, an AI agent through
 * the Trokky MCP server, a site's own tools), and the button to take that access back.
 * Revoking ends every token the application holds under that approval at once.
 *
 * `scope="mine"` shows the signed-in person's own; `scope="all"` shows everyone's, for an
 * admin.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@trokky/trokky/i18n';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';

const logger = createStudioLogger('ConnectedApplications');

export interface ConnectedApplication {
  id: string;
  clientId: string;
  clientName: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt?: string;
  userAgent?: string;
  userId?: string;
  username?: string;
}

const SCOPE_LABEL_KEYS: Record<string, string> = {
  openid: 'openid',
  profile: 'profile',
  'content:read': 'contentRead',
  'content:write': 'contentWrite',
  'content:delete': 'contentDelete',
  'content:publish': 'contentPublish',
  'media:read': 'mediaRead',
  'media:write': 'mediaWrite',
  'media:delete': 'mediaDelete',
  offline_access: 'offlineAccess',
};

export function ConnectedApplications({ scope }: { scope: 'mine' | 'all' }) {
  const { t } = useT('studio');
  const [applications, setApplications] = useState<ConnectedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  // A key, translated at render, so loading does not depend on `t` (a new `t` would refetch)
  const [error, setError] = useState<'loadFailed' | 'revokeFailed' | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  // Where focus goes once a revoked row is gone, so it does not fall back to the page
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{ grants: ConnectedApplication[] }>(
        scope === 'all' ? '/admin/oauth-grants' : '/auth/grants'
      );
      if (response.success && response.data) {
        setApplications(response.data.grants);
      } else {
        setError('loadFailed');
      }
    } catch (err) {
      logger.warn('Failed to load connected applications', err);
      setError('loadFailed');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (application: ConnectedApplication) => {
    if (revoking) {
      return;
    }
    if (!confirm(t('connectedApps.revokeConfirm', { name: application.clientName }))) {
      return;
    }
    setRevoking(application.id);
    setError(null);
    try {
      const path = scope === 'all'
        ? `/admin/users/${encodeURIComponent(application.userId ?? '')}/oauth-grants/${encodeURIComponent(application.id)}`
        : `/auth/grants/${encodeURIComponent(application.id)}`;
      const response = await apiClient.delete(path);
      if (response.success) {
        setApplications(current => current.filter(item => item.id !== application.id));
        listRef.current?.focus();
      } else {
        setError('revokeFailed');
      }
    } catch (err) {
      logger.warn('Failed to revoke application', err);
      setError('revokeFailed');
    } finally {
      setRevoking(null);
    }
  };

  const parseDate = (value?: string) => {
    const date = value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? date : null;
  };
  const formatDate = (value?: string) => parseDate(value)?.toLocaleString() ?? '—';
  const scopeLabel = (value: string) =>
    SCOPE_LABEL_KEYS[value] ? t(`auth.device.scopes.${SCOPE_LABEL_KEYS[value]}`) : value;

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div
      className="space-y-3 focus:outline-none"
      data-testid="connected-applications"
      ref={listRef}
      tabIndex={-1}
      aria-label={t('connectedApps.title', 'Connected applications')}
    >
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error === 'loadFailed'
            ? t('connectedApps.loadFailed', 'Could not load connected applications')
            : t('connectedApps.revokeFailed', 'Could not revoke access')}
        </p>
      )}
      {applications.length === 0 ? (
        !error && <p className="text-sm text-gray-500 dark:text-gray-400">
          {scope === 'all'
            ? t('connectedApps.noneAll', 'No application holds access to this site.')
            : t('connectedApps.none', 'You have not connected any application.')}
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
          {applications.map(application => (
            <li key={application.id} className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between" data-testid={`connected-app-${application.id}`}>
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {application.clientName}
                  {scope === 'all' && application.username && (
                    <span className="font-normal text-gray-500 dark:text-gray-400">
                      {' · '}{application.username}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-300">
                  {application.scopes.filter(value => value !== 'openid').map(scopeLabel).join(' · ')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('connectedApps.connected', { date: formatDate(application.createdAt) })}
                  {parseDate(application.lastUsedAt) && (
                    <>
                      {' · '}
                      {t('connectedApps.lastUsed', { date: formatDate(application.lastUsedAt) })}
                    </>
                  )}
                </p>
                {application.userAgent && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate" title={application.userAgent}>
                    {application.userAgent}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => revoke(application)}
                disabled={revoking !== null}
                aria-busy={revoking === application.id}
                aria-label={t('connectedApps.revokeFor', {
                  name: scope === 'all' && application.username
                    ? `${application.clientName} (${application.username})`
                    : application.clientName
                })}
                className="shrink-0 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                {t('connectedApps.revoke', 'Revoke')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
