/**
 * Trokky - Modern, composable Content Management System
 *
 * Main entry point. Individual modules are available via subpath exports:
 *
 * @example
 * ```typescript
 * import { TrokkyExpress } from '@trokky/trokky/express'
 * import '@trokky/trokky/adapters/filesystem-data'
 * import '@trokky/trokky/adapters/filesystem-media'
 * import type { BaseDocument } from '@trokky/trokky/types'
 * ```
 */

// Re-export core public API
export * from './core/index.js'
