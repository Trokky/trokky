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
        className={`group relative bg-white dark:bg-gray-800 border rounded-lg p-5 transition-colors ${
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
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVerticalIcon className="h-5 w-5 text-gray-400 dark:text-gray-400 cursor-move" />
          </div>
        )}

        {/* Field component */}
        <div className={sortable ? 'ml-8 mr-8' : 'mr-8'}>
          <FieldComponent
            fieldId={`${fieldId}.${index}`}
            value={item}
            onChange={(newValue: any) => operations.update(index, newValue)}
            definition={adjustedItemDefinition}
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
        </div>

        {/* Remove button - hidden for reference fields to avoid UX confusion */}
        {!isDisabled && !isReadonly && !disableRemove && adjustedItemDefinition.type !== 'reference' && (
          <button
            type="button"
            onClick={() => operations.remove(index)}
            className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-opacity"
            title="Remove item"
          >
            <TrashIcon className="h-4 w-4" />
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
              {!isDisabled && !isReadonly && !disableAdd && layout !== 'tags' && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <PlusIcon className="h-3 w-3 mr-1" />
                    {addButtonText}
                  </button>
                </div>
              )}

              {/* Array content */}
              {layout === 'tags' ? renderTagsLayout() : renderItemsLayout()}

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