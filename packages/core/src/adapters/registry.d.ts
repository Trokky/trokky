/**
 * Global Adapter Registry System
 *
 * Provides a registry-based approach for adapter resolution to avoid
 * static import analysis issues with bundlers like esbuild.
 *
 * Instead of hardcoded imports, adapters register themselves and
 * integrations look them up dynamically.
 */
import type { DataStorageAdapter as StorageAdapter, MediaStorageAdapter as MediaAdapter } from '../types/index.js';
export type DataAdapterFactory = (config: any) => Promise<StorageAdapter> | StorageAdapter;
export type MediaAdapterFactory = (config: any) => Promise<MediaAdapter> | MediaAdapter;
export interface AdapterFactories {
    data: Map<string, DataAdapterFactory>;
    media: Map<string, MediaAdapterFactory>;
}
export interface AdapterRegistryConfig {
    name: string;
    type: 'data' | 'media';
    factory: DataAdapterFactory | MediaAdapterFactory;
    environments?: string[];
}
/**
 * Global adapter registry singleton
 */
declare class AdapterRegistry {
    private factories;
    private isInitialized;
    /**
     * Register an adapter factory
     */
    register(config: AdapterRegistryConfig): void;
    /**
     * Get available adapter names by type
     */
    getAvailableAdapters(type: 'data' | 'media'): string[];
    /**
     * Check if an adapter is available
     */
    hasAdapter(name: string, type: 'data' | 'media'): boolean;
    /**
     * Create data adapter instance
     */
    createDataAdapter(name: string, config: any): Promise<StorageAdapter>;
    /**
     * Create media adapter instance
     */
    createMediaAdapter(name: string, config: any): Promise<MediaAdapter>;
    /**
     * Get registry status for debugging
     */
    getStatus(): {
        initialized: boolean;
        dataAdapters: string[];
        mediaAdapters: string[];
    };
    /**
     * Clear registry (mainly for testing)
     */
    clear(): void;
}
declare const globalRegistry: AdapterRegistry;
/**
 * Get the global adapter registry instance
 */
export declare function getAdapterRegistry(): AdapterRegistry;
/**
 * Helper function to register an adapter
 */
export declare function registerAdapter(config: AdapterRegistryConfig): void;
/**
 * Helper function to create adapters
 */
export declare function createAdapter<T extends StorageAdapter | MediaAdapter>(name: string, type: 'data' | 'media', config: any): Promise<T>;
/**
 * Export the registry instance for direct access
 */
export { globalRegistry as adapterRegistry };
//# sourceMappingURL=registry.d.ts.map