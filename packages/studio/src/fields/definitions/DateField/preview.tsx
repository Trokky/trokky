import React from 'react';
import type { FieldComponentProps } from '../../base/index.js';
import type { DateFieldDefinition } from './definition.js';
import { formatDateForDisplay } from './validation.js';

export const DateFieldPreview: React.FC<FieldComponentProps> = ({
  value,
  definition
}) => {
  if (!value) {
    return (
      <span className="text-gray-400 dark:text-gray-500 italic">
        No date selected
      </span>
    );
  }

  const fieldDef = definition as DateFieldDefinition;
  const options = fieldDef.options || {};
  const formattedDate = formatDateForDisplay(value, options.displayFormat);

  return (
    <div className="flex items-center space-x-2">
      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span className="text-gray-900 dark:text-gray-100">
        {formattedDate}
      </span>
      {options.includeTime && (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          with time
        </span>
      )}
    </div>
  );
};