/**
 * Document editor form state.
 *
 * One model for the whole editor: the document as loaded (`initial`), the
 * document as edited (`current`), the validation errors keyed by path, and the
 * save status. Dirty tracking is a real diff between `initial` and `current`,
 * so reverting an edit by hand makes the editor clean again.
 *
 * The reducer and every helper here are pure; the React binding at the bottom
 * is a thin `useReducer` wrapper.
 */

import { useCallback, useMemo, useReducer, useRef } from 'react'
import {
  ITEM_KEY,
  ensureItemKeys,
  getSchemaFieldEntries,
  isMissingValue,
  isSafeKey,
} from './savePayload.js'

/** Path to a value inside the document: object keys and array indices. */
export type DocumentPath = Array<string | number>

export type DocumentStoreStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface DocumentStoreState {
  /** The document as loaded from (or last saved to) the server. */
  initial: any
  /** The document as edited in the form. */
  current: any
  /** Validation errors, keyed by the string form of a path. */
  errors: Record<string, string>
  status: DocumentStoreStatus
}

export type DocumentStoreAction =
  | { type: 'load'; document: any }
  | { type: 'setValue'; path: DocumentPath; value: any }
  | { type: 'reset' }
  | { type: 'resetField'; path: DocumentPath }
  | { type: 'setErrors'; errors: Record<string, string> }
  | { type: 'markSaved'; document?: any }
  | { type: 'setStatus'; status: DocumentStoreStatus }

/** Render a path as the key used in the errors map: `a.b[0].c`. */
export function formatPath(path: DocumentPath): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`
    return acc ? `${acc}.${segment}` : String(segment)
  }, '')
}

/** Read the value at `path`, or undefined when any segment is missing. */
export function getValueAtPath(target: any, path: DocumentPath): any {
  let cursor = target
  for (const segment of path) {
    if (cursor === null || cursor === undefined) return undefined
    cursor = cursor[segment as any]
  }
  return cursor
}

/**
 * Return a copy of `target` with `path` set to `value`. Only the containers
 * along the path are rebuilt; every other subtree keeps its identity.
 * Paths containing prototype-polluting keys are refused.
 */
export function setValueAtPath(target: any, path: DocumentPath, value: any): any {
  if (path.length === 0) return value

  const [segment, ...rest] = path
  if (typeof segment === 'string' && !isSafeKey(segment)) {
    return target
  }

  if (typeof segment === 'number') {
    const source = Array.isArray(target) ? target : []
    const next = source.slice()
    next[segment] = setValueAtPath(source[segment], rest, value)
    return next
  }

  const source =
    target && typeof target === 'object' && !Array.isArray(target) ? target : {}
  return {
    ...source,
    [segment]: setValueAtPath(source[segment as any], rest, value),
  }
}

const IGNORED_DIFF_KEYS = new Set<string>([ITEM_KEY])

function comparableKeys(value: Record<string, any>, ignoredKeys: Set<string>): string[] {
  return Object.keys(value).filter(
    key => !ignoredKeys.has(key) && value[key] !== undefined
  )
}

/**
 * Structural equality. Key order is irrelevant, keys holding `undefined` are
 * treated as absent, and `ignoredKeys` are skipped entirely (used to ignore the
 * editor-only array item keys).
 */
export function deepEqual(a: any, b: any, ignoredKeys: Set<string> = new Set()): boolean {
  if (Object.is(a, b)) return true

  if (a instanceof Date || b instanceof Date) {
    return (
      a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
    )
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    if (a.length !== b.length) return false
    return a.every((item, index) => deepEqual(item, b[index], ignoredKeys))
  }

  if (
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  ) {
    return false
  }

  const aKeys = comparableKeys(a, ignoredKeys)
  const bKeys = comparableKeys(b, ignoredKeys)
  if (aKeys.length !== bKeys.length) return false

  return aKeys.every(
    key =>
      Object.prototype.hasOwnProperty.call(b, key) &&
      deepEqual(a[key], b[key], ignoredKeys)
  )
}

/** Build the state for a freshly loaded (or newly initialised) document. */
export function createInitialState(document: any = null): DocumentStoreState {
  const keyed = document === null || document === undefined ? document : ensureItemKeys(document)
  return {
    initial: keyed ?? null,
    current: keyed ?? null,
    errors: {},
    status: 'idle',
  }
}

export function documentReducer(
  state: DocumentStoreState,
  action: DocumentStoreAction
): DocumentStoreState {
  switch (action.type) {
    case 'load':
      return createInitialState(action.document)

    case 'setValue': {
      if (action.path.length === 0) return state
      const next = setValueAtPath(
        state.current ?? {},
        action.path,
        ensureItemKeys(action.value)
      )
      if (next === state.current) return state

      // Typing in a field clears the error it is showing
      const errorKey = formatPath(action.path)
      let errors = state.errors
      if (Object.keys(errors).some(key => key === errorKey || key.startsWith(`${errorKey}.`) || key.startsWith(`${errorKey}[`))) {
        errors = {}
        for (const [key, message] of Object.entries(state.errors)) {
          if (key === errorKey || key.startsWith(`${errorKey}.`) || key.startsWith(`${errorKey}[`)) continue
          errors[key] = message
        }
      }

      return { ...state, current: next, errors, status: 'idle' }
    }

    case 'reset':
      return { ...state, current: state.initial, errors: {}, status: 'idle' }

    case 'resetField': {
      if (action.path.length === 0) return state
      const original = getValueAtPath(state.initial, action.path)
      const next = setValueAtPath(state.current ?? {}, action.path, original)
      const errorKey = formatPath(action.path)
      const errors = { ...state.errors }
      delete errors[errorKey]
      return { ...state, current: next, errors, status: 'idle' }
    }

    case 'setErrors':
      return { ...state, errors: action.errors }

    case 'markSaved': {
      const saved = action.document === undefined ? state.current : action.document
      const keyed = saved === null || saved === undefined ? saved : ensureItemKeys(saved)
      return { initial: keyed ?? null, current: keyed ?? null, errors: {}, status: 'saved' }
    }

    case 'setStatus':
      return { ...state, status: action.status }

    default:
      return state
  }
}

const dirtyCache = new WeakMap<DocumentStoreState, boolean>()

/** True when the edited document differs from the one that was loaded. */
export function isDirty(state: DocumentStoreState): boolean {
  const cached = dirtyCache.get(state)
  if (cached !== undefined) return cached

  const dirty =
    state.initial !== state.current &&
    !deepEqual(state.initial, state.current, IGNORED_DIFF_KEYS)
  dirtyCache.set(state, dirty)
  return dirty
}

/** Top-level field names whose value differs from the loaded document. */
export function getDirtyPaths(state: DocumentStoreState): string[] {
  if (!isDirty(state)) return []

  const initial = state.initial && typeof state.initial === 'object' ? state.initial : {}
  const current = state.current && typeof state.current === 'object' ? state.current : {}
  const names = new Set([...Object.keys(initial), ...Object.keys(current)])

  return Array.from(names).filter(
    name => !deepEqual(initial[name], current[name], IGNORED_DIFF_KEYS)
  )
}

/** Minimal view of a field plugin needed to validate a value. */
export interface ValidatingFieldPlugin {
  validate?: (value: any, definition: any, context?: any) => {
    isValid: boolean
    errors: string[]
  }
}

export interface ValidationOptions {
  /** Resolve a field plugin by field type. */
  getPlugin?: (type: string) => ValidatingFieldPlugin | undefined
  /** Conditional visibility: invisible fields are never validated. */
  isVisible?: (definition: any, values: Record<string, any>) => boolean
  /** Restrict the result to this field subtree (used on blur). */
  rootPath?: DocumentPath
}

function fieldTitle(name: string, definition: any): string {
  return definition?.title || name
}

function validateValue(
  value: any,
  name: string,
  definition: any,
  path: DocumentPath,
  errors: Record<string, string>,
  options: ValidationOptions
): void {
  const type = definition?.type

  if (definition?.required && isMissingValue(value)) {
    errors[formatPath(path)] = `${fieldTitle(name, definition)} is required`
    return
  }

  // Empty optional values are never validated further: `0` and `false` are
  // values, `undefined` / `null` / `''` / `[]` are not.
  if (isMissingValue(value)) return

  if (type === 'object' && definition?.fields) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    for (const entry of getSchemaFieldEntries(definition)) {
      if (options.isVisible && !options.isVisible({ name: entry.name, ...entry.definition }, value)) continue
      validateValue(
        value[entry.name],
        entry.name,
        entry.definition,
        [...path, entry.name],
        errors,
        options
      )
    }
    return
  }

  if (type === 'array') {
    if (!Array.isArray(value)) return
    const itemDefinition = definition?.of
    if (!itemDefinition) return
    value.forEach((item, index) => {
      validateValue(
        item,
        `${fieldTitle(name, definition)} item ${index + 1}`,
        itemDefinition,
        [...path, index],
        errors,
        options
      )
    })
    return
  }

  const plugin = options.getPlugin?.(type)
  if (!plugin || typeof plugin.validate !== 'function') return

  try {
    const result = plugin.validate(value, { ...definition, title: fieldTitle(name, definition) })
    if (result && result.isValid === false && result.errors?.length) {
      errors[formatPath(path)] = result.errors[0]
    }
  } catch {
    // A misbehaving plugin must never block a save
  }
}

/**
 * Collect the validation errors for a whole document, walking objects and
 * arrays and delegating leaf values to the field plugins' own `validate()`.
 * The result is one flat map keyed by path.
 */
export function collectValidationErrors(
  document: any,
  schema: any,
  options: ValidationOptions = {}
): Record<string, string> {
  const errors: Record<string, string> = {}
  const values = document && typeof document === 'object' ? document : {}
  const rootName = options.rootPath?.[0]

  for (const { name, definition } of getSchemaFieldEntries(schema)) {
    if (rootName !== undefined && name !== rootName) continue
    if (options.isVisible && !options.isVisible({ name, ...definition }, values)) continue
    validateValue(values[name], name, definition, [name], errors, options)
  }

  return errors
}

/** React binding: `useReducer` plus stable action creators. */
export function useDocumentStore() {
  const [state, dispatch] = useReducer(documentReducer, null, () => createInitialState(null))

  const stateRef = useRef(state)
  stateRef.current = state

  const actions = useMemo(
    () => ({
      load: (document: any) => dispatch({ type: 'load', document }),
      setValue: (path: DocumentPath, value: any) =>
        dispatch({ type: 'setValue', path, value }),
      reset: () => dispatch({ type: 'reset' }),
      resetField: (path: DocumentPath) => dispatch({ type: 'resetField', path }),
      setErrors: (errors: Record<string, string>) => dispatch({ type: 'setErrors', errors }),
      markSaved: (document?: any) => dispatch({ type: 'markSaved', document }),
      setStatus: (status: DocumentStoreStatus) => dispatch({ type: 'setStatus', status }),
    }),
    []
  )

  const dirty = isDirty(state)
  const getState = useCallback(() => stateRef.current, [])

  return {
    state,
    document: state.current,
    errors: state.errors,
    status: state.status,
    isDirty: dirty,
    getState,
    ...actions,
  }
}
