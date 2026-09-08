/**
 * Whether a structure item stands for a collection that holds exactly one document.
 *
 * The schema decides this, not the structure. A `singleton` entry says so directly, but a
 * `documentList` entry can still name a schema that declares itself a singleton — the server
 * marks those with `schemaIsSingleton` when it serves the structure. Either way the server
 * enforces one document, so the Studio must not offer to create a second.
 */
export function isSingletonStructureItem(
  item: { type?: string; schemaIsSingleton?: boolean } | null | undefined
): boolean {
  if (!item) return false
  return item.type === 'singleton' || item.schemaIsSingleton === true
}
