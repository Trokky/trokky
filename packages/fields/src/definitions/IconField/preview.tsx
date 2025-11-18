/**
 * Icon Field Preview Component
 * Displays icon preview in lists and cards
 */

import React from 'react';
import type { IconValue } from './definition.js';
import { fontawesomeAdapter } from './adapters/fontawesome.js';

interface IconFieldPreviewProps {
  value: IconValue | null;
}

export function IconFieldPreview({ value }: IconFieldPreviewProps) {
  if (!value) {
    return (
      <span className="text-gray-400 dark:text-gray-500 text-sm">
        No icon
      </span>
    );
  }

  // Get adapter based on library
  const adapter = value.library === 'fontawesome' ? fontawesomeAdapter : null;

  if (!adapter) {
    return (
      <span className="text-gray-500 dark:text-gray-400 text-sm">
        {value.name}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">
        {adapter.renderIcon({ name: value.name, style: value.style }, 16)}
      </span>
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {value.name.replace('fa-', '')}
      </span>
    </div>
  );
}
