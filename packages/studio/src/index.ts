/**
 * @trokky/studio - Main export
 */

// Integrated Studio is exported separately as @trokky/studio/integrated
// to avoid bundling server-side dependencies in browser builds

// Export Studio logger for custom components
export { createStudioLogger, StudioLogger } from './utils/logger.js'
export type { LogLevel, StudioLoggerConfig } from './utils/logger.js'

// Export Studio asset serving utilities for @trokky/routes integration
export { getStudioHTML, getStudioAsset } from './server/assets.js'