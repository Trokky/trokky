import { z } from 'zod';
export class DocumentValidator {
    constructor(schemaRegistry) {
        this.schemaRegistry = schemaRegistry;
    }
    validateDocument(collection, data) {
        const schema = this.schemaRegistry.getSchema(collection);
        if (!schema) {
            return {
                valid: false,
                errors: [{
                        field: '_collection',
                        message: `Schema not found for collection: ${collection}`,
                        code: 'SCHEMA_NOT_FOUND'
                    }]
            };
        }
        try {
            const zodSchema = this.buildZodSchema(schema.fields);
            zodSchema.parse(data);
            return {
                valid: true,
                errors: []
            };
        }
        catch (error) {
            if (error instanceof z.ZodError) {
                return {
                    valid: false,
                    errors: this.formatZodErrors(error)
                };
            }
            return {
                valid: false,
                errors: [{
                        field: '_root',
                        message: `Validation error: ${error}`,
                        code: 'VALIDATION_ERROR'
                    }]
            };
        }
    }
    buildZodSchema(fields) {
        const schemaShape = {};
        for (const [fieldName, fieldDef] of Object.entries(fields)) {
            let fieldSchema = this.buildFieldSchema(fieldDef);
            if (!fieldDef.required) {
                fieldSchema = fieldSchema.optional();
            }
            schemaShape[fieldName] = fieldSchema;
        }
        return z.object(schemaShape).passthrough();
    }
    buildFieldSchema(fieldDef) {
        switch (fieldDef.type) {
            case 'string':
                return z.string();
            case 'number':
                return z.number();
            case 'boolean':
                return z.boolean();
            case 'date':
                return z.date()
                    .or(z.string().refine(str => {
                    // Handle special "now" value
                    if (str === 'now') {
                        return true;
                    }
                    const date = new Date(str);
                    return !isNaN(date.getTime());
                }, { message: 'Invalid date string' }).transform(str => {
                    // Transform "now" to current date
                    if (str === 'now') {
                        return new Date();
                    }
                    return new Date(str);
                }))
                    .or(z.null()); // Allow null values for optional date fields
            case 'array':
                // Use modern 'of' format for array item definition
                if (!fieldDef.of) {
                    return z.array(z.unknown());
                }
                const itemSchema = this.buildFieldSchema(fieldDef.of);
                return z.array(itemSchema);
            case 'object':
                if (!fieldDef.fields) {
                    return z.record(z.unknown());
                }
                const objectShape = {};
                // Handle modern format: fields is a Record<string, FieldDefinition>
                for (const [propName, propDef] of Object.entries(fieldDef.fields)) {
                    const typedPropDef = propDef;
                    let propSchema = this.buildFieldSchema(typedPropDef);
                    if (!typedPropDef.required) {
                        propSchema = propSchema.optional();
                    }
                    objectShape[propName] = propSchema;
                }
                return z.object(objectShape);
            case 'reference':
                return z.union([
                    z.string(), // Still allow string IDs for backward compatibility
                    z.object({
                        _ref: z.string(),
                        _type: z.string().optional()
                    }).passthrough() // Allow additional metadata
                ]);
            case 'media':
                // Media fields can be either a string ID or a complex object with asset reference
                return z.union([
                    z.string(),
                    z.object({
                        _type: z.literal('media'),
                        asset: z.object({
                            _ref: z.string(),
                            _type: z.literal('mediaAsset')
                        }),
                        alt: z.string().optional(),
                        caption: z.string().optional(),
                        title: z.string().optional(),
                        variant: z.string().optional()
                    }).passthrough()
                ]);
            case 'slug':
                // Slug fields are URL-friendly strings
                return z.string()
                    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')
                    .min(1, 'Slug cannot be empty')
                    .max(200, 'Slug is too long');
            default:
                return z.unknown();
        }
    }
    formatZodErrors(zodError) {
        return zodError.errors.map(error => ({
            field: error.path.join('.') || '_root',
            message: error.message,
            code: error.code
        }));
    }
}
//# sourceMappingURL=validator.js.map