"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentValidator = void 0;
const zod_1 = require("zod");
class DocumentValidator {
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
            if (error instanceof zod_1.z.ZodError) {
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
        return zod_1.z.object(schemaShape).passthrough();
    }
    buildFieldSchema(fieldDef) {
        switch (fieldDef.type) {
            case 'string':
                return zod_1.z.string();
            case 'number':
                return zod_1.z.number();
            case 'boolean':
                return zod_1.z.boolean();
            case 'date':
                return zod_1.z.date().or(zod_1.z.string().refine(str => {
                    const date = new Date(str);
                    return !isNaN(date.getTime());
                }, { message: 'Invalid date string' }).transform(str => new Date(str)));
            case 'array':
                if (!fieldDef.items) {
                    return zod_1.z.array(zod_1.z.unknown());
                }
                const itemSchema = this.buildFieldSchema(fieldDef.items);
                return zod_1.z.array(itemSchema);
            case 'object':
                if (!fieldDef.properties) {
                    return zod_1.z.record(zod_1.z.unknown());
                }
                const objectShape = {};
                for (const [propName, propDef] of Object.entries(fieldDef.properties)) {
                    const typedPropDef = propDef;
                    let propSchema = this.buildFieldSchema(typedPropDef);
                    if (!typedPropDef.required) {
                        propSchema = propSchema.optional();
                    }
                    objectShape[propName] = propSchema;
                }
                return zod_1.z.object(objectShape);
            case 'reference':
                return zod_1.z.string(); // Reference IDs are strings
            case 'media':
                // Media fields can be either a string ID or a complex object with asset reference
                return zod_1.z.union([
                    zod_1.z.string(),
                    zod_1.z.object({
                        _type: zod_1.z.literal('media'),
                        asset: zod_1.z.object({
                            _ref: zod_1.z.string(),
                            _type: zod_1.z.literal('mediaAsset')
                        }),
                        alt: zod_1.z.string().optional(),
                        caption: zod_1.z.string().optional(),
                        title: zod_1.z.string().optional(),
                        variant: zod_1.z.string().optional()
                    }).passthrough()
                ]);
            case 'slug':
                // Slug fields are URL-friendly strings
                return zod_1.z.string()
                    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format')
                    .min(1, 'Slug cannot be empty')
                    .max(200, 'Slug is too long');
            default:
                return zod_1.z.unknown();
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
exports.DocumentValidator = DocumentValidator;
