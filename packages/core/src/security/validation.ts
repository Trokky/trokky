import { InvalidInputError } from '../errors/index.js'
import { ListOptions } from '../types/index.js'

export class SecurityValidator {
  private static readonly COLLECTION_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9_-]*$/
  private static readonly ID_REGEX = /^[a-zA-Z0-9-_]+$/
  private static readonly MAX_COLLECTION_NAME_LENGTH = 50
  private static readonly MAX_ID_LENGTH = 100
  private static readonly MAX_LIMIT = 1000
  private static readonly MAX_SORT_FIELDS = 5

  public static validateCollectionName(name: string): void {
    if (typeof name !== 'string') {
      throw new InvalidInputError('Collection name must be a string', 'collection')
    }

    if (!name || name.length === 0) {
      throw new InvalidInputError('Collection name cannot be empty', 'collection')
    }

    if (name.length > this.MAX_COLLECTION_NAME_LENGTH) {
      throw new InvalidInputError(
        `Collection name too long (max ${this.MAX_COLLECTION_NAME_LENGTH} characters)`,
        'collection'
      )
    }

    if (!this.COLLECTION_NAME_REGEX.test(name)) {
      throw new InvalidInputError(
        'Collection name must start with a letter and contain only letters, numbers, underscores, and hyphens',
        'collection'
      )
    }

    // Prevent reserved names
    const reservedNames = ['admin', 'api', 'system', 'config', 'schema', 'migration']
    if (reservedNames.includes(name.toLowerCase())) {
      throw new InvalidInputError(`Collection name '${name}' is reserved`, 'collection')
    }
  }

  public static validateDocumentId(id: string): void {
    if (typeof id !== 'string') {
      throw new InvalidInputError('Document ID must be a string', 'id')
    }

    if (!id || id.length === 0) {
      throw new InvalidInputError('Document ID cannot be empty', 'id')
    }

    if (id.length > this.MAX_ID_LENGTH) {
      throw new InvalidInputError(
        `Document ID too long (max ${this.MAX_ID_LENGTH} characters)`,
        'id'
      )
    }

    if (!this.ID_REGEX.test(id)) {
      throw new InvalidInputError(
        'Document ID must contain only letters, numbers, underscores, and hyphens',
        'id'
      )
    }
  }

  public static sanitizeListOptions(options?: ListOptions): ListOptions | undefined {
    if (!options || typeof options !== 'object') {
      return undefined
    }

    const sanitized: ListOptions = {}

    // Sanitize limit
    if (options.limit !== undefined) {
      if (typeof options.limit !== 'number' || !Number.isInteger(options.limit)) {
        throw new InvalidInputError('Limit must be an integer', 'limit')
      }
      sanitized.limit = Math.min(Math.max(options.limit, 1), this.MAX_LIMIT)
    }

    // Sanitize offset
    if (options.offset !== undefined) {
      if (typeof options.offset !== 'number' || !Number.isInteger(options.offset)) {
        throw new InvalidInputError('Offset must be an integer', 'offset')
      }
      sanitized.offset = Math.max(options.offset, 0)
    }

    // Sanitize sort
    if (options.sort !== undefined) {
      if (typeof options.sort === 'string') {
        this.validateSortField(options.sort)
        sanitized.sort = options.sort
      } else if (Array.isArray(options.sort)) {
        if (options.sort.length > this.MAX_SORT_FIELDS) {
          throw new InvalidInputError(
            `Too many sort fields (max ${this.MAX_SORT_FIELDS})`,
            'sort'
          )
        }
        for (const field of options.sort) {
          this.validateSortField(field)
        }
        sanitized.sort = options.sort.slice(0, this.MAX_SORT_FIELDS)
      } else {
        throw new InvalidInputError('Sort must be a string or array of strings', 'sort')
      }
    }

    // Sanitize filter
    if (options.filter !== undefined) {
      sanitized.filter = this.sanitizeFilter(options.filter)
    }

    return sanitized
  }

  private static validateSortField(field: string): void {
    if (typeof field !== 'string') {
      throw new InvalidInputError('Sort field must be a string', 'sort')
    }

    const sortPattern = /^[a-zA-Z_][a-zA-Z0-9_]*(\.(asc|desc))?$/
    if (!sortPattern.test(field)) {
      throw new InvalidInputError(
        'Invalid sort field format. Use "field" or "field.asc" or "field.desc"',
        'sort'
      )
    }
  }

  public static sanitizeFilter(filter: unknown): Record<string, unknown> {
    if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
      return {}
    }

    const sanitized: Record<string, unknown> = {}
    const filterObj = filter as Record<string, unknown>

    // Limit filter depth and complexity
    const maxFilterKeys = 10
    const keys = Object.keys(filterObj).slice(0, maxFilterKeys)

    for (const key of keys) {
      if (typeof key !== 'string' || key.length === 0) {
        continue
      }

      // Validate field names
      if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(key)) {
        throw new InvalidInputError(`Invalid filter field name: ${key}`, 'filter')
      }

      // Prevent dangerous operators and properties
      const dangerousFields = ['__proto__', 'constructor', 'prototype']
      if (key.startsWith('$') || dangerousFields.some(dangerous => key.includes(dangerous))) {
        throw new InvalidInputError(`Forbidden filter field: ${key}`, 'filter')
      }

      const value = filterObj[key]
      
      // Basic type validation for filter values
      if (value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        if (Array.isArray(value)) {
          // Allow simple arrays for "in" queries
          sanitized[key] = value.slice(0, 100) // Limit array size
        } else if (typeof value === 'object') {
          // Allow simple comparison objects
          sanitized[key] = this.sanitizeFilterValue(value as Record<string, unknown>)
        }
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  private static sanitizeFilterValue(value: Record<string, unknown>): Record<string, unknown> {
    const allowedOperators = ['$eq', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin']
    const sanitized: Record<string, unknown> = {}

    for (const [op, val] of Object.entries(value)) {
      if (allowedOperators.includes(op)) {
        // Basic validation for operator values
        if (['$in', '$nin'].includes(op) && Array.isArray(val)) {
          sanitized[op] = val.slice(0, 100) // Limit array size
        } else if (val !== null && ['string', 'number', 'boolean'].includes(typeof val)) {
          sanitized[op] = val
        }
      }
    }

    return sanitized
  }

  public static validateDocumentData(data: unknown): void {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new InvalidInputError('Document data must be an object', 'data')
    }

    const dataObj = data as Record<string, unknown>

    // Check for dangerous properties
    const dangerousKeys = ['__proto__', 'constructor', 'prototype']
    for (const key of Object.keys(dataObj)) {
      if (dangerousKeys.includes(key)) {
        throw new InvalidInputError(`Forbidden property name: ${key}`, 'data')
      }

      // Validate field names
      if (typeof key !== 'string' || key.length === 0) {
        throw new InvalidInputError('Field names must be non-empty strings', 'data')
      }

      if (key.length > 100) {
        throw new InvalidInputError('Field name too long (max 100 characters)', 'data')
      }

      // Validate field name format (letters, numbers, underscores only)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        throw new InvalidInputError(`Invalid field name format: ${key}`, 'data')
      }
    }

    // Check object size
    const jsonString = JSON.stringify(data)
    if (jsonString.length > 10 * 1024 * 1024) { // 10MB limit
      throw new InvalidInputError('Document too large (max 10MB)', 'data')
    }
  }
}