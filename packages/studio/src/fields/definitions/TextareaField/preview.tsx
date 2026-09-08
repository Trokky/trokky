/**
 * Textarea Field Preview Component
 * Read-only preview rendering for textarea fields
 */

import type { FieldComponentProps } from '../../base/FieldPlugin.js';

// Use generic FieldComponentProps to match plugin interface
type TextareaPreviewProps = FieldComponentProps;

export function TextareaFieldPreview(props: TextareaPreviewProps) {
  const { value, compact, maxLength } = props;
  
  // Handle empty values
  if (!value || (typeof value === 'string' && value.trim().length === 0)) {
    return (
      <span className="text-gray-400 dark:text-gray-500 italic">
        {compact ? 'Empty' : 'No content'}
      </span>
    );
  }

  const stringValue = value as string;

  // Truncate for compact display
  const displayValue = compact && maxLength && stringValue.length > maxLength
    ? `${stringValue.substring(0, maxLength)}...`
    : stringValue;

  // Compact preview (single line with truncation)
  if (compact) {
    return (
      <span className="text-gray-900 dark:text-white truncate">
        {displayValue.replace(/\n/g, ' ')}
      </span>
    );
  }

  // Full preview (preserve line breaks)
  return (
    <div className="text-gray-900 dark:text-white">
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
        {displayValue}
      </pre>
      
      {/* Show truncation indicator if text was cut off */}
      {maxLength && stringValue.length > maxLength && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Showing {maxLength} of {stringValue.length} characters...
        </div>
      )}
    </div>
  );
}