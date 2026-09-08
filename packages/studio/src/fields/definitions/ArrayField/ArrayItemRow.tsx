import React from 'react';
import { useT } from '@trokky/trokky/i18n';
import type { ArrayOperations } from './definition.js';
import { fieldRegistry } from '../../registry/index.js';
import { getItemPreview } from './itemPreview.js';
import { TrashIcon, GripVerticalIcon } from './icons.js';

interface ArrayItemRowProps {
  item: any;
  index: number;
  itemKey: string;
  fieldId?: string;
  arrayValue: any[];
  arrayDefinition: any;
  operations: ArrayOperations;
  suggestions: string[];
  getListItemSuggestions: (currentValue: string, index: number) => string[];
  listItemSuggestions: { index: number; show: boolean; selected: number };
  setListItemSuggestions: React.Dispatch<React.SetStateAction<{ index: number; show: boolean; selected: number }>>;
  listInputRefs: React.MutableRefObject<Map<number, HTMLInputElement>>;
  itemErrors: Record<string, string>;
  setItemErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  draggedIndex: number | null;
  setDraggedIndex: (index: number | null) => void;
  dropTargetIndex: number | null;
  setDropTargetIndex: (index: number | null) => void;
  sortable: boolean;
  disableRemove: boolean;
  isDisabled: boolean;
  isReadonly: boolean;
  nestingLevel: number;
  documentContext: any;
  studioContext: any;
}

/**
 * One row of the list or grid layout: the drag handle, the item's own field
 * component (or the autocomplete input for string items with suggestions) and
 * the remove button. Item state is keyed by `itemKey`, never by position.
 */
export function ArrayItemRow({
  item,
  index,
  itemKey,
  fieldId,
  arrayValue,
  arrayDefinition,
  operations,
  suggestions,
  getListItemSuggestions,
  listItemSuggestions,
  setListItemSuggestions,
  listInputRefs,
  itemErrors,
  setItemErrors,
  draggedIndex,
  setDraggedIndex,
  dropTargetIndex,
  setDropTargetIndex,
  sortable,
  disableRemove,
  isDisabled,
  isReadonly,
  nestingLevel,
  documentContext,
  studioContext,
}: ArrayItemRowProps) {
  const { t } = useT('fields');

    // Access the 'of' property from the raw definition since it's not in the TypeScript interface
    const itemDefinition = (arrayDefinition as any).of;

    if (!itemDefinition) {
      return (
        <div key={itemKey} className="p-3 border border-red-200 dark:border-red-700 rounded bg-red-50 dark:bg-red-900/20">
          <span className="text-red-700 dark:text-red-400 text-sm">{t('types.array.missingDefinition')}</span>
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

    // For reference fields, calculate excludeIds (all other reference IDs in the array)
    // This prevents selecting the same reference multiple times across array items
    const excludeIds: string[] = itemDefinition.type === 'reference'
      ? arrayValue
          .filter((_: any, i: number) => i !== index) // Exclude current item
          .map((ref: any) => ref?._ref || ref) // Get reference ID
          .filter((id: any) => id && typeof id === 'string' && id.trim()) // Filter out empty/invalid
      : [];

    const fieldPlugin = fieldRegistry.get(adjustedItemDefinition.type);
    
    if (!fieldPlugin) {
      return (
        <div key={itemKey} className="p-3 border border-red-200 dark:border-red-700 rounded bg-red-50 dark:bg-red-900/20">
          <span className="text-red-700 dark:text-red-400 text-sm">{t('types.array.unknownType', { type: adjustedItemDefinition.type })}</span>
          <div className="text-xs text-red-600 dark:text-red-400 mt-1">
            {t('types.array.availableTypes', { types: fieldRegistry.getTypes().join(', ') })}
          </div>
        </div>
      );
    }

    const FieldComponent = fieldPlugin.component;
    const itemHasError = !!itemErrors[itemKey];
    const isDropTarget = dropTargetIndex === index && draggedIndex !== index;
    const showDropAbove = isDropTarget && draggedIndex !== null && draggedIndex > index;
    const showDropBelow = isDropTarget && draggedIndex !== null && draggedIndex < index;

    // Get preview for object items
    const itemPreview = getItemPreview(item, itemDefinition);

    return (
      <div key={itemKey}>
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
          {/* Drag handle - only this element is draggable */}
          {sortable && !isDisabled && !isReadonly && (
            <div
              draggable={true}
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
              className="flex-shrink-0 pl-2 py-3 cursor-grab active:cursor-grabbing text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <GripVerticalIcon className="h-4 w-4" />
            </div>
          )}

          {/* Field component */}
          <div className={`flex-1 min-w-0 py-2 ${sortable ? 'pr-2' : 'px-3'} ${!sortable ? 'pl-3' : ''}`}>
            {/* Custom autocomplete input for string items with suggestions */}
            {adjustedItemDefinition.type === 'string' && suggestions.length > 0 ? (
              <div className="relative">
                <input
                  ref={(el) => {
                    if (el) {
                      listInputRefs.current.set(index, el);
                    } else {
                      listInputRefs.current.delete(index);
                    }
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
                isArrayItem={true}
                excludeIds={excludeIds}
                documentContext={documentContext ? {
                  ...documentContext,
                  nestingLevel: nestingLevel + 1  // Increment nesting level for child fields
                } : {
                  nestingLevel: nestingLevel + 1  // For arrays without parent context, start at level 1
                } as any}
                studioContext={studioContext}
                onValidationChange={(result) => {
                  // Handle nested field validation
                  if (!result.isValid) {
                    setItemErrors(prev => ({ ...prev, [itemKey]: result.errors[0] || 'Validation failed' }));
                  } else {
                    setItemErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors[itemKey];
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
          {!isDisabled && !isReadonly && !disableRemove && (
            <button
              type="button"
              onClick={() => operations.remove(index)}
              className="flex-shrink-0 p-2 mr-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title={t('types.array.removeItem')}
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
}
