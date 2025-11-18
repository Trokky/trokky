import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { ArrayFieldDefinition, ArrayOperations } from './definition.js';
import { fieldRegistry } from '../../registry/index.js';
import { ArrayModal } from './ArrayModal.js';

// Simple SVG icons inline to avoid external dependencies
const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const XMarkIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const GripVerticalIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <circle cx="9" cy="5" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="9" cy="19" r="1.5" />
    <circle cx="15" cy="5" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="15" cy="19" r="1.5" />
  </svg>
);

// Generate unique key for array items
function generateItemKey(): string {
  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Array field component
export function ArrayFieldComponent(props: FieldComponentProps) { 
  const {
    fieldId, 
    value, 
    onChange, 
    definition, 
    hasError,
    isDisabled = false,
    isReadonly = false,
    documentContext,
    onValidationChange,
    onFocus,
    onBlur
  } = props;
  const arrayDefinition = definition as ArrayFieldDefinition;
  
  // Detect nesting level from documentContext (0 = top-level, 1+ = nested)
  const nestingLevel = (documentContext as any)?.nestingLevel ?? 0;
  const isTopLevel = nestingLevel === 0;

  const lastValidatedValue = useRef(value);
  // For nested arrays (level 1+), default to expanded for better UX
  const defaultCollapsed = isTopLevel ? true : (arrayDefinition.options?.collapsed ?? false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [newItemInput, setNewItemInput] = useState('');
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Tag autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  // List item autocomplete state (per-item)
  const [listItemSuggestions, setListItemSuggestions] = useState<{ index: number; show: boolean; selected: number }>({ index: -1, show: false, selected: -1 });
  const listInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  // Ensure value is always an array
  const arrayValue = Array.isArray(value) ? value : [];

  // Get options with defaults
  const {
    layout = 'list',
    sortable = true,
    insertAppend = true,
    showCount = true,
    addButtonText = 'Add item',
    disableAdd = false,
    disableRemove = false,
    tagField = {},
    selectField = {}
  } = arrayDefinition.options || {};

  // Validate on value change
  useEffect(() => {
    // Only validate if the value actually changed
    if (lastValidatedValue.current !== value && onValidationChange) {
      const validationResult = { isValid: true, errors: [] }; // Simplified validation
      onValidationChange(validationResult);
      lastValidatedValue.current = value;
    }
  }, [arrayValue, fieldId]);

  // Array operations
  const operations: ArrayOperations = useMemo(() => ({
    add: (item: any, index?: number) => {
      const newArray = [...arrayValue];
      const targetIndex = index !== undefined ? index : (insertAppend ? newArray.length : 0);
      newArray.splice(targetIndex, 0, item);
      onChange(newArray);
    },

    remove: (index: number) => {
      const newArray = arrayValue.filter((_, i) => i !== index);
      onChange(newArray);
    },

    move: (fromIndex: number, toIndex: number) => {
      const newArray = [...arrayValue];
      const [moved] = newArray.splice(fromIndex, 1);
      newArray.splice(toIndex, 0, moved);
      onChange(newArray);
    },

    update: (index: number, item: any) => {
      if (index >= 0 && index < arrayValue.length) {
        const newArray = [...arrayValue];
        newArray[index] = item;
        onChange(newArray);
      }
    },

    clear: () => {
      onChange([]);
    },

    toggle: (item: any) => {
      // For compatibility with ArrayOperations interface
      const exists = arrayValue.includes(item);
      if (exists) {
        const newArray = arrayValue.filter(v => v !== item);
        onChange(newArray);
      } else {
        const newArray = [...arrayValue];
        const targetIndex = insertAppend ? newArray.length : 0;
        newArray.splice(targetIndex, 0, item);
        onChange(newArray);
      }
    }
  }), [arrayValue, insertAppend, onChange]);

  // Handle add new item
  const handleAddItem = useCallback(() => {
    // Access the 'of' property from the raw definition since it's not in the TypeScript interface
    const itemDef = (arrayDefinition as any).of || { type: 'string' };
    const defaultValue = getDefaultItemValue(itemDef);
    operations.add(defaultValue);
  }, [operations, arrayDefinition]);

  // Get tagField options (tagField already destructured from options above)
  const suggestions = tagField.suggestions || [];
  const allowCustom = tagField.allowCustom !== false; // Default to true

  // Filter suggestions based on input and already selected values
  const filteredSuggestions = useMemo(() => {
    if (!suggestions.length) return [];
    const input = newItemInput.toLowerCase().trim();
    return suggestions.filter(suggestion => {
      // Exclude already selected values
      if (arrayValue.includes(suggestion)) return false;
      // If no input, show all available
      if (!input) return true;
      // Filter by input
      return suggestion.toLowerCase().includes(input);
    });
  }, [suggestions, newItemInput, arrayValue]);

  // Filter suggestions for list item (excludes current value but includes it in suggestions)
  const getListItemSuggestions = useCallback((currentValue: string, index: number) => {
    if (!suggestions.length) return [];
    const input = (currentValue || '').toLowerCase().trim();
    return suggestions.filter(suggestion => {
      // Exclude other selected values (but not the current one)
      const otherValues = arrayValue.filter((_, i) => i !== index);
      if (otherValues.includes(suggestion)) return false;
      // If no input, show all available
      if (!input) return true;
      // Filter by input
      return suggestion.toLowerCase().includes(input);
    });
  }, [suggestions, arrayValue]);

  // Handle add tag (for tags layout)
  const handleAddTag = useCallback((tagToAdd?: string) => {
    const tag = (tagToAdd || newItemInput).trim();
    if (!tag) return;

    // Check if already exists
    if (arrayValue.includes(tag)) return;

    // Check allowCustom - if false, must be in suggestions
    if (!allowCustom && suggestions.length > 0 && !suggestions.includes(tag)) {
      return; // Don't add custom tags when not allowed
    }

    operations.add(tag);
    setNewItemInput('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  }, [newItemInput, arrayValue, operations, allowCustom, suggestions]);

  // Handle tag input key press
  const handleTagKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && selectedSuggestionIndex >= 0 && filteredSuggestions[selectedSuggestionIndex]) {
        handleAddTag(filteredSuggestions[selectedSuggestionIndex]);
      } else {
        handleAddTag();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredSuggestions.length > 0) {
        setShowSuggestions(true);
        setSelectedSuggestionIndex(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredSuggestions.length > 0) {
        setShowSuggestions(true);
        setSelectedSuggestionIndex(prev =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  }, [handleAddTag, showSuggestions, selectedSuggestionIndex, filteredSuggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        tagInputRef.current &&
        !tagInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Render array header
  const renderHeader = () => (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center text-base sm:text-sm font-medium text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-dark-text-primary min-h-[44px] py-2"
        >
          {isCollapsed ? (
            <ChevronRightIcon className="h-4 w-4 mr-1" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 mr-1" />
          )}
          {arrayDefinition.title}
          {showCount && (
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              ({arrayValue.length} item{arrayValue.length !== 1 ? 's' : ''})
            </span>
          )}
        </button>
      </div>

      {!isCollapsed && !isDisabled && !isReadonly && !disableAdd && layout !== 'tags' && layout !== 'select' && (
        <button
          type="button"
          onClick={handleAddItem}
          className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
        >
          <PlusIcon className="h-3 w-3 mr-1" />
          {addButtonText}
        </button>
      )}
    </div>
  );

  // Get preview text for an object item
  const getItemPreview = (item: any, itemDef: any): { title?: string; subtitle?: string } => {
    if (!item || typeof item !== 'object') {
      return {};
    }

    // If explicit preview config exists, use it
    if (itemDef?.preview) {
      const preview = itemDef.preview;
      const title = preview.title && item[preview.title] ? String(item[preview.title]) : undefined;
      const subtitle = preview.subtitle && item[preview.subtitle] ? String(item[preview.subtitle]) : undefined;
      if (title) {
        return { title, subtitle };
      }
    }

    // Auto-detect: try common field names for object items
    if (itemDef?.type === 'object') {
      const commonTitleFields = ['title', 'name', 'label', 'heading'];
      for (const field of commonTitleFields) {
        if (item[field]) {
          return { title: String(item[field]) };
        }
      }
    }

    return {};
  };

  // Render individual array item
  const renderItem = (item: any, index: number) => {
    // Access the 'of' property from the raw definition since it's not in the TypeScript interface
    const itemDefinition = (arrayDefinition as any).of;
    
    if (!itemDefinition) {
      return (
        <div key={index} className="p-3 border border-red-200 dark:border-red-700 rounded bg-red-50 dark:bg-red-900/20">
          <span className="text-red-700 dark:text-red-400 text-sm">Array field missing 'of' definition</span>
        </div>
      );
    }
    
    // For reference fields in arrays, ensure they are single-reference (not multi-reference)
    const adjustedItemDefinition = itemDefinition.type === 'reference' 
      ? {
          ...itemDefinition,
          validation: {
            ...itemDefinition.validation,
            multiple: false  // Array items should be single references
          }
        }
      : itemDefinition;
    
    const fieldPlugin = fieldRegistry.get(adjustedItemDefinition.type);
    
    if (!fieldPlugin) {
      return (
        <div key={index} className="p-3 border border-red-200 dark:border-red-700 rounded bg-red-50 dark:bg-red-900/20">
          <span className="text-red-700 dark:text-red-400 text-sm">Unknown field type: {adjustedItemDefinition.type}</span>
          <div className="text-xs text-red-600 dark:text-red-400 mt-1">
            Available types: {fieldRegistry.getTypes().join(', ')}
          </div>
        </div>
      );
    }

    const FieldComponent = fieldPlugin.component;
    const itemHasError = !!itemErrors[index];
    const isDropTarget = dropTargetIndex === index && draggedIndex !== index;
    const showDropAbove = isDropTarget && draggedIndex !== null && draggedIndex > index;
    const showDropBelow = isDropTarget && draggedIndex !== null && draggedIndex < index;

    // Get preview for object items
    const itemPreview = getItemPreview(item, itemDefinition);

    return (
      <div key={index}>
        {/* Drop zone indicator - above item */}
        {showDropAbove && (
          <div className="h-10 bg-gray-100 dark:bg-gray-700/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg mb-3" />
        )}

        <div
          className={`group flex items-center gap-2 bg-white dark:bg-gray-800 border rounded-lg transition-all ${
            itemHasError
              ? 'border-red-300 dark:border-red-600'
              : draggedIndex === index
                ? 'border-blue-400 dark:border-blue-500 opacity-50 shadow-lg scale-[1.02]'
                : isDropTarget
                  ? 'border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          }`}
          draggable={sortable && !isDisabled && !isReadonly}
          onDragStart={(e) => {
            setDraggedIndex(index);
            // Set drag image and constrain visual feedback
            if (e.currentTarget) {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(index));
            }
          }}
          onDragEnd={() => {
            setDraggedIndex(null);
            setDropTargetIndex(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (draggedIndex !== null && draggedIndex !== index) {
              setDropTargetIndex(index);
            }
          }}
          onDragLeave={(e) => {
            // Only clear if we're leaving the element entirely
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDropTargetIndex(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (draggedIndex !== null && draggedIndex !== index) {
              operations.move(draggedIndex, index);
            }
            setDropTargetIndex(null);
          }}
        >
          {/* Drag handle - always visible when sortable */}
          {sortable && !isDisabled && !isReadonly && (
            <div className="flex-shrink-0 pl-2 py-3 cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
              <GripVerticalIcon className="h-4 w-4" />
            </div>
          )}

          {/* Field component */}
          <div className={`flex-1 py-2 ${sortable ? 'pr-2' : 'px-3'} ${!sortable ? 'pl-3' : ''}`}>
            {/* Custom autocomplete input for string items with suggestions */}
            {adjustedItemDefinition.type === 'string' && suggestions.length > 0 ? (
              <div className="relative">
                <input
                  ref={(el) => {
                    if (el) listInputRefs.current.set(index, el);
                    else listInputRefs.current.delete(index);
                  }}
                  type="text"
                  value={item || ''}
                  onChange={(e) => {
                    operations.update(index, e.target.value);
                    setListItemSuggestions({ index, show: true, selected: -1 });
                  }}
                  onFocus={() => {
                    const itemSuggestions = getListItemSuggestions(item, index);
                    if (itemSuggestions.length > 0) {
                      setListItemSuggestions({ index, show: true, selected: -1 });
                    }
                  }}
                  onBlur={() => {
                    // Delay to allow click on suggestion
                    setTimeout(() => {
                      setListItemSuggestions({ index: -1, show: false, selected: -1 });
                    }, 150);
                  }}
                  onKeyDown={(e) => {
                    const itemSuggestions = getListItemSuggestions(item, index);
                    if (e.key === 'ArrowDown' && itemSuggestions.length > 0) {
                      e.preventDefault();
                      setListItemSuggestions(prev => ({
                        ...prev,
                        show: true,
                        selected: prev.selected < itemSuggestions.length - 1 ? prev.selected + 1 : 0
                      }));
                    } else if (e.key === 'ArrowUp' && itemSuggestions.length > 0) {
                      e.preventDefault();
                      setListItemSuggestions(prev => ({
                        ...prev,
                        show: true,
                        selected: prev.selected > 0 ? prev.selected - 1 : itemSuggestions.length - 1
                      }));
                    } else if (e.key === 'Enter' && listItemSuggestions.show && listItemSuggestions.selected >= 0) {
                      e.preventDefault();
                      const selected = itemSuggestions[listItemSuggestions.selected];
                      if (selected) {
                        operations.update(index, selected);
                        setListItemSuggestions({ index: -1, show: false, selected: -1 });
                      }
                    } else if (e.key === 'Escape') {
                      setListItemSuggestions({ index: -1, show: false, selected: -1 });
                    }
                  }}
                  disabled={isDisabled}
                  readOnly={isReadonly}
                  className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                    itemHasError ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {/* Suggestions dropdown */}
                {listItemSuggestions.show && listItemSuggestions.index === index && (() => {
                  const itemSuggestions = getListItemSuggestions(item, index);
                  return itemSuggestions.length > 0 ? (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {itemSuggestions.map((suggestion, sIndex) => (
                        <button
                          key={suggestion}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            operations.update(index, suggestion);
                            setListItemSuggestions({ index: -1, show: false, selected: -1 });
                          }}
                          onMouseEnter={() => setListItemSuggestions(prev => ({ ...prev, selected: sIndex }))}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            sIndex === listItemSuggestions.selected
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            ) : (
              <FieldComponent
                fieldId={`${fieldId}.${index}`}
                value={item}
                onChange={(newValue: any) => operations.update(index, newValue)}
                definition={{
                  ...adjustedItemDefinition,
                  // Pass preview info for ObjectField to display
                  _arrayItemPreview: itemPreview.title ? itemPreview : undefined
                }}
                hasError={itemHasError}
                isDisabled={isDisabled}
                isReadonly={isReadonly}
                documentContext={documentContext ? {
                  ...documentContext,
                  nestingLevel: nestingLevel + 1  // Increment nesting level for child fields
                } : undefined}
                studioContext={props.studioContext}
                onValidationChange={(result) => {
                  // Handle nested field validation
                  if (!result.isValid) {
                    setItemErrors(prev => ({ ...prev, [index]: result.errors[0] || 'Validation failed' }));
                  } else {
                    setItemErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors[index];
                      return newErrors;
                    });
                  }
                }}
                onFocus={() => {}}
                onBlur={() => {}}
              />
            )}
          </div>

          {/* Remove button */}
          {!isDisabled && !isReadonly && !disableRemove && adjustedItemDefinition.type !== 'reference' && (
            <button
              type="button"
              onClick={() => operations.remove(index)}
              className="flex-shrink-0 p-2 mr-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove item"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Drop zone indicator - below item */}
        {showDropBelow && (
          <div className="h-10 bg-gray-100 dark:bg-gray-700/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg mt-3" />
        )}
      </div>
    );
  };

  // Render tags layout
  const renderTagsLayout = () => (
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
                      if (window.confirm(`Remove tag "${tag}"?`)) {
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
                placeholder={tagField.placeholder || 'Add tag...'}
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
                  No matching options
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleAddTag()}
              disabled={!newItemInput.trim() || (!allowCustom && suggestions.length > 0 && !suggestions.includes(newItemInput.trim()))}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Add
            </button>
          </div>

          {/* Available suggestions hint */}
          {suggestions.length > 0 && arrayValue.length === 0 && !newItemInput && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {allowCustom ? 'Type to search or add custom tags' : 'Select from available options'}
            </p>
          )}
        </div>
      )}
    </div>
  );

  // Render select layout (checkboxes or pills for multi-selection)
  const renderSelectLayout = () => {
    const selectOptions = (selectField as { options?: string[]; displayAs?: 'checkboxes' | 'pills' | 'dropdown'; columns?: 1 | 2 | 3 | 4; dropdownSize?: number });
    const options = selectOptions.options || [];
    const displayAs = selectOptions.displayAs || 'checkboxes';
    const columns = selectOptions.columns || 2;
    const dropdownSize = selectOptions.dropdownSize || 6;

    if (options.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500 dark:text-gray-400">
          <p className="text-sm">No options configured for select layout</p>
        </div>
      );
    }

    const handleToggle = (option: string) => {
      if (isDisabled || isReadonly) return;
      operations.toggle(option);
    };

    if (displayAs === 'pills') {
      return (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const isSelected = arrayValue.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleToggle(option)}
                disabled={isDisabled || isReadonly}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                } ${isDisabled || isReadonly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    }

    if (displayAs === 'dropdown') {
      const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
        onChange(selectedOptions);
      };

      return (
        <div className="w-full">
          <select
            multiple
            size={dropdownSize}
            value={arrayValue}
            onChange={handleSelectChange}
            disabled={isDisabled || isReadonly}
            className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
              isDisabled || isReadonly ? 'opacity-50 cursor-not-allowed' : ''
            } ${hasError ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'}`}
          >
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Hold Ctrl/Cmd to select multiple
          </p>
        </div>
      );
    }

    // Checkboxes layout
    const gridCols = {
      1: 'grid-cols-1',
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    };

    return (
      <div className={`grid ${gridCols[columns]} gap-2`}>
        {options.map((option) => {
          const isSelected = arrayValue.includes(option);
          return (
            <label
              key={option}
              className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              } ${isDisabled || isReadonly ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggle(option)}
                disabled={isDisabled || isReadonly}
                className="h-4 w-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 dark:bg-gray-700"
              />
              <span className={`text-sm ${
                isSelected
                  ? 'text-blue-700 dark:text-blue-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300'
              }`}>
                {option}
              </span>
            </label>
          );
        })}
      </div>
    );
  };

  // Render list/grid layout
  const renderItemsLayout = () => {
    if (arrayValue.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No items added yet</p>
          {!isDisabled && !isReadonly && !disableAdd && (
            <button
              type="button"
              onClick={handleAddItem}
              className="mt-2 inline-flex items-center px-3 py-3 sm:py-2 text-base sm:text-sm text-blue-600 hover:text-blue-800 min-h-[44px]"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Add first item
            </button>
          )}
        </div>
      );
    }

    const containerClass = layout === 'grid'
      ? 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : 'space-y-3';

    return (
      <div className={containerClass}>
        {arrayValue.map(renderItem)}
      </div>
    );
  };

  // Render top-level card (for nestingLevel 0)
  const renderTopLevelCard = () => {
    return (
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        disabled={isDisabled || isReadonly}
        className={`w-full text-left border border-gray-300 dark:border-gray-600 rounded-md p-4 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${
          hasError ? 'border-red-300 dark:border-red-600' : ''
        } ${isDisabled || isReadonly ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChevronRightIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                {arrayDefinition.title}
              </h3>
              {arrayDefinition.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {arrayDefinition.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>
              {arrayValue.length} item{arrayValue.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </button>
    );
  };

  // Main render - Conditional based on nesting level
  if (isTopLevel) {
    // Top-level: Show collapsed card + modal
    return (
      <>
        {renderTopLevelCard()}
        <ArrayModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          definition={arrayDefinition}
          value={arrayValue}
          renderContent={() => (
            <div className="space-y-4">
              {/* Add button at top of modal */}
              {!isDisabled && !isReadonly && !disableAdd && layout !== 'tags' && layout !== 'select' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
                  >
                    <PlusIcon className="h-3 w-3 mr-1" />
                    {addButtonText}
                  </button>
                </div>
              )}

              {/* Array content */}
              {layout === 'tags' ? renderTagsLayout() : layout === 'select' ? renderSelectLayout() : renderItemsLayout()}

              {/* Validation info */}
              {arrayDefinition.validation && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {arrayDefinition.validation.minItems && arrayDefinition.validation.maxItems && (
                    <span>
                      {arrayDefinition.validation.minItems} - {arrayDefinition.validation.maxItems} items
                    </span>
                  )}
                  {arrayDefinition.validation.minItems && !arrayDefinition.validation.maxItems && (
                    <span>
                      Minimum {arrayDefinition.validation.minItems} item{arrayDefinition.validation.minItems !== 1 ? 's' : ''}
                    </span>
                  )}
                  {!arrayDefinition.validation.minItems && arrayDefinition.validation.maxItems && (
                    <span>
                      Maximum {arrayDefinition.validation.maxItems} item{arrayDefinition.validation.maxItems !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        />
      </>
    );
  }

  // Nested level 1+: Show traditional accordion behavior
  return (
    <div className="array-field border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      {renderHeader()}

      {!isCollapsed && (
        <div className={`space-y-4 ${hasError ? 'border-l-4 border-red-400 dark:border-red-500 pl-4' : ''}`}>
          {layout === 'tags' ? renderTagsLayout() : layout === 'select' ? renderSelectLayout() : renderItemsLayout()}
        </div>
      )}

      {/* Validation info */}
      {arrayDefinition.validation && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {arrayDefinition.validation.minItems && arrayDefinition.validation.maxItems && (
            <span>
              {arrayDefinition.validation.minItems} - {arrayDefinition.validation.maxItems} items
            </span>
          )}
          {arrayDefinition.validation.minItems && !arrayDefinition.validation.maxItems && (
            <span>
              Minimum {arrayDefinition.validation.minItems} item{arrayDefinition.validation.minItems !== 1 ? 's' : ''}
            </span>
          )}
          {!arrayDefinition.validation.minItems && arrayDefinition.validation.maxItems && (
            <span>
              Maximum {arrayDefinition.validation.maxItems} item{arrayDefinition.validation.maxItems !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Helper function to get default value for new items
function getDefaultItemValue(itemDefinition: any): any {
  if (itemDefinition?.default !== undefined) {
    return itemDefinition.default;
  }

  switch (itemDefinition?.type) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'date':
      return new Date().toISOString();
    case 'array':
      return [];
    case 'object':
      // Include _type field for object items if specified
      const baseObject: any = {};
      if (itemDefinition.name) {
        baseObject._type = itemDefinition.name;
      }
      return baseObject;
    case 'reference':
      return undefined; // ReferenceField expects undefined for empty state
    default:
      return null;
  }
}