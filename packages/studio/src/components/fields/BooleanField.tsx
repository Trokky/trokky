/**
 * Boolean Field Component - Native React implementation using @trokky/fields-core for validation
 */

import React, { useCallback } from 'react'
import { BooleanFieldType, type BooleanFieldConfig } from '@trokky/fields-browser'
import type { FieldRendererProps } from '../../types/field-renderer.js'
import { createStudioLogger } from '../../utils/logger.js'

const logger = createStudioLogger('BooleanField')

export interface BooleanFieldProps extends FieldRendererProps<boolean, BooleanFieldConfig> {}

/**
 * Native React Boolean field component
 */
export function BooleanField({
  value = false,
  config,
  field,
  validation,
  state,
  onChange,
  onBlur,
  onFocus,
  context
}: BooleanFieldProps) {
  const {
    layout = 'checkbox',
    trueLabel = 'Yes',
    falseLabel = 'No'
  } = config || {}

  const hasError = validation && !validation.isValid
  const errorMessage = validation?.errors?.[0]

  // Handle value changes with validation
  const handleChange = useCallback((newValue: boolean) => {
    try {
      // Use @trokky/fields-core for validation
      if (context && config) {
        const validationResult = BooleanFieldType.validate(newValue, config, context as any)
        logger.debug(`Validation result for "${field.name}":`, validationResult)
      }
      
      onChange(newValue)
    } catch (error) {
      logger.error(`Error validating field "${field.name}"`, error)
      onChange(newValue)
    }
  }, [config, context, field.name, onChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange(e.target.checked)
  }

  const handleSwitchToggle = () => {
    if (!state?.disabled && !state?.readOnly) {
      handleChange(!value)
    }
  }

  // Checkbox layout
  if (layout === 'checkbox') {
    return (
      <div className="field-wrapper">
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              id={field.name}
              type="checkbox"
              checked={value}
              disabled={state?.disabled}
              readOnly={state?.readOnly}
              onChange={handleInputChange}
              onBlur={onBlur}
              onFocus={onFocus}
              className={`
                w-4 h-4 rounded border-gray-300 text-blue-600 
                focus:ring-blue-500 focus:ring-2 focus:ring-offset-0
                disabled:opacity-50 disabled:cursor-not-allowed
                ${hasError ? 'border-red-300' : 'border-gray-300'}
              `}
              aria-invalid={hasError}
              aria-describedby={hasError ? `${field.name}-error` : undefined}
            />
          </div>
          <div className="ml-3">
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
        </div>

        {/* Validation errors */}
        {hasError && (
          <div 
            id={`${field.name}-error`}
            className="mt-2 text-sm text-red-600"
            role="alert"
          >
            {errorMessage}
          </div>
        )}
      </div>
    )
  }

  // Switch layout
  if (layout === 'switch') {
    return (
      <div className="field-wrapper">
        <div className="flex items-center justify-between">
          <div>
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
          
          <button
            id={field.name}
            type="button"
            role="switch"
            aria-checked={value}
            disabled={state?.disabled}
            onClick={handleSwitchToggle}
            onBlur={onBlur}
            onFocus={onFocus}
            className={`
              relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
              transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
              ${value ? 'bg-blue-600' : 'bg-gray-200'}
              ${hasError ? 'ring-2 ring-red-300' : ''}
            `}
            aria-invalid={hasError}
            aria-describedby={hasError ? `${field.name}-error` : undefined}
          >
            <span
              className={`
                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                transition duration-200 ease-in-out
                ${value ? 'translate-x-5' : 'translate-x-0'}
              `}
            />
          </button>
        </div>

        {/* Validation errors */}
        {hasError && (
          <div 
            id={`${field.name}-error`}
            className="mt-2 text-sm text-red-600"
            role="alert"
          >
            {errorMessage}
          </div>
        )}
      </div>
    )
  }

  // Radio button layout
  if (layout === 'radio') {
    return (
      <div className="field-wrapper">
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700">
            {field.title || field.name}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {field.description && (
            <p className="mt-1 text-xs text-gray-500">{field.description}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center">
            <input
              id={`${field.name}-true`}
              name={field.name}
              type="radio"
              checked={value === true}
              disabled={state?.disabled}
              readOnly={state?.readOnly}
              onChange={() => handleChange(true)}
              onBlur={onBlur}
              onFocus={onFocus}
              className={`
                w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2
                disabled:opacity-50 disabled:cursor-not-allowed
                ${hasError ? 'border-red-300' : 'border-gray-300'}
              `}
            />
            <label htmlFor={`${field.name}-true`} className="ml-2 text-sm text-gray-700">
              {trueLabel}
            </label>
          </div>
          
          <div className="flex items-center">
            <input
              id={`${field.name}-false`}
              name={field.name}
              type="radio"
              checked={value === false}
              disabled={state?.disabled}
              readOnly={state?.readOnly}
              onChange={() => handleChange(false)}
              onBlur={onBlur}
              onFocus={onFocus}
              className={`
                w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2
                disabled:opacity-50 disabled:cursor-not-allowed
                ${hasError ? 'border-red-300' : 'border-gray-300'}
              `}
            />
            <label htmlFor={`${field.name}-false`} className="ml-2 text-sm text-gray-700">
              {falseLabel}
            </label>
          </div>
        </div>

        {/* Validation errors */}
        {hasError && (
          <div 
            id={`${field.name}-error`}
            className="mt-2 text-sm text-red-600"
            role="alert"
          >
            {errorMessage}
          </div>
        )}
      </div>
    )
  }

  // Default fallback to checkbox
  return null
}

/**
 * Boolean field preview component for read-only display
 */
export function BooleanFieldPreview({
  value,
  config
}: Pick<BooleanFieldProps, 'value' | 'config'>) {
  const { trueLabel = 'Yes', falseLabel = 'No' } = config || {}
  // @todo Add variant support to BooleanFieldConfig

  if (value === null || value === undefined) {
    return (
      <span className="text-gray-400 italic text-sm">
        (not set)
      </span>
    )
  }

  const displayText = value ? trueLabel : falseLabel
  
  // @todo Add variant support to BooleanFieldConfig and use it here
  // For now, use simple text display
  return (
    <span 
      className={`
        text-sm font-medium
        ${value ? 'text-green-700' : 'text-gray-600'}
      `}
    >
      {displayText}
    </span>
  )
}