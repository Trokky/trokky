/**
 * Slug Field Component
 * React component for rendering slug input fields with auto-generation
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { SlugFieldDefinition } from './index.js';
import { defaultSlugify, getSourceValue } from './index.js';

// Use generic FieldComponentProps to match plugin interface
type SlugFieldComponentProps = FieldComponentProps;

export function SlugFieldComponent(props: SlugFieldComponentProps) {
  const {
    fieldId,
    value,
    onChange,
    definition,
    hasError,
    isDisabled,
    isReadonly,
    onFocus,
    onBlur,
    onKeyPress,
    onKeyDown,
    studioContext,
    documentContext,
    ...restProps
  } = props;

  // Type-safe access to slug field specific properties  
  const slugDefinition = definition as SlugFieldDefinition;
  
  // Extract options with defaults (support both direct props and options object)
  const definitionAny = definition as any; // Handle schema flexibility
  const autoGenerate = slugDefinition.autoGenerate ?? definitionAny.options?.autoGenerate ?? true;
  const readOnly = slugDefinition.readOnly ?? definitionAny.options?.readOnly ?? false;
  const unique = slugDefinition.unique ?? definitionAny.options?.unique ?? true;
  const source = slugDefinition.source ?? definitionAny.options?.source;
  const maxLength = slugDefinition.maxLength ?? definitionAny.options?.maxLength;
  
  const [isManuallyEdited, setIsManuallyEdited] = useState(false);
  const [isCheckingUniqueness, setIsCheckingUniqueness] = useState(false);
  const [uniquenessStatus, setUniquenessStatus] = useState<'unknown' | 'unique' | 'taken' | 'error'>('unknown');
  const [isGenerating, setIsGenerating] = useState(false); // Prevent generation loops
  const [isInEditMode, setIsInEditMode] = useState(false); // Track if user is editing existing slug
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate slug from source fields
  const generateSlug = useCallback(() => {
    if (!source || !documentContext?.allValues) {
      return '';
    }

    const sourceValue = getSourceValue(source, documentContext.allValues);
    
    if (!sourceValue) {
      return '';
    }

    const slugifyFn = slugDefinition.slugify || defaultSlugify;
    return slugifyFn(sourceValue, {
      preserveCase: slugDefinition.preserveCase,
      allowedChars: slugDefinition.allowedChars,
      prefix: slugDefinition.prefix,
      suffix: slugDefinition.suffix
    });
  }, [source, documentContext?.allValues, slugDefinition.slugify, slugDefinition.preserveCase, slugDefinition.allowedChars, slugDefinition.prefix, slugDefinition.suffix]);

  // Get source field value for dependency tracking
  const sourceFieldValue = useMemo(() => {
    if (!source || !documentContext?.allValues) {
      return '';
    }
    return getSourceValue(source, documentContext.allValues);
  }, [source, documentContext?.allValues]);

  // Auto-generate slug when source fields change (real-time)
  useEffect(() => {
    if (!autoGenerate || readOnly) {
      return;
    }

    const generatedSlug = generateSlug();
    const isNewDocument = documentContext?.isNewDocument;
    const isEmpty = !value || value.trim() === '';
    const isExistingDocumentWithSlug = !documentContext?.isNewDocument && !isEmpty;
    
    // Auto-generate if:
    // 1. Field is empty (always), OR
    // 2. User hasn't manually edited and source field changed AND this is a new document
    
    if (generatedSlug && (isEmpty || (!isManuallyEdited && !isExistingDocumentWithSlug))) {
      if (generatedSlug !== value) {
        // If unique is required and this is not empty (meaning it's an update), 
        // find a unique variant
        if (!isEmpty && unique && studioContext?.apiClient) {
          handleSmartGeneration(generatedSlug);
        } else {
          onChange(generatedSlug);
          setIsManuallyEdited(false);
        }
      }
    }
  }, [sourceFieldValue, isManuallyEdited, value, autoGenerate, readOnly, documentContext?.isNewDocument]);

  // Check slug uniqueness with debouncing
  const checkSlugUniqueness = useCallback(async (slugToCheck: string) => {
    if (!slugToCheck || !unique || !studioContext?.apiClient) {
      return;
    }

    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set up debounced check
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        setIsCheckingUniqueness(true);
        setUniquenessStatus('unknown');

        // Make API request to check uniqueness
        const collection = documentContext?.schema || 'default';
        const excludeId = documentContext?.documentId;
        
        const queryParams = new URLSearchParams({
          slug: slugToCheck,
          collection: collection
        });
        
        // Only add excludeId if it's a real document ID (not 'new')
        if (excludeId && excludeId !== 'new') {
          queryParams.append('excludeId', excludeId);
        }

        const response = await studioContext.apiClient.get(`/api/slugs/check-unique?${queryParams}`);
        
        if (response.success && response.data) {
          const isUnique = response.data.unique;
          
          // Special case: if this is an existing document with its own slug,
          // don't show "taken" error even if API says it's not unique
          if (!isUnique && !documentContext?.isNewDocument && excludeId && excludeId !== 'new') {
            // This is likely the document's own slug, so treat it as unique
            setUniquenessStatus('unique');
          } else {
            setUniquenessStatus(isUnique ? 'unique' : 'taken');
          }
        } else {
          setUniquenessStatus('error');
        }
      } catch (error) {
        studioContext?.logger?.warn('Failed to check slug uniqueness:', error);
        setUniquenessStatus('error');
      } finally {
        setIsCheckingUniqueness(false);
      }
    }, 500); // 500ms debounce
  }, [unique, studioContext?.apiClient, documentContext?.schema, documentContext?.documentId, documentContext?.isNewDocument, studioContext?.logger]); // More specific dependencies

  // Recheck uniqueness when document transitions from new to saved
  useEffect(() => {
    const currentDocId = documentContext?.documentId;
    const isCurrentlyNew = documentContext?.isNewDocument;
    
    // If we have a real document ID and the uniqueness status is 'taken',
    // recheck because the document might have been saved with this slug
    if (currentDocId && currentDocId !== 'new' && !isCurrentlyNew && uniquenessStatus === 'taken' && value) {
      checkSlugUniqueness(value);
    }
  }, [documentContext?.documentId, documentContext?.isNewDocument, uniquenessStatus, value]); // Remove checkSlugUniqueness to prevent infinite loop

  // Check uniqueness when slug value changes
  useEffect(() => {
    if (value && typeof value === 'string' && value.trim()) {
      checkSlugUniqueness(value.trim());
    } else {
      setUniquenessStatus('unknown');
    }
  }, [value]); // Remove checkSlugUniqueness from dependencies to prevent infinite loop

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);


  // Handle focus - auto-generate if empty
  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    const isEmpty = !value || value.trim() === '';

    if (isEmpty && !readOnly && autoGenerate) {
      const generatedSlug = generateSlug();
      if (generatedSlug) {
        onChange(generatedSlug);
        setIsManuallyEdited(false);
      }
    }
    if (onFocus) onFocus();
  };

  // Prevent invalid characters from being typed
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow backspace, delete, arrow keys, tab, etc.
    if (event.key.length > 1) {
      return;
    }
    
    // Allow only valid characters: a-z, 0-9, hyphen, underscore
    const validChars = /^[a-z0-9\-_]$/;
    if (!validChars.test(event.key.toLowerCase())) {
      event.preventDefault();
    }
  };

  // Handle paste events to sanitize pasted content
  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData('text');
    
    // Sanitize pasted text
    const sanitizedText = pastedText
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-_]/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    if (sanitizedText) {
      setIsManuallyEdited(true);
      onChange(sanitizedText);
    }
  };

  // Handle manual input changes
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value;
    
    // Additional sanitization as backup (in case of paste operations)
    const sanitizedValue = rawValue
      .toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^a-z0-9\-_]/g, '') // Remove any character that's not alphanumeric, hyphen, or underscore
      .replace(/--+/g, '-') // Replace multiple consecutive hyphens with single hyphen
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
    
    setIsManuallyEdited(true);
    onChange(sanitizedValue);
  };

  // Smart generation with uniqueness handling
  const handleSmartGeneration = async (baseSlug: string) => {
    if (isGenerating) {
      return;
    }
    
    setIsGenerating(true);
    try {
      let finalSlug = baseSlug;
      
      // If unique is required, find a unique variant
      if (unique && studioContext?.apiClient) {
        const isUnique = async (candidateSlug: string): Promise<boolean> => {
          try {
            const collection = documentContext?.schema || 'default';
            const excludeId = documentContext?.documentId;
            
            const queryParams = new URLSearchParams({
              slug: candidateSlug,
              collection: collection
            });
            
            if (excludeId && excludeId !== 'new') {
              queryParams.append('excludeId', excludeId);
            }

            const response = await studioContext.apiClient.get(`/api/slugs/check-unique?${queryParams}`);
            return response.success && response.data?.unique;
          } catch {
            return true; // If check fails, assume it's unique
          }
        };

        // Generate unique slug with -1, -2, etc.
        let candidate = baseSlug;
        let counter = 1;
        
        while (!(await isUnique(candidate))) {
          candidate = `${baseSlug}-${counter}`;
          counter++;
          
          // Safety break after 100 attempts
          if (counter > 100) break;
        }
        
        finalSlug = candidate;
      }
      
      if (finalSlug !== value) {
        onChange(finalSlug);
        setIsManuallyEdited(false);
      }
    } catch (error) {
      // Fallback to basic slug if uniqueness check fails
      if (baseSlug !== value) {
        onChange(baseSlug);
        setIsManuallyEdited(false);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle regenerate button click with smart uniqueness
  const handleRegenerate = async () => {
    const baseSlug = generateSlug();
    if (!baseSlug) return;
    
    await handleSmartGeneration(baseSlug);
  };

  // Handle edit button click for existing documents
  const handleEdit = () => {
    setIsInEditMode(true);
    setIsManuallyEdited(true);
  };

  // Determine if this is an existing document with a slug that should be read-only
  const isExistingDocumentWithSlug = !documentContext?.isNewDocument && value && value.trim();
  const shouldBeReadOnly = isExistingDocumentWithSlug && !isInEditMode;

  // Use hasError from field renderer system for styling, also consider uniqueness
  const hasValidationError = hasError || (uniquenessStatus === 'taken');
  const showUniquenessError = uniquenessStatus === 'taken' && !hasError;

  // Common input props
  const inputProps = {
    id: fieldId,
    value: (value as string) || '',
    onChange: handleChange,
    onFocus: handleFocus,
    onBlur,
    onKeyPress,
    onKeyDown,
    disabled: isDisabled,
    readOnly: isReadonly || slugDefinition.readOnly,
    placeholder: slugDefinition.readOnly ? 'Auto-generated' : 'Enter slug or leave empty to auto-generate',
    maxLength: slugDefinition.maxLength,
    className: (() => {
      const baseClasses = hasValidationError 
        ? 'w-full px-3 py-2 pr-10 border !border-red-400 rounded-lg'
        : 'w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg';
      
      return `
        ${baseClasses}
        bg-white dark:bg-gray-700 text-gray-900 dark:text-white
        focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
        font-mono text-sm
      `.trim();
    })(),
    style: hasValidationError ? { 
      borderColor: '#f87171',
      boxShadow: '0 0 0 1px rgba(248, 113, 113, 0.3)'
    } : undefined
  };

  return (
    <div className="space-y-3">
      {/* Input field with regenerate button and status */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            {...inputProps}
            type="text"
            readOnly={shouldBeReadOnly || slugDefinition.readOnly}
            onKeyDown={shouldBeReadOnly ? undefined : handleKeyDown}
            onPaste={shouldBeReadOnly ? undefined : handlePaste}
            className={`${inputProps.className} ${shouldBeReadOnly ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
            title="Only lowercase letters, numbers, hyphens, and underscores allowed. Invalid characters will be blocked."
            placeholder={slugDefinition.placeholder || 'my-awesome-slug'}
          />
          
          {/* Uniqueness status indicator */}
          {slugDefinition.unique && value && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center">
              {isCheckingUniqueness && (
                <div className="animate-spin h-4 w-4 border-2 border-gray-300 dark:border-gray-500 border-t-blue-500 rounded-full" title="Checking uniqueness..."></div>
              )}
              {!isCheckingUniqueness && uniquenessStatus === 'unique' && (
                <div className="text-green-500 text-sm" title="Slug is unique">✓</div>
              )}
              {!isCheckingUniqueness && uniquenessStatus === 'taken' && (
                <div className="text-red-500 text-sm" title="Slug already exists">✗</div>
              )}
              {!isCheckingUniqueness && uniquenessStatus === 'error' && (
                <div className="text-orange-500 text-sm" title="Could not check uniqueness">⚠</div>
              )}
            </div>
          )}
        </div>
        
        {slugDefinition.source && !slugDefinition.readOnly && !isDisabled && (
          <button
            type="button"
            onClick={shouldBeReadOnly ? handleEdit : handleRegenerate}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors text-gray-700 dark:text-gray-200"
            title={shouldBeReadOnly ? "Edit slug" : "Regenerate slug from source field"}
          >
            {shouldBeReadOnly ? 'Edit' : '↻'}
          </button>
        )}
      </div>


      {/* Note: Validation errors are handled by the field renderer system */}
      
      {/* Uniqueness validation error */}
      {showUniquenessError && (
        <div className="text-sm text-red-600 dark:text-red-400">
          This slug is already taken. Please choose a different one.
        </div>
      )}

      {/* Source field info */}
      {slugDefinition.source && slugDefinition.autoGenerate && (
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Auto-generated from: {Array.isArray(slugDefinition.source) ? slugDefinition.source.join(', ') : slugDefinition.source}
          {isManuallyEdited && ' (manually edited)'}
        </div>
      )}
    </div>
  );
}
