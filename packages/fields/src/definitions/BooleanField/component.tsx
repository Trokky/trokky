import React from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { BooleanFieldDefinition } from './definition.js';
import { convertToBoolean } from './validation.js';

// Boolean field component props
type BooleanFieldComponentProps = FieldComponentProps;

export function BooleanFieldComponent(props: BooleanFieldComponentProps) {
  const { definition, value, onChange, hasError, fieldId, isDisabled, isReadonly } = props;
  
  // Type guard for boolean field definition
  if (definition.type !== 'boolean') {
    return <div className="text-red-500 text-sm">Invalid field configuration: expected boolean field</div>;
  }
  
  const booleanDefinition = definition as BooleanFieldDefinition;
  const options = booleanDefinition.options || {};
  
  const style = options.style || 'checkbox';
  const size = options.size || 'md';
  const color = options.color || 'blue';
  const labelPosition = options.labelPosition || 'right';
  const label = options.label || booleanDefinition.title;
  const trueText = options.trueText || 'Yes';
  const falseText = options.falseText || 'No';
  
  // Convert value to boolean with null fallback
  const boolValue = convertToBoolean(value) ?? false;
  const isChecked = boolValue === true;
  
  const handleChange = (newValue: boolean) => {
    onChange(newValue);
  };
  
  // Size classes
  const sizeClasses = {
    sm: { control: 'w-4 h-4', text: 'text-sm' },
    md: { control: 'w-5 h-5', text: 'text-base' },
    lg: { control: 'w-6 h-6', text: 'text-lg' }
  };
  
  // Validate and sanitize color input to prevent CSS injection
  const ALLOWED_COLORS = ['blue', 'green', 'red', 'purple', 'gray'] as const;
  const sanitizedColor = ALLOWED_COLORS.includes(color as any) ? color : 'blue';
  
  // Color classes for checked state
  const colorClasses = {
    blue: { bg: 'bg-blue-600', border: 'border-blue-600', ring: 'focus:ring-blue-500' },
    green: { bg: 'bg-green-600', border: 'border-green-600', ring: 'focus:ring-green-500' },
    red: { bg: 'bg-red-600', border: 'border-red-600', ring: 'focus:ring-red-500' },
    purple: { bg: 'bg-purple-600', border: 'border-purple-600', ring: 'focus:ring-purple-500' },
    gray: { bg: 'bg-gray-600', border: 'border-gray-600', ring: 'focus:ring-gray-500' }
  };
  
  const currentSize = sizeClasses[size];
  const currentColor = colorClasses[sanitizedColor];
  
  // Common classes for controls
  const baseControlClasses = `
    ${currentSize.control}
    border-2 rounded transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `.trim();
  
  const errorClasses = hasError 
    ? 'border-red-400 focus:ring-red-500'
    : 'border-gray-300 dark:border-gray-600';
  
  // Render different styles
  const renderControl = () => {
    switch (style) {
      case 'toggle':
        // @todo: Toggle switch UI is not working properly - needs investigation
        // Issues: Click handler may not be triggering state changes, or CSS classes not applying correctly
        // The toggle should change background color and slide the white circle when clicked
        // Will need to debug the onClick event, state updates, and CSS class application
        return (
          <button
            type="button"
            id={fieldId}
            role="switch"
            aria-checked={isChecked}
            disabled={isDisabled || isReadonly}
            onClick={() => handleChange(!isChecked)}
            className={`
              relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-offset-2 ${currentColor.ring}
              ${isChecked ? currentColor.bg : 'bg-gray-200 dark:bg-gray-700'}
              ${hasError ? 'ring-red-500' : ''}
              disabled:opacity-50 disabled:cursor-not-allowed
            `.trim()}
          >
            <span
              className={`
                inline-block w-4 h-4 transform transition-transform duration-200 bg-white rounded-full shadow-lg
                ${isChecked ? 'translate-x-6' : 'translate-x-1'}
              `.trim()}
            />
          </button>
        );
        
      case 'radio':
        return (
          <div className="flex space-x-4">
            <label className={`flex items-center space-x-2 ${currentSize.text}`}>
              <input
                type="radio"
                name={fieldId}
                checked={isChecked}
                disabled={isDisabled || isReadonly}
                onChange={() => handleChange(true)}
                className={`${baseControlClasses} rounded-full ${isChecked ? `${currentColor.bg} ${currentColor.border}` : errorClasses}`}
              />
              <span className="text-gray-700 dark:text-gray-300">{trueText}</span>
            </label>
            <label className={`flex items-center space-x-2 ${currentSize.text}`}>
              <input
                type="radio"
                name={fieldId}
                checked={!isChecked}
                disabled={isDisabled || isReadonly}
                onChange={() => handleChange(false)}
                className={`${baseControlClasses} rounded-full ${!isChecked ? `${currentColor.bg} ${currentColor.border}` : errorClasses}`}
              />
              <span className="text-gray-700 dark:text-gray-300">{falseText}</span>
            </label>
          </div>
        );
        
      case 'button':
        return (
          <div className="flex space-x-2">
            <button
              type="button"
              disabled={isDisabled || isReadonly}
              onClick={() => handleChange(true)}
              className={`
                px-4 py-2 rounded-lg border-2 transition-colors duration-200 ${currentSize.text}
                focus:outline-none focus:ring-2 focus:ring-offset-2 ${currentColor.ring}
                ${isChecked 
                  ? `${currentColor.bg} ${currentColor.border} text-white` 
                  : `border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800`}
                disabled:opacity-50 disabled:cursor-not-allowed
              `.trim()}
            >
              {trueText}
            </button>
            <button
              type="button"
              disabled={isDisabled || isReadonly}
              onClick={() => handleChange(false)}
              className={`
                px-4 py-2 rounded-lg border-2 transition-colors duration-200 ${currentSize.text}
                focus:outline-none focus:ring-2 focus:ring-offset-2 ${currentColor.ring}
                ${!isChecked 
                  ? `${currentColor.bg} ${currentColor.border} text-white` 
                  : `border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800`}
                disabled:opacity-50 disabled:cursor-not-allowed
              `.trim()}
            >
              {falseText}
            </button>
          </div>
        );
        
      default: // checkbox
        return (
          <input
            type="checkbox"
            id={fieldId}
            checked={isChecked}
            disabled={isDisabled || isReadonly}
            onChange={(e) => handleChange(e.target.checked)}
            className={`
              ${baseControlClasses} rounded
              ${isChecked ? `${currentColor.bg} ${currentColor.border}` : errorClasses}
            `.trim()}
          />
        );
    }
  };
  
  // Render with label positioning
  const control = renderControl();
  
  if (style === 'radio' || style === 'button') {
    // Radio and button styles include their own labels
    return <div className="space-y-1">{control}</div>;
  }
  
  if (!label && style !== 'toggle') {
    // No label, just return the control
    return control;
  }
  
  // Render with label
  const labelElement = (
    <label 
      htmlFor={style !== 'toggle' ? fieldId : undefined}
      className={`${currentSize.text} text-gray-700 dark:text-gray-300 ${
        isDisabled ? 'opacity-50' : 'cursor-pointer'
      }`}
    >
      {label}
    </label>
  );
  
  return (
    <div className="flex items-center space-x-3">
      {labelPosition === 'left' && labelElement}
      {control}
      {labelPosition === 'right' && labelElement}
    </div>
  );
}