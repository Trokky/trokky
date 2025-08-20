/**
 * Global Adapter Registry System
 *
 * Provides a registry-based approach for adapter resolution to avoid
 * static import analysis issues with bundlers like esbuild.
 *
 * Instead of hardcoded imports, adapters register themselves and
 * integrations look them up dynamically.
 */
/**
 * Global adapter registry singleton
 */
class AdapterRegistry {
    constructor() {
        this.factories = {
            data: new Map(),
            media: new Map()
        };
        this.isInitialized = false;
    }
    /**
     * Register an adapter factory
     */
    register(config) {
        const { name, type, factory } = config;
        if (type === 'data') {
            this.factories.data.set(name, factory);
        }
        else if (type === 'media') {
            this.factories.media.set(name, factory);
        }
        else {
            throw new Error(`Unknown adapter type: ${type}`);
        }
        // Mark as initialized once we have at least one adapter
        if (!this.isInitialized) {
            this.isInitialized = true;
        }
    }
    /**
     * Get available adapter names by type
     */
    getAvailableAdapters(type) {
        return Array.from(this.factories[type].keys());
    }
    /**
     * Check if an adapter is available
     */
    hasAdapter(name, type) {
        return this.factories[type].has(name);
    }
    /**
     * Create data adapter instance
     */
    async createDataAdapter(name, config) {
        const factory = this.factories.data.get(name);
        if (!factory) {
            const available = this.getAvailableAdapters('data');
            throw new Error(`Data adapter "${name}" not found. Available adapters: ${available.join(', ')}.\n` +
                `Make sure the adapter package is installed and imported.`);
        }
        try {
            const adapter = await factory(config);
            return adapter;
        }
        catch (error) {
            throw new Error(`Failed to create data adapter "${name}": ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Create media adapter instance
     */
    async createMediaAdapter(name, config) {
        const factory = this.factories.media.get(name);
        if (!factory) {
            const available = this.getAvailableAdapters('media');
            throw new Error(`Media adapter "${name}" not found. Available adapters: ${available.join(', ')}.\n` +
                `Make sure the adapter package is installed and imported.`);
        }
        try {
            const adapter = await factory(config);
            return adapter;
        }
        catch (error) {
            throw new Error(`Failed to create media adapter "${name}": ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get registry status for debugging
     */
    getStatus() {
        return {
            initialized: this.isInitialized,
            dataAdapters: this.getAvailableAdapters('data'),
            mediaAdapters: this.getAvailableAdapters('media')
        };
    }
    /**
     * Clear registry (mainly for testing)
     */
    clear() {
        this.factories.data.clear();
        this.factories.media.clear();
        this.isInitialized = false;
    }
}
// Create global singleton instance
const globalRegistry = new AdapterRegistry();
// Attach to global scope for cross-package access
if (typeof globalThis !== 'undefined') {
    ;
    globalThis.__TROKKY_ADAPTER_REGISTRY__ = globalRegistry;
}
/**
 * Get the global adapter registry instance
 */
export function getAdapterRegistry() {
    // Try to get from global scope first (for cross-package access)
    if (typeof globalThis !== 'undefined' && globalThis.__TROKKY_ADAPTER_REGISTRY__) {
        return globalThis.__TROKKY_ADAPTER_REGISTRY__;
    }
    return globalRegistry;
}
/**
 * Helper function to register an adapter
 */
export function registerAdapter(config) {
    const registry = getAdapterRegistry();
    registry.register(config);
}
/**
 * Helper function to create adapters
 */
export async function createAdapter(name, type, config) {
    const registry = getAdapterRegistry();
    if (type === 'data') {
        return registry.createDataAdapter(name, config);
    }
    else {
        return registry.createMediaAdapter(name, config);
    }
}
/**
 * Export the registry instance for direct access
 */
export { globalRegistry as adapterRegistry };
//# sourceMappingURL=registry.js.map