/**
 * Reference scanner - finds and updates references in documents using schema definitions
 */

import type { SchemaDefinition, FieldDefinition, DocumentReference, IdMapping } from './types.js'

/**
 * Scans documents for references using schema as a guide
 */
export class ReferenceScanner {
  /**
   * Find all references in a document using schema definition
   */
  static findReferences(
    document: Record<string, any>,
    schema: SchemaDefinition
  ): DocumentReference[] {
    const references: DocumentReference[] = []
    this.scanValue(document, schema.fields, [], references)
    return references
  }

  /**
   * Update all references in a document using ID mappings
   * Returns updated document and count of updates
   */
  static updateReferences(
    document: Record<string, any>,
    schema: SchemaDefinition,
    idMappings: IdMapping
  ): { document: Record<string, any>; updateCount: number } {
    let updateCount = 0
    const updated = this.updateValue(document, schema.fields, idMappings, (oldId, newId) => {
      updateCount++
    })
    return { document: updated, updateCount }
  }

  /**
   * Recursively scan a value for references
   */
  private static scanValue(
    value: any,
    fields: FieldDefinition[] | Record<string, FieldDefinition>,
    path: string[],
    references: DocumentReference[]
  ): void {
    if (!value || typeof value !== 'object') return

    const fieldArray = Array.isArray(fields) ? fields : Object.values(fields)
    const fieldMap = new Map(fieldArray.map(f => [f.name, f]))

    for (const [key, val] of Object.entries(value)) {
      const field = fieldMap.get(key)
      if (!field) continue

      const currentPath = [...path, key]

      // Reference field
      if (field.type === 'reference') {
        const ref = this.extractReference(val)
        if (ref) {
          references.push({
            path: [...currentPath, '_ref'],
            oldId: ref,
            targetCollection: Array.isArray(field.to) ? field.to[0] : field.to
          })
        }
      }

      // Media/Image field
      else if (field.type === 'media' || field.type === 'image') {
        const ref = this.extractMediaReference(val)
        if (ref) {
          references.push({
            path: [...currentPath, 'asset', '_ref'],
            oldId: ref,
            targetCollection: 'media'
          })
        }
      }

      // Array field
      else if (field.type === 'array' && Array.isArray(val) && field.of) {
        for (let i = 0; i < val.length; i++) {
          this.scanValue(val[i], [field.of], [...currentPath, i.toString()], references)
        }
      }

      // Object field
      else if (field.type === 'object' && field.fields) {
        this.scanValue(val, field.fields, currentPath, references)
      }

      // Portable text / Rich text - scan for inline references
      else if ((field.type === 'portableText' || field.type === 'richText') && Array.isArray(val)) {
        this.scanPortableText(val, currentPath, references)
      }
    }
  }

  /**
   * Recursively update references in a value
   */
  private static updateValue(
    value: any,
    fields: FieldDefinition[] | Record<string, FieldDefinition>,
    idMappings: IdMapping,
    onUpdate: (oldId: string, newId: string) => void
  ): any {
    if (!value || typeof value !== 'object') return value

    if (Array.isArray(value)) {
      return value.map(item => this.updateValue(item, fields, idMappings, onUpdate))
    }

    const fieldArray = Array.isArray(fields) ? fields : Object.values(fields)
    const fieldMap = new Map(fieldArray.map(f => [f.name, f]))

    const updated: Record<string, any> = {}

    for (const [key, val] of Object.entries(value)) {
      const field = fieldMap.get(key)

      if (!field) {
        // Keep unknown fields as-is
        updated[key] = val
        continue
      }

      // Reference field
      if (field.type === 'reference') {
        const ref = this.extractReference(val)
        if (ref && idMappings[ref]) {
          onUpdate(ref, idMappings[ref])
          updated[key] = { ...val, _ref: idMappings[ref] }
        } else {
          updated[key] = val
        }
      }

      // Media/Image field
      else if (field.type === 'media' || field.type === 'image') {
        const ref = this.extractMediaReference(val)
        if (ref && idMappings[ref]) {
          onUpdate(ref, idMappings[ref])
          updated[key] = {
            ...val,
            asset: { ...val.asset, _ref: idMappings[ref] }
          }
        } else {
          updated[key] = val
        }
      }

      // Array field
      else if (field.type === 'array' && Array.isArray(val) && field.of) {
        updated[key] = val.map(item =>
          this.updateValue(item, [field.of!], idMappings, onUpdate)
        )
      }

      // Object field
      else if (field.type === 'object' && field.fields) {
        updated[key] = this.updateValue(val, field.fields, idMappings, onUpdate)
      }

      // Portable text / Rich text
      else if ((field.type === 'portableText' || field.type === 'richText') && Array.isArray(val)) {
        updated[key] = this.updatePortableText(val, idMappings, onUpdate)
      }

      // Default: copy as-is
      else {
        updated[key] = val
      }
    }

    return updated
  }

  /**
   * Extract reference ID from reference field value
   */
  private static extractReference(value: any): string | null {
    if (!value || typeof value !== 'object') return null
    return typeof value._ref === 'string' ? value._ref : null
  }

  /**
   * Extract media reference from media/image field value
   */
  private static extractMediaReference(value: any): string | null {
    if (!value || typeof value !== 'object') return null
    if (!value.asset || typeof value.asset !== 'object') return null
    return typeof value.asset._ref === 'string' ? value.asset._ref : null
  }

  /**
   * Scan portable text blocks for references
   */
  private static scanPortableText(
    blocks: any[],
    path: string[],
    references: DocumentReference[]
  ): void {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      if (!block || typeof block !== 'object') continue

      // Check for reference in the block itself
      if (block._ref && typeof block._ref === 'string') {
        references.push({
          path: [...path, i.toString(), '_ref'],
          oldId: block._ref,
          targetCollection: undefined
        })
      }

      // Check for marks with references (e.g., link marks)
      if (block.marks && Array.isArray(block.marks)) {
        for (const mark of block.marks) {
          if (mark._ref && typeof mark._ref === 'string') {
            references.push({
              path: [...path, i.toString(), 'marks', '_ref'],
              oldId: mark._ref,
              targetCollection: undefined
            })
          }
        }
      }

      // Recursively scan children
      if (block.children && Array.isArray(block.children)) {
        this.scanPortableText(block.children, [...path, i.toString(), 'children'], references)
      }
    }
  }

  /**
   * Update references in portable text blocks
   */
  private static updatePortableText(
    blocks: any[],
    idMappings: IdMapping,
    onUpdate: (oldId: string, newId: string) => void
  ): any[] {
    return blocks.map(block => {
      if (!block || typeof block !== 'object') return block

      const updated: any = { ...block }

      // Update reference in the block itself
      if (block._ref && typeof block._ref === 'string' && idMappings[block._ref]) {
        onUpdate(block._ref, idMappings[block._ref])
        updated._ref = idMappings[block._ref]
      }

      // Update marks with references
      if (block.marks && Array.isArray(block.marks)) {
        updated.marks = block.marks.map((mark: any) => {
          if (mark._ref && typeof mark._ref === 'string' && idMappings[mark._ref]) {
            onUpdate(mark._ref, idMappings[mark._ref])
            return { ...mark, _ref: idMappings[mark._ref] }
          }
          return mark
        })
      }

      // Recursively update children
      if (block.children && Array.isArray(block.children)) {
        updated.children = this.updatePortableText(block.children, idMappings, onUpdate)
      }

      return updated
    })
  }

  /**
   * Build ID mappings from collections of old and new documents
   */
  static buildIdMappings(
    oldDocuments: Array<{ id?: string; _id?: string }>,
    newDocuments: Array<{ id?: string; _id?: string }>
  ): IdMapping {
    const mappings: IdMapping = {}

    for (let i = 0; i < Math.min(oldDocuments.length, newDocuments.length); i++) {
      const oldId = oldDocuments[i].id || oldDocuments[i]._id
      const newId = newDocuments[i].id || newDocuments[i]._id

      if (oldId && newId) {
        mappings[oldId] = newId
      }
    }

    return mappings
  }
}
