import { useState, useEffect } from 'react';
import {
  KeyIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  DocumentDuplicateIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import { usePermissions } from '@/hooks/usePermissions';
import { TOKEN_PERMISSIONS } from '@/constants/permissions';
import { useT } from '@trokky/i18n';
import type { AppToken, Permission } from '@/types';

const logger = createStudioLogger('AppTokenManagement');

// Permission definitions with i18n keys
const PERMISSION_DEFS: { value: Permission; labelKey: string; group: string }[] = [
  { value: 'content:read', labelKey: 'appTokens.permissions.viewContent', group: 'Content' },
  { value: 'content:write', labelKey: 'appTokens.permissions.editContent', group: 'Content' },
  { value: 'content:delete', labelKey: 'appTokens.permissions.deleteContent', group: 'Content' },
  { value: 'content:publish', labelKey: 'appTokens.permissions.publishContent', group: 'Content' },
  { value: 'media:read', labelKey: 'appTokens.permissions.viewMedia', group: 'Media' },
  { value: 'media:upload', labelKey: 'appTokens.permissions.uploadMedia', group: 'Media' },
  { value: 'media:edit', labelKey: 'appTokens.permissions.editMedia', group: 'Media' },
  { value: 'media:delete', labelKey: 'appTokens.permissions.deleteMedia', group: 'Media' }
];

interface TokenFormData {
  name: string;
  description: string;
  permissions: Permission[];
  expiresAt?: Date;
}

interface TokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tokenData: TokenFormData) => Promise<{ token: string }>;
}

function TokenModal({ isOpen, onClose, onSave }: TokenModalProps) {
  const { t } = useT('studio');
  const [formData, setFormData] = useState<TokenFormData>({
    name: '',
    description: '',
    permissions: ['content:read', 'media:read'],
    expiresAt: undefined
  });
  const [isLoading, setIsLoading] = useState(false);
  const [expiryType, setExpiryType] = useState<'never' | '30days' | '90days' | '1year' | 'custom'>('90days');
  const [customExpiryDate, setCustomExpiryDate] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        description: '',
        permissions: ['content:read', 'media:read'],
        expiresAt: undefined
      });
      setExpiryType('90days');
      setCustomExpiryDate('');
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      let expiresAt: Date | undefined;
      
      if (expiryType === 'never') {
        expiresAt = undefined;
      } else if (expiryType === 'custom') {
        expiresAt = new Date(customExpiryDate);
      } else {
        const days = {
          '30days': 30,
          '90days': 90,
          '1year': 365
        }[expiryType];
        expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }
      
      await onSave({
        ...formData,
        expiresAt
      });
      
      onClose();
    } catch (error) {
      logger.error('Failed to create token', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePermission = (permission: Permission) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  // Convert permission definitions to use translated labels
  const PERMISSIONS = PERMISSION_DEFS.map(perm => ({
    value: perm.value,
    label: t(perm.labelKey),
    group: perm.group
  }));

  // Group permissions by category
  const groupedPermissions = PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.group]) acc[perm.group] = [];
    acc[perm.group].push(perm);
    return acc;
  }, {} as Record<string, typeof PERMISSIONS>);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('appTokens.modal.title')}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('appTokens.modal.tokenName')} *
            </label>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder={t('appTokens.modal.tokenNamePlaceholder')}
              required
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('appTokens.modal.description')}
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder={t('appTokens.modal.descriptionPlaceholder')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('appTokens.modal.expiration')}
            </label>
            <select
              value={expiryType}
              onChange={(e) => setExpiryType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isLoading}
            >
              <option value="30days">{t('appTokens.modal.expiration30days')}</option>
              <option value="90days">{t('appTokens.modal.expiration90days')}</option>
              <option value="1year">{t('appTokens.modal.expiration1year')}</option>
              <option value="never">{t('appTokens.modal.expirationNever')}</option>
              <option value="custom">{t('appTokens.modal.expirationCustom')}</option>
            </select>
            {expiryType === 'custom' && (
              <Input
                type="date"
                value={customExpiryDate}
                onChange={(e) => setCustomExpiryDate(e.target.value)}
                className="mt-2"
                min={new Date().toISOString().split('T')[0]}
                required
                disabled={isLoading}
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('appTokens.modal.permissions')}
            </label>
            <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3 space-y-3 max-h-48 overflow-y-auto">
              {Object.entries(groupedPermissions).map(([group, permissions]) => (
                <div key={group}>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {group}
                  </h4>
                  <div className="space-y-1 ml-2">
                    {permissions.map(permission => (
                      <label key={permission.value} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(permission.value)}
                          onChange={() => togglePermission(permission.value)}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                          {permission.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {t('appTokens.modal.cancel')}
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isLoading || !formData.name}>
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                {t('appTokens.modal.creating')}
              </>
            ) : (
              t('appTokens.modal.createToken')
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface TokenDisplayModalProps {
  token: string | null;
  isOpen: boolean;
  onClose: () => void;
}

function TokenDisplayModal({ token, isOpen, onClose }: TokenDisplayModalProps) {
  const { t } = useT('studio');
  const [copied, setCopied] = useState(false);

  const copyToken = async () => {
    if (token) {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal
      isOpen={isOpen && !!token}
      onClose={onClose}
      title={t('appTokens.tokenCreated.title')}
      size="md"
    >
      <div>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-4 mb-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>{t('common.note')}</strong> {t('appTokens.tokenCreated.warning')}
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('appTokens.tokenCreated.yourToken')}
            </label>
            <div className="flex">
              <input
                type="text"
                value={token || ''}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              />
              <Button
                onClick={copyToken}
                className="rounded-l-none"
                variant={copied ? 'secondary' : 'primary'}
              >
                {copied ? t('appTokens.tokenCreated.copied') : <DocumentDuplicateIcon className="h-4 w-4" />}
              </Button>
            </div>
          </div>

        {/* Actions */}
        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button onClick={onClose}>
            {t('appTokens.tokenCreated.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function AppTokenManagement() {
  const { t } = useT('studio');
  const { hasPermission } = usePermissions();
  const [tokens, setTokens] = useState<AppToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());

  // Permission checks
  const canCreateToken = hasPermission(TOKEN_PERMISSIONS.WRITE);
  const canDeleteToken = hasPermission(TOKEN_PERMISSIONS.DELETE);

  const loadTokens = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/tokens');
      if (response.success && response.data) {
        setTokens(response.data as AppToken[]);
      }
    } catch (error) {
      logger.error('Failed to load tokens', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTokens();
  }, []);

  const handleCreateToken = async (tokenData: TokenFormData) => {
    try {
      const response = await apiClient.post('/tokens', tokenData);
      if (response.success && response.data) {
        setNewToken((response.data as any).token);
        await loadTokens();
        return { token: (response.data as any).token };
      }
      throw new Error('Failed to create token');
    } catch (error) {
      logger.error('Failed to create token', error);
      throw error;
    }
  };

  const handleDeleteToken = async (token: AppToken) => {
    if (!confirm(t('appTokens.deleteConfirm', { name: token.name }))) {
      return;
    }

    try {
      const response = await apiClient.delete(`/tokens/${token.id}`);
      if (response.success) {
        await loadTokens();
      }
    } catch (error) {
      logger.error('Failed to delete token', error);
    }
  };

  const toggleTokenVisibility = (tokenId: string) => {
    setVisibleTokens(prev => {
      const next = new Set(prev);
      if (next.has(tokenId)) {
        next.delete(tokenId);
      } else {
        next.add(tokenId);
      }
      return next;
    });
  };

  const getTokenPreview = (token: AppToken) => {
    if (visibleTokens.has(token.id)) {
      return '••••••••';
    }
    return '••••••••••••••••••••••••••••••••';
  };

  const filteredTokens = tokens.filter(token =>
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (token: AppToken) => {
    if (!token.isActive) {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
    }
    return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
  };

  const getStatusText = (token: AppToken) => {
    if (!token.isActive) return t('appTokens.status.inactive');
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) return t('appTokens.status.expired');
    return t('appTokens.status.active');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('appTokens.title')}</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('appTokens.subtitle')}
          </p>
        </div>
        {canCreateToken && (
          <Button onClick={() => setShowTokenModal(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            {t('appTokens.createToken')}
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder={t('appTokens.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : filteredTokens.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <KeyIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('appTokens.noTokensTitle')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('appTokens.noTokensDesc')}
          </p>
          {canCreateToken && (
            <Button onClick={() => setShowTokenModal(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              {t('appTokens.createToken')}
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('appTokens.tableHeaders.token')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('appTokens.tableHeaders.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('appTokens.tableHeaders.lastUsed')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('appTokens.tableHeaders.expires')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('appTokens.tableHeaders.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTokens.map(token => (
                  <tr key={token.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {token.name}
                        </div>
                        {token.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {token.description}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 font-mono mt-1 flex items-center">
                          <span>{getTokenPreview(token)}</span>
                          <button
                            onClick={() => toggleTokenVisibility(token.id)}
                            className="ml-2 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            {visibleTokens.has(token.id) ? (
                              <EyeSlashIcon className="h-3 w-3" />
                            ) : (
                              <EyeIcon className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(token)}`}>
                        {getStatusText(token)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleDateString() : t('appTokens.never')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {token.expiresAt ? (
                        <div className="flex items-center">
                          <ClockIcon className="h-4 w-4 mr-1" />
                          {new Date(token.expiresAt).toLocaleDateString()}
                        </div>
                      ) : (
                        t('appTokens.never')
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {canDeleteToken && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteToken(token)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <TokenModal
        isOpen={showTokenModal}
        onClose={() => setShowTokenModal(false)}
        onSave={handleCreateToken}
      />

      <TokenDisplayModal
        token={newToken}
        isOpen={!!newToken}
        onClose={() => setNewToken(null)}
      />
    </div>
  );
}