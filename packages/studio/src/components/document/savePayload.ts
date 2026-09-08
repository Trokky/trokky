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

/** True for `{}` literals only: not arrays, Dates, class instances or null. */
export function isPlainObject(value: any): value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/**
 * Property carrying the editor-side stable identity of an array item.
 *
 * Deliberately NOT `_key`: `_key` is real content for portable text, where
 * blocks, spans and markDefs carry their own `_key` and a span's `marks[]`
 * points at a markDef by it. Stripping those would silently break every link.
 */
export const ITEM_KEY = '__trokkyItemKey'

/**
 * Keys that must never be assigned onto an object literal built from user data.
 * Only `__proto__` is actually unsafe: assigning it re-points the prototype.
 * `constructor` and `prototype` are ordinary own properties and may be content
 * (a schema is free to have a field called "prototype"), so they are kept.
 */
const DANGEROUS_KEYS = ['__proto__']

/** True when the key may be written into a payload object. */
export function isSafeKey(key: string): boolean {
  return !DANGEROUS_KEYS.includes(key)
}

let itemKeyCounter = 0

/** Generate a stable identity for a new array item. */
export function createItemKey(): string {
  const cryptoApi = (globalThis as any)?.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  itemKeyCounter += 1
  return `k${Date.now().toString(36)}-${itemKeyCounter}`
}

/**
 * Attach a stable `_key` to every object living in an array, recursively.
 * Values that already carry a key are left untouched, and untouched subtrees
 * keep their identity so the caller can rely on reference equality.
 */
export function ensureItemKeys(value: any): any {
  if (Array.isArray(value)) {
    let changed = false
    const next = value.map(item => {
      let processed = ensureItemKeys(item)
      // Plain objects only: spreading a Date, RegExp or class instance would
      // flatten it to {} and lose the value.
      if (isPlainObject(processed) && !processed[ITEM_KEY]) {
        processed = { ...processed, [ITEM_KEY]: createItemKey() }
      }
      if (processed !== item) changed = true
      return processed
    })
    return changed ? next : value
  }

  if (isPlainObject(value)) {
    let changed = false
    const next: Record<string, any> = {}
    for (const [key, entry] of Object.entries(value)) {
      // Assigning __proto__ would re-point the clone's prototype, after which
      // it is no longer a plain object and the marker stripper skips it.
      if (key === '__proto__') {
        changed = true
        continue
      }
      const processed = ensureItemKeys(entry)
      if (processed !== entry) changed = true
      next[key] = processed
    }
    return changed ? next : value
  }

  return value
}

/**
 * The React key for an array item: its stable `_key` when it has one, and a
 * positional fallback for primitives, which carry no identity of their own.
 */
export function getItemKey(item: any, index: number): string {
  if (item && typeof item === 'object' && !Array.isArray(item) && item[ITEM_KEY]) {
    return String(item[ITEM_KEY])
  }
  return `idx-${index}`
}

/**
 * Remove the editor-only item markers and prototype-polluting keys from a value.
 * Content keys such as portable text's `_key` are left untouched.
 * Applied at save time only: the editor keeps the keys while the form is open.
 */
export function stripItemKeys(value: any): any {
  if (Array.isArray(value)) {
    return value.map(stripItemKeys)
  }

  if (isPlainObject(value)) {
    const next: Record<string, any> = {}
    for (const [key, entry] of Object.entries(value)) {
      if (key === ITEM_KEY || !isSafeKey(key)) continue
      next[key] = stripItemKeys(entry)
    }
    return next
  }

  return value
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

    // Strip empty slots and incomplete placeholder items from top-level array fields
    if (fieldType === 'array' && Array.isArray(value)) {
      value = value.filter(item => item !== null && item !== undefined && !isIncompleteArrayItem(item))
    }

    if (value === undefined) {
      // Array fields always ship as a list: frontends map over them
      value = fieldType === 'array' ? [] : null
    }

    if (!isSafeKey(name)) continue

    payload[name] = stripItemKeys(value)
  }

  // Editor-managed, set by the publish/unpublish transition. Kept even when the
  // schema does not declare it, otherwise publishing would not record its time.
  if (!('publishedAt' in payload) && document && 'publishedAt' in document) {
    payload.publishedAt = document.publishedAt ?? null
  }

  payload._status = document?._status || fallbackStatus || 'draft'

  const type = document?._type || schema?.name
  if (type) {
    payload._type = type
  }

  return payload
}

/**
 * Schema `default` values that a field plugin should turn into a real value
 * (a date field's "now" must not reach the document as the literal string).
 */
const DEFAULT_SENTINELS = new Set(['now'])

/** Field types whose plugin understands a sentinel default. */
const SENTINEL_FIELD_TYPES = new Set(['date', 'datetime'])

/**
 * Resolve a schema-declared default for a new document.
 *
 * The declared value is used verbatim. Only a known sentinel is handed to the
 * field plugin, because most plugins ignore `default` and return their own
 * empty value ('' for a string, false for a boolean, 'untitled' for a slug),
 * which would silently override what the schema author wrote.
 */
export function resolveFieldDefault(
  field: { type?: string; default?: any },
  getPlugin: (type: string) => { getDefaultValue?: (field: any) => any } | undefined
): any {
  const declared = field?.default
  if (
    typeof declared !== 'string' ||
    !DEFAULT_SENTINELS.has(declared) ||
    !field.type ||
    !SENTINEL_FIELD_TYPES.has(field.type)
  ) {
    return declared
  }
  const plugin = getPlugin(field.type)
  if (!plugin || typeof plugin.getDefaultValue !== 'function') return declared
  try {
    const resolved = plugin.getDefaultValue(field)
    return resolved === undefined ? declared : resolved
  } catch {
    return declared
  }
}
