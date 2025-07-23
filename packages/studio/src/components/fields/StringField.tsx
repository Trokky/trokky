/**
 * String Field Component - Native React implementation using @trokky/fields-core for validation
 */

import React, { useCallback, useState } from 'react'
import { StringFieldType, type StringFieldConfig } from '@trokky/fields-browser'
import type { FieldRendererProps } from '../../types/field-renderer.js'
import { createStudioLogger } from '../../utils/logger.js'

const logger = createStudioLogger('StringField')

export interface StringFieldProps extends FieldRendererProps<string, StringFieldConfig> {}

/**
 * Native React String field component
 */
export function StringField({
  value = '',
  config,
  field,
  validation,
  state,
  onChange,
  onBlur,
  onFocus,
  context
}: StringFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [isTouched, setIsTouched] = useState(false)

  const {
    multiline = false,
    rows = 3,
    placeholder,
    format,
    maxLength,
    minLength
  } = config || {}

  const inputValue = value || ''
  const hasError = validation && !validation.isValid
  const errorMessage = validation?.errors?.[0]
  const warningMessage = validation?.warnings?.[0]

  // Determine input type based on format
  const inputType = format === 'password' ? 'password' 
                  : format === 'email' ? 'email'
                  : format === 'url' ? 'url'
                  : format === 'tel' ? 'tel'
                  : 'text'

  // Handle value changes with validation
  // @todo Integrate validation results into component state for real-time feedback
  // @todo Add debounced validation for better performance
  const handleChange = useCallback((newValue: string) => {
    try {
      // Use @trokky/fields-core for validation
      if (context && config) {
        const validationResult = StringFieldType.validate(newValue, config, context as any)
        // @todo Pass validation result back to parent form component
        logger.debug(`Validation result for "${field.name}":`, validationResult)
      }
      
      onChange(newValue)
    } catch (error) {
      logger.error(`Error validating field "${field.name}"`, error)
      onChange(newValue) // Still update the value even if validation fails
    }
  }, [config, context, field.name, onChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    handleChange(e.target.value)
  }

  const handleFocus = () => {
    setIsFocused(true)
    onFocus()
  }

  const handleBlur = () => {
    setIsFocused(false)
    setIsTouched(true)
    onBlur()
  }

  // Base classes for styling
  const baseClasses = [
    'w-full',
    'px-3 py-2',
    'border rounded-md',
    'text-sm',
    'placeholder-gray-400',
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    'transition-colors duration-200'
  ]

  // State-dependent classes
  const stateClasses = [
    hasError ? 'border-red-300 bg-red-50' : 'border-gray-300',
    state?.disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white',
    state?.readOnly ? 'bg-gray-50' : '',
    isFocused ? 'ring-2 ring-blue-500 border-transparent' : ''
  ]

  const className = [...baseClasses, ...stateClasses].filter(Boolean).join(' ')

  const commonProps = {
    id: field.name,
    value: inputValue,
    placeholder: placeholder || field.title || `Enter ${field.name}`,
    maxLength,
    readOnly: state?.readOnly,
    disabled: state?.disabled,
    onChange: handleInputChange,
    onBlur: handleBlur,
    onFocus: handleFocus,
    className,
    'aria-invalid': hasError,
    'aria-describedby': hasError ? `${field.name}-error` : undefined
  }

  return (
    <div className="field-wrapper">
      {/* Field Label */}
      <div className="mb-2">
        <label 
          htmlFor={field.name}
          className="block text-sm font-medium text-gray-700"
        >
          {field.title || field.name}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {field.description && (
          <p className="mt-1 text-xs text-gray-500">{field.description}</p>
        )}
      </div>

      {/* Input Field */}
      {multiline ? (
        <textarea
          rows={rows}
          {...commonProps}
        />
      ) : (
        <input
          type={inputType}
          {...commonProps}
        />
      )}

      {/* Character count for limited fields */}
      {maxLength && (
        <div className="mt-1 text-xs text-gray-500 text-right">
          <span className={inputValue.length > maxLength * 0.9 ? 'text-yellow-600' : ''}>
            {inputValue.length}
          </span>
          <span className="text-gray-400">/{maxLength}</span>
        </div>
      )}

      {/* Validation errors */}
      {hasError && isTouched && (
        <div 
          id={`${field.name}-error`}
          className="mt-2 text-sm text-red-600"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      {/* Validation warnings */}
      {warningMessage && isTouched && !hasError && (
        <div className="mt-2 text-sm text-yellow-600">
          {warningMessage}
        </div>
      )}

      {/* Help text for specific formats */}
      {format === 'email' && !hasError && !warningMessage && (
        <div className="mt-1 text-xs text-gray-500">
          Enter a valid email address
        </div>
      )}
      {format === 'url' && !hasError && !warningMessage && (
        <div className="mt-1 text-xs text-gray-500">
          Enter a valid URL (e.g., https://example.com)
        </div>
      )}
      {format === 'tel' && !hasError && !warningMessage && (
        <div className="mt-1 text-xs text-gray-500">
          Enter a valid phone number
        </div>
      )}
      {minLength && !hasError && !warningMessage && (
        <div className="mt-1 text-xs text-gray-500">
          Minimum {minLength} characters required
        </div>
      )}
    </div>
  )
}

/**
 * String field preview component for read-only display
 */
export function StringFieldPreview({
  value,
  config
}: Pick<StringFieldProps, 'value' | 'config'>) {
  if (!value) {
    return (
      <span className="text-gray-400 italic text-sm">
        (empty)
      </span>
    )
  }

  const { format } = config || {}
  
  // Special handling for different formats
  if (format === 'email') {
    return (
      <a 
        href={`mailto:${value}`}
        className="text-blue-600 hover:text-blue-800 underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {value}
      </a>
    )
  }

  if (format === 'url') {
    return (
      <a 
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 underline"
      >
        {value}
      </a>
    )
  }

  if (format === 'tel') {
    return (
      <a 
        href={`tel:${value}`}
        className="text-blue-600 hover:text-blue-800 underline"
      >
        {value}
      </a>
    )
  }

  if (format === 'password') {
    return (
      <span className="text-gray-500 font-mono">
        {'•'.repeat(Math.min(value.length, 8))}
      </span>
    )
  }

  // Truncate long text for compact display
  const displayValue = value.length > 100 
    ? `${value.slice(0, 97)}...`
    : value

  return (
    <span 
      className="text-gray-900"
      title={value.length > 100 ? value : undefined}
    >
      {displayValue}
    </span>
  )
}