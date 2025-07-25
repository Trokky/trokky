/**
 * Email Field Preview Component
 * Shows email with clickable mailto link
 */

import React from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';

export function EmailFieldPreview({ value }: FieldComponentProps) {
  const emailValue = String(value || '');
  
  if (!emailValue.trim()) {
    return (
      <span className="text-gray-400 dark:text-gray-500 italic text-sm">
        No email provided
      </span>
    );
  }

  // Basic email validation for preview
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  
  if (!isValidEmail) {
    return (
      <span className="text-red-500 dark:text-red-400 text-sm">
        Invalid email: {emailValue}
      </span>
    );
  }

  return (
    <a
      href={`mailto:${emailValue}`}
      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm"
      onClick={(e) => e.stopPropagation()} // Prevent parent handlers
    >
      {emailValue}
    </a>
  );
}