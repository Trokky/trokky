/**
 * Simple Search Hook - Minimal search functionality without performance issues
 */

import { useState, useCallback } from 'react';

// Simple hook for search modal state only
export function useGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);

  const openSearch = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    openSearch,
    closeSearch,
  };
}