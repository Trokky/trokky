/**
 * Field Registry System
 * 
 * Central registry for all field types (built-in and custom).
 * Provides registration, lookup, and management capabilities.
 * Based on proven legacy architecture from Trokky v1
 */

import type { FieldPlugin, FieldPluginSource, RegisteredFieldPlugin } from '../base/FieldPlugin.js';
import type { FieldCategory } from '../base/FieldDefinition.js';

export interface FieldRegistryStats {
  total: number;
  byCategory: Record<FieldCategory, number>;
  bySource: Record<FieldPluginSource, number>;
  initialized: boolean;
}

export class FieldRegistry {
  private plugins = new Map<string, RegisteredFieldPlugin>();
  private initialized = false;

  /**
   * Register a field plugin
   */
  register(plugin: FieldPlugin<any, any>, source: FieldPluginSource = 'custom'): void {
    // Validate plugin
    this.validatePlugin(plugin);

    // Check for conflicts
    if (this.plugins.has(plugin.type)) {
      const existing = this.plugins.get(plugin.type)!;
      
      // Allow built-in fields to be overridden by custom fields
      if (existing.source === 'builtin' && source === 'custom') {
        console.warn(`Overriding built-in field type '${plugin.type}' with custom implementation`);
      } else if (existing.source === 'custom' && source === 'builtin') {
        console.warn(`Ignoring built-in field type '${plugin.type}' - custom implementation already registered`);
        return;
      } else {
        throw new Error(`Field type '${plugin.type}' is already registered from source '${existing.source}'`);
      }
    }

    // Register the plugin
    const registeredPlugin: RegisteredFieldPlugin = {
      ...plugin,
      source,
      registeredAt: new Date()
    };

    this.plugins.set(plugin.type, registeredPlugin);
    
    // console.debug(`Registered field plugin '${plugin.type}' from '${source}' source`);
  }

  /**
   * Get a field plugin by type
   */
  get(type: string): FieldPlugin | undefined {
    return this.plugins.get(type);
  }

  /**
   * Get all registered field plugins
   */
  getAll(): RegisteredFieldPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get field plugins by category
   */
  getByCategory(category: FieldCategory): RegisteredFieldPlugin[] {
    return this.getAll().filter(plugin => plugin.category === category);
  }

  /**
   * Get all registered field type names
   */
  getTypes(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Check if a field type is registered
   */
  has(type: string): boolean {
    return this.plugins.has(type);
  }

  /**
   * Unregister a field plugin
   */
  unregister(type: string): boolean {
    return this.plugins.delete(type);
  }

  /**
   * Clear all registered plugins
   */
  clear(): void {
    this.plugins.clear();
    this.initialized = false;
  }

  /**
   * Get registry statistics
   */
  getStats(): FieldRegistryStats {
    const plugins = this.getAll();
    
    const byCategory: Record<FieldCategory, number> = {
      text: 0,
      number: 0,
      boolean: 0,
      date: 0,
      media: 0,
      reference: 0,
      structure: 0,
      custom: 0
    };

    const bySource: Record<FieldPluginSource, number> = {
      builtin: 0,
      external: 0,
      custom: 0
    };

    for (const plugin of plugins) {
      byCategory[plugin.category]++;
      bySource[plugin.source]++;
    }

    return {
      total: plugins.length,
      byCategory,
      bySource,
      initialized: this.initialized
    };
  }

  /**
   * Mark registry as initialized (all built-in fields loaded)
   */
  markInitialized(): void {
    this.initialized = true;
  }

  /**
   * Check if registry is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Validate plugin structure
   */
  private validatePlugin(plugin: FieldPlugin<any, any>): void {
    const required = ['type', 'displayName', 'description', 'category', 'component', 'validate', 'getDefaultValue', 'toSchemaField', 'fromSchemaField'];
    
    for (const prop of required) {
      if (!(prop in plugin) || plugin[prop as keyof FieldPlugin<any, any>] === undefined) {
        throw new Error(`Field plugin is missing required property: ${prop}`);
      }
    }

    if (typeof plugin.type !== 'string' || plugin.type.trim() === '') {
      throw new Error('Field plugin type must be a non-empty string');
    }

    if (typeof plugin.validate !== 'function') {
      throw new Error('Field plugin validate must be a function');
    }

    if (typeof plugin.getDefaultValue !== 'function') {
      throw new Error('Field plugin getDefaultValue must be a function');
    }

    if (typeof plugin.toSchemaField !== 'function') {
      throw new Error('Field plugin toSchemaField must be a function');
    }

    if (typeof plugin.fromSchemaField !== 'function') {
      throw new Error('Field plugin fromSchemaField must be a function');
    }

    // Validate React component
    if (typeof plugin.component !== 'function' && typeof plugin.component !== 'object') {
      throw new Error('Field plugin component must be a React component');
    }
  }
}

// Global field registry instance
export const fieldRegistry = new FieldRegistry();

// Export for convenience
export default fieldRegistry;