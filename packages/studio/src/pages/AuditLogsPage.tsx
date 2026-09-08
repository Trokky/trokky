/**
 * AuditLogsPage - Full audit logs viewer with filtering and search
 *
 * Provides administrators with a complete view of all CMS activity
 */

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ClockIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon as ChevronRightSmallIcon
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { useT } from '@trokky/trokky/i18n';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ChangesDiff } from '@/components/document/ChangesDiff';
import { useContextSidebar } from '@/contexts/ContextSidebarContext';

const logger = createStudioLogger('AuditLogsPage');

interface AuditLog {
  id: string;
  documentId: string;
  collection: string;
  operation: 'create' | 'update' | 'delete' | 'publish' | 'unpublish' | 'restore';
  actorId: string;
  actorType: 'user' | 'api' | 'system' | 'webhook';
  actorUsername?: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    fields?: string[];
  };
  timestamp: string;
  revision: number;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

interface User {
  id: string;
  username: string;
  email?: string;
}

const ITEMS_PER_PAGE = 25;

export function AuditLogsPage() {
  const { t } = useT('studio');
  // Context sidebar configuration
  useContextSidebar({
    page: 'audit-logs',
    title: t('auditLogs.title'),
    defaultVisible: false,
    defaultPosition: 'left'
  });

  // State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [collections, setCollections] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedOperation, setSelectedOperation] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Username cache for resolving user IDs
  const [usernameCache, setUsernameCache] = useState<Record<string, string>>({});

  // Load collections from structure
  useEffect(() => {
    loadCollections();
    loadUsers();
  }, []);

  // Load audit logs when filters change or collections are loaded
  useEffect(() => {
    // Only load if we have collections (wait for structure to load) or a specific collection is selected
    if (collections.length > 0 || selectedCollection) {
      loadAuditLogs();
    }
  }, [currentPage, selectedCollection, selectedUser, selectedOperation, collections.length]);

  const loadCollections = async () => {
    try {
      const response = await apiClient.get('/config/structure');
      if (response.success && (response.data as any)?.structure) {
        const structure = (response.data as any).structure;
        const items = structure.items || structure;

        const extractSchemaTypes = (items: any[]): string[] => {
          const schemas: string[] = [];
          for (const item of items) {
            if (item.schemaType) {
              schemas.push(item.schemaType);
            }
            if (item.items && Array.isArray(item.items)) {
              schemas.push(...extractSchemaTypes(item.items));
            }
          }
          return schemas;
        };

        if (Array.isArray(items)) {
          setCollections([...new Set(extractSchemaTypes(items))].sort());
        }
      }
    } catch (err) {
      logger.warn('Failed to load collections', err);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await apiClient.get('/users');
      if (response.success && (response.data as any)?.users) {
        setUsers((response.data as any).users);
      }
    } catch (err) {
      logger.warn('Failed to load users', err);
    }
  };

  const resolveUsername = async (userId: string): Promise<string> => {
    if (usernameCache[userId]) return usernameCache[userId];
    if (userId === 'system') return 'System';

    try {
      const response = await apiClient.get(`/users/${userId}`);
      if (response.success && (response.data as any)?.user) {
        const user = (response.data as any).user;
        const username = user.username || user.name || user.email || 'User';
        setUsernameCache(prev => ({ ...prev, [userId]: username }));
        return username;
      }
    } catch {
      // Silently fail
    }

    return userId.startsWith('user-') ? 'User' : userId;
  };

  const loadAuditLogs = async () => {
    setLoading(true);
    setError(null);

    try {
      const offset = (currentPage - 1) * ITEMS_PER_PAGE;
      let allLogs: AuditLog[] = [];

      // If a specific collection is selected, query just that collection
      if (selectedCollection) {
        const response = await apiClient.get(`/audit-logs/collections/${selectedCollection}`, {
          limit: 200,
          offset: 0
        });
        if (response.success && (response.data as any)?.auditLogs) {
          allLogs = (response.data as any).auditLogs;
        }
      } else {
        // Query all collections
        for (const collection of collections) {
          try {
            const response = await apiClient.get(`/audit-logs/collections/${collection}`, {
              limit: 100,
              offset: 0
            });
            if (response.success && (response.data as any)?.auditLogs) {
              allLogs.push(...(response.data as any).auditLogs);
            }
          } catch {
            // Silently continue
          }
        }
      }

      // Apply filters
      let filteredLogs = allLogs;

      // Filter by user
      if (selectedUser) {
        filteredLogs = filteredLogs.filter(log => log.actorId === selectedUser);
      }

      // Filter by operation
      if (selectedOperation) {
        filteredLogs = filteredLogs.filter(log => log.operation === selectedOperation);
      }

      // Filter by search query (search in document title from changes)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredLogs = filteredLogs.filter(log => {
          const afterData = log.changes?.after as any;
          const beforeData = log.changes?.before as any;
          const title = afterData?.title || afterData?.name || beforeData?.title || beforeData?.name || '';
          return title.toLowerCase().includes(query) ||
                 log.documentId.toLowerCase().includes(query) ||
                 log.collection.toLowerCase().includes(query);
        });
      }

      // Sort by timestamp (newest first)
      filteredLogs.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setTotalCount(filteredLogs.length);

      // Paginate
      const paginatedLogs = filteredLogs.slice(offset, offset + ITEMS_PER_PAGE);

      // Resolve usernames
      const uniqueActorIds = [...new Set(paginatedLogs.map(l => l.actorId).filter(Boolean))];
      for (const actorId of uniqueActorIds) {
        await resolveUsername(actorId);
      }

      // Enrich with usernames
      const enrichedLogs = paginatedLogs.map(log => ({
        ...log,
        actorUsername: usernameCache[log.actorId] || log.actorUsername
      }));

      setAuditLogs(enrichedLogs);
      logger.info('Audit logs loaded', { count: enrichedLogs.length, total: filteredLogs.length });

    } catch (err: any) {
      logger.error('Failed to load audit logs', err);
      setError('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(() => {
    setCurrentPage(1);
    loadAuditLogs();
  }, [searchQuery]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setSelectedCollection('');
    setSelectedUser('');
    setSelectedOperation('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const toggleEntryExpansion = (entryId: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const getOperationInfo = (operation: string) => {
    switch (operation) {
      case 'create':
        return { icon: PlusIcon, text: t('auditLogs.operations.create'), color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' };
      case 'update':
        return { icon: PencilIcon, text: t('auditLogs.operations.update'), color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' };
      case 'delete':
        return { icon: TrashIcon, text: t('auditLogs.operations.delete'), color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' };
      case 'publish':
        return { icon: EyeIcon, text: t('auditLogs.operations.publish'), color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' };
      case 'unpublish':
        return { icon: EyeIcon, text: t('auditLogs.operations.unpublish'), color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-100 dark:bg-orange-900/30' };
      case 'restore':
        return { icon: ClockIcon, text: t('auditLogs.operations.restore'), color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30' };
      default:
        return { icon: PencilIcon, text: operation, color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-100 dark:bg-gray-700' };
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return {
        relative: formatDistanceToNow(date, { addSuffix: true }),
        full: date.toLocaleString()
      };
    } catch {
      return { relative: 'Unknown', full: timestamp };
    }
  };

  const getDocumentTitle = (log: AuditLog) => {
    const afterData = log.changes?.after as any;
    const beforeData = log.changes?.before as any;
    return afterData?.title || afterData?.name || beforeData?.title || beforeData?.name || log.documentId;
  };

  const getChangedFieldsSummary = (log: AuditLog) => {
    if (!log.changes?.fields || log.changes.fields.length === 0) return null;
    const fields = log.changes.fields;
    if (fields.length === 1) return t('auditLogs.changedField', { field: fields[0] });
    return t('auditLogs.changedFields', { count: fields.length });
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const hasActiveFilters = selectedCollection || selectedUser || selectedOperation || searchQuery;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
              <ClockIcon className="h-7 w-7 mr-3 text-gray-500" />
              {t('auditLogs.title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('auditLogs.subtitle')}
            </p>
          </div>
          <button
            onClick={() => loadAuditLogs()}
            disabled={loading}
            className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('auditLogs.refresh')}
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
        <div className="p-4">
          {/* Search bar */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('auditLogs.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              {t('auditLogs.search')}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center px-4 py-2 border rounded-lg font-medium ${
                showFilters || hasActiveFilters
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <FunnelIcon className="h-4 w-4 mr-2" />
              {t('auditLogs.filters')}
              {hasActiveFilters && (
                <span className="ml-2 px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded-full">
                  {[selectedCollection, selectedUser, selectedOperation].filter(Boolean).length}
                </span>
              )}
            </button>
          </div>

          {/* Filter options */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Collection filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('auditLogs.collection')}
                  </label>
                  <select
                    value={selectedCollection}
                    onChange={(e) => { setSelectedCollection(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">{t('auditLogs.allCollections')}</option>
                    {collections.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                {/* User filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('auditLogs.user')}
                  </label>
                  <select
                    value={selectedUser}
                    onChange={(e) => { setSelectedUser(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">{t('auditLogs.allUsers')}</option>
                    {users.map(user => (
                      <option key={user.id} value={user.id}>{user.username}</option>
                    ))}
                  </select>
                </div>

                {/* Operation filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('auditLogs.operation')}
                  </label>
                  <select
                    value={selectedOperation}
                    onChange={(e) => { setSelectedOperation(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">{t('auditLogs.allOperations')}</option>
                    <option value="create">{t('auditLogs.operations.create')}</option>
                    <option value="update">{t('auditLogs.operations.update')}</option>
                    <option value="delete">{t('auditLogs.operations.delete')}</option>
                    <option value="publish">{t('auditLogs.operations.publish')}</option>
                    <option value="unpublish">{t('auditLogs.operations.unpublish')}</option>
                  </select>
                </div>
              </div>

              {hasActiveFilters && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    {t('auditLogs.clearFilters')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results summary */}
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {totalCount > 0 ? (
          <>{t('auditLogs.showingResults', { start: ((currentPage - 1) * ITEMS_PER_PAGE) + 1, end: Math.min(currentPage * ITEMS_PER_PAGE, totalCount), total: totalCount })}</>
        ) : (
          loading ? t('auditLogs.loading') : t('auditLogs.noResults')
        )}
      </div>

      {/* Audit logs list */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading && auditLogs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
            <span className="ml-3 text-gray-500 dark:text-gray-400">{t('auditLogs.loading')}</span>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => loadAuditLogs()}
              className="mt-4 text-primary-600 dark:text-primary-400 hover:underline"
            >
              {t('auditLogs.tryAgain')}
            </button>
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="p-12 text-center">
            <ClockIcon className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400">{t('auditLogs.noLogs')}</p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="mt-4 text-primary-600 dark:text-primary-400 hover:underline"
              >
                {t('auditLogs.clearFilters')}
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {auditLogs.map((log) => {
              const opInfo = getOperationInfo(log.operation);
              const OpIcon = opInfo.icon;
              const timestamp = formatTimestamp(log.timestamp);
              const isExpanded = expandedEntries.has(log.id);
              const changedFields = getChangedFieldsSummary(log);

              return (
                <div key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                  {/* Main row */}
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Operation icon */}
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${opInfo.bgColor}`}>
                        <OpIcon className={`h-5 w-5 ${opInfo.color}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium ${opInfo.color}`}>
                            {opInfo.text}
                          </span>
                          <Link
                            to={`/content/${log.collection}/${log.documentId}`}
                            className="font-medium text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 truncate"
                          >
                            {getDocumentTitle(log)}
                          </Link>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                            {log.collection}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center">
                            <UserIcon className="h-4 w-4 mr-1" />
                            {usernameCache[log.actorId] || log.actorUsername || log.actorId}
                          </span>
                          <span title={timestamp.full}>
                            {timestamp.relative}
                          </span>
                          {changedFields && (
                            <span className="text-gray-400 dark:text-gray-500">
                              {changedFields}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expand button */}
                      {log.changes && (log.changes.before || log.changes.after) && (
                        <button
                          onClick={() => toggleEntryExpansion(log.id)}
                          className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title={isExpanded ? t('auditLogs.hideDetails') : t('auditLogs.showDetails')}
                        >
                          {isExpanded ? (
                            <ChevronDownIcon className="h-5 w-5" />
                          ) : (
                            <ChevronRightSmallIcon className="h-5 w-5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && log.changes && (
                    <div className="px-4 pb-4 ml-14">
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                        <ChangesDiff
                          before={log.changes.before}
                          after={log.changes.after}
                          operation={log.operation}
                        />

                        {/* Technical details */}
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <div>
                              <span className="font-medium">{t('auditLogs.technical.revision')}</span> {log.revision}
                            </div>
                            <div>
                              <span className="font-medium">{t('auditLogs.technical.documentId')}</span> {log.documentId}
                            </div>
                            {log.ipAddress && (
                              <div>
                                <span className="font-medium">{t('auditLogs.technical.ip')}</span> {log.ipAddress}
                              </div>
                            )}
                            {log.actorType && (
                              <div>
                                <span className="font-medium">{t('auditLogs.technical.actorType')}</span> {log.actorType}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t('auditLogs.page', { current: currentPage, total: totalPages })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              {t('auditLogs.previous')}
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('auditLogs.next')}
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
