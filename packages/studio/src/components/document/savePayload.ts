/**
 * Save payload construction for the document editor.
 *
 * Pure helpers, kept free of React so they can be unit tested.
 */

/** A schema field entry, normalised from the object or array `fields` format. */
export interface SchemaFieldEntry {
  name: string
  definition: any
}

/** Normalise `schema.fields` (object map or array) into a list of entries. */
export function getSchemaFieldEntries(schema: any): SchemaFieldEntry[] {
  const fields = schema?.fields
  if (!fields) return []

  if (Array.isArray(fields)) {
    return fields
      .filter((field: any) => field && field.name)
      .map((field: any) => ({ name: field.name, definition: field }))
  }

  if (typeof fields === 'object') {
    return Object.entries(fields).map(([name, definition]) => ({
      name,
      definition,
    }))
  }

  return []
}

/**
 * Incomplete placeholder items created by the array field UI but never filled in:
 * a media item without a resolved asset, or a reference without a target.
 */
export function isIncompleteArrayItem(item: any): boolean {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false

  if (item._type === 'media') {
    return !item.asset || !item.asset._ref
  }

  if (item._type === 'reference') {
    return !item._ref
  }

  return false
}

/** Value that counts as "not provided" for required-field checks. */
export function isMissingValue(value: any): boolean {
  if (value === undefined || value === null) return true
  if (value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

/**
 * Build the API payload for a save: schema fields plus `_status` and `_type` only.
 * System fields (_id, _createdAt, _updatedAt, _revision, _createdBy, ...) are dropped
 * so the server stays authoritative for them.
 */
export function buildSavePayload(
  document: any,
  schema: any,
  fallbackStatus: string = 'draft'
): Record<string, any> {
  const payload: Record<string, any> = {}

  for (const { name, definition } of getSchemaFieldEntries(schema)) {
    const fieldType = definition?.type
    let value = document ? document[name] : undefined

    // Clear values whose shape no longer matches the schema type
    if (value !== undefined && value !== null) {
      const isArray = Array.isArray(value)
      const isObject = typeof value === 'object' && !isArray
      if (fieldType === 'object' && isArray) {
        value = {}
      } else if (fieldType === 'array' && isObject) {
        value = []
      }
    }

    // Strip incomplete placeholder items from top-level array fields
    if (fieldType === 'array' && Array.isArray(value)) {
      value = value.filter(item => !isIncompleteArrayItem(item))
    }

    if (value === undefined) {
      // Array fields always ship as a list: frontends map over them
      value = fieldType === 'array' ? [] : null
    }

    payload[name] = value
  }

  payload._status = document?._status || fallbackStatus || 'draft'

  const type = document?._type || schema?.name
  if (type) {
    payload._type = type
  }

  return payload
}
