import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { ArrayFieldDefinition, ArrayOperations } from './definition.js';
import { fieldRegistry } from '../../registry/index.js';

// Simple SVG icons inline to avoid external dependencies
const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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

const Bars3Icon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
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
  
  const lastValidatedValue = useRef(value);
  const [isCollapsed, setIsCollapsed] = useState(arrayDefinition.options?.collapsed || false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [newItemInput, setNewItemInput] = useState('');
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});

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
    tagField = {}
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

  // Handle add tag (for tags layout)
  const handleAddTag = useCallback(() => {
    if (newItemInput.trim() && !arrayValue.includes(newItemInput.trim())) {
      operations.add(newItemInput.trim());
      setNewItemInput('');
    }
  }, [newItemInput, arrayValue, operations]);

  // Handle tag input key press
  const handleTagKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  }, [handleAddTag]);

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

      {!isCollapsed && !isDisabled && !isReadonly && !disableAdd && layout !== 'tags' && (
        <button
          type="button"
          onClick={handleAddItem}
          className="inline-flex items-center px-3 py-3 sm:py-2 text-base sm:text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
        >
          <PlusIcon className="h-3 w-3 mr-1" />
          {addButtonText}
        </button>
      )}
    </div>
  );

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

    return (
      <div
        key={index}
        className={`group relative bg-white dark:bg-gray-800 border rounded-lg p-3 transition-colors ${
          itemHasError ? 'border-red-300 dark:border-red-600' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        } ${draggedIndex === index ? 'opacity-50' : ''}`}
        draggable={sortable && !isDisabled && !isReadonly}
        onDragStart={() => setDraggedIndex(index)}
        onDragEnd={() => setDraggedIndex(null)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (draggedIndex !== null && draggedIndex !== index) {
            operations.move(draggedIndex, index);
          }
        }}
      >
        {/* Drag handle */}
        {sortable && !isDisabled && !isReadonly && (
          <div className="absolute left-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Bars3Icon className="h-5 w-5 text-gray-400 dark:text-gray-400 cursor-move" />
          </div>
        )}

        {/* Field component */}
        <div className={sortable ? 'ml-6' : ''}>
          <FieldComponent
            fieldId={`${fieldId}.${index}`}
            value={item}
            onChange={(newValue: any) => operations.update(index, newValue)}
            definition={adjustedItemDefinition}
            hasError={itemHasError}
            isDisabled={isDisabled}
            isReadonly={isReadonly}
            documentContext={documentContext}
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
        </div>

        {/* Remove button - hidden for reference fields to avoid UX confusion */}
        {!isDisabled && !isReadonly && !disableRemove && adjustedItemDefinition.type !== 'reference' && (
          <button
            type="button"
            onClick={() => operations.remove(index)}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-opacity"
            title="Remove item"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
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
                  className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100 p-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Add new tag input */}
      {!isDisabled && !isReadonly && !disableAdd && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newItemInput}
            onChange={(e) => setNewItemInput(e.target.value)}
            onKeyPress={handleTagKeyPress}
            placeholder={tagField.placeholder || 'Add tag...'}
            className="flex-1 px-3 py-3 sm:py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm min-h-[44px]"
          />
          <button
            type="button"
            onClick={handleAddTag}
            disabled={!newItemInput.trim()}
            className="px-3 py-3 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-base sm:text-sm min-h-[44px]"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );

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

  // Main render
  return (
    <div className="array-field border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      {renderHeader()}
      
      {!isCollapsed && (
        <div className={`space-y-4 ${hasError ? 'border-l-4 border-red-400 dark:border-red-500 pl-4' : ''}`}>
          {layout === 'tags' ? renderTagsLayout() : renderItemsLayout()}
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
      return {};
    case 'reference':
      return undefined; // ReferenceField expects undefined for empty state
    default:
      return null;
  }
}