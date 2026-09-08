import React from 'react';
import { useT } from '@trokky/trokky/i18n';
import type { ArrayOperations } from './definition.js';
import { XMarkIcon } from './icons.js';

interface ArrayTagsLayoutProps {
  arrayValue: any[];
  operations: ArrayOperations;
  tagField: any;
  suggestions: string[];
  allowCustom: boolean;
  newItemInput: string;
  setNewItemInput: (value: string) => void;
  showSuggestions: boolean;
  setShowSuggestions: (value: boolean) => void;
  selectedSuggestionIndex: number;
  setSelectedSuggestionIndex: (index: number) => void;
  filteredSuggestions: string[];
  handleAddTag: (tagToAdd?: string) => void;
  handleTagKeyPress: (e: React.KeyboardEvent) => void;
  tagInputRef: React.RefObject<HTMLInputElement | null>;
  suggestionsRef: React.RefObject<HTMLDivElement | null>;
  isDisabled: boolean;
  isReadonly: boolean;
  disableAdd: boolean;
  disableRemove: boolean;
}

/**
 * The tags layout: the pills already chosen, and the input with its
 * autocomplete that adds the next one.
 */
export function ArrayTagsLayout({
  arrayValue,
  operations,
  tagField,
  suggestions,
  allowCustom,
  newItemInput,
  setNewItemInput,
  showSuggestions,
  setShowSuggestions,
  selectedSuggestionIndex,
  setSelectedSuggestionIndex,
  filteredSuggestions,
  handleAddTag,
  handleTagKeyPress,
  tagInputRef,
  suggestionsRef,
  isDisabled,
  isReadonly,
  disableAdd,
  disableRemove,
}: ArrayTagsLayoutProps) {
  const { t } = useT('fields');

  return (
    <div className="space-y-3">
      {/* Existing tags */}
      {arrayValue.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {arrayValue.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100"
            >
              {tag}
              {!isDisabled && !isReadonly && !disableRemove && (
                <button
                  type="button"
                  onClick={() => {
                    if (tagField.confirmDelete) {
                      if (window.confirm(t('types.array.removeTag', { tag }))) {
                        operations.remove(index);
                      }
                    } else {
                      operations.remove(index);
                    }
                  }}
                  className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100 p-0.5"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Add new tag input with autocomplete */}
      {!isDisabled && !isReadonly && !disableAdd && (
        <div className="relative">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={tagInputRef}
                type="text"
                value={newItemInput}
                onChange={(e) => {
                  setNewItemInput(e.target.value);
                  setShowSuggestions(true);
                  setSelectedSuggestionIndex(-1);
                }}
                onFocus={() => {
                  if (filteredSuggestions.length > 0) {
                    setShowSuggestions(true);
                  }
                }}
                onKeyDown={handleTagKeyPress}
                placeholder={tagField.placeholder || t('types.array.addTag')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />

              {/* Suggestions dropdown */}
              {showSuggestions && filteredSuggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto"
                >
                  {filteredSuggestions.map((suggestion, index) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleAddTag(suggestion)}
                      onMouseEnter={() => setSelectedSuggestionIndex(index)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        index === selectedSuggestionIndex
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}

              {/* Show hint when allowCustom is false */}
              {!allowCustom && suggestions.length > 0 && newItemInput && filteredSuggestions.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                  {t('types.array.noMatchingOptions')}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleAddTag()}
              disabled={!newItemInput.trim() || (!allowCustom && suggestions.length > 0 && !suggestions.includes(newItemInput.trim()))}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {t('types.array.add')}
            </button>
          </div>

          {/* Available suggestions hint */}
          {suggestions.length > 0 && arrayValue.length === 0 && !newItemInput && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {allowCustom ? t('types.array.typeToSearch') : t('types.array.selectFromOptions')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
