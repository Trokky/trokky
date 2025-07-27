/**
 * Slug Field Preview Component
 * Read-only display component for SlugField values
 */

import React from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { SlugFieldDefinition } from './index.js';

/**
 * Preview component for slug fields in read-only contexts
 * Shows the slug with URL-style formatting and copy functionality
 */
export function SlugFieldPreview(props: FieldComponentProps) {
  const {
    value,
    definition,
    compact = false,
    maxLength = 40
  } = props;
  
  // Type-safe access to slug field specific properties
  const slugDefinition = definition as SlugFieldDefinition;
  
  // Handle empty values
  if (!value || value.toString().trim() === '') {
    return (
      <span className="text-gray-400 dark:text-gray-500 italic text-sm">
        (no slug)
      </span>
    );
  }

  const slugValue = value.toString();
  
  // Determine if we should truncate
  const shouldTruncate = compact && slugValue.length > maxLength;
  const displayValue = shouldTruncate 
    ? `${slugValue.slice(0, maxLength - 3)}...`
    : slugValue;

  // Handle copy to clipboard
  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(slugValue);
      // Could show a toast notification here if studioContext is available
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = slugValue;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (fallbackErr) {
        console.warn('Copy to clipboard failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="flex items-center gap-2 group">
      {/* URL-style display */}
      <span 
        className="text-gray-900 dark:text-gray-100 text-sm font-mono bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded border"
        title={shouldTruncate ? slugValue : `URL slug: /${slugValue}`}
      >
        <span className="text-gray-400">/</span>
        {displayValue}
      </span>

      {/* Copy button (visible on hover) */}
      <button
        type="button"
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
        title="Copy slug to clipboard"
      >
        📋
      </button>

      {/* Prefix/suffix indicators */}
      {(slugDefinition.prefix || slugDefinition.suffix) && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {slugDefinition.prefix && `prefix: ${slugDefinition.prefix}`}
          {slugDefinition.prefix && slugDefinition.suffix && ', '}
          {slugDefinition.suffix && `suffix: ${slugDefinition.suffix}`}
        </span>
      )}
    </div>
  );
}