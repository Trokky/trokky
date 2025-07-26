import React, { useState, useCallback, useMemo } from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { ArrayFieldDefinition, ArrayOperations, ArrayOption } from './definition.js';
import { 
  validateArrayAdd, 
  validateArrayRemove, 
  validateArrayMove,
  getDefaultItemValue,
  sanitizeArrayItem
} from './validation.js';

// Array field component props
type ArrayFieldComponentProps = FieldComponentProps;

export function ArrayFieldComponent(props: ArrayFieldComponentProps) {
  const { definition, value, onChange, hasError, fieldId, isDisabled, isReadonly } = props;
  
  // Type guard for array field definition
  if (definition.type !== 'array') {
    return <div className="text-red-500 text-sm">Invalid field configuration: expected array field</div>;
  }
  
  const arrayDefinition = definition as ArrayFieldDefinition;
  const options = arrayDefinition.options || {};
  
  // Ensure value is always an array
  const arrayValue = Array.isArray(value) ? value : [];
  
  // Local state - use fieldId to make state unique per field instance
  const [collapseState, setCollapseState] = useState<Record<string, boolean>>({});
  const isCollapsed = collapseState[fieldId] ?? (options.collapsed || false);
  const setIsCollapsed = (collapsed: boolean) => {
    setCollapseState(prev => ({ ...prev, [fieldId]: collapsed }));
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  
  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Layout and mode configuration
  const layout = options.layout || 'list';
  const mode = options.mode || 'multiple';
  const isSingleSelect = mode === 'single';
  
  // Array operations
  const operations: ArrayOperations = useMemo(() => ({
    add: (item: any, index?: number) => {
      const sanitizedItem = sanitizeArrayItem(item, arrayDefinition);
      const validation = validateArrayAdd(arrayValue, sanitizedItem, arrayDefinition, index);
      
      if (!validation.isValid) {
        console.error('Add validation failed:', validation.errors[0]);
        return;
      }
      
      const newArray = [...arrayValue];
      const insertIndex = index ?? (options.insertAppend ? newArray.length : 0);
      newArray.splice(insertIndex, 0, sanitizedItem);
      onChange(newArray);
    },
    
    remove: (index: number) => {
      const validation = validateArrayRemove(arrayValue, index, arrayDefinition);
      
      if (!validation.isValid) {
        console.error('Remove validation failed:', validation.errors[0]);
        return;
      }
      
      const newArray = arrayValue.filter((_, i) => i !== index);
      onChange(newArray);
    },
    
    move: (fromIndex: number, toIndex: number) => {
      const validation = validateArrayMove(arrayValue, fromIndex, toIndex);
      
      if (!validation.isValid) {
        console.error('Move validation failed:', validation.errors[0]);
        return;
      }
      
      const newArray = [...arrayValue];
      const [moved] = newArray.splice(fromIndex, 1);
      newArray.splice(toIndex, 0, moved);
      onChange(newArray);
    },
    
    update: (index: number, item: any) => {
      if (index >= 0 && index < arrayValue.length) {
        const sanitizedItem = sanitizeArrayItem(item, arrayDefinition);
        const newArray = [...arrayValue];
        newArray[index] = sanitizedItem;
        onChange(newArray);
      }
    },
    
    clear: () => {
      onChange([]);
    },
    
    toggle: (item: any) => {
      const sanitizedItem = sanitizeArrayItem(item, arrayDefinition);
      
      if (isSingleSelect) {
        // Single select: replace current selection
        onChange([sanitizedItem]);
      } else {
        // Multi select: toggle item in array
        const exists = arrayValue.includes(sanitizedItem);
        if (exists) {
          const newArray = arrayValue.filter(v => v !== sanitizedItem);
          onChange(newArray);
        } else {
          operations.add(sanitizedItem);
        }
      }
    }
  }), [arrayValue, arrayDefinition, options, onChange, isSingleSelect]);
  
  // Get available options for select-based layouts
  const availableOptions = arrayDefinition.options_list || [];
  
  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
  };
  
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      operations.move(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };
  
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };
  
  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm || !options.selectOptions?.searchable) {
      return availableOptions;
    }
    
    return availableOptions.filter(option =>
      option.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableOptions, searchTerm, options.selectOptions?.searchable]);
  
  // Render different layouts
  const renderContent = () => {
    switch (layout) {
      case 'select':
        return renderSelectLayout();
      case 'checkboxes':
        return renderCheckboxLayout();
      case 'radio':
        return renderRadioLayout();
      case 'tags':
        return renderTagsLayout();
      case 'list':
        return renderListLayout();
      case 'grid':
        return renderGridLayout();
      default:
        return renderListLayout();
    }
  };
  
  // Select dropdown layout
  const renderSelectLayout = () => {
    const selectOptions = options.selectOptions || {};
    const selectedValues = isSingleSelect ? arrayValue.slice(0, 1) : arrayValue;
    
    return (
      <div className="space-y-2">
        <select
          id={fieldId}
          multiple={!isSingleSelect}
          disabled={isDisabled}
          value={isSingleSelect ? (selectedValues[0] || '') : selectedValues}
          onChange={(e) => {
            const selectedOptions = Array.from(e.target.selectedOptions);
            const values = selectedOptions.map(opt => opt.value);
            onChange(isSingleSelect ? values.slice(0, 1) : values);
          }}
          aria-label={definition.title || 'Select options'}
          aria-describedby={definition.description ? `${fieldId}-description` : undefined}
          aria-invalid={hasError}
          aria-required={definition.required}
          className={`
            w-full px-3 py-2 border rounded-lg
            ${hasError ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}
            bg-white dark:bg-gray-700 text-gray-900 dark:text-white
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          style={{ maxHeight: selectOptions.maxHeight }}
        >
          {selectOptions.placeholder && (
            <option value="" disabled>
              {selectOptions.placeholder}
            </option>
          )}
          {filteredOptions.map((option) => (
            <option 
              key={option.value} 
              value={option.value}
              disabled={option.disabled}
            >
              {option.title}
              {selectOptions.showDescriptions && option.description && ` - ${option.description}`}
            </option>
          ))}
        </select>
        
        {/* Selected items display for multi-select */}
        {!isSingleSelect && (
          <div className="flex flex-wrap gap-2 mt-2">
            {/* Count pill as first special tag */}
            {options.showCount && selectedValues.length > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-600 text-white dark:bg-gray-700 dark:text-gray-200">
                {selectedValues.length} selected
              </span>
            )}
            
            {/* Selected value pills with better contrast */}
            {selectedValues.map((value, index) => {
              const option = availableOptions.find(opt => opt.value === value);
              return (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-600 text-white dark:bg-blue-500 dark:text-white shadow-sm"
                >
                  {option?.title || value}
                  {!isDisabled && !isReadonly && (
                    <button
                      type="button"
                      onClick={() => operations.remove(index)}
                      className="ml-1 text-blue-200 hover:text-white dark:text-blue-200 dark:hover:text-white"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  };
  
  // Checkbox group layout
  const renderCheckboxLayout = () => {
    return (
      <div className="space-y-2">
        {filteredOptions.map((option) => {
          const isChecked = arrayValue.includes(option.value);
          
          return (
            <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isChecked}
                disabled={isDisabled || isReadonly || option.disabled}
                onChange={() => operations.toggle(option.value)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {option.title}
                </div>
                {option.description && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {option.description}
                  </div>
                )}
              </div>
            </label>
          );
        })}
      </div>
    );
  };
  
  // Radio button layout (single select only)
  const renderRadioLayout = () => {
    const selectedValue = arrayValue[0];
    
    return (
      <div className="space-y-2">
        {filteredOptions.map((option) => (
          <label key={option.value} className="flex items-center space-x-3 cursor-pointer">
            <input
              type="radio"
              name={fieldId}
              value={option.value}
              checked={selectedValue === option.value}
              disabled={isDisabled || isReadonly || option.disabled}
              onChange={() => operations.toggle(option.value)}
              className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {option.title}
              </div>
              {option.description && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {option.description}
                </div>
              )}
            </div>
          </label>
        ))}
      </div>
    );
  };
  
  // Tags layout
  const renderTagsLayout = () => {
    const tagOptions = options.tagOptions || {};
    const maxTags = tagOptions.maxTags;
    const canAddMore = !maxTags || arrayValue.length < maxTags;
    
    const handleAddTag = () => {
      if (newTagInput.trim() && !arrayValue.includes(newTagInput.trim()) && canAddMore) {
        operations.add(newTagInput.trim());
        setNewTagInput('');
      }
    };
    
    const handleTagKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag();
      }
    };
    
    return (
      <div className="space-y-3">
        {/* Existing tags */}
        {arrayValue.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {arrayValue.map((tag, index) => (
              <span
                key={index}
                className={`
                  inline-flex items-center px-2 py-1 rounded-full text-xs font-medium shadow-sm
                  ${tagOptions.colorScheme === 'green' ? '!bg-green-700 !text-white dark:!bg-green-600 dark:!text-white' :
                    tagOptions.colorScheme === 'red' ? '!bg-red-700 !text-white dark:!bg-red-600 dark:!text-white' :
                    tagOptions.colorScheme === 'purple' ? '!bg-purple-700 !text-white dark:!bg-purple-600 dark:!text-white' :
                    tagOptions.colorScheme === 'gray' ? '!bg-gray-700 !text-white dark:!bg-gray-600 dark:!text-white' :
                    '!bg-blue-700 !text-white dark:!bg-blue-600 dark:!text-white'}
                `}
              >
                {tag}
                {!isDisabled && !isReadonly && (
                  <button
                    type="button"
                    onClick={() => operations.remove(index)}
                    className="ml-1 text-white/70 hover:text-white"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        
        {/* Tag input */}
        {!isDisabled && !isReadonly && canAddMore && (
          <div className="flex space-x-2">
            <input
              type="text"
              value={newTagInput}
              onChange={(e) => setNewTagInput(e.target.value)}
              onKeyPress={handleTagKeyPress}
              placeholder={tagOptions.placeholder}
              className={`
                flex-1 px-3 py-2 border rounded-lg
                ${hasError ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              `}
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!newTagInput.trim() || arrayValue.includes(newTagInput.trim())}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        )}
        
        {/* Suggestions */}
        {tagOptions.suggestions && tagOptions.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-gray-500 mr-2">Suggestions:</span>
            {tagOptions.suggestions
              .filter(suggestion => !arrayValue.includes(suggestion))
              .slice(0, 5)
              .map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => canAddMore && operations.add(suggestion)}
                  disabled={!canAddMore}
                  className="text-xs px-2 py-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded disabled:opacity-50"
                >
                  {suggestion}
                </button>
              ))}
          </div>
        )}
      </div>
    );
  };
  
  // List layout (basic implementation)
  const renderListLayout = () => {
    if (arrayValue.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No items added yet</p>
          {!isDisabled && !isReadonly && !options.disableAdd && (
            <button
              type="button"
              onClick={() => operations.add(getDefaultItemValue(arrayDefinition))}
              className="mt-2 inline-flex items-center px-3 py-2 text-sm text-blue-600 hover:text-blue-800"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {options.addButtonText || 'Add first item'}
            </button>
          )}
        </div>
      );
    }
    
    return (
      <div className="space-y-2">
        {arrayValue.map((item, index) => (
          <div 
            key={index} 
            className={`
              flex items-center space-x-2 p-3 border rounded-lg group transition-colors
              ${draggedIndex === index ? 'opacity-50 bg-blue-50 border-blue-300' : 'hover:border-blue-300'}
              ${dragOverIndex === index ? 'border-blue-500 bg-blue-50' : ''}
            `}
            draggable={options.sortable && !isDisabled && !isReadonly}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
          >
            {/* Drag handle */}
            {options.sortable && !isDisabled && !isReadonly && (
              <div
                className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Drag to reorder"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
              </div>
            )}
            
            <div className="flex-1">
              <span className="text-sm text-gray-900 dark:text-white">
                {typeof item === 'object' ? JSON.stringify(item) : String(item)}
              </span>
            </div>
            
            {!isDisabled && !isReadonly && !options.disableRemove && (
              <button
                type="button"
                onClick={() => operations.remove(index)}
                className="text-red-600 hover:text-red-800 p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        ))}
        
        {!isDisabled && !isReadonly && !options.disableAdd && (
          <button
            type="button"
            onClick={() => operations.add(getDefaultItemValue(arrayDefinition))}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-600"
          >
            <svg className="w-4 h-4 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {options.addButtonText || 'Add item'}
          </button>
        )}
      </div>
    );
  };
  
  // Grid layout (simplified)
  const renderGridLayout = () => {
    const gridCols = options.gridColumns || {};
    const gridClass = `grid gap-4 grid-cols-${gridCols.sm || 1} md:grid-cols-${gridCols.md || 2} lg:grid-cols-${gridCols.lg || 3}`;
    
    return (
      <div>
        <div className={gridClass}>
          {arrayValue.map((item, index) => (
            <div key={index} className="relative aspect-square border rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800 hover:border-blue-300 transition-colors">
              {/* Placeholder image representation */}
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900">
                <div className="text-center">
                  <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                    {typeof item === 'object' ? JSON.stringify(item) : String(item)}
                  </div>
                </div>
              </div>
              
              {/* Remove button */}
              {!isDisabled && !isReadonly && !options.disableRemove && (
                <button
                  type="button"
                  onClick={() => operations.remove(index)}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          
          {/* Add new item button */}
          {!isDisabled && !isReadonly && !options.disableAdd && (
            <div 
              onClick={() => operations.add(getDefaultItemValue(arrayDefinition))}
              className="aspect-square border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <div className="text-center">
                <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {options.addButtonText || 'Add item'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {options.showCount && layout !== 'select' && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({arrayValue.length} item{arrayValue.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        
        {(['checkboxes', 'radio', 'list', 'grid', 'tags'].includes(layout)) && (
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg 
              className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
      
      {/* Content */}
      {!isCollapsed && (
        <div className={hasError ? 'border-l-4 border-red-400 pl-4' : ''}>
          {renderContent()}
        </div>
      )}
      
      {/* Validation info */}
      {arrayDefinition.validation && layout !== 'select' && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {typeof arrayDefinition.validation.minItems === 'number' && typeof arrayDefinition.validation.maxItems === 'number' && (
            <span>
              {arrayValue.length} / {arrayDefinition.validation.maxItems} items ({arrayDefinition.validation.minItems} - {arrayDefinition.validation.maxItems} allowed)
            </span>
          )}
          {typeof arrayDefinition.validation.minItems === 'number' && typeof arrayDefinition.validation.maxItems !== 'number' && (
            <span>
              {arrayValue.length} items (minimum {arrayDefinition.validation.minItems})
            </span>
          )}
          {typeof arrayDefinition.validation.minItems !== 'number' && typeof arrayDefinition.validation.maxItems === 'number' && (
            <span>
              {arrayValue.length} / {arrayDefinition.validation.maxItems} items
            </span>
          )}
        </div>
      )}
    </div>
  );
}