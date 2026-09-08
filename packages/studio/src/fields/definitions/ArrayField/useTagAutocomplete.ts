import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type React from 'react';
import type { ArrayOperations } from './definition.js';

interface UseTagAutocompleteOptions {
  arrayValue: any[];
  operations: ArrayOperations;
  tagField: any;
}

/**
 * The autocomplete shared by the tags input and the string items of the list
 * layout: which suggestions are still available, and the keyboard handling
 * that picks one.
 */
export function useTagAutocomplete({
  arrayValue,
  operations,
  tagField,
}: UseTagAutocompleteOptions) {
  const [newItemInput, setNewItemInput] = useState('');

  // Tag autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // List item autocomplete state (per-item)
  const [listItemSuggestions, setListItemSuggestions] = useState<{ index: number; show: boolean; selected: number }>({ index: -1, show: false, selected: -1 });
  const listInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  // Get tagField options (tagField already destructured from options above)
  const suggestions: string[] = tagField.suggestions || [];
  const allowCustom = tagField.allowCustom !== false; // Default to true

  // Filter suggestions based on input and already selected values
  const filteredSuggestions = useMemo(() => {
    if (!suggestions.length) return [];
    const input = newItemInput.toLowerCase().trim();
    return suggestions.filter(suggestion => {
      // Exclude already selected values
      if (arrayValue.includes(suggestion)) return false;
      // If no input, show all available
      if (!input) return true;
      // Filter by input
      return suggestion.toLowerCase().includes(input);
    });
  }, [suggestions, newItemInput, arrayValue]);

  // Filter suggestions for list item (excludes current value but includes it in suggestions)
  const getListItemSuggestions = useCallback((currentValue: string, index: number) => {
    if (!suggestions.length) return [];
    const input = (currentValue || '').toLowerCase().trim();
    return suggestions.filter(suggestion => {
      // Exclude other selected values (but not the current one)
      const otherValues = arrayValue.filter((_, i) => i !== index);
      if (otherValues.includes(suggestion)) return false;
      // If no input, show all available
      if (!input) return true;
      // Filter by input
      return suggestion.toLowerCase().includes(input);
    });
  }, [suggestions, arrayValue]);

  // Handle add tag (for tags layout)
  const handleAddTag = useCallback((tagToAdd?: string) => {
    const tag = (tagToAdd || newItemInput).trim();
    if (!tag) return;

    // Check if already exists
    if (arrayValue.includes(tag)) return;

    // Check allowCustom - if false, must be in suggestions
    if (!allowCustom && suggestions.length > 0 && !suggestions.includes(tag)) {
      return; // Don't add custom tags when not allowed
    }

    operations.add(tag);
    setNewItemInput('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  }, [newItemInput, arrayValue, operations, allowCustom, suggestions]);

  // Handle tag input key press
  const handleTagKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && selectedSuggestionIndex >= 0 && filteredSuggestions[selectedSuggestionIndex]) {
        handleAddTag(filteredSuggestions[selectedSuggestionIndex]);
      } else {
        handleAddTag();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredSuggestions.length > 0) {
        setShowSuggestions(true);
        setSelectedSuggestionIndex(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredSuggestions.length > 0) {
        setShowSuggestions(true);
        setSelectedSuggestionIndex(prev =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  }, [handleAddTag, showSuggestions, selectedSuggestionIndex, filteredSuggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        tagInputRef.current &&
        !tagInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return {
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
  };
}
