/**
 * Singleton resolution — the one place that answers "does this collection hold
 * exactly one document?".
 *
 * The schema is the source of truth. "Exactly one document" is a content-model
 * invariant: it governs the create guard, the PUT upsert, and how the CLI restores
 * a backup. A `type: 'singleton'` entry in a project's structure answers a different
 * question — which document the navigation opens and auto-creates — and must never
 * be used to decide the invariant, because a project can have no custom structure,
 * a static one, or one that varies by user role.
 *
 * Declaring the structure entry without the schema flag used to be silent: every
 * request still behaved correctly and the divergence only surfaced later, when a
 * restore regenerated document ids and dropped documents. `assertSingletonConsistency`
 * turns that into a boot failure instead.
 */

import type { ContentSchema } from '../types/index.js'

/** A structure entry that presents a collection as a singleton. */
export interface StructureSingleton {
  collection: string
  documentId: string
  /** `options.autoCreate`, defaulting to true when the entry does not set it. */
  autoCreate: boolean
}

export interface SingletonConsistencyIssue {
  collection: string
  documentId: string
  reason: 'schema-not-singleton' | 'schema-missing'
}

/**
 * Whether a schema declares itself a singleton.
 *
 * Both spellings are accepted: `singleton: true` and `type: 'singleton'`. Either alone means
 * singleton, so a schema that sets `type: 'singleton'` alongside `singleton: false` is still
 * one. Schemas are validated as `z.ZodSchema<any>`, so neither spelling is checked by the
 * compiler and a near miss such as `isSingleton: true` is silently ignored — which is exactly
 * why the consistency check below exists.
 */
export function isSingletonSchema(schema: ContentSchema | null | undefined): boolean {
  if (!schema) return false
  return schema.singleton === true || schema.type === 'singleton'
}

/**
 * Collect every `type: 'singleton'` entry in a resolved structure, walking nested items.
 *
 * `documentId` falls back to the collection name, matching how the Studio addresses a
 * singleton view that does not name one explicitly.
 */
export function collectStructureSingletons(structure: any): StructureSingleton[] {
  const found: StructureSingleton[] = []
  const seen = new Set<any>()

  const walk = (items: any[]): void => {
    for (const item of items) {
      if (!item || typeof item !== 'object') continue

      // Structures are user-supplied and may be self-referential.
      if (seen.has(item)) continue
      seen.add(item)

      if (item.type === 'singleton' && typeof item.schemaType === 'string') {
        found.push({
          collection: item.schemaType,
          documentId: item.documentId || item.schemaType,
          autoCreate: item.options?.autoCreate !== false,
        })
      }

      if (Array.isArray(item.items)) walk(item.items)
    }
  }

  walk(Array.isArray(structure?.items) ? structure.items : [])
  return found
}

/**
 * Find structure singletons whose schema does not declare the invariant.
 *
 * Only this direction is a defect. A schema may be a singleton without appearing in the
 * structure at all — it simply gets no navigation entry.
 */
export function findSingletonConsistencyIssues(
  structure: any,
  schemas: ContentSchema[]
): SingletonConsistencyIssue[] {
  const byName = new Map<string, ContentSchema>()
  for (const schema of schemas) {
    if (schema?.name) byName.set(schema.name, schema)
  }

  const issues: SingletonConsistencyIssue[] = []
  for (const entry of collectStructureSingletons(structure)) {
    const { collection, documentId } = entry
    const schema = byName.get(collection)
    if (!schema) {
      issues.push({ collection, documentId, reason: 'schema-missing' })
    } else if (!isSingletonSchema(schema)) {
      issues.push({ collection, documentId, reason: 'schema-not-singleton' })
    }
  }
  return issues
}

/**
 * Throw if the structure and the schemas disagree about which collections are singletons.
 *
 * Called at startup so the mismatch is reported against the project's source, long before
 * it can cost documents during a restore.
 *
 * Only a schema that contradicts the structure is fatal. A structure entry naming a schema
 * that is not registered at all is reported through `onWarning` instead: it costs a broken
 * navigation link rather than documents, and a project may legitimately leave a nav entry in
 * place while registering its schema conditionally.
 */
export function assertSingletonConsistency(
  structure: any,
  schemas: ContentSchema[],
  onWarning?: (message: string) => void
): void {
  const issues = findSingletonConsistencyIssues(structure, schemas)
  if (issues.length === 0) return

  for (const issue of issues.filter(i => i.reason === 'schema-missing')) {
    onWarning?.(
      `Structure presents '${issue.collection}' as a singleton but no schema by that name is registered`
    )
  }

  const fatal = issues.filter(issue => issue.reason === 'schema-not-singleton')
  if (fatal.length === 0) return

  const lines = fatal.map(
    issue =>
      `  - '${issue.collection}' is presented as a singleton but its schema does not set 'singleton: true'`
  )

  throw new Error(
    `Structure and schemas disagree about singletons:\n${lines.join('\n')}\n\n` +
      `The schema decides whether a collection holds exactly one document. Without the flag, ` +
      `creating and restoring documents in these collections behaves as if they were ordinary ` +
      `list collections: a restore regenerates their document ids, so the structure ends up ` +
      `pointing at documents that no longer exist.`
  )
}
