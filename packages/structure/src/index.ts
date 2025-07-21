/**
 * @trokky/structure
 * Structure configuration system for Trokky CMS
 */

// Types
export type * from './types'

// Validation schemas
export * from './validation/schemas'

// Builder classes
export { StructureBuilder, NavigationTreeBuilder } from './builder'
export type {
  StructureBuilderOptions,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  NavigationTree,
  NavigationItem,
  GenerationOptions
} from './builder'

// Utilities
export { PermissionChecker, QueryBuilder, StructureMerger } from './utils'
export type {
  PermissionCheckerOptions,
  MergeOptions,
  MergeResult,
  MergeConflict
} from './utils'

// Main exports for convenience
export { TrokkyStructureSchema } from './validation/schemas'