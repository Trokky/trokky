import type { ApiClient } from '../../services/api-client.js'

/**
 * Field plugin system interfaces
 * Based on proven legacy architecture from Trokky v1
 *
 * Base types are centralized in @trokky/types. This file adds React-specific
 * interfaces that require React dependencies.
 */

import type { ComponentType } from 'react'
import type {
  BaseFieldDefinition,
  ValidationResult,
  ValidationState,
  DocumentContext,
  FieldCategory,
  FieldPluginSource
} from '@trokky/trokky/types'

// Re-export FieldPluginSource for backwards compatibility
export type { FieldPluginSource } from '@trokky/trokky/types'

// Studio context interface for field access to Studio capabilities
export interface StudioContext {
  /**
   * The Studio API client itself, not a hand-bound subset of it. Fields used to
   * get a structural copy whose signatures had drifted from the class
   * (uploadMedia lost its metadata argument, getMediaUrl was missing entirely),
   * so the type said one thing and the runtime did another.
   */
  apiClient: ApiClient

  // Authentication and user context
  auth: {
    getCurrentUser: () => any
    hasPermission: (resource: string, action: string) => boolean
    getAccessToken: () => string | null
  }

  // Inter-field communication
  fieldEvents: {
    emit: (event: string, data: any) => void
    on: (event: string, callback: (data: any) => void) => () => void
    getFieldValue: (fieldId: string) => any
    watchField: (fieldId: string, callback: (value: any) => void) => () => void
  }

  // Studio utilities
  utils: {
    showToast: (
      message: string,
      type?: 'success' | 'error' | 'warning' | 'info'
    ) => void
    showConfirm: (
      message: string,
      options?: {
        title?: string
        confirmText?: string
        cancelText?: string
        variant?: 'default' | 'danger'
      }
    ) => Promise<boolean>
    showMediaBrowser: (
      config: import('@trokky/trokky/types/media').MediaBrowserConfig
    ) => void
  }

  // Studio logger for field components
  logger: {
    debug: (message: string, data?: any) => void
    info: (message: string, data?: any) => void
    warn: (message: string, data?: any) => void
    error: (message: string, error?: Error | any) => void
  }

  // Media URL generator for proper URL construction across serving modes
  mediaUrlGenerator?: {
    getMediaUrl: (mediaId: string, variant?: string) => string
  } | null

  // Studio branding configuration
  branding?: {
    title?: string
    organizationName?: string
    primaryColor?: string
    secondaryColor?: string
    logo?: string
  }

  // Studio configuration
  config?: any

  // Current theme
  theme?: 'light' | 'dark' | 'auto'

  // Studio settings
  settings?: Record<string, any>

  // All available schemas, keyed by schema name
  schemas?: Record<string, any>
}

// Props passed to field components
export interface FieldComponentProps {
  fieldId: string
  value: any
  onChange: (value: any) => void
  definition: BaseFieldDefinition
  hasError?: boolean
  error?: string
  validationState?: ValidationState
  isDisabled?: boolean
  isReadonly?: boolean
  documentContext?: DocumentContext
  studioContext?: StudioContext
  onValidationChange?: (result: ValidationResult) => void
  onFocus?: () => void
  onBlur?: () => void
  [key: string]: any // Allow additional props
}

// Core field plugin interface
export interface FieldPlugin<
  TDefinition extends BaseFieldDefinition = BaseFieldDefinition,
  TValue = any,
> {
  // Plugin metadata
  type: string
  displayName: string
  description: string
  category: FieldCategory

  // React component for Studio rendering
  component: ComponentType<FieldComponentProps>

  // Validation function
  validate: (
    value: TValue,
    definition: TDefinition,
    context?: DocumentContext
  ) => ValidationResult

  // Default value generator
  getDefaultValue: (definition: TDefinition) => TValue

  // Schema conversion utilities
  toSchemaField: (definition: TDefinition) => any
  fromSchemaField: (schemaField: any) => TDefinition

  // Optional preview component for read-only display
  previewComponent?: ComponentType<FieldComponentProps>

  // Optional settings for the field type
  settings?: {
    icon?: string
    color?: string
    tags?: string[]
  }

  // Demo configuration for auto-generated field demonstrations
  demoConfig?: {
    examples: Array<{
      name: string
      value: TValue
      description: string
    }>
    invalidValue?: TValue
    variants: Array<{
      name: string
      definition: TDefinition
    }>
  }
}

// Registered field plugin with metadata
export interface RegisteredFieldPlugin extends FieldPlugin {
  source: FieldPluginSource
  registeredAt: Date

  // Ensure demoConfig is properly typed for registered plugins
  demoConfig?: {
    examples: Array<{
      name: string
      value: any
      description: string
    }>
    invalidValue?: any
    variants: Array<{
      name: string
      definition: any
    }>
  }
}

// Export types (already declared above, no need to re-export)
