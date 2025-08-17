/**
 * AuditLogEntry - Individual audit log entry in document history
 * 
 * Shows details of a single document change including who, what, when
 */

import { 
  UserIcon,
  ClockIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  ComputerDesktopIcon,
  CogIcon,
  GlobeAltIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { ChangesDiff } from './ChangesDiff';
import { createStudioLogger } from '@/utils/logger';

const logger = createStudioLogger('AuditLogEntry');

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

interface AuditLogEntryProps {
  auditLog: AuditLog;
  isExpanded: boolean;
  onToggleExpansion: () => void;
  isLatest?: boolean;
}

export function AuditLogEntry({ 
  auditLog, 
  isExpanded, 
  onToggleExpansion,
  isLatest = false 
}: AuditLogEntryProps) {
  
  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const timeAgo = formatDistanceToNow(date, { addSuffix: true });
      const fullDate = date.toLocaleString();
      
      return {
        timeAgo,
        fullDate
      };
    } catch (error) {
      logger.warn('Failed to format timestamp', error);
      return {
        timeAgo: 'Unknown time',
        fullDate: timestamp
      };
    }
  };

  const { timeAgo, fullDate } = formatTimestamp(auditLog.timestamp);

  // Get operation icon and text
  const getOperationInfo = (operation: string) => {
    switch (operation) {
      case 'create':
        return {
          icon: PlusIcon,
          text: 'Created',
          color: 'text-green-600 dark:text-green-400'
        };
      case 'update':
        return {
          icon: PencilIcon,
          text: 'Updated',
          color: 'text-blue-600 dark:text-blue-400'
        };
      case 'delete':
        return {
          icon: TrashIcon,
          text: 'Deleted',
          color: 'text-red-600 dark:text-red-400'
        };
      case 'publish':
        return {
          icon: EyeIcon,
          text: 'Published',
          color: 'text-purple-600 dark:text-purple-400'
        };
      case 'unpublish':
        return {
          icon: EyeIcon,
          text: 'Unpublished',
          color: 'text-orange-600 dark:text-orange-400'
        };
      case 'restore':
        return {
          icon: ClockIcon,
          text: 'Restored',
          color: 'text-indigo-600 dark:text-indigo-400'
        };
      default:
        return {
          icon: PencilIcon,
          text: operation,
          color: 'text-gray-600 dark:text-gray-400'
        };
    }
  };

  // Get actor icon based on type
  const getActorIcon = (actorType: string) => {
    switch (actorType) {
      case 'user':
        return UserIcon;
      case 'api':
        return ComputerDesktopIcon;
      case 'system':
        return CogIcon;
      case 'webhook':
        return GlobeAltIcon;
      default:
        return UserIcon;
    }
  };

  const operationInfo = getOperationInfo(auditLog.operation);
  const OperationIcon = operationInfo.icon;
  const ActorIcon = getActorIcon(auditLog.actorType);

  // Get changed fields summary
  const getChangedFieldsSummary = () => {
    if (!auditLog.changes?.fields || auditLog.changes.fields.length === 0) {
      return null;
    }

    const fields = auditLog.changes.fields;
    if (fields.length === 1) {
      return `Changed ${fields[0]}`;
    } else if (fields.length <= 3) {
      return `Changed ${fields.join(', ')}`;
    } else {
      return `Changed ${fields.length} fields`;
    }
  };

  const changedFieldsSummary = getChangedFieldsSummary();

  return (
    <div className={`border border-gray-200 dark:border-gray-600 rounded-lg ${
      isLatest ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' : 
      'bg-white dark:bg-gray-800'
    }`}>
      {/* Main entry header */}
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            {/* Operation icon */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              auditLog.operation === 'create' ? 'bg-green-100 dark:bg-green-900' :
              auditLog.operation === 'update' ? 'bg-blue-100 dark:bg-blue-900' :
              auditLog.operation === 'delete' ? 'bg-red-100 dark:bg-red-900' :
              'bg-gray-100 dark:bg-gray-700'
            }`}>
              <OperationIcon className={`h-4 w-4 ${operationInfo.color}`} />
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${operationInfo.color}`}>
                  {operationInfo.text}
                </span>
                {isLatest && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                    Latest
                  </span>
                )}
              </div>

              {/* Actor info */}
              <div className="flex items-center mt-1">
                <ActorIcon className="h-3 w-3 mr-1 text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {auditLog.actorUsername || auditLog.actorId}
                  {auditLog.actorType !== 'user' && (
                    <span className="text-gray-500"> ({auditLog.actorType})</span>
                  )}
                </span>
              </div>

              {/* Changes summary */}
              {changedFieldsSummary && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {changedFieldsSummary}
                </div>
              )}

              {/* Timestamp */}
              <div className="flex items-center mt-1">
                <ClockIcon className="h-3 w-3 mr-1 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400" title={fullDate}>
                  {timeAgo}
                </span>
              </div>
            </div>
          </div>

          {/* Expand/collapse button */}
          {auditLog.changes && (auditLog.changes.before || auditLog.changes.after) && (
            <button
              onClick={onToggleExpansion}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={isExpanded ? 'Hide details' : 'Show details'}
            >
              {isExpanded ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {isExpanded && auditLog.changes && (
        <div className="border-t border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-750">
          <ChangesDiff
            before={auditLog.changes.before}
            after={auditLog.changes.after}
            operation={auditLog.operation}
          />

          {/* Technical details */}
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
            <div className="grid grid-cols-1 gap-2 text-xs text-gray-500 dark:text-gray-400">
              <div>
                <span className="font-medium">Revision:</span> {auditLog.revision}
              </div>
              {auditLog.ipAddress && (
                <div>
                  <span className="font-medium">IP Address:</span> {auditLog.ipAddress}
                </div>
              )}
              {auditLog.userAgent && (
                <div>
                  <span className="font-medium">User Agent:</span>{' '}
                  <span className="truncate" title={auditLog.userAgent}>
                    {auditLog.userAgent.length > 50 
                      ? `${auditLog.userAgent.substring(0, 50)}...` 
                      : auditLog.userAgent
                    }
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}