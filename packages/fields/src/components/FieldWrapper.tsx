/**
 * Field Wrapper Component
 * 
 * Provides consistent layout and styling for all field types.
 * Handles labels, descriptions, errors, and validation states.
 */

import React, { type ReactNode } from 'react';
import type { BaseFieldDefinition, ValidationState } from '../base/FieldDefinition.js';

interface FieldWrapperProps {
  fieldId: string;
  definition: BaseFieldDefinition;
  hasError?: boolean;
  error?: string;
  validationState?: ValidationState;
  children: ReactNode;
}

export function FieldWrapper({
  fieldId,
  definition,
  hasError,
  error,
  validationState,
  children
}: FieldWrapperProps) {
  return (
    <div className="space-y-2">
      {/* Field label with inline description */}
      <label
        htmlFor={fieldId}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {definition.title}
        {definition.required && <span className="text-red-500 ml-1">*</span>}
        {definition.description && (
          <span className="font-normal text-xs text-gray-400 dark:text-gray-500">
            {' '}- {definition.description}
          </span>
        )}
      </label>

      {/* Field component */}
      <div className={`
        ${hasError ? 'ring-1 ring-red-500' : ''}
        ${validationState?.isValidating ? 'opacity-75' : ''}
      `}>
        {children}
      </div>

      {/* Error message */}
      {hasError && error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Validation state indicator */}
      {validationState?.isValidating && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Validating...
        </p>
      )}
    </div>
  );
}