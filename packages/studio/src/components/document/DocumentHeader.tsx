/**
 * DocumentHeader - Document editor header with state management and controls
 */

import { useState, useMemo } from 'react';
import {
  EyeIcon,
  PencilIcon,
  CloudArrowUpIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { useDocumentEditor } from './DocumentEditorContext';
import { DocumentStates, type DocumentState } from './DocumentStates';
import { useT } from '@trokky/i18n';

export function DocumentHeader() {
  const { t } = useT('studio');
  const {
    schema,
    document,
    documentState,
    currentMode,
    isNewDocument,
    hasUnsavedChanges,
    hasValidationErrors,
    isReadOnly,
    saving,
    onStateChange,
    onModeChange,
    onSave,
    onCancel,
    onToggleMobileSidebar
  } = useDocumentEditor();

  const [showStateMenu, setShowStateMenu] = useState(false);

  const handleStateChange = async (newState: DocumentState) => {
    if (DocumentStates.requiresConfirmation(documentState, newState)) {
      const confirmed = confirm(
        t('documentEditor.confirmStateChange', {
          from: DocumentStates.getStateName(documentState),
          to: DocumentStates.getStateName(newState)
        })
      );
      if (!confirmed) return;
    }

    await onStateChange(newState);
    setShowStateMenu(false);
  };

  const documentTitle = useMemo(() => {
    const schemaTitle = schema?.title || schema?.name || 'Document';
    if (!document) return t('documentEditor.newDocument', { type: schemaTitle });

    // First, try to get the first field value (prioritize user input)
    if (schema?.fields) {
      const fields = Array.isArray(schema.fields)
        ? schema.fields
        : Object.entries(schema.fields).map(([name, field]) => ({ name, ...field }));

      const firstField = fields[0];
      if (firstField && document[firstField.name]) {
        const value = document[firstField.name];
        if (typeof value === 'string' && value.trim()) {
          // Don't use if it's just the default "New ..." title
          if (!value.startsWith('New ')) {
            return value;
          }
        }
      }
    }

    // Then try common title fields (but skip if they're default values)
    if (document.title && !document.title.startsWith('New ')) {
      return document.title;
    }
    if (document.name && !document.name.startsWith('New ')) {
      return document.name;
    }
    if (document.slug) {
      return document.slug;
    }

    return t('documentEditor.newDocument', { type: schemaTitle });
  }, [document, schema, t]);

  const isSingletonDocument = schema?.singleton === true;
  // Show cancel button only when there are unsaved changes (for discarding changes)
  const shouldShowCancelButton = hasUnsavedChanges;

  const availableTransitions = DocumentStates.getAvailableTransitions(documentState);

  return (
    <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="px-6 py-3">
        {/* First line - Back navigation, collection type and actions */}
        <div className="flex items-center justify-between mb-2">
          {/* Left side - Back navigation, document type and state */}
          <div className="flex items-center space-x-4">
            {/* Back to collection button - only show for non-singleton documents */}
            {!isSingletonDocument && (
              <button
                onClick={onCancel}
                className="flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                title={t('documentEditor.backTo', { type: schema?.title || schema?.name })}
              >
                <ChevronLeftIcon className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">{t('documentEditor.backTo', { type: schema?.title || schema?.name })}</span>
                <span className="sm:hidden">{t('common.back')}</span>
              </button>
            )}
            
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {schema?.title || schema?.name} {isNewDocument ? '(New)' : ''}
            </span>

            {/* Document State Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowStateMenu(!showStateMenu)}
                className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium border ${getStateButtonClasses(documentState)}`}
              >
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getStateIndicatorClasses(documentState)}`}></span>
                {DocumentStates.getStateName(documentState)}
                <ChevronDownIcon className="ml-1 h-4 w-4" />
              </button>

              {showStateMenu && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                  <div className="py-1">
                    {availableTransitions.map((state) => (
                      <button
                        key={state}
                        onClick={() => handleStateChange(state)}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getStateIndicatorClasses(state)}`}></span>
                        {DocumentStates.getStateName(state)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right side - Mode switching and actions */}
          <div className="flex items-center space-x-4">
            {/* Mode switching */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => onModeChange('form')}
                className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  currentMode === 'form'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <PencilIcon className="h-4 w-4 mr-1.5" />
                {t('documentEditor.edit')}
              </button>
              <button
                onClick={() => onModeChange('preview')}
                className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  currentMode === 'preview'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <EyeIcon className="h-4 w-4 mr-1.5" />
                {t('documentEditor.preview')}
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex items-center space-x-3">
              {shouldShowCancelButton && (
                <Button
                  variant="outline"
                  onClick={onCancel}
                >
                  <XMarkIcon className="h-4 w-4 mr-1.5" />
                  {t('common.cancel')}
                </Button>
              )}

              <Button
                onClick={onSave}
                loading={saving}
                disabled={isReadOnly || saving || !hasUnsavedChanges || hasValidationErrors}
                title={isReadOnly ? t('documentEditor.readOnlyMode') : undefined}
              >
                <CloudArrowUpIcon className="h-4 w-4 mr-1.5" />
                {isReadOnly ? t('documentEditor.readOnly') : (isNewDocument ? t('common.create') : t('common.save'))}
              </Button>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="border-t border-gray-200 dark:border-gray-700 mb-2"></div>

        {/* Second line - Document title */}
        <div className="mb-2 flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {documentTitle}
            </h1>
            {(hasUnsavedChanges || hasValidationErrors || isReadOnly) && (
              <div className="flex items-center space-x-2 mt-0.5">
                {isReadOnly && (
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    • {t('documentEditor.readOnlyMode')}
                  </span>
                )}
                {hasUnsavedChanges && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    • {t('documentEditor.unsavedChanges')}
                  </span>
                )}
                {hasValidationErrors && (
                  <span className="text-xs text-red-600 dark:text-red-400">
                    • {t('documentEditor.validationErrors')}
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Mobile info icon - shows Document Info sidebar */}
          <button
            onClick={() => onToggleMobileSidebar(true)}
            className="md:hidden flex-shrink-0 ml-2 p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors"
            title={t('documentEditor.documentInfo')}
          >
            <InformationCircleIcon className="h-6 w-6" />
          </button>
        </div>
      </div>

      {/* Click outside to close state menu */}
      {showStateMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowStateMenu(false)}
        />
      )}
    </div>
  );
}

function getStateButtonClasses(state: DocumentState): string {
  const baseClasses = 'border';
  
  switch (state) {
    case 'draft':
      return `${baseClasses} border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300`;
    case 'published':
      return `${baseClasses} border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-300`;
    default:
      return `${baseClasses} border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300`;
  }
}

function getStateIndicatorClasses(state: DocumentState): string {
  switch (state) {
    case 'draft':
      return 'bg-gray-400 dark:bg-gray-500';
    case 'published':
      return 'bg-green-500 dark:bg-green-400';
    default:
      return 'bg-gray-400 dark:bg-gray-500';
  }
}