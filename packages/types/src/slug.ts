/**
 * Slug field types
 *
 * This module contains all slug-related types used across the Trokky ecosystem.
 * These types are shared between @trokky/fields (client-side) and @trokky/routes (server-side).
 */

/**
 * Options for the slugify function
 * Used by both client-side (fields) and server-side (routes) slug generation
 */
export interface SlugifyOptions {
  /** Preserve original case instead of converting to lowercase */
  preserveCase?: boolean
  /** Additional allowed characters beyond a-z0-9- */
  allowedChars?: string
  /** Allow forward slashes for hierarchical paths (default: true) */
  allowSlashes?: boolean
  /** Prefix to add to generated slugs */
  prefix?: string
  /** Suffix to add to generated slugs */
  suffix?: string
}

/**
 * Configuration for a slug field extracted from schema
 * Used by server-side slug processor to generate slugs
 */
export interface SlugFieldConfig {
  /** Name of the field in the document */
  fieldName: string
  /** Source field(s) to generate slug from */
  source?: string | string[]
  /** Whether to auto-generate slug (default: true) */
  autoGenerate?: boolean
  /** Whether slug must be unique within collection (default: true) */
  unique?: boolean
  /** Maximum length of the slug */
  maxLength?: number
  /** Minimum length of the slug */
  minLength?: number
  /** Preserve original case */
  preserveCase?: boolean
  /** Additional allowed characters */
  allowedChars?: string
  /** Allow forward slashes */
  allowSlashes?: boolean
  /** Prefix to add to generated slugs */
  prefix?: string
  /** Suffix to add to generated slugs */
  suffix?: string
}

/**
 * Value structure for a slug field
 * Contains metadata about how the slug was generated
 */
export interface SlugFieldValue {
  /** The actual slug value */
  value: string
  /** Whether this slug was auto-generated (vs manually entered) */
  generated: boolean
  /** Which source field it was generated from */
  source?: string
  /** When the slug was last updated */
  lastUpdated: Date
}

/**
 * Base slug field options that can be specified in schema
 * These are the slug-specific properties on a field definition
 */
export interface SlugFieldOptions {
  /** Field(s) to generate slug from (e.g., 'title', ['title', 'subtitle']) */
  source?: string | string[]
  /** Whether to auto-generate slug (default: true) */
  autoGenerate?: boolean
  /** Maximum length of the slug (default: 200) */
  maxLength?: number
  /** Minimum length of the slug (default: 1) */
  minLength?: number
  /** Whether slug must be unique within collection (default: true) */
  unique?: boolean
  /** Allow empty slug values (default: false) */
  allowEmpty?: boolean
  /** Custom validation pattern */
  pattern?: RegExp
  /** Placeholder text for the input field */
  placeholder?: string
  /** Whether field is read-only (default: false) */
  readOnly?: boolean
  /** Preserve original case (default: false, converts to lowercase) */
  preserveCase?: boolean
  /** Additional allowed characters beyond a-z0-9- */
  allowedChars?: string
  /** Allow forward slashes for hierarchical paths (default: true) */
  allowSlashes?: boolean
  /** Prefix to add to generated slugs */
  prefix?: string
  /** Suffix to add to generated slugs */
  suffix?: string
}
