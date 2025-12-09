/**
 * String Field Component
 * React component for rendering string input fields
 */

import React from 'react';
import { useT } from '@trokky/i18n';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { StringFieldDefinition, StringListOption } from './definition.js';

// Use generic FieldComponentProps to match plugin interface
type StringFieldComponentProps = FieldComponentProps;

export function StringFieldComponent(props: StringFieldComponentProps) {
  const { t } = useT('fields');
  const {
    fieldId,
    value,
    onChange,
    definition,
    hasError,
    isDisabled,
    isReadonly,
    mode,
    onFocus,
    onBlur,
    onKeyPress,
    onKeyDown,
    ...restProps
  } = props;

  // Type-safe access to string field specific properties
  const stringDefinition = definition as StringFieldDefinition;
  const options = stringDefinition.options || {};
  const validation = stringDefinition.validation || {};

  // Check if we're in read-only mode (consistent with other field components)
  const isViewMode = mode === 'preview' || isReadonly || isDisabled;

  // Read-only mode: render as display text
  if (isViewMode) {
    const displayValue = (value as string) || '';
    
    // Handle empty values
    if (!displayValue || displayValue.trim() === '') {
      return (
        <div className="text-gray-400 dark:text-gray-500 italic text-sm py-2">
          {t('types.string.noValue')}
        </div>
      );
    }

    // Handle dropdown/select fields - show the selected option title
    if (options.list && options.list.length > 0) {
      // Normalize list options to find the selected title
      const normalizedOptions = options.list.map(item => {
        if (typeof item === 'string') {
          return { title: item, value: item };
        }
        return item as StringListOption;
      });

      const selectedOption = normalizedOptions.find(option => option.value === displayValue);
      const displayTitle = selectedOption ? selectedOption.title : displayValue;

      return (
        <div className="py-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-900 dark:text-gray-100 text-sm">
              {displayTitle}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({t('types.string.selection')})
            </span>
          </div>
        </div>
      );
    }

    // Handle password fields (from inputType or field name)
    if (options.inputType === 'password') {
      return (
        <div className="text-gray-500 dark:text-gray-400 font-mono text-sm py-2">
          {'•'.repeat(Math.min(displayValue.length, 8))}
        </div>
      );
    }

    // Handle email fields
    if (options.inputType === 'email' || validation.email) {
      return (
        <div className="py-2">
          <a 
            href={`mailto:${displayValue}`}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            {displayValue}
          </a>
        </div>
      );
    }

    // Handle URL fields
    if (options.inputType === 'url' || validation.url) {
      return (
        <div className="py-2">
          <a 
            href={displayValue}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm"
          >
            {displayValue}
          </a>
        </div>
      );
    }

    // Handle phone number fields
    if (options.inputType === 'tel') {
      return (
        <div className="py-2">
          <a 
            href={`tel:${displayValue}`}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm"
          >
            {displayValue}
          </a>
        </div>
      );
    }

    // Handle multiline text
    if (options.multiline && displayValue.includes('\n')) {
      return (
        <div className="text-gray-900 dark:text-gray-100 text-sm py-2 whitespace-pre-wrap">
          {displayValue}
        </div>
      );
    }

    // Default text display
    return (
      <div className="text-gray-900 dark:text-gray-100 text-sm py-2">
        {displayValue}
      </div>
    );
  }

  // Handle value transformation
  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    let newValue = event.target.value;
    
    // Apply transformations
    if (options.transform) {
      switch (options.transform) {
        case 'lowercase':
          newValue = newValue.toLowerCase();
          break;
        case 'uppercase':
          newValue = newValue.toUpperCase();
          break;
        case 'capitalize':
          newValue = newValue.replace(/\b\w/g, (l) => l.toUpperCase());
          break;
      }
    }
    
    onChange(newValue);
  };

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
    readOnly: isReadonly,
    placeholder: options.placeholder,
    autoComplete: options.autoComplete,
    spellCheck: options.spellCheck,
    maxLength: validation.maxLength,
    className: (() => {
      const baseClasses = hasError 
        ? 'w-full px-3 py-2 border !border-red-400 rounded-lg'
        : 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg';
      
      const finalClassName = `
        ${baseClasses}
        bg-white dark:bg-gray-700 text-gray-900 dark:text-white
        focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        disabled:opacity-50 disabled:cursor-not-allowed
        ${options.className || ''}
      `.trim();
      return finalClassName;
    })(),
    style: hasError ? { 
      borderColor: '#f87171', // red-400 (more subtle)
      boxShadow: '0 0 0 1px rgba(248, 113, 113, 0.3)' // subtle ring
    } : undefined
  };

  // Render select/dropdown if list options are provided (Sanity-style)
  if (options.list && options.list.length > 0) {
    // Normalize list options to always have title and value
    const normalizedOptions = options.list.map(item => {
      if (typeof item === 'string') {
        return { title: item, value: item };
      }
      return item as StringListOption;
    });

    return (
      <select
        {...inputProps}
        className={inputProps.className}
        style={inputProps.style}
      >
        {!stringDefinition.required && (
          <option value="">{options.placeholder || t('types.select.placeholder')}</option>
        )}
        {normalizedOptions.map(option => (
          <option key={option.value} value={option.value}>
            {option.title}
          </option>
        ))}
      </select>
    );
  }

  // Render multiline textarea
  if (options.multiline) {
    return (
      <textarea
        {...inputProps}
        rows={options.rows || 3}
        className={`${inputProps.className} resize-vertical min-h-[80px]`}
      />
    );
  }

  // Render single-line input
  return (
    <input
      {...inputProps}
      type={options.inputType || 'text'}
    />
  );
}