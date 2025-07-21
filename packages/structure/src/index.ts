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
  GenerationOptions,
  CountService
} from './builder'

// Utilities
export { PermissionChecker, QueryBuilder, StructureMerger } from './utils'
export { FastHasher, StableHasher, CacheKeyUtils } from './utils/hash'
export type {
  PermissionCheckerOptions,
  MergeOptions,
  MergeResult,
  MergeConflict
} from './utils'

// Errors
export * from './errors'

// Main exports for convenience
export { TrokkyStructureSchema } from './validation/schemas'