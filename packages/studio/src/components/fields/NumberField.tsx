/**
 * Number Field Component - Native React implementation using @trokky/fields-core for validation
 */

import React, { useCallback, useState } from 'react'
import { NumberFieldType, type NumberFieldConfig } from '@trokky/fields-browser'
import type { FieldRendererProps } from '../../types/field-renderer.js'
import { createStudioLogger } from '../../utils/logger.js'

const logger = createStudioLogger('NumberField')

export interface NumberFieldProps extends FieldRendererProps<number, NumberFieldConfig> {}

/**
 * Native React Number field component
 */
export function NumberField({
  value,
  config,
  field,
  validation,
  state,
  onChange,
  onBlur,
  onFocus,
  context
}: NumberFieldProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [isTouched, setIsTouched] = useState(false)
  const [displayValue, setDisplayValue] = useState(value?.toString() || '')

  const {
    min,
    max,
    step = 1,
    precision,
    placeholder,
    format = 'number'
  } = config || {}

  const hasError = validation && !validation.isValid
  const errorMessage = validation?.errors?.[0]
  const warningMessage = validation?.warnings?.[0]

  // Handle value changes with validation
  const handleChange = useCallback((newValue: number | null) => {
    try {
      // Use @trokky/fields-core for validation
      if (context && config && newValue !== null) {
        const validationResult = NumberFieldType.validate(newValue, config, context as any)
        logger.debug(`Validation result for "${field.name}":`, validationResult)
      }
      
      onChange(newValue)
    } catch (error) {
      logger.error(`Error validating field "${field.name}"`, error)
      onChange(newValue)
    }
  }, [config, context, field.name, onChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value
    setDisplayValue(inputValue)

    // Parse the input value
    if (inputValue === '') {
      handleChange(null)
      return
    }

    const numericValue = parseFloat(inputValue)
    
    // Check if it's a valid number
    if (!isNaN(numericValue)) {
      // Apply precision if specified
      const finalValue = precision !== undefined 
        ? parseFloat(numericValue.toFixed(precision))
        : numericValue
      
      handleChange(finalValue)
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
    onFocus()
  }

  const handleBlur = () => {
    setIsFocused(false)
    setIsTouched(true)
    
    // Format the display value on blur
    if (value !== null && value !== undefined) {
      const formattedValue = precision !== undefined 
        ? value.toFixed(precision)
        : value.toString()
      setDisplayValue(formattedValue)
    }
    
    onBlur()
  }

  // Update display value when prop changes
  React.useEffect(() => {
    if (value !== null && value !== undefined) {
      setDisplayValue(value.toString())
    } else {
      setDisplayValue('')
    }
  }, [value])

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

  // Determine input type
  const inputType = format === 'currency' ? 'number' : 'number'

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
      <div className="relative">
        {format === 'currency' && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">$</span>
          </div>
        )}
        
        <input
          id={field.name}
          type={inputType}
          value={displayValue}
          placeholder={placeholder || field.title || `Enter ${field.name}`}
          min={min}
          max={max}
          step={step}
          readOnly={state?.readOnly}
          disabled={state?.disabled}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          className={format === 'currency' ? `pl-8 ${className}` : className}
          aria-invalid={hasError}
          aria-describedby={hasError ? `${field.name}-error` : undefined}
        />
        
        {format === 'percentage' && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-gray-500 sm:text-sm">%</span>
          </div>
        )}
      </div>

      {/* Range indicator for min/max */}
      {(min !== undefined || max !== undefined) && (
        <div className="mt-1 text-xs text-gray-500">
          {min !== undefined && max !== undefined 
            ? `Range: ${min} - ${max}`
            : min !== undefined 
            ? `Minimum: ${min}`
            : `Maximum: ${max}`
          }
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

      {/* Help text */}
      {step !== 1 && !hasError && !warningMessage && (
        <div className="mt-1 text-xs text-gray-500">
          Step: {step}
        </div>
      )}
    </div>
  )
}

/**
 * Number field preview component for read-only display
 */
export function NumberFieldPreview({
  value,
  config
}: Pick<NumberFieldProps, 'value' | 'config'>) {
  if (value === null || value === undefined) {
    return (
      <span className="text-gray-400 italic text-sm">
        (empty)
      </span>
    )
  }

  const { format, precision } = config || {}

  // Format the number based on config
  let displayValue: string

  if (format === 'currency') {
    displayValue = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: precision ?? 2,
      maximumFractionDigits: precision ?? 2
    }).format(value)
  } else if (format === 'percentage') {
    displayValue = `${precision !== undefined ? value.toFixed(precision) : value}%`
  } else {
    displayValue = precision !== undefined ? value.toFixed(precision) : value.toString()
  }

  return (
    <span className="text-gray-900 font-mono">
      {displayValue}
    </span>
  )
}