/**
 * String Field Preview Component
 * Read-only display component for StringField values
 */

import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { StringFieldDefinition } from './definition.js';

/**
 * Preview component for string fields in read-only contexts
 * Handles formatting, truncation, and format-specific displays
 */
export function StringFieldPreview(props: FieldComponentProps) {
  const {
    value,
    definition,
    compact = false,
    maxLength = 50
  } = props;
  
  // Type-safe access to string field specific properties
  const stringDefinition = definition as StringFieldDefinition;
  // Handle empty values
  if (!value || value.trim() === '') {
    return (
      <span className="text-gray-400 dark:text-gray-500 italic text-sm">
        (empty)
      </span>
    );
  }

  const { options, validation } = stringDefinition;
  const inputType = options?.inputType;
  const email = validation?.email;
  const url = validation?.url;

  // Handle password fields
  if (inputType === 'password') {
    return (
      <span className="text-gray-500 dark:text-gray-400 font-mono text-sm">
        {'•'.repeat(Math.min(value.length, 8))}
      </span>
    );
  }

  // Determine if we should truncate
  const shouldTruncate = compact && value.length > maxLength;
  const displayValue = shouldTruncate 
    ? `${value.slice(0, maxLength - 3)}...`
    : value;

  // Format-specific displays
  if (email || inputType === 'email') {
    return (
      <a 
        href={`mailto:${value}`}
        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm"
        target="_blank"
        rel="noopener noreferrer"
        title={shouldTruncate ? value : undefined}
      >
        {displayValue}
      </a>
    );
  }

  if (url || inputType === 'url') {
    return (
      <a 
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm"
        title={shouldTruncate ? value : undefined}
      >
        {displayValue}
      </a>
    );
  }

  if (inputType === 'tel') {
    return (
      <a 
        href={`tel:${value}`}
        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm"
        title={shouldTruncate ? value : undefined}
      >
        {displayValue}
      </a>
    );
  }

  // Handle multiline text
  if (options?.multiline && value.includes('\n')) {
    // For multiline in compact mode, show first line only
    if (compact) {
      const firstLine = value.split('\n')[0];
      const truncatedFirstLine = firstLine.length > maxLength 
        ? `${firstLine.slice(0, maxLength - 3)}...`
        : firstLine;
      
      return (
        <span 
          className="text-gray-900 dark:text-gray-100 text-sm"
          title={value}
        >
          {truncatedFirstLine}
        </span>
      );
    }

    // For non-compact multiline, preserve line breaks
    return (
      <span 
        className="text-gray-900 dark:text-gray-100 text-sm whitespace-pre-wrap"
        title={shouldTruncate ? value : undefined}
      >
        {displayValue}
      </span>
    );
  }

  // Default text display
  return (
    <span 
      className="text-gray-900 dark:text-gray-100 text-sm"
      title={shouldTruncate ? value : undefined}
    >
      {displayValue}
    </span>
  );
}