/**
 * GlobalSearchModal - Main search interface with keyboard navigation
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  MagnifyingGlassIcon, 
  XMarkIcon,
  DocumentTextIcon,
  PhotoIcon,
  UserIcon,
  CubeIcon,
  ClockIcon,
  CommandLineIcon
} from '@heroicons/react/24/outline';
import { useSearch } from '@/hooks/useSearch';
import { SearchResult } from '@/services/search-service';
import { Modal } from '@/components/ui/Modal';
import { createStudioLogger } from '@/utils/logger';

const logger = createStudioLogger('GlobalSearchModal');

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CONTENT_TYPE_ICONS = {
  document: DocumentTextIcon,
  media: PhotoIcon,
  user: UserIcon,
  schema: CubeIcon,
} as const;

const CONTENT_TYPE_LABELS = {
  document: 'Document',
  media: 'Media',
  user: 'User',
  schema: 'Schema',
} as const;

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const {
    query,
    setQuery,
    results,
    categories,
    isLoading,
    isEmpty,
    hasResults,
    searchTime,
    recentSearches,
    saveSearch,
    clearResults,
  } = useSearch('', {
    enabled: isOpen,
    debounceMs: 150,
  });

  // Compute derived state with useMemo to prevent unnecessary recalculations
  const showRecentSearches = useMemo(
    () => !query && recentSearches.length > 0,
    [query, recentSearches.length]
  );
  const showEmptyState = useMemo(
    () => query.length >= 2 && isEmpty && !isLoading,
    [query.length, isEmpty, isLoading]
  );
  const showMinQueryState = useMemo(
    () => query.length > 0 && query.length < 2,
    [query.length]
  );

  // Reset search when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      clearResults();
      setSelectedIndex(-1);
      // Focus the input after a brief delay to ensure modal is rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, clearResults]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const selectedElement = container.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
      
      if (selectedElement) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = selectedElement.getBoundingClientRect();
        
        const isAbove = elementRect.top < containerRect.top;
        const isBelow = elementRect.bottom > containerRect.bottom;
        
        if (isAbove || isBelow) {
          selectedElement.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }
      }
    }
  }, [selectedIndex]);

  // Handle search submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length >= 2) {
      saveSearch(query.trim());
    }
  }, [query, saveSearch]);

  // Handle result click
  const handleResultClick = useCallback((result: SearchResult) => {
    saveSearch(query);
    if (result.url) {
      logger.debug('Navigating to search result', { url: result.url, title: result.title });
      navigate(result.url);
    }
    onClose();
  }, [query, saveSearch, navigate, onClose]);

  // Handle recent search click
  const handleRecentSearchClick = useCallback((recentQuery: string) => {
    setQuery(recentQuery);
  }, [setQuery]);

  // Memoized keyboard navigation handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen || e.target !== searchInputRef.current) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => {
          let maxIndex = -1;
          if (showRecentSearches) {
            maxIndex = recentSearches.length - 1;
          } else if (hasResults) {
            maxIndex = results.length - 1;
          }
          return prev >= maxIndex ? 0 : prev + 1;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => {
          let maxIndex = -1;
          if (showRecentSearches) {
            maxIndex = recentSearches.length - 1;
          } else if (hasResults) {
            maxIndex = results.length - 1;
          }
          return prev <= 0 ? maxIndex : prev - 1;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (showRecentSearches && selectedIndex < recentSearches.length) {
            const recentSearch = recentSearches[selectedIndex];
            if (recentSearch) {
              handleRecentSearchClick(recentSearch);
            }
          } else if (hasResults && !showRecentSearches && selectedIndex < results.length) {
            const selectedResult = results[selectedIndex];
            if (selectedResult) {
              handleResultClick(selectedResult);
            }
          }
        } else if (query.trim().length >= 2) {
          handleSubmit(e as any);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, selectedIndex, showRecentSearches, recentSearches, hasResults, results, query, handleRecentSearchClick, handleResultClick, handleSubmit, onClose]);

  // Keyboard navigation
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Group results by type
  const groupedResults = React.useMemo(() => {
    const groups: Record<string, SearchResult[]> = {
      documents: [],
      media: [],
      users: [],
      schemas: [],
    };

    results.forEach(result => {
      const key = result.type === 'document' ? 'documents' : 
                 result.type === 'media' ? 'media' :
                 result.type === 'user' ? 'users' : 'schemas';
      groups[key]?.push(result);
    });

    return groups;
  }, [results]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Search Input */}
        <div className="relative flex items-center h-16 px-4 border-b border-gray-200 dark:border-gray-700">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-3" />
          <form onSubmit={handleSubmit} className="flex-1">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search everything..."
              className="w-full bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none text-lg"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          </form>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div ref={scrollContainerRef} className="h-96 overflow-y-auto">
          {/* Loading State */}
          {isLoading && (
            <div className="p-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-3"></div>
              <p className="text-gray-500 dark:text-gray-400">Searching...</p>
            </div>
          )}

          {/* Recent Searches */}
          {showRecentSearches && (
            <div className="p-4">
              <div className="flex items-center mb-3">
                <ClockIcon className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Recent searches</span>
              </div>
              <div className="space-y-1">
                {recentSearches.slice(0, 5).map((recentQuery, index) => (
                  <button
                    key={index}
                    data-index={index}
                    onClick={() => handleRecentSearchClick(recentQuery)}
                    className={`w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors ${
                      selectedIndex === index ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500' : ''
                    }`}
                  >
                    {recentQuery}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Minimum Query State */}
          {showMinQueryState && (
            <div className="p-8 text-center">
              <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">Type at least 2 characters to search</p>
            </div>
          )}

          {/* Empty State */}
          {showEmptyState && (
            <div className="p-8 text-center">
              <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-900 dark:text-white font-medium mb-1">No results found</p>
              <p className="text-gray-500 dark:text-gray-400">Try adjusting your search terms</p>
            </div>
          )}

          {/* Search Results */}
          {hasResults && !showRecentSearches && (
            <div className="p-4 space-y-4">
              {/* Results Summary */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Found {results.length} results{searchTime > 0 && ` in ${searchTime}ms`}
                </p>
              </div>

              {/* Results by Category */}
              {Object.entries(groupedResults).map(([categoryKey, categoryResults]) => {
                if (categoryResults.length === 0) return null;

                const count = categories[categoryKey as keyof typeof categories];
                const label = categoryKey === 'documents' ? 'Documents' :
                             categoryKey === 'media' ? 'Media' :
                             categoryKey === 'users' ? 'Users' : 'Schemas';

                return (
                  <div key={categoryKey}>
                    <div className="flex items-center mb-2">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        {label} ({count})
                      </h3>
                    </div>
                    <div className="space-y-1">
                      {categoryResults.map((result, resultIndex) => {
                        // Calculate global index across all categories
                        let globalIndex = 0;
                        for (const [catKey, catResults] of Object.entries(groupedResults)) {
                          if (catKey === categoryKey) {
                            globalIndex += resultIndex;
                            break;
                          }
                          globalIndex += catResults.length;
                        }
                        
                        return (
                          <SearchResultItem
                            key={`${result.type}-${result.id}`}
                            result={result}
                            isSelected={selectedIndex === globalIndex}
                            dataIndex={globalIndex}
                            onClick={() => handleResultClick(result)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">
                ↑↓
              </kbd>
              <span>to navigate</span>
            </div>
            <div className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">
                ↵
              </kbd>
              <span>to open</span>
            </div>
            <div className="flex items-center space-x-1">
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">
                esc
              </kbd>
              <span>to close</span>
            </div>
          </div>
          <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
            <CommandLineIcon className="w-3 h-3" />
            <span>Powered by Trokky</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface SearchResultItemProps {
  result: SearchResult;
  isSelected?: boolean;
  dataIndex?: number;
  onClick: () => void;
}

function SearchResultItem({ result, isSelected = false, dataIndex, onClick }: SearchResultItemProps) {
  const IconComponent = CONTENT_TYPE_ICONS[result.type];
  const typeLabel = CONTENT_TYPE_LABELS[result.type];

  const handleClick = () => {
    // Let the Link navigate naturally, just handle additional logic
    onClick();
  };

  return (
    <Link
      to={result.url || '#'}
      onClick={handleClick}
      data-index={dataIndex}
      className={`flex items-start space-x-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors group ${
        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500' : ''
      }`}
    >
      {/* Icon */}
      <div className="flex-shrink-0 w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
        <IconComponent className="w-4 h-4 text-gray-600 dark:text-gray-300" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {result.highlights?.title?.[0] ? (
              <span dangerouslySetInnerHTML={{ __html: result.highlights.title[0] }} />
            ) : (
              result.title
            )}
          </h4>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
            {typeLabel}
          </span>
        </div>
        
        {result.excerpt && (
          <p className="text-sm text-gray-600 dark:text-gray-400 overflow-hidden" style={{ 
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}>
            {result.highlights?.content?.[0] ? (
              <span dangerouslySetInnerHTML={{ __html: result.highlights.content[0] }} />
            ) : (
              result.excerpt
            )}
          </p>
        )}

        {result.metadata && (
          <div className="flex items-center space-x-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
            {result.metadata.schemaType && (
              <span>{result.metadata.schemaType}</span>
            )}
            {result.metadata.author && (
              <>
                <span>•</span>
                <span>by {result.metadata.author}</span>
              </>
            )}
            {result.metadata.createdAt && (
              <>
                <span>•</span>
                <span>{new Date(result.metadata.createdAt).toLocaleDateString()}</span>
              </>
            )}
            {result.metadata.size && (
              <>
                <span>•</span>
                <span>{result.metadata.size}</span>
              </>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}