import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Slug Field Component
 * React component for rendering slug input fields with auto-generation
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { defaultSlugify, getSourceValue } from './index.js';
export function SlugFieldComponent(props) {
    const { fieldId, value, onChange, definition, hasError, isDisabled, isReadonly, onFocus, onBlur, onKeyPress, onKeyDown, studioContext, documentContext, ...restProps } = props;
    // Type-safe access to slug field specific properties  
    const slugDefinition = definition;
    // Extract options with defaults (support both direct props and options object)
    const definitionAny = definition; // Handle schema flexibility
    const autoGenerate = slugDefinition.autoGenerate ?? definitionAny.options?.autoGenerate ?? true;
    const readOnly = slugDefinition.readOnly ?? definitionAny.options?.readOnly ?? false;
    const unique = slugDefinition.unique ?? definitionAny.options?.unique ?? true;
    const source = slugDefinition.source ?? definitionAny.options?.source;
    const maxLength = slugDefinition.maxLength ?? definitionAny.options?.maxLength;
    const [isManuallyEdited, setIsManuallyEdited] = useState(false);
    const [isCheckingUniqueness, setIsCheckingUniqueness] = useState(false);
    const [uniquenessStatus, setUniquenessStatus] = useState('unknown');
    const debounceTimeoutRef = useRef(null);
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
    }, [source, documentContext, slugDefinition]);
    // Get source field value for dependency tracking
    const sourceFieldValue = useMemo(() => {
        if (!source || !documentContext?.allValues) {
            console.log('🔍 SLUG DEBUG: No source or allValues', {
                hasSource: !!source,
                hasAllValues: !!documentContext?.allValues,
                source: source,
                allValues: documentContext?.allValues
            });
            return '';
        }
        const value = getSourceValue(source, documentContext.allValues);
        console.log('🔍 SLUG DEBUG: Source field value changed', {
            source: source,
            sourceValue: value,
            allValues: documentContext.allValues
        });
        return value;
    }, [source, documentContext?.allValues]);
    // Auto-generate slug when source fields change (real-time)
    useEffect(() => {
        console.log('🔍 SLUG DEBUG: Auto-generate effect triggered', {
            autoGenerate,
            readOnly,
            sourceFieldValue,
            isManuallyEdited,
            currentValue: value,
            isEmpty: !value || value.trim() === ''
        });
        if (!autoGenerate || readOnly) {
            console.log('🔍 SLUG DEBUG: Skipping - auto-generate disabled or read-only');
            return;
        }
        const generatedSlug = generateSlug();
        const isNewDocument = documentContext?.isNewDocument;
        const isEmpty = !value || value.trim() === '';
        console.log('🔍 SLUG DEBUG: Generation check', {
            generatedSlug,
            isEmpty,
            isManuallyEdited,
            isNewDocument,
            currentValue: value,
            shouldGenerate: generatedSlug && (isEmpty || !isManuallyEdited)
        });
        // Auto-generate if:
        // 1. Field is empty (always), OR
        // 2. User hasn't manually edited and source field changed
        if (generatedSlug && (isEmpty || !isManuallyEdited)) {
            if (generatedSlug !== value) {
                console.log('🔍 SLUG DEBUG: GENERATING SLUG', {
                    from: value,
                    to: generatedSlug
                });
                // If unique is required and this is not empty (meaning it's an update), 
                // find a unique variant
                if (!isEmpty && unique && studioContext?.apiClient) {
                    handleSmartGeneration(generatedSlug);
                }
                else {
                    onChange(generatedSlug);
                }
            }
            else {
                console.log('🔍 SLUG DEBUG: Slug unchanged, skipping');
            }
        }
    }, [sourceFieldValue, generateSlug, isManuallyEdited, value, onChange, autoGenerate, readOnly, documentContext?.isNewDocument]);
    // Check slug uniqueness with debouncing
    const checkSlugUniqueness = useCallback(async (slugToCheck) => {
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
                    }
                    else {
                        setUniquenessStatus(isUnique ? 'unique' : 'taken');
                    }
                }
                else {
                    setUniquenessStatus('error');
                }
            }
            catch (error) {
                studioContext?.logger?.warn('Failed to check slug uniqueness:', error);
                setUniquenessStatus('error');
            }
            finally {
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
        }
        else {
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
    const handleFocus = (event) => {
        const isEmpty = !value || value.trim() === '';
        console.log('🔍 SLUG DEBUG: Focus event', {
            isEmpty,
            readOnly,
            autoGenerate,
            currentValue: value
        });
        if (isEmpty && !readOnly && autoGenerate) {
            const generatedSlug = generateSlug();
            console.log('🔍 SLUG DEBUG: Focus generation', {
                generatedSlug,
                willGenerate: !!generatedSlug
            });
            if (generatedSlug) {
                onChange(generatedSlug);
                setIsManuallyEdited(false);
                console.log('🔍 SLUG DEBUG: Generated on focus:', generatedSlug);
            }
        }
        if (onFocus)
            onFocus();
    };
    // Handle manual input changes
    const handleChange = (event) => {
        const newValue = event.target.value;
        setIsManuallyEdited(true);
        onChange(newValue);
    };
    // Smart generation with uniqueness handling
    const handleSmartGeneration = async (baseSlug) => {
        try {
            let finalSlug = baseSlug;
            // If unique is required, find a unique variant
            if (unique && studioContext?.apiClient) {
                const isUnique = async (candidateSlug) => {
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
                    }
                    catch {
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
                    if (counter > 100)
                        break;
                }
                finalSlug = candidate;
            }
            console.log('🔍 SLUG DEBUG: Smart generation result', {
                baseSlug,
                finalSlug,
                wasChanged: baseSlug !== finalSlug
            });
            onChange(finalSlug);
            setIsManuallyEdited(false);
        }
        catch (error) {
            console.log('🔍 SLUG DEBUG: Smart generation failed, using base slug');
            // Fallback to basic slug if uniqueness check fails
            onChange(baseSlug);
            setIsManuallyEdited(false);
        }
    };
    // Handle regenerate button click with smart uniqueness
    const handleRegenerate = async () => {
        const baseSlug = generateSlug();
        if (!baseSlug)
            return;
        await handleSmartGeneration(baseSlug);
    };
    // Use hasError from field renderer system for styling, also consider uniqueness
    const hasValidationError = hasError || (uniquenessStatus === 'taken');
    const showUniquenessError = uniquenessStatus === 'taken' && !hasError;
    // Common input props
    const inputProps = {
        id: fieldId,
        value: value || '',
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
    return (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex gap-2", children: [_jsxs("div", { className: "flex-1 relative", children: [_jsx("input", { ...inputProps, type: "text" }), slugDefinition.unique && value && (_jsxs("div", { className: "absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center", children: [isCheckingUniqueness && (_jsx("div", { className: "animate-spin h-4 w-4 border-2 border-gray-300 dark:border-gray-500 border-t-blue-500 rounded-full", title: "Checking uniqueness..." })), !isCheckingUniqueness && uniquenessStatus === 'unique' && (_jsx("div", { className: "text-green-500 text-sm", title: "Slug is unique", children: "\u2713" })), !isCheckingUniqueness && uniquenessStatus === 'taken' && (_jsx("div", { className: "text-red-500 text-sm", title: "Slug already exists", children: "\u2717" })), !isCheckingUniqueness && uniquenessStatus === 'error' && (_jsx("div", { className: "text-orange-500 text-sm", title: "Could not check uniqueness", children: "\u26A0" }))] }))] }), slugDefinition.source && !slugDefinition.readOnly && !isDisabled && (_jsx("button", { type: "button", onClick: handleRegenerate, className: "px-3 py-2 text-sm bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors text-gray-700 dark:text-gray-200", title: "Regenerate slug from source field", children: "\u21BB" }))] }), showUniquenessError && (_jsx("div", { className: "text-sm text-red-600 dark:text-red-400", children: "This slug is already taken. Please choose a different one." })), slugDefinition.source && slugDefinition.autoGenerate && (_jsxs("div", { className: "text-xs text-gray-500 dark:text-gray-400", children: ["Auto-generated from: ", Array.isArray(slugDefinition.source) ? slugDefinition.source.join(', ') : slugDefinition.source, isManuallyEdited && ' (manually edited)'] }))] }));
}
