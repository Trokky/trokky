import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useT } from '@trokky/trokky/i18n';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type {
  ReferenceFieldDefinition,
  ReferenceValue,
  ReferenceSearchResult,
  ReferenceOperations
} from './definition.js';
import {
  sanitizeReferenceValue,
  normalizeReferenceValue,
  getReferenceDisplayValue,
  getFilteredTypes
} from './validation.js';

// Performance optimization: LRU cache for search results
class SearchCache {
  private cache = new Map<string, { results: ReferenceSearchResult[], timestamp: number }>();
  private maxSize = 50;
  private ttl = 5 * 60 * 1000; // 5 minutes

  get(key: string): ReferenceSearchResult[] | null {
    const entry = this.cache.get(key);
    if (!entry || Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.results;
  }

  set(key: string, results: ReferenceSearchResult[]): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, { results, timestamp: Date.now() });
  }

  clear(): void {
    this.cache.clear();
  }
}

const globalSearchCache = new SearchCache();

type ReferenceFieldComponentProps = FieldComponentProps & {
  /** IDs to exclude from the dropdown (used by ArrayField to prevent duplicates across items) */
  excludeIds?: string[];
};

export function ReferenceFieldComponent(props: ReferenceFieldComponentProps) {
  const { t } = useT('fields');
  const { definition, value, onChange, hasError, isDisabled, isReadonly, studioContext, isArrayItem, excludeIds = [] } = props;

  if (definition.type !== 'reference') {
    return <div className="text-red-500 text-sm">{t('types.object.invalidConfig')}</div>;
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
  const [resolvedReferences, setResolvedReferences] = useState<ReferenceValue[]>([]);
  const [dropdownDirection, setDropdownDirection] = useState<'down' | 'up'>('down');
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [availableCount, setAvailableCount] = useState<number | null>(null);
  
  // Performance refs
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentSearchRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const isMultiple = validation.multiple || false;
  const allReferences = resolvedReferences.length > 0 ? resolvedReferences : normalizedReferences;
  // Filter out empty placeholder references (from array add item)
  const currentReferences = allReferences.filter(ref => !((ref as any)._empty) && ref._ref);
  
  // State for dynamically loaded document types (for universal references)
  const [availableDocumentTypes, setAvailableDocumentTypes] = useState<string[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);

  // Check if this is a universal reference (no `to` specified)
  const isUniversalReference = !referenceDefinition.to;

  // Load all document types for universal references
  useEffect(() => {
    if (!isUniversalReference) return;

    let mounted = true;
    const abortController = new AbortController();

    const loadDocumentTypes = async () => {
      const apiClient = studioContext?.apiClient || props.studioContext?.apiClient;
      if (!apiClient?.getSchemas || abortController.signal.aborted) return;

      setIsLoadingTypes(true);
      try {
        const response = await apiClient.getSchemas();
        if (abortController.signal.aborted || !mounted) return;

        if (response.success && response.data) {
          // Extract collection names from schemas with proper typing
          interface SchemaResponse {
            name?: string;
            type?: string;
          }
          const types = response.data
            .map((schema: SchemaResponse) => schema.name || schema.type)
            .filter((name: string | undefined): name is string => typeof name === 'string' && name.length > 0);
          setAvailableDocumentTypes(types);
        }
      } catch (error) {
        if (!abortController.signal.aborted && mounted) {
          console.warn('Failed to load document types for universal reference:', error);
        }
      } finally {
        if (!abortController.signal.aborted && mounted) {
          setIsLoadingTypes(false);
        }
      }
    };

    loadDocumentTypes();

    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [isUniversalReference]);

  // Target type structure
  interface TargetType {
    type: string;
    displayName: string;
    icon?: string;
    filter?: Record<string, any>;
  }

  // Get target types with filter support
  const targetTypes = useMemo((): TargetType[] => {
    const { to } = referenceDefinition;

    // Universal reference: use dynamically loaded types with filtering
    if (!to) {
      const filteredTypes = getFilteredTypes(referenceDefinition, availableDocumentTypes);
      return filteredTypes.map(type => ({
        type,
        displayName: type,
        icon: undefined,
        filter: undefined
      }));
    }

    // Typed reference: use explicit `to` types
    if (typeof to === 'string') {
      return [{ type: to, displayName: to, icon: undefined, filter: undefined }];
    }
    if (Array.isArray(to)) {
      return to.map(target =>
        typeof target === 'string'
          ? { type: target, displayName: target, icon: undefined, filter: undefined }
          : {
              type: target.type,
              displayName: target.displayName || target.type,
              icon: target.icon,
              filter: target.filter
            }
      );
    }
    return [];
  }, [referenceDefinition, availableDocumentTypes]);
  
  // Resolve references to display names
  useEffect(() => {
    const resolveReferences = async () => {
      // Filter out empty placeholder references (from array add item) before resolving
      const referencesToResolve = normalizedReferences.filter(ref =>
        ref._ref && ref._ref.trim() && !((ref as any)._empty) && ref._type !== 'reference'
      );

      if (!referencesToResolve.length || !props.studioContext?.apiClient) {
        setResolvedReferences([]);
        return;
      }

      try {
        const resolved = await Promise.all(
          referencesToResolve.map(async (ref) => {
            // Skip if already cached
            if (ref._cached) {
              return ref;
            }

            // Determine the correct type from target types or infer from ID
            let refType = ref._type;
            if (refType === 'unknown' && targetTypes.length > 0) {
              // Try to infer type from the reference ID or use target types
              if (targetTypes.length === 1) {
                refType = targetTypes[0].type;
              } else {
                // Try to infer from ID prefix (e.g., "author-xxx" -> "author")
                const idPrefix = ref._ref.split('-')[0];
                const matchingType = targetTypes.find(t => t.type === idPrefix);
                if (matchingType) {
                  refType = matchingType.type;
                } else {
                  // Fallback to first target type
                  refType = targetTypes[0].type;
                }
              }
            }

            try {
              const response = await props.studioContext!.apiClient.getDocument(refType, ref._ref);
              
              if (response.success && response.data?.document) {
                const doc = response.data.document;
                return {
                  ...ref,
                  _type: refType, // Update the type
                  _cached: {
                    title: doc.name || doc.title || doc._id || doc.id,
                    name: doc.name,
                    description: doc.description || doc.bio || doc.excerpt
                  }
                };
              }
            } catch (error) {
              console.warn(`Failed to resolve reference ${ref._ref} as ${refType}:`, error);
            }

            return ref; // Return original if resolution fails
          })
        );

        setResolvedReferences(resolved);
      } catch (error) {
        console.error('Failed to resolve references:', error);
        setResolvedReferences(normalizedReferences);
      }
    };

    resolveReferences();
  }, [normalizedReferences, props.studioContext?.apiClient, targetTypes]);
  
  // Reference operations
  const operations: ReferenceOperations = useMemo(() => ({
    addReference: (documentId: string, documentType: string) => {
      // Prevent duplicates - check if reference already exists in current refs OR in sibling array items
      const isDuplicate = currentReferences.some(ref => ref._ref === documentId) || excludeIds.includes(documentId);
      if (isDuplicate) {
        setIsSearchOpen(false);
        return; // Silently ignore duplicate
      }

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
        onChange(newReferences.length > 0 ? sanitizeReferenceValue(newReferences) : null);
      } else {
        onChange(null);
      }
    },
    
    setReference: (documentId: string, documentType: string) => {
      const newRef: ReferenceValue = { _ref: documentId, _type: documentType };
      onChange(sanitizeReferenceValue(newRef));
      setIsSearchOpen(false);
    },
    
    clear: () => {
      onChange(null);
    },
    
    reorderReferences: (fromIndex: number, toIndex: number) => {
      if (!isMultiple) return;
      
      const newReferences = [...currentReferences];
      const [movedRef] = newReferences.splice(fromIndex, 1);
      newReferences.splice(toIndex, 0, movedRef);
      onChange(sanitizeReferenceValue(newReferences));
    },
    
    searchDocuments: async (query: string, types?: string[]) => {
      // Cancel previous search
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsLoading(true);
      try {
        const apiClient = studioContext?.apiClient || props.studioContext?.apiClient;
        if (!apiClient) {
          console.warn('API client not available for reference search');
          setSearchResults([]);
          return [];
        }

        // Generate cache key (includes filter to avoid stale results)
        const optionsFilter = options.filter ? JSON.stringify(options.filter) : '';
        const typesWithFilters = targetTypes.map(t => `${t.type}:${JSON.stringify(t.filter || {})}`);
        const cacheKey = `${query}:${(types || typesWithFilters).join(',')}:${optionsFilter}`;

        // Check cache first
        const cachedResults = globalSearchCache.get(cacheKey);
        if (cachedResults) {
          const resultsWithSelection = cachedResults.map(result => ({
            ...result,
            // Mark as selected if in current references OR in excludeIds (sibling array items)
            isSelected: currentReferences.some(ref => ref._ref === result.id) || excludeIds.includes(result.id)
          }));
          setSearchResults(resultsWithSelection);
          setIsLoading(false);
          return resultsWithSelection;
        }

        const searchTypes = types || targetTypes.map(t => t.type);

        // Determine limit based on whether it's initial load or search
        const limit = query.trim() ? 15 : 25; // More results for initial load

        // Search each target type with abort signal
        const searchPromises = searchTypes.map(async (searchType) => {
          try {
            // Find the target type config to get the filter
            const targetTypeConfig = targetTypes.find(t => t.type === searchType);

            // Get filter from either targetType config or options (options.filter takes priority)
            const filter = options.filter || targetTypeConfig?.filter;

            // Build query options
            const queryOptions: Record<string, any> = {
              search: query.trim() || undefined,
              limit: filter ? limit * 2 : limit // Fetch more if we need to filter client-side
            };

            const response = await apiClient.getDocuments(searchType, queryOptions);

            if (signal.aborted) return [];

            if (response.success && response.data?.documents) {
              let documents = response.data.documents;

              // Apply client-side filter if specified
              // Supports common filter patterns like "_status == 'published'" or "_status == \"published\""
              if (filter && typeof filter === 'string') {
                const statusMatch = filter.match(/_status\s*==\s*['"]([^'"]+)['"]/);
                if (statusMatch) {
                  const targetStatus = statusMatch[1];
                  documents = documents.filter((doc: any) => doc._status === targetStatus);
                }
              }

              return documents.slice(0, limit).map((doc: any) => ({
                id: doc._id || doc.id,
                type: searchType,
                title: doc.name || doc.title || doc._id || doc.id,
                description: doc.description || doc.bio || doc.excerpt || `${searchType} document`,
                isSelected: false // Will be updated below
              }));
            }
          } catch (typeError) {
            if (!signal.aborted) {
              console.warn(`Failed to search ${searchType}:`, typeError);
            }
          }
          return [];
        });

        const allResults = await Promise.all(searchPromises);
        const flatResults = allResults.flat();

        if (signal.aborted) return [];

        // Cache results
        globalSearchCache.set(cacheKey, flatResults);

        // Update selection status (include excludeIds to prevent duplicates across array items)
        const resultsWithSelection = flatResults.map(result => ({
          ...result,
          isSelected: currentReferences.some(ref => ref._ref === result.id) || excludeIds.includes(result.id)
        }));

        setSearchResults(resultsWithSelection);

        // Store available count for button display
        if (!query.trim()) {
          setAvailableCount(resultsWithSelection.length);
        }

        return resultsWithSelection;
      } catch (error) {
        if (!abortControllerRef.current?.signal.aborted) {
          console.error('Search failed:', error);
        }
        setSearchResults([]);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    
    getReferencedDocument: async (documentId: string) => {
      if (!props.studioContext?.apiClient) {
        console.warn('API client not available for reference lookup');
        return { id: documentId, title: 'Referenced Document' };
      }

      // Try to find the document in each target type
      for (const targetType of targetTypes) {
        try {
          const response = await props.studioContext.apiClient.getDocument(targetType.type, documentId);

          if (response.success && response.data) {
            const doc = response.data;
            return {
              id: doc._id || doc.id,
              title: doc.name || doc.title || doc._id || doc.id,
              type: targetType.type
            };
          }
        } catch (error) {
          console.warn(`Failed to lookup document ${documentId} in ${targetType.type}:`, error);
        }
      }

      // Fallback if not found
      return { id: documentId, title: 'Referenced Document' };
    }
  }), [currentReferences, isMultiple, onChange, props.studioContext, targetTypes, excludeIds, options.filter]);
  
  // Auto-load initial results when dropdown opens
  useEffect(() => {
    if (isSearchOpen && !hasLoadedInitial && searchResults.length === 0 && !isLoading) {
      // Load initial documents when dropdown first opens
      setHasLoadedInitial(true);
      const types = selectedTypeFilter ? [selectedTypeFilter] : targetTypes.map(t => t.type);
      operations.searchDocuments('', types); // Empty query loads all
    }
  }, [isSearchOpen, hasLoadedInitial, searchResults.length, isLoading, selectedTypeFilter, targetTypes, operations]);

  // Optimized search handler with improved debouncing
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Update current search ref for cancellation
    currentSearchRef.current = query;

    // For empty query, load all documents (no debounce needed)
    if (!query.trim()) {
      const types = selectedTypeFilter ? [selectedTypeFilter] : targetTypes.map(t => t.type);
      operations.searchDocuments('', types);
      return;
    }

    // Debounced search with shorter delay for better UX
    searchTimeoutRef.current = setTimeout(() => {
      // Only proceed if this is still the current search
      if (currentSearchRef.current === query) {
        const types = selectedTypeFilter ? [selectedTypeFilter] : targetTypes.map(t => t.type);
        operations.searchDocuments(query, types);
      }
    }, 200); // Reduced from 300ms to 200ms
  }, [selectedTypeFilter, targetTypes, operations]);
  
  // Calculate optimal dropdown direction based on viewport position
  const calculateDropdownDirection = useCallback(() => {
    if (!containerRef.current) return 'down';
    
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 300; // Approximate max height of dropdown
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Open upward if there's not enough space below but enough above
    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
      return 'up';
    }
    
    return 'down';
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    if (!isSearchOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is outside both the container and dropdown
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsSearchOpen(false);
        setSearchQuery('');
        setHasLoadedInitial(false);
      }
    };

    // Add listener on next tick to avoid closing immediately
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSearchOpen]);
  
  // Render single reference item
  const renderReferenceItem = (ref: ReferenceValue) => {
    const displayValue = getReferenceDisplayValue(ref, options.displayField);
    const targetType = targetTypes.find(t => t.type === ref._type);
    
    return (
      <div
        key={ref._ref}
        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 overflow-hidden"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
          {targetType?.icon && (
            <span className="text-gray-400 dark:text-gray-400 flex-shrink-0">{targetType.icon}</span>
          )}
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={displayValue}>
              {displayValue}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {targetType?.displayName || ref._type} • {ref._ref}
            </p>
          </div>
        </div>
        
        {/* Hide remove button for array items - ArrayField has its own trash button */}
        {!isDisabled && !isReadonly && !isArrayItem && (
          <div className="flex items-center gap-1">
            {isMultiple && options.sortable && (
              <button
                type="button"
                className="p-1 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-dark-text-secondary"
                title={t('types.reference.dragToReorder')}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
              </button>
            )}

            <button
              type="button"
              onClick={() => operations.removeReference(ref._ref)}
              className="p-1 text-gray-400 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
              title={t('types.reference.removeReference')}
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
    
    const positionClasses = dropdownDirection === 'up' 
      ? "absolute z-10 bottom-full left-0 right-0 mb-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-64 overflow-y-auto"
      : "absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-64 overflow-y-auto";
    
    return (
      <div ref={dropdownRef} className={positionClasses}>
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={options.searchPlaceholder || t('types.reference.filterDocuments')}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400"
              autoFocus
            />

            {targetTypes.length > 1 && (
              <select
                value={selectedTypeFilter}
                onChange={(e) => {
                  setSelectedTypeFilter(e.target.value);
                  // Trigger reload with new type filter
                  setHasLoadedInitial(false);
                  setSearchResults([]);
                }}
                className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">{t('types.reference.allTypes')}</option>
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
          {isLoading || isLoadingTypes ? (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              <div className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
              {isLoadingTypes ? t('types.reference.loadingTypes') : t('types.reference.searching')}
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
                  w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors
                  ${result.isSelected ? 'opacity-50 cursor-not-allowed bg-blue-50 dark:bg-blue-900/20' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {result.title}
                    </p>
                    {result.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-300 truncate">
                        {result.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 dark:text-gray-400">
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
            <div className="p-8 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('types.reference.noResultsFor', { query: searchQuery })}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {t('types.reference.tryDifferentTerm')}
              </p>
            </div>
          ) : (
            <div className="p-8 text-center">
              <svg className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('types.reference.noDocumentsAvailable')}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {t('types.reference.createDocumentsFirst')}
              </p>
            </div>
          )}
        </div>
        
        <div className="p-2 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setIsSearchOpen(false)}
            className="w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-dark-text-primary transition-colors"
          >
            {t('types.reference.close')}
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className={`reference-field ${hasError ? 'border-l-4 border-red-400 dark:border-red-500 pl-4' : ''}`}>
      {/* Current references */}
      {currentReferences.length > 0 && (
        <div className="space-y-2 mb-3">
          {currentReferences.map((ref) => renderReferenceItem(ref))}
          
          {isMultiple && options.showCount && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
              {t('types.reference.references', { count: currentReferences.length })}
              {validation.maxReferences && ` ${t('types.reference.ofMax', { max: validation.maxReferences })}`}
            </p>
          )}
        </div>
      )}
      
      {/* Add reference button */}
      {!isDisabled && !isReadonly && (
        <div ref={containerRef} className="relative">
          {(!isMultiple && currentReferences.length === 0) || (isMultiple && (!validation.maxReferences || currentReferences.length < validation.maxReferences)) ? (
            <button
              type="button"
              onClick={() => {
                if (!isSearchOpen) {
                  const direction = calculateDropdownDirection();
                  setDropdownDirection(direction);
                } else {
                  // Reset when closing - clear results to force fresh search with updated selections
                  setSearchQuery('');
                  setSearchResults([]);
                  setHasLoadedInitial(false);
                }
                setIsSearchOpen(!isSearchOpen);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-colors text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>{options.placeholder || t('types.reference.placeholder')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {isUniversalReference && (
                    <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                      {t('types.reference.anyType')}
                    </span>
                  )}
                  {availableCount !== null && availableCount > 0 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {t('types.reference.available', { count: availableCount })}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ) : null}
          
          {renderSearchResults()}
        </div>
      )}
      
      {/* Actions - only show for non-multiple reference fields that are not array items */}
      {!isDisabled && !isReadonly && currentReferences.length > 0 && !isMultiple && !isArrayItem && (
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={operations.clear}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            {t('types.reference.clear')}
          </button>
        </div>
      )}
    </div>
  );
}