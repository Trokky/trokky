import React from 'react';
import { useT } from '@trokky/trokky/i18n';
import type { ArrayOperations } from './definition.js';

interface ArraySelectLayoutProps {
  arrayValue: any[];
  operations: ArrayOperations;
  onChange: (value: any) => void;
  selectField: unknown;
  hasError?: boolean;
  isDisabled: boolean;
  isReadonly: boolean;
}

/**
 * The select layout: the configured options as checkboxes, pills or a multi
 * select, toggling membership of the array.
 */
export function ArraySelectLayout({
  arrayValue,
  operations,
  onChange,
  selectField,
  hasError,
  isDisabled,
  isReadonly,
}: ArraySelectLayoutProps) {
  const { t } = useT('fields');

    const selectOptions = (selectField as { options?: string[]; displayAs?: 'checkboxes' | 'pills' | 'dropdown'; columns?: 1 | 2 | 3 | 4; dropdownSize?: number });
    const options = selectOptions.options || [];
    const displayAs = selectOptions.displayAs || 'checkboxes';
    const columns = selectOptions.columns || 2;
    const dropdownSize = selectOptions.dropdownSize || 6;

    if (options.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          <p className="text-sm">{t('types.array.noOptionsConfigured')}</p>
        </div>
      );
    }

    const handleToggle = (option: string) => {
      if (isDisabled || isReadonly) return;
      operations.toggle(option);
    };

    if (displayAs === 'pills') {
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const isSelected = arrayValue.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleToggle(option)}
                disabled={isDisabled || isReadonly}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                } ${isDisabled || isReadonly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    }

    if (displayAs === 'dropdown') {
      const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
        onChange(selectedOptions);
      };

      return (
        <div className="w-full">
          <select
            multiple
            size={dropdownSize}
            value={arrayValue}
            onChange={handleSelectChange}
            disabled={isDisabled || isReadonly}
            className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
              isDisabled || isReadonly ? 'opacity-50 cursor-not-allowed' : ''
            } ${hasError ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'}`}
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('types.array.holdCtrlToSelect')}
          </p>
        </div>
      );
    }

    // Checkboxes layout
    const gridCols = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    };

    return (
      <div className={`grid ${gridCols[columns]} gap-2`}>
        {options.map((option) => {
          const isSelected = arrayValue.includes(option);
          return (
            <label
              key={option}
              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              } ${isDisabled || isReadonly ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(option)}
                disabled={isDisabled || isReadonly}
                className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
              />
              <span className={`text-sm ${
                isSelected
                  ? 'text-blue-700 dark:text-blue-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {option}
              </span>
            </label>
          );
        })}
      </div>
    );
}
