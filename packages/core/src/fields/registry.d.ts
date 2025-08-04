import { FieldType, FieldCategory, FieldTypeRegistrationOptions, FieldTypeMetadata } from './field-type.js';
/**
 * Field type registration error
 */
export declare class FieldTypeRegistrationError extends Error {
    fieldType?: string | undefined;
    constructor(message: string, fieldType?: string | undefined);
}
/**
 * Central registry for all field types in the system
 * Supports registration, lookup, categorization, and extensibility
 */
export declare class FieldTypeRegistry {
    private static types;
    private static categories;
    private static metadata;
    /**
     * Register a field type in the registry
     */
    static register<T extends FieldType>(fieldType: T, options?: FieldTypeRegistrationOptions): void;
    /**
     * Get a field type by name
     */
    static get(name: string): FieldType | undefined;
    /**
     * Get all registered field types
     */
    static getAll(): FieldType[];
    /**
     * Get field types by category
     */
    static getByCategory(category: FieldCategory): FieldType[];
    /**
     * Check if a field type exists
     */
    static exists(name: string): boolean;
    /**
     * Get all available categories
     */
    static getCategories(): FieldCategory[];
    /**
     * Get metadata for a field type
     */
    static getMetadata(name: string): FieldTypeMetadata | undefined;
    /**
     * Get all field type metadata
     */
    static getAllMetadata(): FieldTypeMetadata[];
    /**
     * Unregister a field type
     */
    static unregister(name: string): boolean;
    /**
     * Clear all registered field types (mainly for testing)
     */
    static clear(): void;
    /**
     * Get field types that match a search query
     */
    static search(query: string): FieldType[];
    /**
     * Validate field type before registration
     */
    private static validateFieldType;
    /**
     * Remove field type from all categories
     */
    private static removeFromAllCategories;
    /**
     * Create a snapshot of the current registry state (for debugging/testing)
     */
    static snapshot(): {
        types: string[];
        categories: Record<string, string[]>;
        metadata: Record<string, FieldTypeMetadata>;
    };
}
//# sourceMappingURL=registry.d.ts.map