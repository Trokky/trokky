/**
 * Schema analyzer - builds dependency graphs and analyzes field structures
 */

import type { SchemaDefinition, FieldDefinition, DependencyGraph } from './types.js'

/**
 * Analyze schemas and build dependency graph
 */
export class SchemaAnalyzer {
  /**
   * Build dependency graph from schemas
   * Returns a map of collection -> dependencies
   */
  static buildDependencyGraph(schemas: SchemaDefinition[]): DependencyGraph {
    const graph: DependencyGraph = {}

    for (const schema of schemas) {
      const dependencies = new Set<string>()

      // Recursively scan all fields for references
      this.scanFieldsForDependencies(schema.fields, dependencies)

      graph[schema.name] = Array.from(dependencies)
    }

    return graph
  }

  /**
   * Recursively scan fields to find dependencies (references to other collections)
   */
  private static scanFieldsForDependencies(
    fields: FieldDefinition[] | Record<string, FieldDefinition>,
    dependencies: Set<string>
  ): void {
    const fieldArray = Array.isArray(fields) ? fields : Object.values(fields)

    for (const field of fieldArray) {
      // Reference fields
      if (field.type === 'reference' && field.to) {
        const targets = Array.isArray(field.to) ? field.to : [field.to]
        targets.forEach(target => dependencies.add(target))
      }

      // Media and image fields depend on media collection
      if (field.type === 'media' || field.type === 'image') {
        dependencies.add('media')
      }

      // Array fields - check the 'of' type
      if (field.type === 'array' && field.of) {
        this.scanFieldsForDependencies([field.of], dependencies)
      }

      // Object fields - recursively scan nested fields
      if (field.type === 'object' && field.fields) {
        this.scanFieldsForDependencies(field.fields, dependencies)
      }
    }
  }

  /**
   * Topological sort to determine restore order
   * Returns collections in order such that dependencies come before dependents
   */
  static getRestoreOrder(graph: DependencyGraph): string[] {
    const collections = Object.keys(graph)
    const sorted: string[] = []
    const visited = new Set<string>()
    const visiting = new Set<string>()

    const visit = (collection: string): void => {
      if (visited.has(collection)) return
      if (visiting.has(collection)) {
        // Cycle detected - this is OK, we'll handle it
        return
      }

      visiting.add(collection)

      const deps = graph[collection] || []
      for (const dep of deps) {
        // Only visit if it's in our collection set
        if (collections.includes(dep)) {
          visit(dep)
        }
      }

      visiting.delete(collection)
      visited.add(collection)
      sorted.push(collection)
    }

    // Visit all collections
    for (const collection of collections) {
      visit(collection)
    }

    return sorted
  }

  /**
   * Find all reference fields in a schema (flat list with paths)
   */
  static findReferenceFields(schema: SchemaDefinition): ReferenceFieldInfo[] {
    const references: ReferenceFieldInfo[] = []
    this.scanFieldsForReferences(schema.fields, [], references)
    return references
  }

  /**
   * Recursively scan fields to build reference field info
   */
  private static scanFieldsForReferences(
    fields: FieldDefinition[] | Record<string, FieldDefinition>,
    path: string[],
    references: ReferenceFieldInfo[]
  ): void {
    const fieldArray = Array.isArray(fields) ? fields : Object.values(fields)

    for (const field of fieldArray) {
      const currentPath = [...path, field.name]

      // Reference fields
      if (field.type === 'reference' && field.to) {
        references.push({
          path: currentPath,
          fieldName: field.name,
          targetCollections: Array.isArray(field.to) ? field.to : [field.to],
          fieldType: 'reference'
        })
      }

      // Media fields
      if (field.type === 'media' || field.type === 'image') {
        references.push({
          path: currentPath,
          fieldName: field.name,
          targetCollections: ['media'],
          fieldType: field.type
        })
      }

      // Array fields
      if (field.type === 'array' && field.of) {
        this.scanFieldsForReferences([field.of], currentPath, references)
      }

      // Object fields
      if (field.type === 'object' && field.fields) {
        this.scanFieldsForReferences(field.fields, currentPath, references)
      }
    }
  }

  /**
   * Validate that target schemas are compatible with backup schemas
   */
  static validateSchemaCompatibility(
    backupSchemas: SchemaDefinition[],
    targetSchemas: SchemaDefinition[]
  ): SchemaCompatibilityResult {
    const errors: string[] = []
    const warnings: string[] = []

    const backupSchemaMap = new Map(backupSchemas.map(s => [s.name, s]))
    const targetSchemaMap = new Map(targetSchemas.map(s => [s.name, s]))

    // Check for missing collections
    for (const backupSchema of backupSchemas) {
      const targetSchema = targetSchemaMap.get(backupSchema.name)

      if (!targetSchema) {
        errors.push(`Collection '${backupSchema.name}' exists in backup but not in target`)
        continue
      }

      // Check singleton compatibility
      if (backupSchema.singleton !== targetSchema.singleton) {
        warnings.push(
          `Collection '${backupSchema.name}' singleton mismatch: ` +
          `backup=${backupSchema.singleton}, target=${targetSchema.singleton}`
        )
      }

      // Check field compatibility (basic check)
      // fields is an object/map, not an array
      const backupFieldNames = new Set(Object.keys(backupSchema.fields))
      const targetFieldNames = new Set(Object.keys(targetSchema.fields))

      for (const fieldName of backupFieldNames) {
        if (!targetFieldNames.has(fieldName)) {
          warnings.push(
            `Field '${fieldName}' in collection '${backupSchema.name}' ` +
            `exists in backup but not in target`
          )
        }
      }
    }

    return {
      compatible: errors.length === 0,
      errors,
      warnings
    }
  }
}

export interface ReferenceFieldInfo {
  path: string[]
  fieldName: string
  targetCollections: string[]
  fieldType: 'reference' | 'media' | 'image'
}

export interface SchemaCompatibilityResult {
  compatible: boolean
  errors: string[]
  warnings: string[]
}
