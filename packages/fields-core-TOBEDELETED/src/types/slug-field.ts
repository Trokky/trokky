/**
 * Slug Field Type Implementation
 * URL-safe string field with automatic generation from source fields
 */

import type { FieldType, ValidationResult, FieldContext } from '@trokky/core'
import { FieldCategory } from '@trokky/core'
import { createValidationResult, createValidationError, getFieldPath } from '../utils/validation.js'

export interface SlugFieldConfig {
  // Source field to generate slug from
  source?: string | string[]
  
  // Maximum length of the slug
  maxLength?: number
  
  // Minimum length of the slug
  minLength?: number
  
  // Allow empty slug
  allowEmpty?: boolean
  
  // Custom slug generation function
  slugify?: (input: string) => string
  
  // Prefix to add to generated slugs
  prefix?: string
  
  // Suffix to add to generated slugs
  suffix?: string
  
  // Allow manual editing of generated slug
  readOnly?: boolean
  
  // Custom validation pattern (regex)
  pattern?: string
  
  // Validation message for pattern mismatch
  patternMessage?: string
  
  // Preserve case (default: lowercase)
  preserveCase?: boolean
  
  // Characters to allow in addition to alphanumeric and hyphens
  allowedChars?: string
}

export interface SlugFieldValue {
  current: string
  source?: string | string[]
  auto?: boolean
}

// Default slug configuration
const DEFAULT_SLUG_CONFIG: Required<Omit<SlugFieldConfig, 'source' | 'prefix' | 'suffix' | 'pattern' | 'patternMessage' | 'allowedChars'>> = {
  maxLength: 200,
  minLength: 1,
  allowEmpty: false,
  readOnly: false,
  preserveCase: false,
  slugify: defaultSlugify
}

// Default slugify function
function defaultSlugify(input: string): string {
  return input
    .toString()
    .normalize('NFD') // Normalize unicode characters
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove invalid chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

// Advanced slugify with more options
function advancedSlugify(input: string, config: SlugFieldConfig): string {
  let result = input.toString().normalize('NFD')
  
  // Remove accents
  result = result.replace(/[\u0300-\u036f]/g, '')
  
  // Handle case preservation
  if (!config.preserveCase) {
    result = result.toLowerCase()
  }
  
  // Trim whitespace
  result = result.trim()
  
  // Build allowed character pattern
  let allowedPattern = 'a-zA-Z0-9\\s-'
  if (config.allowedChars) {
    // Escape special regex characters in allowedChars
    const escapedChars = config.allowedChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    allowedPattern += escapedChars
  }
  
  // Remove invalid characters
  const invalidCharsRegex = new RegExp(`[^${allowedPattern}]`, 'g')
  result = result.replace(invalidCharsRegex, '')
  
  // Replace spaces with hyphens
  result = result.replace(/\s+/g, '-')
  
  // Replace multiple hyphens with single
  result = result.replace(/-+/g, '-')
  
  // Remove leading/trailing hyphens
  result = result.replace(/^-|-$/g, '')
  
  return result
}

// Generate slug from source fields
function generateSlugFromSource(context: FieldContext, config: SlugFieldConfig): string {
  if (!config.source) {
    return ''
  }
  
  const sources = Array.isArray(config.source) ? config.source : [config.source]
  let sourceText = ''
  
  for (const sourcePath of sources) {
    const value = getValueFromPath(context.document, sourcePath)
    if (value && typeof value === 'string') {
      sourceText += (sourceText ? ' ' : '') + value.trim()
    }
  }
  
  if (!sourceText) {
    return ''
  }
  
  // Use custom slugify function if provided, otherwise use advanced slugify
  const slugifyFn = config.slugify || ((input: string) => advancedSlugify(input, config))
  let slug = slugifyFn(sourceText)
  
  // Add prefix/suffix if configured
  if (config.prefix) {
    slug = config.prefix + (slug ? '-' + slug : '')
  }
  if (config.suffix) {
    slug = (slug ? slug + '-' : '') + config.suffix
  }
  
  return slug
}

// Helper function to get value from object path
function getValueFromPath(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined
  }, obj)
}

// Validate slug format
function validateSlugFormat(slug: string, config: SlugFieldConfig): boolean {
  // Check custom pattern if provided
  if (config.pattern) {
    const regex = new RegExp(config.pattern)
    return regex.test(slug)
  }
  
  // Default validation: cannot start or end with hyphen, no consecutive hyphens
  if (slug.startsWith('-') || slug.endsWith('-') || slug.includes('--')) {
    return false
  }
  
  // Simplified character validation - basic alphanumeric and hyphens
  if (config.allowedChars) {
    // For custom patterns, use simple character-by-character validation
    const allowedSet = new Set([
      ...Array.from('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'),
      ...Array.from(config.allowedChars)
    ])
    
    for (const char of slug) {
      if (!allowedSet.has(char)) {
        return false
      }
    }
    return true
  } else {
    // Default: only alphanumeric and hyphens
    return /^[a-zA-Z0-9-]+$/.test(slug)
  }
}

export const SlugFieldType: FieldType<SlugFieldConfig, string> = {
  name: 'slug',
  category: FieldCategory.TEXT,
  description: 'URL-safe string field with automatic generation from source fields',

  validate(value: string, config: SlugFieldConfig, context: FieldContext): ValidationResult {
    const fieldConfig = { ...DEFAULT_SLUG_CONFIG, ...config }
    const fieldPath = getFieldPath(context)
    const errors = []

    // Handle null/undefined values
    if (value == null || value === '') {
      if (!fieldConfig.allowEmpty) {
        errors.push(createValidationError(
          fieldPath,
          'Slug is required',
          'REQUIRED'
        ))
      }
      return createValidationResult(errors)
    }

    // Ensure value is a string
    if (typeof value !== 'string') {
      errors.push(createValidationError(
        fieldPath,
        'Slug must be a string',
        'INVALID_TYPE'
      ))
      return createValidationResult(errors)
    }

    // Length validation
    if (value.length < fieldConfig.minLength) {
      errors.push(createValidationError(
        fieldPath,
        `Slug must be at least ${fieldConfig.minLength} characters long`,
        'MIN_LENGTH'
      ))
    }

    if (value.length > fieldConfig.maxLength) {
      errors.push(createValidationError(
        fieldPath,
        `Slug must be no more than ${fieldConfig.maxLength} characters long`,
        'MAX_LENGTH'
      ))
    }

    // Format validation
    if (!validateSlugFormat(value, fieldConfig)) {
      const message = fieldConfig.patternMessage || 
        'Slug contains invalid characters. Only letters, numbers, hyphens, and configured allowed characters are permitted'
      errors.push(createValidationError(
        fieldPath,
        message,
        'INVALID_FORMAT'
      ))
    }

    // Check for leading/trailing hyphens
    if (value.startsWith('-') || value.endsWith('-')) {
      errors.push(createValidationError(
        fieldPath,
        'Slug cannot start or end with a hyphen',
        'INVALID_FORMAT'
      ))
    }

    // Check for consecutive hyphens
    if (value.includes('--')) {
      errors.push(createValidationError(
        fieldPath,
        'Slug cannot contain consecutive hyphens',
        'INVALID_FORMAT'
      ))
    }

    return createValidationResult(errors)
  },

  serialize(value: string, config: SlugFieldConfig): string {
    if (!value || typeof value !== 'string') {
      return ''
    }
    
    return value.trim()
  },

  deserialize(data: any, config: SlugFieldConfig): string {
    if (data == null) {
      return ''
    }
    
    if (typeof data === 'string') {
      return data.trim()
    }
    
    // Handle slug value objects (for advanced use cases)
    if (typeof data === 'object' && data.current) {
      return typeof data.current === 'string' ? data.current.trim() : ''
    }
    
    // Convert other types to string and slugify
    const fieldConfig = { ...DEFAULT_SLUG_CONFIG, ...config }
    const stringValue = String(data)
    const slugifyFn = fieldConfig.slugify || ((input: string) => advancedSlugify(input, fieldConfig))
    
    return slugifyFn(stringValue)
  },

  defaultValue: ''
}

// Helper functions for working with slug fields
export function createSlugField(config: Partial<SlugFieldConfig> = {}) {
  return {
    type: 'slug',
    config: { ...DEFAULT_SLUG_CONFIG, ...config }
  }
}

export function createAutoSlugField(source: string | string[], options: Partial<SlugFieldConfig> = {}) {
  return createSlugField({
    source,
    readOnly: true, // Auto-generated slugs are typically read-only
    ...options
  })
}

export function createManualSlugField(options: Partial<SlugFieldConfig> = {}) {
  return createSlugField({
    readOnly: false,
    ...options
  })
}

// Utility functions
export function slugify(input: string, options: Partial<SlugFieldConfig> = {}): string {
  const config = { ...DEFAULT_SLUG_CONFIG, ...options }
  const slugifyFn = config.slugify || ((text: string) => advancedSlugify(text, config))
  
  let result = slugifyFn(input)
  
  // Apply prefix/suffix
  if (config.prefix) {
    result = config.prefix + (result ? '-' + result : '')
  }
  if (config.suffix) {
    result = (result ? result + '-' : '') + config.suffix
  }
  
  return result
}

export function validateSlug(slug: string, config: Partial<SlugFieldConfig> = {}): boolean {
  const fieldConfig = { ...DEFAULT_SLUG_CONFIG, ...config }
  
  if (!slug || typeof slug !== 'string') {
    return fieldConfig.allowEmpty
  }
  
  // Length checks
  if (slug.length < fieldConfig.minLength || slug.length > fieldConfig.maxLength) {
    return false
  }
  
  // Format checks
  return validateSlugFormat(slug, fieldConfig)
}

export function generateSlug(context: FieldContext, config: SlugFieldConfig): string {
  return generateSlugFromSource(context, config)
}

// URL-safe character validation
export function isUrlSafe(text: string): boolean {
  return /^[a-zA-Z0-9-_~.]+$/.test(text)
}

// Slug uniqueness helper (requires external uniqueness checking)
export interface SlugUniquenessChecker {
  isUnique(slug: string, excludeId?: string): Promise<boolean>
  generateUnique(baseSlug: string, excludeId?: string): Promise<string>
}

export function createUniqueSlug(
  baseSlug: string, 
  checker: SlugUniquenessChecker, 
  excludeId?: string
): Promise<string> {
  return checker.generateUnique(baseSlug, excludeId)
}