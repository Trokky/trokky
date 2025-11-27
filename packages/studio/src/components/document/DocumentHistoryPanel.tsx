/**
 * DocumentHistoryPanel - Shows audit history for a document
 * 
 * Displays chronological list of all changes made to a document
 * with details about who made what changes when
 */

import { useState, useEffect } from 'react';
import { 
  ClockIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import { AuditLogEntry } from './AuditLogEntry';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const logger = createStudioLogger('DocumentHistoryPanel');

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

interface DocumentHistoryPanelProps {
  documentId: string;
  collection: string;
  isVisible?: boolean;
}

export function DocumentHistoryPanel({ 
  documentId, 
  collection, 
  isVisible = true 
}: DocumentHistoryPanelProps) {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // Load audit logs when component mounts or documentId changes
  useEffect(() => {
    if (documentId && isVisible) {
      loadAuditLogs();
    }
  }, [documentId, isVisible]);

  // Resolve user ID to username
  const resolveUsername = async (userId: string, cache: Record<string, string>): Promise<string> => {
    if (cache[userId]) return cache[userId];
    if (userId === 'system') return 'System';

    try {
      const response = await apiClient.get(`/users/${userId}`);
      if (response.success && (response.data as any)?.user) {
        const user = (response.data as any).user;
        return user.username || user.name || user.email || 'User';
      }
    } catch {
      // Silently fail - will use fallback
    }

    return userId.startsWith('user-') ? 'User' : userId;
  };

  const loadAuditLogs = async () => {
    if (!documentId) return;

    setLoading(true);
    setError(null);

    try {
      logger.debug('Loading audit logs for document', { documentId, collection });

      const response = await apiClient.get(`/audit-logs/documents/${documentId}`, {
        params: {
          limit: 50,
          offset: 0
        }
      });

      if (response.success && (response.data as any)?.auditLogs) {
        const logs = (response.data as any).auditLogs;

        // Resolve usernames for all unique actor IDs
        const usernameCache: Record<string, string> = {};
        const uniqueActorIds = [...new Set(logs.map((l: any) => l.actorId).filter(Boolean))];

        for (const actorId of uniqueActorIds) {
          usernameCache[actorId as string] = await resolveUsername(actorId as string, usernameCache);
        }

        // Enrich logs with resolved usernames
        const enrichedLogs = logs.map((log: any) => ({
          ...log,
          actorUsername: usernameCache[log.actorId] || log.actorUsername
        }));

        setAuditLogs(enrichedLogs);
        logger.info('Audit logs loaded successfully', {
          documentId,
          count: enrichedLogs.length
        });
      } else {
        logger.warn('Failed to load audit logs', response);
        setError('Failed to load document history');
      }
    } catch (err: any) {
      logger.error('Error loading audit logs', err);

      if (err.response?.status === 501) {
        setError('Document history is not available');
      } else {
        setError('Failed to load document history');
      }
    } finally {
      setLoading(false);
    }
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

  const handleRefresh = () => {
    loadAuditLogs();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div>
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <ClockIcon className="h-4 w-4 mr-1.5 text-gray-500 dark:text-gray-400" />
          <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Document History
          </h3>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
          title="Refresh history"
        >
          <ArrowPathIcon className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div>
        {loading && (
          <div className="flex items-center py-4">
            <LoadingSpinner />
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              Loading...
            </span>
          </div>
        )}

        {error && (
          <div className="py-4">
            <div className="text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          </div>
        )}

        {!loading && !error && auditLogs.length === 0 && (
          <div className="text-center py-4">
            <ClockIcon className="h-6 w-6 mx-auto text-gray-300 dark:text-gray-600 mb-1" />
            <div className="text-xs text-gray-500 dark:text-gray-400">
              No history yet
            </div>
          </div>
        )}

        {!loading && !error && auditLogs.length > 0 && (
          <div className="space-y-1.5">
            {auditLogs.slice(0, 10).map((auditLog, index) => (
              <AuditLogEntry
                key={auditLog.id}
                auditLog={auditLog}
                isExpanded={expandedEntries.has(auditLog.id)}
                onToggleExpansion={() => toggleEntryExpansion(auditLog.id)}
                isLatest={index === 0}
              />
            ))}

            {auditLogs.length > 10 && (
              <div className="text-center pt-1">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  +{auditLogs.length - 10} more changes
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}