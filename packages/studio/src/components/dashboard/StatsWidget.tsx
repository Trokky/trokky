/**
 * StatsWidget - Shows content and activity statistics
 */

import { useState, useEffect } from 'react';
import {
  DocumentTextIcon,
  UsersIcon,
  PhotoIcon,
  ClockIcon,
  ChartBarIcon,
  RectangleStackIcon
} from '@heroicons/react/24/outline';
import { apiClient } from '@/services/api-client';
import { createStudioLogger } from '@/utils/logger';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useT } from 'trokky/i18n';

const logger = createStudioLogger('StatsWidget');

interface Stat {
  labelKey?: string;
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: {
    value: number;
    labelKey?: string;
    label: string;
  };
}

export function StatsWidget() {
  const { t } = useT('studio');
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []); // Empty dependency array to prevent re-renders

  const loadStats = async () => {
    try {
      logger.debug('Starting to load stats');
      
      // Get all available collections dynamically
      const collectionsResponse = await apiClient.get('/collections');
      const collections = collectionsResponse.success ? collectionsResponse.data?.collections || [] : [];
      const collectionNames = collections.map((col: any) => col.name);
      
      logger.debug('Found collections for stats', { 
        collectionNames, 
        collections: collections.map((c: any) => ({ name: c.name, title: c.title, singleton: c.singleton }))
      });

      // Fetch stats for all collections
      const statsPromises = collectionNames.map(collectionName => 
        apiClient.getCollectionStats(collectionName)
      );
      
      const statsResponses = await Promise.allSettled(statsPromises);

      logger.debug('Stats responses received', {
        collectionNames,
        responses: statsResponses.map((r, i) => ({
          collection: collectionNames[i],
          status: r.status
        }))
      });

      // Get media count - use meta.total for accurate count
      let mediaCount = 0;
      try {
        const mediaResponse = await apiClient.getMedia({ limit: 1 });
        if (mediaResponse.success && mediaResponse.meta?.total !== undefined) {
          mediaCount = mediaResponse.meta.total;
        }
      } catch (error) {
        logger.warn('Failed to get media count', error);
      }

      const newStats: Stat[] = [];

      // Calculate totals across all content collections
      let totalContent = 0;
      let totalRecent = 0;

      // Collection-specific counts
      const collectionCounts: Record<string, number> = {};

      // Process each collection's stats
      statsResponses.forEach((response, index) => {
        const collectionName = collectionNames[index];
        
        if (response.status === 'fulfilled' && response.value.success) {
          const stats = response.value.data?.stats;
          if (stats) {
            const count = stats.totalDocuments || 0;
            collectionCounts[collectionName] = count;
            
            // Add to total content (all collections contribute)
            totalContent += count;
            totalRecent += stats.recentDocuments || 0;
          }
        }
      });

      // Add total content overview
      newStats.push({
        labelKey: 'dashboard.stats.totalContent',
        label: 'Total Content',
        value: totalContent,
        icon: DocumentTextIcon,
        color: 'text-blue-600 dark:text-blue-400',
        trend: totalRecent > 0 ? {
          value: totalRecent,
          labelKey: 'dashboard.stats.thisWeek',
          label: 'this week'
        } : undefined
      });

      // Handle Singletons specially - count number of singleton collections
      const singletonCollections = collections.filter((col: any) =>
        col.singleton
      );

      if (singletonCollections.length > 0) {
        newStats.push({
          labelKey: 'dashboard.stats.singletons',
          label: 'Singletons',
          value: singletonCollections.length,
          icon: DocumentTextIcon,
          color: 'text-indigo-600 dark:text-indigo-400'
        });
      }

      // Add individual collection stats (exclude singletons only)
      Object.entries(collectionCounts).forEach(([collectionName, count]) => {
        const collection = collections.find((c: any) => c.name === collectionName);
        const isSingleton = collection?.singleton;
        
        if (!isSingleton && count > 0) {
          const label = collection?.title || collectionName.charAt(0).toUpperCase() + collectionName.slice(1);
          
          newStats.push({
            label,
            value: count,
            icon: DocumentTextIcon,
            color: 'text-blue-600 dark:text-blue-400'
          });
        }
      });

      // Add media count
      if (mediaCount > 0) {
        newStats.push({
          labelKey: 'dashboard.stats.mediaFiles',
          label: 'Media Files',
          value: mediaCount,
          icon: PhotoIcon,
          color: 'text-orange-600 dark:text-orange-400'
        });
      }

      setStats(newStats);
      logger.info('Stats loaded successfully', { statsCount: newStats.length });

    } catch (error) {
      logger.error('Failed to load stats', error);
      // Show basic stats even if API calls fail
      setStats([
        {
          labelKey: 'dashboard.stats.content',
          label: 'Content',
          value: '—',
          icon: DocumentTextIcon,
          color: 'text-gray-600 dark:text-gray-400'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get translated label
  const getLabel = (stat: Stat) => stat.labelKey ? t(stat.labelKey) : stat.label;
  const getTrendLabel = (trend: Stat['trend']) => trend?.labelKey ? t(trend.labelKey) : trend?.label;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner />
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            {t('dashboard.stats.loading')}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center mb-4">
        <RectangleStackIcon className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('dashboard.stats.contentOverview')}
        </h2>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Fixed Key Stats - Total Content and Media Files (Vertical) */}
        <div className="flex-shrink-0">
          <div className="flex flex-col gap-4 w-48">
            {stats.filter(stat => stat.labelKey === 'dashboard.stats.totalContent' || stat.labelKey === 'dashboard.stats.mediaFiles').map((stat, index) => {
              const Icon = stat.icon;

              return (
                <div key={index} className="flex items-center space-x-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4">
                  <div className={`flex-shrink-0 w-12 h-12 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm`}>
                    <Icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="text-3xl font-bold text-gray-900 dark:text-white leading-none">
                      {stat.value}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                      {getLabel(stat)}
                    </div>
                    {stat.trend && (
                      <div className="text-xs text-green-600 dark:text-green-400">
                        +{stat.trend.value} {getTrendLabel(stat.trend)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vertical Separator */}
        <div className="hidden lg:block w-px bg-gray-200 dark:bg-gray-700"></div>

        {/* Dynamic Schema Stats - 4 per line */}
        <div className="flex-1">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.filter(stat => stat.labelKey !== 'dashboard.stats.totalContent' && stat.labelKey !== 'dashboard.stats.mediaFiles').map((stat, index) => {
              const Icon = stat.icon;

              return (
                <div key={index} className="flex items-center space-x-3">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700/50 flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-bold text-gray-900 dark:text-white leading-none">
                      {stat.value}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                      {getLabel(stat)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}