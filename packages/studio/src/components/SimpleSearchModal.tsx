/**
 * SimpleSearchModal - Clean, simple search implementation
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentTextIcon,
  PhotoIcon,
  ClockIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { useT } from '@trokky/i18n';
import { Modal } from '@/components/ui/Modal';
import { useApiClient } from '@/hooks/useApiClient';

interface SimpleSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  type: 'document' | 'media';
  title: string;
  url: string;
  excerpt?: string;
  metadata?: {
    schemaType?: string;
    author?: string;
    createdAt?: string;
    size?: string;
  };
}

// Sanitize and strip HTML/markdown - safe content only
function sanitizeText(text: string): string {
  if (!text) return '';
  
  return text
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove markdown images ![alt](url)
    .replace(/!\[.*?\]\(.*?\)/g, '')
    // Remove markdown links [text](url) but keep the text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Remove script-like content
    .replace(/javascript:/gi, '')
    // Remove other markdown formatting
    .replace(/[*_`#]/g, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Simple highlight function - safe and performance-friendly
function highlightText(text: string, query: string): string {
  if (!query || query.length < 2) return sanitizeText(text);
  
  // First sanitize the text
  const sanitized = sanitizeText(text);
  
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return sanitized.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-800">$1</mark>');
}


// Format file size
function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

export function SimpleSearchModal({ isOpen, onClose }: SimpleSearchModalProps) {
  const { t } = useT('studio');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const client = useApiClient();

  // Load recent searches and cleanup
  useEffect(() => {
    if (isOpen) {
      try {
        const stored = localStorage.getItem('trokky_recent_searches');
        setRecentSearches(stored ? JSON.parse(stored) : []);
      } catch {
        setRecentSearches([]);
      }
      // Focus input
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      // Clear search timeout when modal closes
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = null;
      }
    }
  }, [isOpen]);

  // Efficient server-side search function
  const performSearch = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      // Use the new server-side search endpoint
      const searchResponse = await client.get('/search', { 
        q: searchQuery,
        limit: 10 
      });

      if (searchResponse.success && searchResponse.data) {
        const serverResults = (searchResponse.data as any).results || [];
        
        // Transform server results to match our interface
        const transformedResults: SearchResult[] = serverResults.map((result: any) => ({
          id: result.id,
          type: result.type,
          title: result.title,
          url: result.url,
          excerpt: result.excerpt,
          metadata: {
            schemaType: result.metadata?.schemaType,
            author: result.metadata?.author,
            createdAt: result.metadata?.createdAt,
            size: result.metadata?.size ? formatFileSize(result.metadata.size) : undefined,
          }
        }));

        setResults(transformedResults);
      } else {
        console.warn('Search failed:', searchResponse.error);
        setResults([]);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };


  // Handle search input change with proper debouncing
  const handleSearchChange = (value: string) => {
    setQuery(value);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    // Save to recent searches
    if (query.length >= 2) {
      const newRecent = [query, ...recentSearches.filter(q => q !== query)].slice(0, 5);
      setRecentSearches(newRecent);
      localStorage.setItem('trokky_recent_searches', JSON.stringify(newRecent));
    }
    
    navigate(result.url);
    onClose();
  };

  // Handle recent search click
  const handleRecentClick = (recentQuery: string) => {
    setQuery(recentQuery);
    performSearch(recentQuery);
  };

  // Clear recent searches
  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('trokky_recent_searches');
  };

  // Handle close
  const handleClose = () => {
    setQuery('');
    setResults([]);
    onClose();
  };

  const showRecentSearches = !query && recentSearches.length > 0;
  const showResults = query.length >= 2 && results.length > 0;
  const showEmptyState = query.length >= 2 && !isLoading && results.length === 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden w-full max-w-2xl">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 mr-3" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
            autoComplete="off"
          />
          {query ? (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
                searchInputRef.current?.focus();
              }}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={t('search.clearSearch')}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title={t('search.closeSearch')}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="h-96 overflow-y-auto">
          {/* Loading */}
          {isLoading && (
            <div className="p-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-3"></div>
              <p className="text-gray-500 dark:text-gray-400">{t('search.searching')}</p>
            </div>
          )}

          {/* Recent Searches */}
          {showRecentSearches && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <ClockIcon className="w-4 h-4 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('search.recentSearches')}</span>
                </div>
                <button
                  onClick={clearRecentSearches}
                  className="flex items-center text-xs text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title={t('search.clearHistory')}
                >
                  <TrashIcon className="w-3 h-3 mr-1" />
                  {t('search.clear')}
                </button>
              </div>
              <div className="space-y-1">
                {recentSearches.map((recentQuery, index) => (
                  <button
                    key={index}
                    onClick={() => handleRecentClick(recentQuery)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    <span dangerouslySetInnerHTML={{ __html: highlightText(recentQuery, query) }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {showResults && (
            <div className="p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {t('search.foundResults', { count: results.length })}
              </div>
              <div className="space-y-2">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className="w-full flex items-start space-x-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-left"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      {result.type === 'document' ? (
                        <DocumentTextIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      ) : (
                        <PhotoIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        <span dangerouslySetInnerHTML={{ __html: highlightText(result.title, query) }} />
                      </h4>
                      {result.excerpt && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 overflow-hidden" style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          <span dangerouslySetInnerHTML={{ __html: highlightText(result.excerpt, query) }} />
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                          {result.type === 'document' ? t('search.document') : t('search.media')}
                        </span>
                        {result.metadata?.schemaType && (
                          <span className="text-xs text-blue-600 dark:text-blue-400">
                            {result.metadata.schemaType}
                          </span>
                        )}
                        {result.metadata?.author && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {t('search.by')} {result.metadata.author}
                          </span>
                        )}
                        {result.metadata?.size && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {result.metadata.size}
                          </span>
                        )}
                        {result.metadata?.createdAt && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(result.metadata.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {showEmptyState && (
            <div className="p-8 text-center">
              <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-900 dark:text-white font-medium mb-1">{t('search.noResults')}</p>
              <p className="text-gray-500 dark:text-gray-400">{t('search.tryDifferent')}</p>
            </div>
          )}

          {/* Help text */}
          {!query && !showRecentSearches && (
            <div className="p-8 text-center">
              <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">{t('search.typeToSearch')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{t('search.pressEscape')}</span>
            <span>{t('search.poweredBy')}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}