/**
 * Dot-notation path utilities for CLI
 * Handles operations like:
 * - Getting values: getByPath(obj, "foo.bar.baz")
 * - Setting values: setByPath(obj, "foo.bar.baz", value)
 * - Picking fields: pickFields(obj, ["foo.bar", "foo.qux"])
 */

/** Keys that are disallowed to prevent prototype pollution attacks */
const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype']

/**
 * Check if a path or key is safe (not a prototype pollution attempt)
 * @throws {Error} If the path contains dangerous keys
 */
function validatePathSecurity(path: string): void {
  const parts = path.split('.')
  for (const part of parts) {
    if (DANGEROUS_KEYS.includes(part)) {
      throw new Error(`Invalid path: "${path}" - contains disallowed key "${part}"`)
    }
  }
}

/**
 * Recursively validate that an object doesn't contain dangerous keys
 * @throws {Error} If the object contains prototype pollution keys
 */
function validateObjectSecurity(value: unknown): void {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (DANGEROUS_KEYS.includes(key)) {
        throw new Error(`Invalid value: contains disallowed key "${key}"`)
      }
      validateObjectSecurity((value as Record<string, unknown>)[key])
    }
  }
}

/**
 * Get a value from an object using dot notation
 * @param obj - The object to traverse
 * @param path - Dot-separated path (e.g., "foo.bar.baz")
 * @returns The value at the path, or undefined if not found
 */
export function getByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined
  if (!path) return obj

  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Set a value in an object using dot notation
 * Creates intermediate objects as needed
 * @param obj - The object to modify (mutates in place)
 * @param path - Dot-separated path (e.g., "foo.bar.baz")
 * @param value - The value to set
 * @returns The modified object
 * @throws {Error} If path contains dangerous keys (prototype pollution prevention)
 */
export function setByPath<T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: unknown
): T {
  if (!path) return obj

  // Validate path to prevent prototype pollution
  validatePathSecurity(path)

  const parts = path.split('.')
  let current: Record<string, unknown> = obj

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {}
    }
    current = current[part] as Record<string, unknown>
  }

  current[parts[parts.length - 1]] = value
  return obj
}

/**
 * Pick specific fields from an object using dot notation paths
 * @param obj - The source object
 * @param fields - Array of dot-separated paths to pick
 * @returns A new object containing only the specified fields
 */
export function pickFields(
  obj: unknown,
  fields: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const field of fields) {
    const value = getByPath(obj, field)
    if (value !== undefined) {
      setByPath(result, field, value)
    }
  }

  return result
}

/**
 * Parse a --set argument in the format "path=value" or "path=json"
 * @param setArg - The argument string (e.g., "foo.bar=hello" or "foo.bar={\"key\":\"value\"}")
 * @returns Tuple of [path, value] or null if invalid
 * @throws {Error} If path or value contains dangerous keys (prototype pollution prevention)
 */
export function parseSetArg(setArg: string): [string, unknown] | null {
  const eqIndex = setArg.indexOf('=')
  if (eqIndex === -1) return null

  const path = setArg.slice(0, eqIndex).trim()
  const valueStr = setArg.slice(eqIndex + 1)

  if (!path) return null

  // Validate path to prevent prototype pollution
  validatePathSecurity(path)

  // Try to parse as JSON first, fall back to string
  let value: unknown
  try {
    value = JSON.parse(valueStr)
    // Validate parsed JSON object for dangerous keys
    validateObjectSecurity(value)
  } catch (error) {
    // If it's a security error, re-throw it
    if (error instanceof Error && error.message.includes('disallowed key')) {
      throw error
    }
    // Not valid JSON, treat as string
    value = valueStr
  }

  return [path, value]
}

/**
 * Parse multiple --set arguments and merge them into an object
 * @param setArgs - Array of "path=value" strings
 * @returns Object with all paths set
 */
export function parseSetArgs(setArgs: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const arg of setArgs) {
    const parsed = parseSetArg(arg)
    if (parsed) {
      const [path, value] = parsed
      setByPath(result, path, value)
    }
  }

  return result
}

/**
 * Parse comma-separated fields string
 * @param fieldsStr - Comma-separated field paths (e.g., "foo.bar,foo.baz,qux")
 * @returns Array of field paths
 */
export function parseFieldsArg(fieldsStr: string): string[] {
  return fieldsStr
    .split(',')
    .map(f => f.trim())
    .filter(f => f.length > 0)
}

/**
 * Deep merge two objects
 * Source values override target values, with deep merging for nested objects
 * @param target - The base object
 * @param source - The object to merge in (takes precedence)
 * @returns A new merged object
 */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target }

  for (const key of Object.keys(source)) {
    // Skip dangerous keys to prevent prototype pollution
    if (DANGEROUS_KEYS.includes(key)) {
      continue
    }

    const sourceValue = source[key]
    const targetValue = target[key]

    // If both values are plain objects, merge them recursively
    if (
      isPlainObject(sourceValue) &&
      isPlainObject(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      )
    } else {
      // Otherwise, source value wins
      result[key] = sourceValue
    }
  }

  return result
}

/**
 * Check if a value is a plain object (not array, null, Date, etc.)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  )
}

/**
 * Unwrap a document from API response format
 * Handles both { document: ... } wrapper and direct document responses
 * @param result - The API response
 * @returns The unwrapped document
 */
export function unwrapDocument(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== 'object') {
    return {}
  }

  if ('document' in result) {
    const doc = (result as { document: unknown }).document
    if (!doc || typeof doc !== 'object') {
      return {}
    }
    return doc as Record<string, unknown>
  }

  return result as Record<string, unknown>
}
