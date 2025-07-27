/**
 * Slug Field Component
 * React component for rendering slug input fields with auto-generation
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [isManuallyEdited, setIsManuallyEdited] = useState(false);
  const [previewSlug, setPreviewSlug] = useState('');
  const [isCheckingUniqueness, setIsCheckingUniqueness] = useState(false);
  const [uniquenessStatus, setUniquenessStatus] = useState<'unknown' | 'unique' | 'taken' | 'error'>('unknown');
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Generate slug from source fields
  const generateSlug = useCallback(() => {
    if (!slugDefinition.source || !documentContext?.allValues) {
      return '';
    }

    const sourceValue = getSourceValue(slugDefinition.source, documentContext.allValues);
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
  }, [slugDefinition, documentContext]);

  // Auto-generate slug when source fields change
  useEffect(() => {
    if (!slugDefinition.autoGenerate || isManuallyEdited || slugDefinition.readOnly) {
      return;
    }

    const generatedSlug = generateSlug();
    if (generatedSlug && generatedSlug !== value) {
      onChange(generatedSlug);
    }
  }, [slugDefinition, documentContext, generateSlug, isManuallyEdited, value, onChange]);

  // Check slug uniqueness with debouncing
  const checkSlugUniqueness = useCallback(async (slugToCheck: string) => {
    console.log('🔍 Checking slug uniqueness:', {
      slugToCheck,
      unique: slugDefinition.unique,
      hasApiClient: !!studioContext?.apiClient
    });
    
    if (!slugToCheck || !slugDefinition.unique || !studioContext?.apiClient) {
      console.log('⏹️ Skipping uniqueness check:', {
        noSlug: !slugToCheck,
        notUnique: !slugDefinition.unique,
        noApiClient: !studioContext?.apiClient
      });
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
        
        if (excludeId) {
          queryParams.append('excludeId', excludeId);
        }

        console.log('🌐 Making API request:', `/api/slugs/check-unique?${queryParams}`);
        const response = await studioContext.apiClient.get(`/api/slugs/check-unique?${queryParams}`);
        console.log('📡 API response:', response);
        console.log('🔍 Response data details:', {
          hasSuccess: 'success' in response,
          successValue: response.success,
          hasData: 'data' in response,
          dataValue: response.data,
          dataType: typeof response.data
        });
        
        if (response.success && response.data) {
          setUniquenessStatus(response.data.unique ? 'unique' : 'taken');
          console.log('✅ Uniqueness status set:', response.data.unique ? 'unique' : 'taken');
        } else {
          setUniquenessStatus('error');
          console.log('❌ API response error - success:', response.success, 'data:', response.data);
        }
      } catch (error) {
        studioContext?.logger?.warn('Failed to check slug uniqueness:', error);
        setUniquenessStatus('error');
      } finally {
        setIsCheckingUniqueness(false);
      }
    }, 500); // 500ms debounce
  }, [slugDefinition, studioContext, documentContext]);

  // Check uniqueness when slug value changes
  useEffect(() => {
    if (value && typeof value === 'string' && value.trim()) {
      checkSlugUniqueness(value.trim());
    } else {
      setUniquenessStatus('unknown');
    }
  }, [value, checkSlugUniqueness]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Update preview slug for display
  useEffect(() => {
    if (value) {
      setPreviewSlug(value);
    } else {
      const generated = generateSlug();
      setPreviewSlug(generated);
    }
  }, [value, generateSlug]);

  // Handle manual input changes
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setIsManuallyEdited(true);
    onChange(newValue);
  };

  // Handle regenerate button click
  const handleRegenerate = () => {
    const generatedSlug = generateSlug();
    if (generatedSlug) {
      onChange(generatedSlug);
      setIsManuallyEdited(false);
    }
  };

  // Use hasError from field renderer system for styling, also consider uniqueness
  const hasValidationError = hasError || (uniquenessStatus === 'taken');
  const showUniquenessError = uniquenessStatus === 'taken' && !hasError;

  // Common input props
  const inputProps = {
    id: fieldId,
    value: (value as string) || '',
    onChange: handleChange,
    onFocus,
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
          />
          
          {/* Uniqueness status indicator */}
          {slugDefinition.unique && value && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center">
              {isCheckingUniqueness && (
                <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-500 rounded-full" title="Checking uniqueness..."></div>
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
            onClick={handleRegenerate}
            className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
            title="Regenerate slug from source field"
          >
            ↻
          </button>
        )}
      </div>

      {/* Preview URL */}
      {previewSlug && (
        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Preview URL</span>
          <div className="text-sm text-gray-700 dark:text-gray-300 font-mono break-all">
            <span className="text-gray-400">/</span>
            {previewSlug}
          </div>
        </div>
      )}

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