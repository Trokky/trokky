/**
 * Textarea Field Component
 * React component for rendering multi-line text input fields
 */

import React, { useRef, useEffect } from 'react';
import { useT } from '@trokky/trokky/i18n';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { TextareaFieldDefinition } from './definition.js';

// Use generic FieldComponentProps to match plugin interface
type TextareaFieldComponentProps = FieldComponentProps;

export function TextareaFieldComponent(props: TextareaFieldComponentProps) {
  const { t } = useT('fields');
  const {
    fieldId,
    value,
    onChange,
    definition,
    hasError,
    isDisabled,
    isReadonly,
    onFocus,
    onBlur
  } = props;
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Type-safe access to textarea field specific properties
  const textareaDefinition = definition as TextareaFieldDefinition;
  const options = textareaDefinition.options || {};
  const validation = textareaDefinition.validation || {};

  // Read-only mode: render as display text
  if (isReadonly && !isDisabled) {
    const displayValue = (value as string) || '';
    
    // Handle empty values
    if (!displayValue || displayValue.trim() === '') {
      return (
        <div className="text-gray-400 dark:text-gray-500 italic text-sm py-2 min-h-[80px] flex items-start">
          {t('noValue')}
        </div>
      );
    }

    // Display multiline text with preserved formatting
    return (
      <div className="text-gray-900 dark:text-gray-100 text-sm py-2 whitespace-pre-wrap border border-gray-300 dark:border-gray-600 rounded-lg px-3 bg-gray-50 dark:bg-gray-800 min-h-[80px]">
        {displayValue}
      </div>
    );
  }

  // Auto-resize functionality
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea || !options.autoResize) return;

    // Reset height to get accurate scrollHeight
    textarea.style.height = 'auto';
    
    const minHeight = (options.minRows || 2) * 24; // Approximate line height
    const maxHeight = options.maxRows ? options.maxRows * 24 : Infinity;
    
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  };

  // Adjust height on mount and value changes
  useEffect(() => {
    adjustHeight();
  }, [value]);

  // Handle value changes
  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    onChange(newValue);
    
    // Adjust height after value change
    if (options.autoResize) {
      setTimeout(adjustHeight, 0);
    }
  };

  // Count words and lines for validation feedback
  const wordCount = typeof value === 'string' ? value.trim().split(/\s+/).filter(word => word.length > 0).length : 0;
  const lineCount = typeof value === 'string' ? value.split('\n').length : 0;

  return (
    <div className="w-full">
      <textarea
        ref={textareaRef}
        id={fieldId}
        value={(value as string) || ''}
        onChange={handleChange}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={isDisabled}
        readOnly={isReadonly}
        placeholder={options.placeholder}
        autoComplete={options.autoComplete}
        spellCheck={options.spellCheck}
        wrap={options.wrap}
        rows={options.rows || 4}
        maxLength={validation.maxLength}
        className={`
          w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
          bg-white dark:bg-gray-700 text-gray-900 dark:text-white
          focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          disabled:opacity-50 disabled:cursor-not-allowed
          resize-vertical min-h-[80px]
          ${hasError ? 'border-red-500 ring-1 ring-red-500' : ''}
          ${options.autoResize ? 'resize-none' : ''}
          ${options.className || ''}
        `.trim()}
      />
      
      {/* Character/word/line count feedback */}
      {(validation.maxLength || validation.wordCount?.max || validation.lineCount?.max) && (
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
          <div className="flex gap-4">
            {validation.wordCount?.max && (
              <span className={wordCount > validation.wordCount.max ? 'text-red-500' : ''}>
                {wordCount}/{validation.wordCount.max} {t('types.text.words')}
              </span>
            )}
            {validation.lineCount?.max && (
              <span className={lineCount > validation.lineCount.max ? 'text-red-500' : ''}>
                {lineCount}/{validation.lineCount.max} {t('types.text.lines')}
              </span>
            )}
          </div>
          {validation.maxLength && (
            <span className={((value as string) || '').length > validation.maxLength ? 'text-red-500' : ''}>
              {((value as string) || '').length}/{validation.maxLength}
            </span>
          )}
        </div>
      )}
    </div>
  );
}