import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { 
  ReferenceFieldDefinition,
  ReferenceValue,
  ReferenceSearchResult,
  ReferenceOperations
} from './definition.js';
import { 
  validateReferenceField,
  sanitizeReferenceValue,
  getDefaultReferenceValue,
  normalizeReferenceValue,
  getReferenceDisplayValue
} from './validation.js';

type ReferenceFieldComponentProps = FieldComponentProps;

export function ReferenceFieldComponent(props: ReferenceFieldComponentProps) {
  const { definition, value, onChange, hasError, fieldId, isDisabled, isReadonly } = props;
  
  if (definition.type !== 'reference') {
    return <div className="text-red-500 text-sm">Invalid field configuration: expected reference field</div>;
  }
  
  const referenceDefinition = definition as ReferenceFieldDefinition;
  const options = referenceDefinition.options || {};
  const validation = referenceDefinition.validation || {};
  
  const sanitizedValue = useMemo(() => 
    sanitizeReferenceValue(value), 
    [value]
  );
  
  const normalizedReferences = useMemo(() => 
    normalizeReferenceValue(sanitizedValue),
    [sanitizedValue]
  );
  
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ReferenceSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('');
  
  const isMultiple = validation.multiple || false;
  const currentReferences = normalizedReferences;
  
  // Get target types
  const targetTypes = useMemo(() => {
    const { to } = referenceDefinition;
    if (typeof to === 'string') {
      return [{ type: to, displayName: to }];
    }
    if (Array.isArray(to)) {
      return to.map(target => 
        typeof target === 'string' 
          ? { type: target, displayName: target }
          : { type: target.type, displayName: target.displayName || target.type, icon: target.icon }
      );
    }
    return [];
  }, [referenceDefinition.to]);
  
  // Reference operations
  const operations: ReferenceOperations = useMemo(() => ({
    addReference: (documentId: string, documentType: string) => {
      if (isMultiple) {
        const newRef: ReferenceValue = { _ref: documentId, _type: documentType };
        const newReferences = [...currentReferences, newRef];
        onChange(sanitizeReferenceValue(newReferences));
      } else {
        const newRef: ReferenceValue = { _ref: documentId, _type: documentType };
        onChange(sanitizeReferenceValue(newRef));
      }
      setIsSearchOpen(false);
    },
    
    removeReference: (documentId: string) => {
      if (isMultiple) {
        const newReferences = currentReferences.filter(ref => ref._ref !== documentId);
        onChange(sanitizeReferenceValue(newReferences.length > 0 ? newReferences : undefined));
      } else {
        onChange(undefined);
      }
    },
    
    setReference: (documentId: string, documentType: string) => {
      const newRef: ReferenceValue = { _ref: documentId, _type: documentType };
      onChange(sanitizeReferenceValue(newRef));
      setIsSearchOpen(false);
    },
    
    clear: () => {
      onChange(undefined);
    },
    
    reorderReferences: (fromIndex: number, toIndex: number) => {
      if (!isMultiple) return;
      
      const newReferences = [...currentReferences];
      const [movedRef] = newReferences.splice(fromIndex, 1);
      newReferences.splice(toIndex, 0, movedRef);
      onChange(sanitizeReferenceValue(newReferences));
    },
    
    searchDocuments: async (query: string, types?: string[]) => {
      setIsLoading(true);
      try {
        // Mock search implementation - replace with actual API call
        const mockResults: ReferenceSearchResult[] = [
          {
            id: '1',
            type: 'article',
            title: `Search result for "${query}"`,
            description: 'Mock search result',
            isSelected: currentReferences.some(ref => ref._ref === '1')
          }
        ];
        setSearchResults(mockResults);
        return mockResults;
      } catch (error) {
        console.error('Search failed:', error);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    
    getReferencedDocument: async (documentId: string) => {
      // Mock implementation - replace with actual API call
      return { id: documentId, title: 'Referenced Document' };
    }
  }), [currentReferences, isMultiple, onChange]);
  
  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const types = selectedTypeFilter ? [selectedTypeFilter] : targetTypes.map(t => t.type);
      operations.searchDocuments(query, types);
    } else {
      setSearchResults([]);
    }
  }, [selectedTypeFilter, targetTypes, operations]);
  
  // Render single reference item
  const renderReferenceItem = (ref: ReferenceValue, index: number) => {
    const displayValue = getReferenceDisplayValue(ref, options.displayField);
    const targetType = targetTypes.find(t => t.type === ref._type);
    
    return (
      <div
        key={ref._ref}
        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md border"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {targetType?.icon && (
            <span className="text-gray-400">{targetType.icon}</span>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {displayValue}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {targetType?.displayName || ref._type} • {ref._ref}
            </p>
          </div>
        </div>
        
        {!isDisabled && !isReadonly && (
          <div className="flex items-center gap-1">
            {isMultiple && options.sortable && (
              <button
                type="button"
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Drag to reorder"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
              </button>
            )}
            
            <button
              type="button"
              onClick={() => operations.removeReference(ref._ref)}
              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              title="Remove reference"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  };
  
  // Render search results
  const renderSearchResults = () => {
    if (!isSearchOpen) return null;
    
    return (
      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-64 overflow-y-auto">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={options.searchPlaceholder || 'Search documents...'}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              autoFocus
            />
            
            {targetTypes.length > 1 && (
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="">All types</option>
                {targetTypes.map(type => (
                  <option key={type.type} value={type.type}>
                    {type.displayName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        
        <div className="max-h-48 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              Searching...
            </div>
          ) : searchResults.length > 0 ? (
            searchResults.map(result => (
              <button
                key={result.id}
                type="button"
                onClick={() => {
                  if (isMultiple) {
                    operations.addReference(result.id, result.type);
                  } else {
                    operations.setReference(result.id, result.type);
                  }
                }}
                disabled={result.isSelected}
                className={`
                  w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0
                  ${result.isSelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {result.title}
                    </p>
                    {result.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {result.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {result.type} • {result.id}
                    </p>
                  </div>
                  {result.isSelected && (
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            ))
          ) : searchQuery ? (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              No results found for "{searchQuery}"
            </div>
          ) : (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              Start typing to search documents
            </div>
          )}
        </div>
        
        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setIsSearchOpen(false)}
            className="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className={`reference-field ${hasError ? 'border-l-4 border-red-400 pl-4' : ''}`}>
      {/* Current references */}
      {currentReferences.length > 0 && (
        <div className="space-y-2 mb-3">
          {currentReferences.map((ref, index) => renderReferenceItem(ref, index))}
          
          {isMultiple && options.showCount && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
              {currentReferences.length} reference{currentReferences.length !== 1 ? 's' : ''}
              {validation.maxReferences && ` of ${validation.maxReferences} max`}
            </p>
          )}
        </div>
      )}
      
      {/* Add reference button */}
      {!isDisabled && !isReadonly && (
        <div className="relative">
          {(!isMultiple && currentReferences.length === 0) || (isMultiple && (!validation.maxReferences || currentReferences.length < validation.maxReferences)) ? (
            <button
              type="button"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {options.placeholder || 'Select reference...'}
              </div>
            </button>
          ) : null}
          
          {renderSearchResults()}
        </div>
      )}
      
      {/* Actions */}
      {!isDisabled && !isReadonly && currentReferences.length > 0 && (
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={operations.clear}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}