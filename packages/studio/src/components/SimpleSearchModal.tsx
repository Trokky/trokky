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
} from '@heroicons/react/24/outline';
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
}

export function SimpleSearchModal({ isOpen, onClose }: SimpleSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const client = useApiClient();

  // Load recent searches
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
    }
  }, [isOpen]);

  // Simple search function
  const performSearch = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const results: SearchResult[] = [];
      
      // Search documents
      try {
        const schemasResponse = await client.getSchemas();
        if (schemasResponse.success && schemasResponse.data) {
          for (const schema of schemasResponse.data.slice(0, 3)) { // Limit to 3 schemas
            const docsResponse = await client.getDocuments(schema.name, { limit: 5 });
            if (docsResponse.success && docsResponse.data?.documents) {
              docsResponse.data.documents.forEach((doc: any) => {
                const title = doc.title || doc.name || doc.slug || 'Untitled';
                if (title.toLowerCase().includes(searchQuery.toLowerCase())) {
                  results.push({
                    id: doc.id || doc._id,
                    type: 'document',
                    title,
                    url: `/content/${schema.name}/${doc.id || doc._id}`,
                    excerpt: doc.description || doc.excerpt
                  });
                }
              });
            }
          }
        }
      } catch (error) {
        console.warn('Document search failed:', error);
      }

      // Search media
      try {
        const mediaResponse = await client.get('/api/media', { limit: 10 });
        if (mediaResponse.success && mediaResponse.data) {
          (mediaResponse.data as any[]).forEach((file: any) => {
            const title = file.title || file.filename || 'Untitled';
            if (title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                (file.id && file.id.toLowerCase().includes(searchQuery.toLowerCase()))) {
              results.push({
                id: file.id,
                type: 'media',
                title,
                url: `/media?file=${file.id}`,
                excerpt: file.description
              });
            }
          });
        }
      } catch (error) {
        console.warn('Media search failed:', error);
      }

      setResults(results.slice(0, 10)); // Limit to 10 results
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setQuery(value);
    // Simple debounce - use timeout
    setTimeout(() => {
      if (value === query) { // Only search if query hasn't changed
        performSearch(value);
      }
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
            placeholder="Search documents, media..."
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
            autoComplete="off"
          />
          <button
            onClick={handleClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto">
          {/* Loading */}
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
                <ClockIcon className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Recent searches</span>
              </div>
              <div className="space-y-1">
                {recentSearches.map((recentQuery, index) => (
                  <button
                    key={index}
                    onClick={() => handleRecentClick(recentQuery)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    {recentQuery}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {showResults && (
            <div className="p-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Found {results.length} result{results.length !== 1 ? 's' : ''}
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
                        {result.title}
                      </h4>
                      {result.excerpt && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {result.excerpt}
                        </p>
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded mt-1 inline-block">
                        {result.type === 'document' ? 'Document' : 'Media'}
                      </span>
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
              <p className="text-gray-900 dark:text-white font-medium mb-1">No results found</p>
              <p className="text-gray-500 dark:text-gray-400">Try different search terms</p>
            </div>
          )}

          {/* Help text */}
          {!query && !showRecentSearches && (
            <div className="p-8 text-center">
              <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">Type to search documents and media</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Press Escape to close</span>
            <span>Powered by Trokky</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}