/**
 * Global Adapter Registry System
 * 
 * Provides a registry-based approach for adapter resolution to avoid
 * static import analysis issues with bundlers like esbuild.
 * 
 * Instead of hardcoded imports, adapters register themselves and
 * integrations look them up dynamically.
 */

import type { 
  DataStorageAdapter as StorageAdapter, 
  MediaStorageAdapter as MediaAdapter 
} from '../types/index.js'

// Adapter factory function types
export type DataAdapterFactory = (config: any) => Promise<StorageAdapter> | StorageAdapter
export type MediaAdapterFactory = (config: any) => Promise<MediaAdapter> | MediaAdapter

// Registry interfaces
export interface AdapterFactories {
  data: Map<string, DataAdapterFactory>
  media: Map<string, MediaAdapterFactory>
}

export interface AdapterRegistryConfig {
  name: string
  type: 'data' | 'media'
  factory: DataAdapterFactory | MediaAdapterFactory
  environments?: string[]  // e.g., ['node', 'edge', 'cloudflare']
}

/**
 * Global adapter registry singleton
 */
class AdapterRegistry {
  private factories: AdapterFactories = {
    data: new Map(),
    media: new Map()
  }

  private isInitialized = false

  /**
   * Register an adapter factory
   */
  register(config: AdapterRegistryConfig): void {
    const { name, type, factory } = config
    
    if (type === 'data') {
      this.factories.data.set(name, factory as DataAdapterFactory)
    } else if (type === 'media') {
      this.factories.media.set(name, factory as MediaAdapterFactory)
    } else {
      throw new Error(`Unknown adapter type: ${type}`)
    }

    // Mark as initialized once we have at least one adapter
    if (!this.isInitialized) {
      this.isInitialized = true
    }
  }

  /**
   * Get available adapter names by type
   */
  getAvailableAdapters(type: 'data' | 'media'): string[] {
    return Array.from(this.factories[type].keys())
  }

  /**
   * Check if an adapter is available
   */
  hasAdapter(name: string, type: 'data' | 'media'): boolean {
    return this.factories[type].has(name)
  }

  /**
   * Create data adapter instance
   */
  async createDataAdapter(name: string, config: any): Promise<StorageAdapter> {
    const factory = this.factories.data.get(name)
    
    if (!factory) {
      const available = this.getAvailableAdapters('data')
      throw new Error(
        `Data adapter "${name}" not found. Available adapters: ${available.join(', ')}.\n` +
        `Make sure the adapter package is installed and imported.`
      )
    }

    try {
      const adapter = await factory(config)
      return adapter
    } catch (error) {
      throw new Error(
        `Failed to create data adapter "${name}": ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Create media adapter instance
   */
  async createMediaAdapter(name: string, config: any): Promise<MediaAdapter> {
    const factory = this.factories.media.get(name)
    
    if (!factory) {
      const available = this.getAvailableAdapters('media')
      throw new Error(
        `Media adapter "${name}" not found. Available adapters: ${available.join(', ')}.\n` +
        `Make sure the adapter package is installed and imported.`
      )
    }

    try {
      const adapter = await factory(config)
      return adapter
    } catch (error) {
      throw new Error(
        `Failed to create media adapter "${name}": ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Get registry status for debugging
   */
  getStatus(): {
    initialized: boolean
    dataAdapters: string[]
    mediaAdapters: string[]
  } {
    return {
      initialized: this.isInitialized,
      dataAdapters: this.getAvailableAdapters('data'),
      mediaAdapters: this.getAvailableAdapters('media')
    }
  }

  /**
   * Clear registry (mainly for testing)
   */
  clear(): void {
    this.factories.data.clear()
    this.factories.media.clear()
    this.isInitialized = false
  }
}

// Create global singleton instance
const globalRegistry = new AdapterRegistry()

// Attach to global scope for cross-package access
if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).__TROKKY_ADAPTER_REGISTRY__ = globalRegistry
}

/**
 * Get the global adapter registry instance
 */
export function getAdapterRegistry(): AdapterRegistry {
  // Try to get from global scope first (for cross-package access)
  if (typeof globalThis !== 'undefined' && (globalThis as any).__TROKKY_ADAPTER_REGISTRY__) {
    return (globalThis as any).__TROKKY_ADAPTER_REGISTRY__
  }
  
  return globalRegistry
}

/**
 * Helper function to register an adapter
 */
export function registerAdapter(config: AdapterRegistryConfig): void {
  const registry = getAdapterRegistry()
  registry.register(config)
}

/**
 * Helper function to create adapters
 */
export async function createAdapter<T extends StorageAdapter | MediaAdapter>(
  name: string,
  type: 'data' | 'media',
  config: any
): Promise<T> {
  const registry = getAdapterRegistry()
  
  if (type === 'data') {
    return registry.createDataAdapter(name, config) as Promise<T>
  } else {
    return registry.createMediaAdapter(name, config) as Promise<T>
  }
}

/**
 * Export the registry instance for direct access
 */
export { globalRegistry as adapterRegistry }