/**
 * @trokky/structure
 * Structure configuration system for Trokky CMS
 */

// Types
export type * from './types/index.js'

// Validation schemas
export * from './validation/schemas.js'

// Builder classes
export { StructureBuilder, NavigationTreeBuilder } from './builder/index.js'
export type {
  StructureBuilderOptions,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  NavigationTree,
  NavigationItem,
  GenerationOptions,
  CountService
} from './builder/index.js'

// Utilities
export { PermissionChecker, QueryBuilder, StructureMerger } from './utils/index.js'
export { FastHasher, StableHasher, CacheKeyUtils } from './utils/hash.js'
export type {
  PermissionCheckerOptions,
  MergeOptions,
  MergeResult,
  MergeConflict
} from './utils/index.js'

// Errors
export * from './errors/index.js'

// Main exports for convenience
export { TrokkyStructureSchema } from './validation/schemas.js'