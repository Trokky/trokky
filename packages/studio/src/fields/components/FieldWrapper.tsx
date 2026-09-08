/**
 * Field Wrapper Component
 *
 * Provides consistent layout and styling for all field types.
 * Handles labels, descriptions, errors, and validation states.
 */

import { type ReactNode } from 'react';
import { useT } from '@trokky/trokky/i18n';
import type { BaseFieldDefinition, ValidationState } from '../base/FieldDefinition.js';

interface FieldWrapperProps {
  fieldId: string;
  definition: BaseFieldDefinition;
  hasError?: boolean;
  error?: string;
  validationState?: ValidationState;
  children: ReactNode;
}

/**
 * Helper to translate text that may have an i18n: prefix
 * If the text starts with "i18n:", extract the key and translate it
 * Otherwise return the text as-is
 */
function useTranslateText(text: string | undefined, t: (key: string) => string): string | undefined {
  if (!text) return undefined;
  if (text.startsWith('i18n:')) {
    const key = text.substring(5); // Remove 'i18n:' prefix
    return t(key);
  }
  return text;
}

export function FieldWrapper({
  fieldId,
  definition,
  hasError,
  error,
  validationState,
  children
}: FieldWrapperProps) {
  const { t } = useT('fields');

  // Translate title and description if they have i18n: prefix
  const title = useTranslateText(definition.title, t);
  const description = useTranslateText(definition.description, t);

  return (
    <div className="space-y-2">
      {/* Field label - conditionally rendered */}
      {!definition.hideLabel && (
        <div>
          <label
            htmlFor={fieldId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {title}
            {definition.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {description && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
        </div>
      )}

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
          {t('common.validating')}
        </p>
      )}
    </div>
  );
}
