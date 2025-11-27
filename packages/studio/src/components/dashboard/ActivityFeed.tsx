/**
 * ActivityFeed - Shows recent content activity across the CMS
 * 
 * Displays recent document changes, user activity, and system events
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ClockIcon,
  UserIcon,
  DocumentTextIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  EyeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const logger = createStudioLogger('ActivityFeed');

// Group activities by document to show recent change history per document
function groupActivitiesByDocument(activities: AuditLog[]): DocumentGroup[] {
  if (activities.length === 0) return [];
  
  // Filter to only include recent activities (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentActivities = activities.filter(activity => 
    new Date(activity.timestamp) > thirtyDaysAgo
  );
  
  // Create a map of documentId+collection -> activities
  const documentMap = new Map<string, AuditLog[]>();
  
  recentActivities.forEach(activity => {
    const key = `${activity.collection}:${activity.documentId}`;
    if (!documentMap.has(key)) {
      documentMap.set(key, []);
    }
    documentMap.get(key)!.push(activity);
  });
  
  // Convert to sorted groups (by most recent activity)
  const groups: DocumentGroup[] = [];
  
  documentMap.forEach((docActivities, key) => {
    // Sort activities within document by timestamp (newest first)
    const sortedDocActivities = docActivities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    const mostRecent = sortedDocActivities[0];
    
    groups.push({
      documentId: mostRecent.documentId,
      collection: mostRecent.collection,
      documentTitle: getDocumentTitleFromActivity(mostRecent),
      activities: sortedDocActivities,
      lastActivity: mostRecent.timestamp
    });
  });
  
  // Sort groups by most recent activity
  return groups.sort((a, b) => 
    new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );
}

// Helper to extract document title from activity
function getDocumentTitleFromActivity(activity: AuditLog): string {
  const afterData = activity.changes?.after as any;
  const beforeData = activity.changes?.before as any;
  
  return afterData?.title || afterData?.name || 
         beforeData?.title || beforeData?.name || 
         activity.documentId;
}

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

interface DocumentGroup {
  documentId: string;
  collection: string;
  documentTitle: string;
  activities: AuditLog[];
  lastActivity: string;
}

interface ActivityFeedProps {
  limit?: number;
  showHeader?: boolean;
}

export function ActivityFeed({ limit = 20, showHeader = true }: ActivityFeedProps) {
  const [documentGroups, setDocumentGroups] = useState<DocumentGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDocuments, setExpandedDocuments] = useState<Set<string>>(new Set());

  // Load recent activity when component mounts
  useEffect(() => {
    loadRecentActivity();
  }, [limit]);

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

  const loadRecentActivity = async () => {
    setLoading(true);
    setError(null);

    try {
      logger.debug('Loading recent activity', { limit });

      // Fetch collections dynamically from structure
      let collections: string[] = [];
      try {
        const structureResponse = await apiClient.get('/config/structure');
        if (structureResponse.success && (structureResponse.data as any)?.structure) {
          const structure = (structureResponse.data as any).structure;
          const items = structure.items || structure;

          // Recursive function to extract schemaTypes from nested structure
          const extractSchemaTypes = (items: any[]): string[] => {
            const schemas: string[] = [];
            for (const item of items) {
              if (item.schemaType) {
                schemas.push(item.schemaType);
              }
              // Handle nested groups
              if (item.items && Array.isArray(item.items)) {
                schemas.push(...extractSchemaTypes(item.items));
              }
            }
            return schemas;
          };

          if (Array.isArray(items)) {
            collections = [...new Set(extractSchemaTypes(items))];
          }
        }
      } catch (err) {
        logger.warn('Failed to fetch structure, using fallback collections', err);
      }

      // Fallback to common collections if structure fetch fails
      if (collections.length === 0) {
        collections = ['article', 'homepage', 'settings', 'navigation'];
      }

      logger.debug('Collections to query for activity', { collections });

      const allActivities: AuditLog[] = [];

      // Fetch audit logs from each collection
      for (const collection of collections) {
        try {
          const response = await apiClient.get(`/audit-logs/collections/${collection}`, {
            limit: 50, // Fetch more logs to ensure we get all recent changes
            offset: 0
          });

          if (response.success && (response.data as any)?.auditLogs) {
            allActivities.push(...(response.data as any).auditLogs);
          }
        } catch (err) {
          // Silently continue if a collection fails
          logger.warn(`Failed to load audit logs for collection ${collection}`, err);
        }
      }

      // Resolve usernames for all unique actor IDs
      const usernameCache: Record<string, string> = {};
      const uniqueActorIds = [...new Set(allActivities.map(a => a.actorId).filter(Boolean))];

      for (const actorId of uniqueActorIds) {
        usernameCache[actorId] = await resolveUsername(actorId, usernameCache);
      }

      // Enrich activities with resolved usernames
      const enrichedActivities = allActivities.map(activity => ({
        ...activity,
        actorUsername: usernameCache[activity.actorId] || activity.actorUsername
      }));

      // Sort all activities by timestamp (newest first)
      const sortedActivities = enrichedActivities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Group ALL activities by document to show complete change history per document
      const documentGroups = groupActivitiesByDocument(sortedActivities);

      // Apply limit to number of documents shown
      const finalGroups = documentGroups.slice(0, limit);

      setDocumentGroups(finalGroups);
      logger.info('Recent activity loaded successfully', {
        count: sortedActivities.length
      });

    } catch (err: any) {
      logger.error('Error loading recent activity', err);
      setError('Failed to load recent activity');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadRecentActivity();
  };

  const toggleDocumentExpansion = (documentKey: string) => {
    const newExpanded = new Set(expandedDocuments);
    if (newExpanded.has(documentKey)) {
      newExpanded.delete(documentKey);
    } else {
      newExpanded.add(documentKey);
    }
    setExpandedDocuments(newExpanded);
  };

  // Get operation details for display
  const getOperationInfo = (operation: string) => {
    switch (operation) {
      case 'create':
        return {
          icon: PlusIcon,
          text: 'created',
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/20'
        };
      case 'update':
        return {
          icon: PencilIcon,
          text: 'updated',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-100 dark:bg-blue-900/20'
        };
      case 'delete':
        return {
          icon: TrashIcon,
          text: 'deleted',
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/20'
        };
      case 'publish':
        return {
          icon: EyeIcon,
          text: 'published',
          color: 'text-purple-600 dark:text-purple-400',
          bgColor: 'bg-purple-100 dark:bg-purple-900/20'
        };
      case 'unpublish':
        return {
          icon: EyeIcon,
          text: 'unpublished',
          color: 'text-orange-600 dark:text-orange-400',
          bgColor: 'bg-orange-100 dark:bg-orange-900/20'
        };
      default:
        return {
          icon: PencilIcon,
          text: operation,
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-100 dark:bg-gray-700'
        };
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch (error) {
      return 'Unknown time';
    }
  };

  // Get changed fields summary for individual activities
  const getChangedFieldsSummary = (activity: AuditLog) => {
    if (!activity.changes?.fields || activity.changes.fields.length === 0) {
      return null;
    }

    const fields = activity.changes.fields;
    if (fields.length === 1) {
      return `Changed ${fields[0]}`;
    } else if (fields.length <= 2) {
      return `Changed ${fields.join(', ')}`;
    } else {
      return `Changed ${fields.length} fields`;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      {showHeader && (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <ClockIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Recent Activity
              </h2>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Refresh activity"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
            <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
              Loading recent activity...
            </span>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <ExclamationTriangleIcon className="h-8 w-8 mx-auto text-red-400 mb-2" />
            <div className="text-sm text-red-600 dark:text-red-400 mb-2">
              {error}
            </div>
            <button
              onClick={handleRefresh}
              className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && documentGroups.length === 0 && (
          <div className="text-center py-8">
            <ClockIcon className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <div className="text-sm text-gray-500 dark:text-gray-400">
              No recent activity
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Activity will appear here as content is created and edited
            </div>
          </div>
        )}

        {!loading && !error && documentGroups.length > 0 && (
          <div className="space-y-3">
            {documentGroups.map((group) => {
              const documentKey = `${group.collection}:${group.documentId}`;
              const isExpanded = expandedDocuments.has(documentKey);
              const latestActivity = group.activities[0];
              const operationInfo = getOperationInfo(latestActivity.operation);

              return (
                <div key={documentKey} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                  {/* Collapsible Header - Document title + last update */}
                  <button
                    onClick={() => toggleDocumentExpansion(documentKey)}
                    className="w-full p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* Document title */}
                        <Link
                          to={`/content/${group.collection}/${group.documentId}`}
                          className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 block truncate"
                          title={group.documentTitle}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {group.documentTitle}
                        </Link>
                        
                        {/* Last update summary - single line */}
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span className={operationInfo.color}>
                            {operationInfo.text}
                          </span>
                          <span> by {latestActivity.actorUsername || latestActivity.actorId} • {formatTimestamp(latestActivity.timestamp)}</span>
                        </div>
                      </div>
                      
                      {/* Expand/Collapse icon */}
                      <div className="flex-shrink-0 ml-2">
                        {isExpanded ? (
                          <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded content - All changes */}
                  {isExpanded && (
                    <div className="px-3 pb-3 border-t border-gray-100 dark:border-gray-700">
                      <div className="space-y-2 pt-3">
                        {group.activities.map((activity) => {
                          const activityOperationInfo = getOperationInfo(activity.operation);
                          const changedFields = getChangedFieldsSummary(activity);

                          return (
                            <div key={activity.id} className="flex items-start space-x-2 text-xs">
                              {/* Operation indicator */}
                              <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${activityOperationInfo.color.replace('text-', 'bg-')}`} />
                              
                              {/* Change details */}
                              <div className="flex-1 text-gray-600 dark:text-gray-400 leading-relaxed">
                                <span className={`${activityOperationInfo.color} font-medium`}>
                                  {activityOperationInfo.text}
                                </span>
                                {changedFields && (
                                  <span className="text-gray-500 dark:text-gray-500"> ({changedFields})</span>
                                )}
                                <span className="text-gray-500 dark:text-gray-500"> by {activity.actorUsername || activity.actorId}</span>
                                <div className="text-gray-400 dark:text-gray-600 mt-0.5">
                                  {formatTimestamp(activity.timestamp)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}