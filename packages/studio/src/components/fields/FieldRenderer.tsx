/**
 * Field Renderer - React component that renders field types using registered React components
 */

import React from 'react'
import type { FieldRendererProps } from '../../types/field-renderer.js'
import { getFieldRenderer } from '../../services/field-renderer-registry.js'
import { createStudioLogger } from '../../utils/logger.js'

const logger = createStudioLogger('FieldRenderer')

/**
 * Main field renderer component that uses registered React field components
 */
export function FieldRenderer(props: FieldRendererProps) {
  const { field } = props
  
  // Get the registered React component for this field type
  const FieldComponent = getFieldRenderer(field.type)
  
  if (!FieldComponent) {
    logger.warn(`No renderer found for field type: ${field.type}`)
    return (
      <div className="field-wrapper">
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700">
            {field.title || field.name}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        </div>
        <div className="p-4 border border-red-300 bg-red-50 rounded-md">
          <p className="text-red-700 text-sm">
            No renderer found for field type: <code className="font-mono bg-red-100 px-1 rounded">{field.type}</code>
          </p>
        </div>
      </div>
    )
  }

  try {
    // Render the React component directly
    return React.createElement(FieldComponent, props)
  } catch (error) {
    logger.error(`Error rendering field "${field.name}" of type "${field.type}"`, error)
    
    return (
      <div className="field-wrapper">
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700">
            {field.title || field.name}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        </div>
        <div className="p-4 border border-red-300 bg-red-50 rounded-md">
          <p className="text-red-700 text-sm">
            Error rendering field: {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      </div>
    )
  }
}

/**
 * Field preview renderer using registered React preview components
 * @todo Implement proper preview component registry separate from main components
 * @todo Add preview-specific rendering logic and styling
 */
export function FieldPreviewRenderer({
  value,
  config: _config,
  field
}: Pick<FieldRendererProps, 'value' | 'config' | 'field'>) {
  // @todo Get preview component specifically, not main component
  const PreviewComponent = getFieldRenderer(field.type)
  
  if (!PreviewComponent) {
    return (
      <span className="text-gray-900">
        {typeof value === 'string' ? value : JSON.stringify(value)}
      </span>
    )
  }

  try {
    // @todo Use dedicated preview components instead of main field components
    // For now, just render a simple preview
    return (
      <span className="text-gray-900">
        {typeof value === 'string' ? value : JSON.stringify(value)}
      </span>
    )
  } catch (error) {
    logger.error(`Error rendering preview for field "${field.name}" of type "${field.type}"`, error)
    return (
      <span className="text-gray-500 italic">
        (preview error)
      </span>
    )
  }
}