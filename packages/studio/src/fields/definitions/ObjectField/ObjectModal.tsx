/**
 * ObjectModal - Modal/Drawer for editing top-level object fields
 *
 * Provides a focused editing experience for complex objects without cluttering the main form.
 * Opens as a slide-in drawer from the right side of the screen.
 */

import React from 'react';
import { useT } from 'trokky/i18n';
import type { ObjectFieldDefinition, NestedFieldDefinition } from './definition.js';

interface ObjectModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Function to close the modal */
  onClose: () => void;
  /** Object field definition */
  definition: ObjectFieldDefinition;
  /** Current object value */
  value: Record<string, any>;
  /** Callback when value changes */
  onChange: (newValue: Record<string, any>) => void;
  /** Field ID for nested field IDs */
  fieldId: string;
  /** Whether the field is disabled */
  isDisabled?: boolean;
  /** Whether the field is readonly */
  isReadonly?: boolean;
  /** Studio context (for nested fields) */
  studioContext?: any;
  /** Document context (for nested fields) */
  documentContext?: any;
  /** Visible fields to render */
  visibleFields: Array<{ name: string; definition: NestedFieldDefinition }>;
  /** Render function for individual fields */
  renderField: (fieldName: string, fieldDef: NestedFieldDefinition) => React.ReactNode;
}

export function ObjectModal({
  isOpen,
  onClose,
  definition,
  visibleFields,
  renderField,
}: ObjectModalProps) {
  const { t } = useT('fields');

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal/Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-gray-900 shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {definition.title || t('types.object.label')}
            </h2>
            {definition.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {definition.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title={t('modal.close')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {visibleFields.length > 0 ? (
              visibleFields.map(field => (
                <div key={field.name}>
                  {renderField(field.name, field.definition)}
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  {t('modal.noFieldsDefined')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {t('modal.done')}
          </button>
        </div>
      </div>
    </>
  );
}
