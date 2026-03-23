/**
 * Trokky - Modern, composable Content Management System
 *
 * Main entry point. Individual modules are available via subpath exports:
 *
 * @example
 * ```typescript
 * import { TrokkyExpress } from 'trokky/express'
 * import 'trokky/adapters/filesystem-data'
 * import 'trokky/adapters/filesystem-media'
 * import type { BaseDocument } from 'trokky/types'
 * ```
 */

// Re-export core public API
export * from './core/index.js'
