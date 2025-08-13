/**
 * Image Processors Module
 * 
 * Exports processor types and the NoOp processor.
 * Other processors are loaded dynamically to avoid bundling issues.
 */

// Export types and base classes
export * from './types'

// Export NoOp processor (safe for all environments)
export { NoOpImageProcessor } from './noop'

// NOTE: Sharp and other processors are NOT exported here!
// They are loaded dynamically in the factory to prevent bundling issues.