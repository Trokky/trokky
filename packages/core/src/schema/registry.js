import { ContentSchemaSchema } from '../types/index.js';
export class SchemaRegistry {
    schemas = new Map();
    constructor(schemas) {
        if (Array.isArray(schemas)) {
            this.loadSchemas(schemas);
        }
        else {
            // TODO: Implement dynamic schema loading from file pattern
            throw new Error('File-based schema loading not yet implemented');
        }
    }
    loadSchemas(schemas) {
        for (const schema of schemas) {
            this.validateAndRegisterSchema(schema);
        }
    }
    validateAndRegisterSchema(schema) {
        try {
            const validatedSchema = ContentSchemaSchema.parse(schema);
            this.schemas.set(validatedSchema.name, validatedSchema);
        }
        catch (error) {
            throw new Error(`Invalid schema "${schema.name}": ${error}`);
        }
    }
    getSchema(name) {
        return this.schemas.get(name) || null;
    }
    hasSchema(name) {
        return this.schemas.has(name);
    }
    getAllSchemas() {
        return Array.from(this.schemas.values());
    }
    getSchemaNames() {
        return Array.from(this.schemas.keys());
    }
    registerSchema(schema) {
        this.validateAndRegisterSchema(schema);
    }
    unregisterSchema(name) {
        return this.schemas.delete(name);
    }
}
