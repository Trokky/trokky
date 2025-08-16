/**
 * Search Hooks - React hooks for search functionality
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useApiClient } from './useApiClient';
import { createSearchService, SearchResult, SearchResponse, SearchOptions } from '@/services/search-service';
import { createStudioLogger } from '@/utils/logger';

const logger = createStudioLogger('useSearch');

export interface UseSearchOptions extends SearchOptions {
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseSearchResult {
  // Query state
  query: string;
  setQuery: (query: string) => void;
  
  // Results
  results: SearchResult[];
  totalCount: number;
  categories: SearchResponse['categories'];
  
  // Loading states
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  
  // Meta information
  searchTime: number;
  isEmpty: boolean;
  hasResults: boolean;
  
  // Actions
  search: (query: string) => void;
  clearResults: () => void;
  
  // Suggestions
  suggestions: string[];
  getSuggestions: (query: string) => Promise<void>;
  
  // Recent searches
  recentSearches: string[];
  saveSearch: (query: string) => void;
}

export function useSearch(
  initialQuery: string = '',
  options: UseSearchOptions = {}
): UseSearchResult {
  const {
    enabled = true,
    debounceMs = 300,
    ...searchOptions
  } = options;

  const client = useApiClient();
  const [query, setQuery] = useState(initialQuery);
  const [displayQuery, setDisplayQuery] = useState(initialQuery);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create search service instance
  const searchService = useMemo(() => createSearchService(client), [client]);

  // Debounced search function
  const debouncedSearch = useCallback((searchQuery: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      setQuery(searchQuery);
    }, debounceMs);
  }, [debounceMs]);

  // Handle query change with immediate display update and debounced search
  const handleQueryChange = useCallback((value: string) => {
    setDisplayQuery(value);
    debouncedSearch(value);
  }, [debouncedSearch]);

  // Perform search when query changes
  useEffect(() => {
    let cancelled = false;

    async function performSearch() {
      if (!enabled || query.length < 2) {
        setSearchResponse(null);
        setIsLoading(false);
        setIsError(false);
        setError(null);
        return;
      }

      try {
        setIsLoading(true);
        setIsError(false);
        setError(null);

        logger.debug('Performing search', { query, options: searchOptions });
        const response = await searchService.search(query, searchOptions);
        
        if (!cancelled) {
          setSearchResponse(response);
          logger.debug('Search completed', { 
            query, 
            resultCount: response.totalCount,
            searchTime: response.searchTime 
          });
        }
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err : new Error('Search failed');
          setIsError(true);
          setError(error);
          setSearchResponse(null);
          logger.error('Search failed', err);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    performSearch();

    return () => {
      cancelled = true;
    };
  }, [query, enabled, searchService, searchOptions]);

  // Load recent searches on mount
  useEffect(() => {
    const loadRecentSearches = () => {
      try {
        const recent = searchService.getRecentSearches();
        setRecentSearches(recent);
        logger.debug('Loaded recent searches', { count: recent.length });
      } catch (error) {
        logger.warn('Failed to load recent searches', error);
        setRecentSearches([]);
      }
    };

    loadRecentSearches();
  }, [searchService]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Memoized results
  const results = useMemo(
    () => searchResponse?.results || [],
    [searchResponse?.results]
  );

  const totalCount = useMemo(
    () => searchResponse?.totalCount || 0,
    [searchResponse?.totalCount]
  );

  const categories = useMemo(
    () => searchResponse?.categories || { documents: 0, media: 0, users: 0, schemas: 0 },
    [searchResponse?.categories]
  );

  const searchTime = useMemo(
    () => searchResponse?.searchTime || 0,
    [searchResponse?.searchTime]
  );

  const isEmpty = useMemo(
    () => displayQuery.length >= 2 && !isLoading && results.length === 0,
    [displayQuery, isLoading, results.length]
  );

  const hasResults = useMemo(
    () => results.length > 0,
    [results.length]
  );

  // Search function
  const search = useCallback((searchQuery: string) => {
    setDisplayQuery(searchQuery);
    setQuery(searchQuery);
  }, []);

  // Clear results
  const clearResults = useCallback(() => {
    setDisplayQuery('');
    setQuery('');
    setSearchResponse(null);
    setIsError(false);
    setError(null);
  }, []);

  // Get suggestions
  const getSuggestions = useCallback(async (suggestionQuery: string) => {
    try {
      const newSuggestions = await searchService.getSuggestions(suggestionQuery);
      setSuggestions(newSuggestions);
    } catch (error) {
      logger.warn('Failed to get suggestions', error);
      setSuggestions([]);
    }
  }, [searchService]);

  // Save search to recent searches
  const saveSearch = useCallback((searchQuery: string) => {
    if (searchQuery.length < 2) return;

    try {
      searchService.saveRecentSearch(searchQuery);
      
      // Update local state
      setRecentSearches(prev => {
        const updated = [searchQuery, ...prev.filter(q => q !== searchQuery)].slice(0, 10);
        return updated;
      });
      
      logger.debug('Saved recent search', { query: searchQuery });
    } catch (error) {
      logger.warn('Failed to save search', error);
    }
  }, [searchService]);

  return {
    // Query state
    query: displayQuery,
    setQuery: handleQueryChange,
    
    // Results
    results,
    totalCount,
    categories,
    
    // Loading states
    isLoading,
    isError,
    error,
    
    // Meta information
    searchTime,
    isEmpty,
    hasResults,
    
    // Actions
    search,
    clearResults,
    
    // Suggestions
    suggestions,
    getSuggestions,
    
    // Recent searches
    recentSearches,
    saveSearch,
  };
}

// Specialized hook for global search modal
export function useGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  
  const searchResult = useSearch('', {
    enabled: isOpen, // Only search when modal is open
    debounceMs: 150, // Faster debounce for modal
  });

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open search
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen(true);
      }
      
      // Escape to close search
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        searchResult.clearResults();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, searchResult]);

  const openSearch = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    searchResult.clearResults();
  }, [searchResult]);

  return {
    ...searchResult,
    isOpen,
    openSearch,
    closeSearch,
    setIsOpen,
  };
}

// Hook for context-aware search (specific pages)
export function useContextSearch(contentType: string, initialQuery: string = '') {
  return useSearch(initialQuery, {
    types: [contentType],
    debounceMs: 400, // Slower debounce for context search
  });
}