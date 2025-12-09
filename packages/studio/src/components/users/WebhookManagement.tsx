import { useState, useEffect } from 'react';
import {
  GlobeAltIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon,
  EyeIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import { usePermissions } from '@/hooks/usePermissions';
import { WEBHOOK_PERMISSIONS } from '@/constants/permissions';
import { useT } from '@trokky/i18n';

const logger = createStudioLogger('WebhookManagement');

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  headers?: Record<string, string>;
  retryPolicy?: {
    maxRetries: number;
    backoffType: 'linear' | 'exponential';
    baseDelay: number;
    maxDelay?: number;
    retryOnStatus?: number[];
  };
  createdAt: string;
  updatedAt: string;
}

interface WebhookDelivery {
  deliveryId: string;
  success: boolean;
  statusCode?: number;
  responseTime: number;
  timestamp: string;
  attempt: number;
  error?: string;
}

// Event type definitions with i18n keys
const EVENT_TYPE_DEFS = [
  { value: 'document.*', labelKey: 'webhooks.events.allDocuments', group: 'Documents' },
  { value: 'document.created', labelKey: 'webhooks.events.documentCreated', group: 'Documents' },
  { value: 'document.updated', labelKey: 'webhooks.events.documentUpdated', group: 'Documents' },
  { value: 'document.deleted', labelKey: 'webhooks.events.documentDeleted', group: 'Documents' },
  { value: 'document.published', labelKey: 'webhooks.events.documentPublished', group: 'Documents' },
  { value: 'document.unpublished', labelKey: 'webhooks.events.documentUnpublished', group: 'Documents' },
  { value: 'media.*', labelKey: 'webhooks.events.allMedia', group: 'Media' },
  { value: 'media.uploaded', labelKey: 'webhooks.events.mediaUploaded', group: 'Media' },
  { value: 'media.updated', labelKey: 'webhooks.events.mediaUpdated', group: 'Media' },
  { value: 'media.deleted', labelKey: 'webhooks.events.mediaDeleted', group: 'Media' },
  { value: 'user.*', labelKey: 'webhooks.events.allUsers', group: 'Users' },
  { value: 'user.created', labelKey: 'webhooks.events.userCreated', group: 'Users' },
  { value: 'user.updated', labelKey: 'webhooks.events.userUpdated', group: 'Users' },
  { value: 'user.login', labelKey: 'webhooks.events.userLogin', group: 'Users' },
  { value: 'system.*', labelKey: 'webhooks.events.allSystem', group: 'System' },
  { value: 'system.startup', labelKey: 'webhooks.events.systemStartup', group: 'System' },
  { value: 'system.error', labelKey: 'webhooks.events.systemError', group: 'System' }
];

interface WebhookFormData {
  name: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  headers: Record<string, string>;
  retryPolicy: {
    maxRetries: number;
    backoffType: 'linear' | 'exponential';
    baseDelay: number;
    maxDelay?: number;
  };
}

interface WebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (webhookData: WebhookFormData) => Promise<void>;
  webhook?: WebhookConfig;
}

function WebhookModal({ isOpen, onClose, onSave, webhook }: WebhookModalProps) {
  const { t } = useT('studio');
  const [formData, setFormData] = useState<WebhookFormData>({
    name: '',
    url: '',
    events: ['document.created', 'document.updated'],
    secret: '',
    active: true,
    headers: {},
    retryPolicy: {
      maxRetries: 3,
      backoffType: 'exponential',
      baseDelay: 1000,
      maxDelay: 30000
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [headerKey, setHeaderKey] = useState('');
  const [headerValue, setHeaderValue] = useState('');

  // Reset form when modal opens or webhook changes
  useEffect(() => {
    if (isOpen) {
      if (webhook) {
        // Edit mode
        setFormData({
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          secret: webhook.secret || '',
          active: webhook.active,
          headers: webhook.headers || {},
          retryPolicy: webhook.retryPolicy || {
            maxRetries: 3,
            backoffType: 'exponential',
            baseDelay: 1000,
            maxDelay: 30000
          }
        });
      } else {
        // Create mode
        setFormData({
          name: '',
          url: '',
          events: ['document.created', 'document.updated'],
          secret: '',
          active: true,
          headers: {},
          retryPolicy: {
            maxRetries: 3,
            backoffType: 'exponential',
            baseDelay: 1000,
            maxDelay: 30000
          }
        });
      }
      setHeaderKey('');
      setHeaderValue('');
    }
  }, [isOpen, webhook]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      logger.error('Failed to save webhook', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEvent = (eventType: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventType)
        ? prev.events.filter(e => e !== eventType)
        : [...prev.events, eventType]
    }));
  };

  const addHeader = () => {
    if (headerKey.trim() && headerValue.trim()) {
      setFormData(prev => ({
        ...prev,
        headers: { ...prev.headers, [headerKey.trim()]: headerValue.trim() }
      }));
      setHeaderKey('');
      setHeaderValue('');
    }
  };

  const removeHeader = (key: string) => {
    setFormData(prev => ({
      ...prev,
      headers: Object.fromEntries(Object.entries(prev.headers).filter(([k]) => k !== key))
    }));
  };

  const generateSecret = () => {
    const secret = `wh_${Math.random().toString(36).substr(2, 32)}`;
    setFormData(prev => ({ ...prev, secret }));
  };

  // Convert event definitions to use translated labels
  const EVENT_TYPES = EVENT_TYPE_DEFS.map(event => ({
    value: event.value,
    label: t(event.labelKey),
    group: event.group
  }));

  // Group events by category
  const groupedEvents = EVENT_TYPES.reduce((acc, event) => {
    if (!acc[event.group]) acc[event.group] = [];
    acc[event.group].push(event);
    return acc;
  }, {} as Record<string, typeof EVENT_TYPES>);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={webhook ? t('webhooks.modal.editTitle') : t('webhooks.modal.createTitle')}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('webhooks.modal.name')} *
          </label>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder={t('webhooks.modal.namePlaceholder')}
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('webhooks.modal.url')} *
          </label>
          <Input
            type="url"
            value={formData.url}
            onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
            placeholder={t('webhooks.modal.urlPlaceholder')}
            required
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('webhooks.modal.events')}
          </label>
          <div className="border border-gray-300 dark:border-gray-600 rounded-md p-3 space-y-3 max-h-48 overflow-y-auto">
            {Object.entries(groupedEvents).map(([group, events]) => (
              <div key={group}>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {group}
                </h4>
                <div className="space-y-1 ml-2">
                  {events.map(event => (
                    <label key={event.value} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event.value)}
                        onChange={() => toggleEvent(event.value)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                        {event.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('webhooks.modal.secret')}
          </label>
          <div className="flex">
            <Input
              type="text"
              value={formData.secret}
              onChange={(e) => setFormData(prev => ({ ...prev, secret: e.target.value }))}
              placeholder={t('webhooks.modal.secretPlaceholder')}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={generateSecret}
              variant="secondary"
              className="ml-2 whitespace-nowrap"
              disabled={isLoading}
            >
              {t('common.generate')}
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('webhooks.modal.secretDescription')}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('webhooks.modal.headers')}
          </label>
          {Object.entries(formData.headers).length > 0 && (
            <div className="mb-3 space-y-1">
              {Object.entries(formData.headers).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                  <span className="text-sm font-mono">{key}: {value}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeHeader(key)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <XCircleIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              placeholder={t('webhooks.modal.headerNamePlaceholder')}
              value={headerKey}
              onChange={(e) => setHeaderKey(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Input
              placeholder={t('webhooks.modal.headerValuePlaceholder')}
              value={headerValue}
              onChange={(e) => setHeaderValue(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={addHeader}
              variant="secondary"
              disabled={isLoading || !headerKey.trim() || !headerValue.trim()}
            >
              {t('common.add')}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('webhooks.modal.maxRetries')}
            </label>
            <Input
              type="number"
              min={0}
              max={10}
              value={formData.retryPolicy.maxRetries}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                retryPolicy: { ...prev.retryPolicy, maxRetries: parseInt(e.target.value) || 0 }
              }))}
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('webhooks.modal.backoffStrategy')}
            </label>
            <select
              value={formData.retryPolicy.backoffType}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                retryPolicy: { ...prev.retryPolicy, backoffType: e.target.value as 'linear' | 'exponential' }
              }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isLoading}
            >
              <option value="linear">{t('webhooks.modal.linear')}</option>
              <option value="exponential">{t('webhooks.modal.exponential')}</option>
            </select>
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="webhook-active"
            checked={formData.active}
            onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            disabled={isLoading}
          />
          <label htmlFor="webhook-active" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
            {t('webhooks.modal.active')}
          </label>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={isLoading || !formData.name || !formData.url || formData.events.length === 0}
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                {webhook ? t('webhooks.modal.updating') : t('webhooks.modal.creating')}
              </>
            ) : (
              webhook ? t('webhooks.modal.update') : t('webhooks.modal.create')
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface DeliveryModalProps {
  webhook: WebhookConfig | null;
  isOpen: boolean;
  onClose: () => void;
}

function DeliveryModal({ webhook, isOpen, onClose }: DeliveryModalProps) {
  const { t } = useT('studio');
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && webhook) {
      loadDeliveries();
    }
  }, [isOpen, webhook]);

  const loadDeliveries = async () => {
    if (!webhook) return;
    
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/webhooks/${webhook.id}/deliveries`);
      if (response.success && response.data) {
        setDeliveries((response.data as any).deliveries || []);
      }
    } catch (error) {
      logger.error('Failed to load deliveries', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen && !!webhook}
      onClose={onClose}
      title={t('webhooks.deliveryModal.title', { name: webhook?.name })}
      size="xl"
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-8">
            <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">{t('webhooks.deliveryModal.noDeliveries')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('webhooks.deliveryModal.status')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('webhooks.deliveryModal.response')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('webhooks.deliveryModal.timestamp')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('webhooks.deliveryModal.attempt')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {deliveries.map(delivery => (
                  <tr key={delivery.deliveryId}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
                        delivery.success
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {delivery.success ? (
                          <CheckCircleIcon className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircleIcon className="h-3 w-3 mr-1" />
                        )}
                        {delivery.success ? t('webhooks.deliveryModal.success') : t('webhooks.deliveryModal.failed')}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <div>
                        {delivery.statusCode && (
                          <span className="font-mono text-gray-900 dark:text-white">
                            {delivery.statusCode}
                          </span>
                        )}
                        <div className="text-xs text-gray-500">
                          {delivery.responseTime}ms
                        </div>
                        {delivery.error && (
                          <div className="text-xs text-red-500 max-w-xs truncate" title={delivery.error}>
                            {delivery.error}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(delivery.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      #{delivery.attempt}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function WebhookManagement() {
  const { t } = useT('studio');
  const { hasPermission } = usePermissions();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | undefined>();
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookConfig | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  // Permission checks
  const canCreateWebhook = hasPermission(WEBHOOK_PERMISSIONS.WRITE);
  const canEditWebhook = hasPermission(WEBHOOK_PERMISSIONS.WRITE);
  const canDeleteWebhook = hasPermission(WEBHOOK_PERMISSIONS.DELETE);

  const loadWebhooks = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/webhooks');
      if (response.success && response.data) {
        setWebhooks((response.data as any).webhooks || []);
      }
    } catch (error) {
      logger.error('Failed to load webhooks', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWebhooks();
  }, []);

  const handleCreateWebhook = async (webhookData: WebhookFormData) => {
    try {
      const response = await apiClient.post('/webhooks', { webhookData });
      if (response.success) {
        await loadWebhooks();
      }
    } catch (error) {
      logger.error('Failed to create webhook', error);
      throw error;
    }
  };

  const handleUpdateWebhook = async (webhookData: WebhookFormData) => {
    if (!editingWebhook) return;
    
    try {
      const response = await apiClient.put(`/webhooks/${editingWebhook.id}`, { webhookData });
      if (response.success) {
        await loadWebhooks();
        setEditingWebhook(undefined);
      }
    } catch (error) {
      logger.error('Failed to update webhook', error);
      throw error;
    }
  };

  const handleDeleteWebhook = async (webhook: WebhookConfig) => {
    if (!confirm(t('webhooks.deleteConfirm', { name: webhook.name }))) {
      return;
    }

    try {
      const response = await apiClient.delete(`/webhooks/${webhook.id}`);
      if (response.success) {
        await loadWebhooks();
      }
    } catch (error) {
      logger.error('Failed to delete webhook', error);
    }
  };

  const handleTestWebhook = async (webhook: WebhookConfig) => {
    try {
      setTestingWebhook(webhook.id);
      const response = await apiClient.post(`/webhooks/${webhook.id}/test`, {
        eventType: 'system.test'
      });
      if (response.success) {
        logger.info('Test webhook sent successfully');
        // Optionally show a success message
      }
    } catch (error) {
      logger.error('Failed to test webhook', error);
    } finally {
      setTestingWebhook(null);
    }
  };

  const openEditModal = (webhook: WebhookConfig) => {
    setEditingWebhook(webhook);
    setShowWebhookModal(true);
  };

  const openDeliveryModal = (webhook: WebhookConfig) => {
    setSelectedWebhook(webhook);
    setShowDeliveryModal(true);
  };

  const closeModals = () => {
    setShowWebhookModal(false);
    setEditingWebhook(undefined);
    setShowDeliveryModal(false);
    setSelectedWebhook(null);
  };

  const filteredWebhooks = webhooks.filter(webhook =>
    webhook.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    webhook.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (webhook: WebhookConfig) => {
    if (!webhook.active) {
      return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
    return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
  };

  const getStatusText = (webhook: WebhookConfig) => {
    return webhook.active ? t('webhooks.status.active') : t('webhooks.status.inactive');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('webhooks.title')}</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('webhooks.subtitle')}
          </p>
        </div>
        {canCreateWebhook && (
          <Button onClick={() => setShowWebhookModal(true)}>
            <PlusIcon className="h-4 w-4 mr-2" />
            {t('webhooks.createWebhook')}
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder={t('webhooks.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : filteredWebhooks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <GlobeAltIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {t('webhooks.noWebhooksTitle')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('webhooks.noWebhooksDesc')}
          </p>
          {canCreateWebhook && (
            <Button onClick={() => setShowWebhookModal(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              {t('webhooks.createWebhook')}
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
                    {t('webhooks.tableHeaders.webhook')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('webhooks.tableHeaders.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('webhooks.tableHeaders.events')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('webhooks.tableHeaders.lastUpdated')}
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {t('webhooks.tableHeaders.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredWebhooks.map(webhook => (
                  <tr key={webhook.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {webhook.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {webhook.url}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(webhook)}`}>
                        {getStatusText(webhook)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {webhook.events.length} event{webhook.events.length !== 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-gray-400 max-w-xs">
                        {webhook.events.slice(0, 3).join(', ')}
                        {webhook.events.length > 3 && ` +${webhook.events.length - 3} more`}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(webhook.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTestWebhook(webhook)}
                        disabled={testingWebhook === webhook.id || !webhook.active}
                        title={t('webhooks.testWebhook')}
                      >
                        {testingWebhook === webhook.id ? (
                          <ArrowPathIcon className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlayIcon className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openDeliveryModal(webhook)}
                        title={t('webhooks.viewDeliveryHistory')}
                      >
                        <EyeIcon className="h-4 w-4" />
                      </Button>
                      {canEditWebhook && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditModal(webhook)}
                          title={t('webhooks.editWebhook')}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                      )}
                      {canDeleteWebhook && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteWebhook(webhook)}
                          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          title={t('webhooks.deleteWebhook')}
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

      <WebhookModal
        isOpen={showWebhookModal}
        onClose={closeModals}
        onSave={editingWebhook ? handleUpdateWebhook : handleCreateWebhook}
        webhook={editingWebhook}
      />

      <DeliveryModal
        webhook={selectedWebhook}
        isOpen={showDeliveryModal}
        onClose={closeModals}
      />
    </div>
  );
}