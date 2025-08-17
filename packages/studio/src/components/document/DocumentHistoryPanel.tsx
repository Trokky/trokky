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

  const loadAuditLogs = async () => {
    if (!documentId) return;

    setLoading(true);
    setError(null);

    try {
      logger.debug('Loading audit logs for document', { documentId, collection });

      const response = await apiClient.get(`/audit-logs/documents/${documentId}`, {
        params: {
          limit: 50, // Load last 50 changes
          offset: 0
        }
      });

      if (response.success && (response.data as any)?.auditLogs) {
        setAuditLogs((response.data as any).auditLogs);
        logger.info('Audit logs loaded successfully', { 
          documentId, 
          count: (response.data as any).auditLogs.length 
        });
      } else {
        logger.warn('Failed to load audit logs', response);
        setError('Failed to load document history');
      }
    } catch (err: any) {
      logger.error('Error loading audit logs', err);
      
      // Check if audit logs are not supported
      if (err.response?.status === 501) {
        setError('Document history is not available (audit logs not supported by storage adapter)');
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
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <ClockIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Document History
            </h3>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
            title="Refresh history"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              Loading history...
            </span>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <div className="text-sm text-red-600 dark:text-red-400 mb-2">
              {error}
            </div>
            {error.includes('not supported') && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Audit logging may not be enabled for this storage adapter.
              </div>
            )}
          </div>
        )}

        {!loading && !error && auditLogs.length === 0 && (
          <div className="text-center py-8">
            <ClockIcon className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <div className="text-sm text-gray-500 dark:text-gray-400">
              No history available
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Changes will appear here once you save the document
            </div>
          </div>
        )}

        {!loading && !error && auditLogs.length > 0 && (
          <div className="space-y-3">
            {auditLogs.map((auditLog, index) => (
              <AuditLogEntry
                key={auditLog.id}
                auditLog={auditLog}
                isExpanded={expandedEntries.has(auditLog.id)}
                onToggleExpansion={() => toggleEntryExpansion(auditLog.id)}
                isLatest={index === 0}
              />
            ))}

            {auditLogs.length >= 50 && (
              <div className="text-center py-2">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Showing last 50 changes
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}