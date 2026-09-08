import { useState, useRef, useEffect } from 'react';
import { useT } from '@trokky/trokky/i18n';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { ArrayFieldDefinition } from './definition.js';
import { FieldDrawer } from '../../components/FieldDrawer.js';
import { getItemKey } from '@/components/document/savePayload.js';
import { PlusIcon, ChevronDownIcon, ChevronRightIcon } from './icons.js';
import { useArrayOperations } from './useArrayOperations.js';
import { useTagAutocomplete } from './useTagAutocomplete.js';
import { ArrayItemRow } from './ArrayItemRow.js';
import { ArrayTagsLayout } from './ArrayTagsLayout.js';
import { ArraySelectLayout } from './ArraySelectLayout.js';
import { ArrayValidationInfo } from './ArrayValidationInfo.js';

// Array field component
export function ArrayFieldComponent(props: FieldComponentProps) {
  const { t } = useT('fields');
  const {
    fieldId,
    value,
    onChange,
    definition,
    hasError,
    isDisabled = false,
    isReadonly = false,
    documentContext,
    onValidationChange
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
  // Per-item state is keyed by the item's stable `_key`, so it follows the item
  // across reorders and removals instead of sticking to a position
  const [itemErrors, setItemErrors] = useState<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const itemsContainerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  // Ensure value is always an array and filter out null/undefined values
  const arrayValue = Array.isArray(value) ? value.filter(item => item !== null && item !== undefined) : [];

  // Get options with defaults
  const {
    layout = 'list',
    sortable = true,
    insertAppend = true,
    showCount = true,
    addButtonText,
    disableAdd = false,
    disableRemove = false,
    tagField = {},
    selectField = {}
  } = arrayDefinition.options || {};

  // Null/undefined values are normalised locally in `arrayValue` above; never
  // emit onChange from an effect just to sanitize the incoming value.

  // Validate on value change
  useEffect(() => {
    // Only validate if the value actually changed
    if (lastValidatedValue.current !== value && onValidationChange) {
      const validationResult = { isValid: true, errors: [] }; // Simplified validation
      onValidationChange(validationResult);
      lastValidatedValue.current = value;
    }
  }, [arrayValue, fieldId, onValidationChange]);

  const { operations, handleAddItem } = useArrayOperations({
    arrayValue,
    insertAppend,
    onChange,
    arrayDefinition,
  });

  // Auto-scroll to newly added item
  useEffect(() => {
    // Skip scroll on initial mount (prevLengthRef starts at 0)
    if (prevLengthRef.current > 0 && arrayValue.length > prevLengthRef.current && itemsContainerRef.current) {
      // Item was added - scroll to the last item
      const container = itemsContainerRef.current;
      const lastItem = container.lastElementChild as HTMLElement;
      if (lastItem) {
        // Use setTimeout to ensure the DOM has updated
        setTimeout(() => {
          lastItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    }
    prevLengthRef.current = arrayValue.length;
  }, [arrayValue.length]);

  const {
    suggestions,
    allowCustom,
    filteredSuggestions,
    getListItemSuggestions,
    handleAddTag,
    handleTagKeyPress,
    newItemInput,
    setNewItemInput,
    showSuggestions,
    setShowSuggestions,
    selectedSuggestionIndex,
    setSelectedSuggestionIndex,
    tagInputRef,
    suggestionsRef,
    listItemSuggestions,
    setListItemSuggestions,
    listInputRefs,
  } = useTagAutocomplete({ arrayValue, operations, tagField });

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
              ({t('types.array.itemCount', { count: arrayValue.length })})
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
          {addButtonText || t('types.array.addItem')}
        </button>
      )}
    </div>
  );

  // Render individual array item
  const renderItem = (item: any, index: number) => (
    <ArrayItemRow
      key={getItemKey(item, index)}
      item={item}
      index={index}
      itemKey={getItemKey(item, index)}
      fieldId={fieldId}
      arrayValue={arrayValue}
      arrayDefinition={arrayDefinition}
      operations={operations}
      suggestions={suggestions}
      getListItemSuggestions={getListItemSuggestions}
      listItemSuggestions={listItemSuggestions}
      setListItemSuggestions={setListItemSuggestions}
      listInputRefs={listInputRefs}
      itemErrors={itemErrors}
      setItemErrors={setItemErrors}
      draggedIndex={draggedIndex}
      setDraggedIndex={setDraggedIndex}
      dropTargetIndex={dropTargetIndex}
      setDropTargetIndex={setDropTargetIndex}
      sortable={sortable}
      disableRemove={disableRemove}
      isDisabled={isDisabled}
      isReadonly={isReadonly}
      nestingLevel={nestingLevel}
      documentContext={documentContext}
      studioContext={props.studioContext}
    />
  );

  // Render tags layout
  const renderTagsLayout = () => (
    <ArrayTagsLayout
      arrayValue={arrayValue}
      operations={operations}
      tagField={tagField}
      suggestions={suggestions}
      allowCustom={allowCustom}
      newItemInput={newItemInput}
      setNewItemInput={setNewItemInput}
      showSuggestions={showSuggestions}
      setShowSuggestions={setShowSuggestions}
      selectedSuggestionIndex={selectedSuggestionIndex}
      setSelectedSuggestionIndex={setSelectedSuggestionIndex}
      filteredSuggestions={filteredSuggestions}
      handleAddTag={handleAddTag}
      handleTagKeyPress={handleTagKeyPress}
      tagInputRef={tagInputRef}
      suggestionsRef={suggestionsRef}
      isDisabled={isDisabled}
      isReadonly={isReadonly}
      disableAdd={disableAdd}
      disableRemove={disableRemove}
    />
  );

  // Render select layout (checkboxes or pills for multi-selection)
  const renderSelectLayout = () => (
    <ArraySelectLayout
      arrayValue={arrayValue}
      operations={operations}
      onChange={onChange}
      selectField={selectField}
      hasError={hasError}
      isDisabled={isDisabled}
      isReadonly={isReadonly}
    />
  );

  // Render list/grid layout
  const renderItemsLayout = () => {
    if (arrayValue.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">{t('types.array.empty')}</p>
          {!isDisabled && !isReadonly && !disableAdd && (
            <button
              type="button"
              onClick={handleAddItem}
              className="mt-2 inline-flex items-center px-3 py-3 sm:py-2 text-base sm:text-sm text-blue-600 hover:text-blue-800 min-h-[44px]"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              {t('types.array.addFirstItem')}
            </button>
          )}
        </div>
      );
    }

    const containerClass = layout === 'grid'
      ? 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      : 'space-y-3';

    return (
      <div ref={itemsContainerRef} className={containerClass}>
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
        className={`w-full text-left border rounded-md p-4 transition-colors cursor-pointer ${
          isModalOpen
            ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : hasError
              ? 'border-red-300 dark:border-red-600'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
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
              {t('types.array.itemCount', { count: arrayValue.length })}
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
        <FieldDrawer
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={arrayDefinition.title || t('types.array.label')}
          subtitle={`(${t('types.array.itemCount', { count: arrayValue.length })})`}
        >
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
                    {addButtonText || t('types.array.addItem')}
                  </button>
                </div>
              )}

              {/* Array content */}
              {layout === 'tags' ? renderTagsLayout() : layout === 'select' ? renderSelectLayout() : renderItemsLayout()}

              {/* Footer with Add button and validation info */}
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                {/* Add item button at bottom - same conditions as top button */}
                {!isDisabled && !isReadonly && !disableAdd && layout !== 'tags' && layout !== 'select' && arrayValue.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
                  >
                    <PlusIcon className="h-3 w-3 mr-1" />
                    {addButtonText || t('types.array.addItem')}
                  </button>
                )}
                {/* Spacer when no add button */}
                {(isDisabled || isReadonly || disableAdd || layout === 'tags' || layout === 'select' || arrayValue.length === 0) && <span />}

                {/* Validation info */}
                <ArrayValidationInfo validation={arrayDefinition.validation} />
              </div>
            </div>
        </FieldDrawer>
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

      {/* Footer with validation info and Add button */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        {/* Validation info - left side */}
        <ArrayValidationInfo validation={arrayDefinition.validation} />
        {/* Spacer when no validation */}
        {!arrayDefinition.validation && <span />}

        {/* Add item button - right side */}
        {!isDisabled && !isReadonly && !disableAdd && layout !== 'tags' && layout !== 'select' && arrayValue.length > 0 && (
          <button
            type="button"
            onClick={handleAddItem}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
          >
            <PlusIcon className="h-3 w-3 mr-1" />
            {addButtonText || t('types.array.addItem')}
          </button>
        )}
      </div>
    </div>
  );
}
