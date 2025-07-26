import React from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { BooleanFieldDefinition } from './definition.js';
import { convertToBoolean, getBooleanDisplayText } from './validation.js';

export function BooleanFieldPreview(props: FieldComponentProps) {
  const { value, definition } = props;
  const booleanDefinition = definition as BooleanFieldDefinition;
  const options = booleanDefinition.options || {};
  
  const boolValue = convertToBoolean(value);
  const displayText = getBooleanDisplayText(boolValue, booleanDefinition);
  
  // Get color for the value
  const getValueColor = () => {
    if (boolValue === true) {
      switch (options.color) {
        case 'green': return 'text-green-600 dark:text-green-400';
        case 'blue': return 'text-blue-600 dark:text-blue-400';
        case 'purple': return 'text-purple-600 dark:text-purple-400';
        case 'red': return 'text-red-600 dark:text-red-400';
        default: return 'text-green-600 dark:text-green-400';
      }
    } else if (boolValue === false) {
      return 'text-gray-500 dark:text-gray-400';
    } else {
      return 'text-gray-400 dark:text-gray-500';
    }
  };
  
  // Get icon for the value
  const getValueIcon = () => {
    if (boolValue === true) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    } else if (boolValue === false) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    } else {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      );
    }
  };
  
  return (
    <div className="flex items-center space-x-2">
      <span className={getValueColor()}>
        {getValueIcon()}
      </span>
      <span className={`${getValueColor()} font-medium`}>
        {displayText}
      </span>
    </div>
  );
}