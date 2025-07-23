/**
 * Field Renderer Registry - Manages field type to React component mappings
 */

import type { 
  FieldRenderer, 
  FieldRendererEntry, 
  FieldRendererRegistry as IFieldRendererRegistry 
} from '../types/field-renderer'

/**
 * Default field renderer registry implementation
 */
export class FieldRendererRegistry implements IFieldRendererRegistry {
  private renderers = new Map<string, FieldRendererEntry>()

  /**
   * Register a field renderer
   */
  register(entry: FieldRendererEntry): void {
    this.renderers.set(entry.type, entry)
  }

  /**
   * Get renderer for a field type
   */
  getRenderer(type: string): FieldRenderer | null {
    const entry = this.renderers.get(type)
    return entry?.component || null
  }

  /**
   * Get preview renderer for a field type
   */
  getPreviewRenderer(type: string): FieldRenderer | null {
    const entry = this.renderers.get(type)
    return entry?.preview || entry?.component || null
  }

  /**
   * Check if a field type has a renderer
   */
  hasRenderer(type: string): boolean {
    return this.renderers.has(type)
  }

  /**
   * Get all registered field types
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.renderers.keys())
  }

  /**
   * Get all registered renderers with metadata
   */
  getAllRenderers(): Map<string, FieldRendererEntry> {
    return new Map(this.renderers)
  }

  /**
   * Unregister a field renderer
   */
  unregister(type: string): boolean {
    return this.renderers.delete(type)
  }

  /**
   * Clear all registered renderers
   */
  clear(): void {
    this.renderers.clear()
  }

  /**
   * Get renderers by category
   */
  getRenderersByCategory(category: FieldRendererEntry['meta']['category']): FieldRendererEntry[] {
    return Array.from(this.renderers.values())
      .filter(entry => entry.meta.category === category)
  }

  /**
   * Register multiple renderers at once
   */
  registerMany(entries: FieldRendererEntry[]): void {
    entries.forEach(entry => this.register(entry))
  }
}

/**
 * Global field renderer registry instance
 */
export const fieldRendererRegistry = new FieldRendererRegistry()

/**
 * Register a field renderer (convenience function)
 */
export function registerFieldRenderer(entry: FieldRendererEntry): void {
  fieldRendererRegistry.register(entry)
}

/**
 * Get field renderer (convenience function)
 */
export function getFieldRenderer(type: string): FieldRenderer | null {
  return fieldRendererRegistry.getRenderer(type)
}

/**
 * Get preview renderer (convenience function)
 */
export function getPreviewRenderer(type: string): FieldRenderer | null {
  return fieldRendererRegistry.getPreviewRenderer(type)
}

/**
 * Check if field type has renderer (convenience function)
 */
export function hasFieldRenderer(type: string): boolean {
  return fieldRendererRegistry.hasRenderer(type)
}