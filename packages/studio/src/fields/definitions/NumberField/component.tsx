import React, { useState, useEffect } from 'react';
import { useT } from 'trokky/i18n';
import { StringFieldComponent } from '../StringField/component.js';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { NumberFieldDefinition } from './definition.js';
import { formatNumber, parseFormattedNumber } from './validation.js';

// Number field component props
type NumberFieldComponentProps = FieldComponentProps;

export function NumberFieldComponent(props: NumberFieldComponentProps) {
  const { t } = useT('fields');
  const { definition, value, onChange, isReadonly, isDisabled, hasError } = props;
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Ensure number-specific properties are set
  const numberDefinition = definition as NumberFieldDefinition;
  const showSpinButtons = numberDefinition.options?.showSpinButtons !== false; // Default true
  const autoFormat = numberDefinition.options?.autoFormat !== false; // Default true
  const displayMode = numberDefinition.options?.displayMode || 'input';
  const showValue = numberDefinition.options?.showValue !== false; // Default true for slider

  // Read-only mode: render as display text
  if (isReadonly && !isDisabled) {
    const numValue = typeof value === 'number' ? value : parseFormattedNumber(String(value || ''), numberDefinition);
    
    // Handle empty values
    if (value === null || value === undefined || value === '') {
      return (
        <div className="text-gray-400 dark:text-gray-500 italic text-sm py-2">
          {t('types.number.noValue')}
        </div>
      );
    }

    // Display formatted number
    if (numValue !== null && isFinite(numValue)) {
      const formattedValue = autoFormat ? formatNumber(numValue, numberDefinition) : numValue.toString();
      return (
        <div className="text-gray-900 dark:text-gray-100 text-sm py-2 font-mono">
          {formattedValue}
        </div>
      );
    } else {
      // Display raw value if it can't be parsed as a number
      return (
        <div className="text-gray-500 dark:text-gray-400 text-sm py-2 font-mono">
          {String(value)}
        </div>
      );
    }
  }
  
  // Update display value when prop value changes
  useEffect(() => {
    if (value === null || value === undefined || value === '') {
      setDisplayValue('');
      return;
    }
    
    const numValue = typeof value === 'number' ? value : parseFormattedNumber(String(value), numberDefinition);
    
    if (numValue !== null && isFinite(numValue)) {
      if (isFocused) {
        // When focused, show raw number for editing
        setDisplayValue(numValue.toString());
      } else if (autoFormat) {
        // When not focused, show formatted number
        setDisplayValue(formatNumber(numValue, numberDefinition));
      } else {
        setDisplayValue(numValue.toString());
      }
    } else {
      setDisplayValue(String(value));
    }
  }, [value, numberDefinition, isFocused, autoFormat]);
  
  const enhancedDefinition = {
    ...numberDefinition,
    options: {
      inputType: 'text', // Use text to allow formatting, but with inputMode for mobile
      placeholder: getPlaceholderText(numberDefinition),
      inputMode: getInputMode(numberDefinition),
      spellCheck: false, // Disable spellcheck for numbers
      autoComplete: 'off', // Usually not needed for numbers
      ...numberDefinition.options
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Convert to raw number for editing
    const numValue = parseFormattedNumber(displayValue, numberDefinition);
    if (numValue !== null && isFinite(numValue)) {
      setDisplayValue(numValue.toString());
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Parse and validate the input
    const numValue = parseFormattedNumber(displayValue, numberDefinition);
    
    if (numValue !== null && isFinite(numValue)) {
      // Update the actual value
      onChange(numValue);
      
      // Format for display if auto-format is enabled
      if (autoFormat) {
        setDisplayValue(formatNumber(numValue, numberDefinition));
      }
    } else if (displayValue.trim() === '') {
      // Handle empty input
      onChange('');
      setDisplayValue('');
    } else {
      // Invalid input - keep as is for user to correct
      onChange(displayValue);
    }
  };


  const handleKeyPress = (event: React.KeyboardEvent) => {
    // Allow control keys (backspace, delete, arrow keys, etc.)
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    
    // Allow specific keys
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (allowedKeys.includes(event.key)) return;
    
    // Allow numeric characters, decimal point, minus sign, and common formatting
    const allowedChars = /[0-9.\-+,\s]/;
    if (!allowedChars.test(event.key)) {
      event.preventDefault();
    }
  };

  const handleChange = (newValue: string) => {
    setDisplayValue(newValue);
    
    // If not focused (programmatic change), parse and update immediately
    if (!isFocused) {
      const numValue = parseFormattedNumber(newValue, numberDefinition);
      if (numValue !== null && isFinite(numValue)) {
        onChange(numValue);
      } else {
        onChange(newValue);
      }
    }
  };

  const handleIncrement = () => {
    const currentNum = parseFormattedNumber(displayValue, numberDefinition) || 0;
    const step = numberDefinition.validation?.step || 1;
    const newValue = currentNum + step;
    
    // Apply max constraint
    const max = numberDefinition.validation?.max;
    const finalValue = max !== undefined ? Math.min(newValue, max) : newValue;
    
    onChange(finalValue);
  };

  const handleDecrement = () => {
    const currentNum = parseFormattedNumber(displayValue, numberDefinition) || 0;
    const step = numberDefinition.validation?.step || 1;
    const newValue = currentNum - step;

    // Apply min constraint
    const min = numberDefinition.validation?.min;
    const finalValue = min !== undefined ? Math.max(newValue, min) : newValue;

    onChange(finalValue);
  };

  // Slider mode
  if (displayMode === 'slider') {
    const min = numberDefinition.validation?.min ?? 0;
    const max = numberDefinition.validation?.max ?? 100;
    const step = numberDefinition.validation?.step || 1;
    const precision = numberDefinition.validation?.precision ?? 2;

    const numValue = typeof value === 'number' ? value : (parseFormattedNumber(String(value || ''), numberDefinition) ?? min);
    const currentValue = Math.max(min, Math.min(max, numValue));

    // Calculate percentage for gradient
    const percentage = ((currentValue - min) / (max - min)) * 100;

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value);
      onChange(newValue);
    };

    return (
      <div className="w-full">
        <div className="flex items-center gap-3">
          {/* Min label */}
          <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right flex-shrink-0">
            {min}
          </span>

          {/* Slider */}
          <div className="flex-1 relative">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={currentValue}
              onChange={handleSliderChange}
              disabled={isDisabled || isReadonly}
              className={`w-full h-2 rounded-lg appearance-none cursor-pointer
                ${isDisabled || isReadonly ? 'opacity-50 cursor-not-allowed' : ''}
                ${hasError ? 'accent-red-500' : 'accent-blue-600'}
              `}
              style={{
                background: `linear-gradient(to right, ${hasError ? '#ef4444' : '#2563eb'} 0%, ${hasError ? '#ef4444' : '#2563eb'} ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`
              }}
            />
          </div>

          {/* Max label */}
          <span className="text-xs text-gray-500 dark:text-gray-400 w-8 flex-shrink-0">
            {max}
          </span>

          {/* Current value display */}
          {showValue && (
            <span className={`text-sm font-medium w-16 text-right flex-shrink-0 ${
              hasError ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
            }`}>
              {currentValue.toFixed(precision)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <StringFieldComponent
        {...props}
        definition={enhancedDefinition}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyPress={handleKeyPress}
      />
      
      {/* Spin buttons - positioned like password field icons */}
      {showSpinButtons && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex flex-col">
          <button
            type="button"
            onClick={handleIncrement}
            className="w-5 h-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 focus:outline-none flex items-center justify-center"
            tabIndex={-1}
            aria-label={t('types.number.increaseValue')}
            title={t('types.number.increaseValue')}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={handleDecrement}
            className="w-5 h-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 focus:outline-none flex items-center justify-center"
            tabIndex={-1}
            aria-label={t('types.number.decreaseValue')}
            title={t('types.number.decreaseValue')}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function getPlaceholderText(definition: NumberFieldDefinition): string {
  const options = definition.options || {};
  
  if (options.placeholder) {
    return options.placeholder;
  }
  
  // Generate contextual placeholder based on format
  switch (options.format) {
    case 'currency':
      return `0.00 ${options.currency || 'USD'}`;
    case 'percentage':
      return '0.00%';
    case 'scientific':
      return '1.23e+4';
    default:
      if (definition.validation?.integerOnly) {
        return 'Enter whole number';
      }
      return 'Enter number';
  }
}

function getInputMode(definition: NumberFieldDefinition): "decimal" | "numeric" {
  const validation = definition.validation || {};
  
  if (validation.integerOnly) {
    return 'numeric'; // Integer numbers
  }
  
  return 'decimal'; // Decimal numbers
}