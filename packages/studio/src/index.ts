/**
 * @trokky/studio - Main export
 */

// Export field registration API for developers
export { FieldRegistration, registerFieldType, registerFieldTypes } from './api/field-registration.js'

// Export field renderer components
export { FieldRenderer, FieldPreviewRenderer } from './components/fields/FieldRenderer.js'

// Export field renderer types for TypeScript users
export type { 
  FieldRendererProps, 
  FieldRenderer as FieldRendererType,
  FieldRendererEntry,
  FieldRendererRegistry,
  FieldGroup,
  FormLayoutConfig
} from './types/field-renderer.js'

// Integrated Studio is exported separately as @trokky/studio/integrated
// to avoid bundling server-side dependencies in browser builds

// Export Studio logger for custom components
export { createStudioLogger, StudioLogger } from './utils/logger.js'
export type { LogLevel, StudioLoggerConfig } from './utils/logger.js'