/**
 * Universal Field Renderer
 * 
 * Component that renders fields using the field registry.
 * Works in both integrated and standalone Studio modes.
 * Based on proven legacy architecture from Trokky v1
 */

import React from 'react';
import { fieldRegistry } from '../registry/FieldRegistry.js';
import { FieldWrapper } from './FieldWrapper.js';
import type { FieldComponentProps } from '../base/FieldPlugin.js';

export interface FieldRendererProps extends FieldComponentProps {
  mode?: 'edit' | 'preview';
  compact?: boolean;
  maxLength?: number;
}

// Component that renders a field plugin with its wrapper
export function FieldRenderer({ 
  fieldId, 
  value, 
  onChange, 
  definition, 
  hasError,
  error,
  validationState,
  isDisabled,
  isReadonly,
  documentContext,
  onValidationChange,
  onFocus,
  onBlur,
  mode = 'edit',
  compact = false,
  maxLength,
  ...additionalProps
}: FieldRendererProps) {
  // Get the plugin for this field type
  const plugin = fieldRegistry.get(definition.type);
  
  if (!plugin) {
    const errorMessage = `Unsupported field type: ${definition.type}`;
    
    if (mode === 'preview') {
      return (
        <span className="text-gray-500 dark:text-gray-400 italic text-sm">
          {errorMessage}
        </span>
      );
    }
    
    return (
      <FieldWrapper
        fieldId={fieldId}
        definition={definition}
        hasError={hasError}
        error={error}
        validationState={validationState}
      >
        <div className="text-sm text-gray-500 italic">
          {errorMessage}
        </div>
      </FieldWrapper>
    );
  }

  // Preview mode: use preview component without wrapper
  if (mode === 'preview') {
    const PreviewComponent = plugin.previewComponent;
    
    if (!PreviewComponent) {
      // Fallback to simple text display if no preview component
      return (
        <span className="text-gray-900 dark:text-gray-100 text-sm">
          {typeof value === 'string' ? value : JSON.stringify(value)}
        </span>
      );
    }

    return (
      <PreviewComponent
        fieldId={fieldId}
        value={value}
        onChange={onChange}
        definition={definition}
        hasError={hasError}
        error={error}
        validationState={validationState}
        isDisabled={isDisabled}
        isReadonly={isReadonly}
        documentContext={documentContext}
        onValidationChange={onValidationChange}
        onFocus={onFocus}
        onBlur={onBlur}
        compact={compact}
        maxLength={maxLength}
        {...additionalProps}
      />
    );
  }

  // Edit mode: use standard component with wrapper
  const FieldComponent = plugin.component;

  return (
    <FieldWrapper
      fieldId={fieldId}
      definition={definition}
      hasError={hasError}
      error={error}
      validationState={validationState}
    >
      <FieldComponent
        fieldId={fieldId}
        value={value}
        onChange={onChange}
        definition={definition}
        hasError={hasError}
        error={error}
        validationState={validationState}
        isDisabled={isDisabled}
        isReadonly={isReadonly}
        documentContext={documentContext}
        onValidationChange={onValidationChange}
        onFocus={onFocus}
        onBlur={onBlur}
        {...additionalProps}
      />
    </FieldWrapper>
  );
}