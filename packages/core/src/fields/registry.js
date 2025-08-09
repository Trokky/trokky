import { FieldCategory } from './field-type.js';
/**
 * Field type registration error
 */
export class FieldTypeRegistrationError extends Error {
    fieldType;
    constructor(message, fieldType) {
        super(message);
        this.fieldType = fieldType;
        this.name = 'FieldTypeRegistrationError';
    }
}
/**
 * Central registry for all field types in the system
 * Supports registration, lookup, categorization, and extensibility
 */
export class FieldTypeRegistry {
    static types = new Map();
    static categories = new Map();
    static metadata = new Map();
    /**
     * Register a field type in the registry
     */
    static register(fieldType, options = {}) {
        const { override = false, migrations = [] } = options;
        // Check if field type already exists
        if (this.types.has(fieldType.name) && !override) {
            throw new FieldTypeRegistrationError(`Field type '${fieldType.name}' is already registered. Use override option to replace.`, fieldType.name);
        }
        // Validate field type
        this.validateFieldType(fieldType);
        // Register the field type
        this.types.set(fieldType.name, fieldType);
        // Add to category
        const category = fieldType.category || FieldCategory.CUSTOM;
        if (!this.categories.has(category)) {
            this.categories.set(category, []);
        }
        // Remove from previous category if re-registering
        if (override) {
            this.removeFromAllCategories(fieldType.name);
        }
        // Ensure category array exists after potential removal
        if (!this.categories.has(category)) {
            this.categories.set(category, []);
        }
        this.categories.get(category).push(fieldType);
        // Store metadata
        this.metadata.set(fieldType.name, {
            name: fieldType.name,
            category,
            description: fieldType.description,
            icon: fieldType.icon,
            version: '1.0.0', // TODO: Extract from package.json or field type
            migrations
        });
    }
    /**
     * Get a field type by name
     */
    static get(name) {
        return this.types.get(name);
    }
    /**
     * Get all registered field types
     */
    static getAll() {
        return Array.from(this.types.values());
    }
    /**
     * Get field types by category
     */
    static getByCategory(category) {
        return this.categories.get(category) || [];
    }
    /**
     * Check if a field type exists
     */
    static exists(name) {
        return this.types.has(name);
    }
    /**
     * Get all available categories
     */
    static getCategories() {
        return Array.from(this.categories.keys());
    }
    /**
     * Get metadata for a field type
     */
    static getMetadata(name) {
        return this.metadata.get(name);
    }
    /**
     * Get all field type metadata
     */
    static getAllMetadata() {
        return Array.from(this.metadata.values());
    }
    /**
     * Unregister a field type
     */
    static unregister(name) {
        const fieldType = this.types.get(name);
        if (!fieldType) {
            return false;
        }
        // Remove from types
        this.types.delete(name);
        // Remove from categories
        this.removeFromAllCategories(name);
        // Remove metadata
        this.metadata.delete(name);
        return true;
    }
    /**
     * Clear all registered field types (mainly for testing)
     */
    static clear() {
        this.types.clear();
        this.categories.clear();
        this.metadata.clear();
    }
    /**
     * Get field types that match a search query
     */
    static search(query) {
        const lowerQuery = query.toLowerCase();
        return this.getAll().filter(fieldType => fieldType.name.toLowerCase().includes(lowerQuery) ||
            fieldType.description?.toLowerCase().includes(lowerQuery) ||
            fieldType.category?.toLowerCase().includes(lowerQuery));
    }
    /**
     * Validate field type before registration
     */
    static validateFieldType(fieldType) {
        if (!fieldType.name) {
            throw new FieldTypeRegistrationError('Field type must have a name');
        }
        if (typeof fieldType.name !== 'string' || fieldType.name.trim() === '') {
            throw new FieldTypeRegistrationError('Field type name must be a non-empty string');
        }
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(fieldType.name)) {
            throw new FieldTypeRegistrationError('Field type name must start with a letter and contain only letters, numbers, and underscores');
        }
        if (typeof fieldType.validate !== 'function') {
            throw new FieldTypeRegistrationError('Field type must have a validate function');
        }
        if (typeof fieldType.serialize !== 'function') {
            throw new FieldTypeRegistrationError('Field type must have a serialize function');
        }
        if (typeof fieldType.deserialize !== 'function') {
            throw new FieldTypeRegistrationError('Field type must have a deserialize function');
        }
    }
    /**
     * Remove field type from all categories
     */
    static removeFromAllCategories(name) {
        for (const [category, fieldTypes] of this.categories.entries()) {
            const index = fieldTypes.findIndex(ft => ft.name === name);
            if (index !== -1) {
                fieldTypes.splice(index, 1);
                // Remove empty categories
                if (fieldTypes.length === 0) {
                    this.categories.delete(category);
                }
            }
        }
    }
    /**
     * Create a snapshot of the current registry state (for debugging/testing)
     */
    static snapshot() {
        return {
            types: Array.from(this.types.keys()),
            categories: Object.fromEntries(Array.from(this.categories.entries()).map(([cat, types]) => [
                cat,
                types.map(t => t.name)
            ])),
            metadata: Object.fromEntries(this.metadata.entries())
        };
    }
}
