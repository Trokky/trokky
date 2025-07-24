/**
 * String Field Component
 * React component for rendering string input fields
 */

import React from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { StringFieldDefinition } from './definition.js';

// Use generic FieldComponentProps to match plugin interface
type StringFieldComponentProps = FieldComponentProps;

export function StringFieldComponent(props: StringFieldComponentProps) {
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
  
  // Type-safe access to string field specific properties
  const stringDefinition = definition as StringFieldDefinition;
  const options = stringDefinition.options || {};
  const validation = stringDefinition.validation || {};

  // Handle value transformation
  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
    disabled: isDisabled,
    readOnly: isReadonly,
    placeholder: options.placeholder,
    autoComplete: options.autoComplete,
    spellCheck: options.spellCheck,
    maxLength: validation.maxLength,
    className: `
      w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
      bg-white dark:bg-gray-700 text-gray-900 dark:text-white
      focus:ring-2 focus:ring-blue-500 focus:border-blue-500
      disabled:opacity-50 disabled:cursor-not-allowed
      ${hasError ? 'border-red-500 ring-1 ring-red-500' : ''}
      ${options.className || ''}
    `.trim()
  };

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