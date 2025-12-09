/**
 * ChangesDiff - Visual diff component for showing document changes
 *
 * Displays before/after comparison of document fields
 */

import { useState } from 'react';
import {
  PlusIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline';
import { useT } from '@trokky/i18n';

interface ChangesDiffProps {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  operation: string;
}

export function ChangesDiff({ before, after, operation }: ChangesDiffProps) {
  const { t } = useT('studio');
  const [showSystemFields, setShowSystemFields] = useState(false);

  // Get all changed fields by comparing before and after
  const getChangedFields = () => {
    const changes: {
      field: string;
      beforeValue: unknown;
      afterValue: unknown;
      changeType: 'added' | 'removed' | 'modified';
    }[] = [];

    // Handle creation case (no before data)
    if (operation === 'create' && after) {
      Object.entries(after).forEach(([field, value]) => {
        // Skip system fields unless explicitly shown
        if (!showSystemFields && field.startsWith('_')) {
          return;
        }

        changes.push({
          field,
          beforeValue: undefined,
          afterValue: value,
          changeType: 'added'
        });
      });
      return changes;
    }

    // Handle deletion case (no after data)
    if (operation === 'delete' && before) {
      Object.entries(before).forEach(([field, value]) => {
        // Skip system fields unless explicitly shown
        if (!showSystemFields && field.startsWith('_')) {
          return;
        }

        changes.push({
          field,
          beforeValue: value,
          afterValue: undefined,
          changeType: 'removed'
        });
      });
      return changes;
    }

    // Handle update case (compare before and after)
    if (before && after) {
      const allFields = new Set([...Object.keys(before), ...Object.keys(after)]);
      
      allFields.forEach(field => {
        // Skip system fields unless explicitly shown
        if (!showSystemFields && field.startsWith('_')) {
          return;
        }

        const beforeValue = before[field];
        const afterValue = after[field];

        // Check if values are different
        if (!isEqual(beforeValue, afterValue)) {
          let changeType: 'added' | 'removed' | 'modified';
          
          if (beforeValue === undefined) {
            changeType = 'added';
          } else if (afterValue === undefined) {
            changeType = 'removed';
          } else {
            changeType = 'modified';
          }

          changes.push({
            field,
            beforeValue,
            afterValue,
            changeType
          });
        }
      });
    }

    return changes;
  };

  // Simple deep equality check
  const isEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;
    
    if (typeof a === 'object') {
      try {
        return JSON.stringify(a) === JSON.stringify(b);
      } catch {
        return false;
      }
    }
    
    return false;
  };

  // Format value for display
  const formatValue = (value: unknown): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') {
      // Truncate long strings
      return value.length > 100 ? `${value.substring(0, 100)}...` : value;
    }
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'object') {
      try {
        const json = JSON.stringify(value, null, 2);
        return json.length > 200 ? `${json.substring(0, 200)}...` : json;
      } catch {
        return '[Object]';
      }
    }
    return String(value);
  };

  // Get styling for change type
  const getChangeStyles = (changeType: 'added' | 'removed' | 'modified') => {
    switch (changeType) {
      case 'added':
        return {
          icon: PlusIcon,
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          textColor: 'text-green-800 dark:text-green-200',
          borderColor: 'border-green-200 dark:border-green-800'
        };
      case 'removed':
        return {
          icon: PlusIcon, // Use PlusIcon for consistency (we'll show minus in text)
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          textColor: 'text-red-800 dark:text-red-200',
          borderColor: 'border-red-200 dark:border-red-800'
        };
      case 'modified':
        return {
          icon: PlusIcon, // We'll show both - and + for modified
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          textColor: 'text-blue-800 dark:text-blue-200',
          borderColor: 'border-blue-200 dark:border-blue-800'
        };
    }
  };

  const changes = getChangedFields();

  if (changes.length === 0) {
    return (
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
        {t('changesDiff.noVisibleChanges')}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Show/hide system fields toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {t('changesDiff.changesCount', { count: changes.length })}
        </span>
        <button
          onClick={() => setShowSystemFields(!showSystemFields)}
          className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {showSystemFields ? (
            <EyeSlashIcon className="h-3 w-3" />
          ) : (
            <EyeIcon className="h-3 w-3" />
          )}
          <span>{showSystemFields ? t('changesDiff.hideSystemFields') : t('changesDiff.showSystemFields')}</span>
        </button>
      </div>

      {/* Changes list */}
      <div className="space-y-2">
        {changes.map((change, index) => {
          const styles = getChangeStyles(change.changeType);
          const Icon = styles.icon;

          return (
            <div
              key={`${change.field}-${index}`}
              className={`border rounded p-2 ${styles.bgColor} ${styles.borderColor}`}
            >
              <div className="flex items-start space-x-2">
                <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${styles.textColor}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium ${styles.textColor}`}>
                    {change.field}
                  </div>
                  
                  {/* Show before value for removed/modified */}
                  {(change.changeType === 'removed' || change.changeType === 'modified') && change.beforeValue !== undefined && (
                    <div className="mt-1">
                      <div className="text-xs text-red-600 dark:text-red-400 font-medium">
                        - {t('changesDiff.before')}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 bg-red-100 dark:bg-red-900/30 rounded px-2 py-1 mt-1 font-mono">
                        {formatValue(change.beforeValue)}
                      </div>
                    </div>
                  )}

                  {/* Show after value for added/modified */}
                  {(change.changeType === 'added' || change.changeType === 'modified') && change.afterValue !== undefined && (
                    <div className="mt-1">
                      <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                        + {t('changesDiff.after')}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 bg-green-100 dark:bg-green-900/30 rounded px-2 py-1 mt-1 font-mono">
                        {formatValue(change.afterValue)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}