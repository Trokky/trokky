"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = exports.ContentSchemaSchema = exports.LegacyFieldDefinitionSchema = exports.LegacyFieldTypeSchema = void 0;
const zod_1 = require("zod");
// Schema field types
exports.LegacyFieldTypeSchema = zod_1.z.enum([
    'string',
    'number',
    'boolean',
    'date',
    'array',
    'object',
    'reference',
    'media',
    'slug'
]);
// Schema field definition Zod schema
exports.LegacyFieldDefinitionSchema = zod_1.z.object({
    type: exports.LegacyFieldTypeSchema,
    required: zod_1.z.boolean().optional().default(false),
    description: zod_1.z.string().optional(),
    validation: zod_1.z.record(zod_1.z.unknown()).optional(),
    options: zod_1.z.record(zod_1.z.unknown()).optional(), // For field-specific options
    items: zod_1.z.lazy(() => exports.LegacyFieldDefinitionSchema).optional(), // For arrays
    properties: zod_1.z.record(zod_1.z.lazy(() => exports.LegacyFieldDefinitionSchema)).optional(), // For objects
    collection: zod_1.z.string().optional(), // For references
    // Slug field specific properties
    source: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]).optional(), // Source field(s) for auto-generation
    autoGenerate: zod_1.z.boolean().optional(), // Enable auto-generation
    unique: zod_1.z.boolean().optional(), // Require uniqueness
    maxLength: zod_1.z.number().optional(), // Maximum length
    minLength: zod_1.z.number().optional(), // Minimum length
    allowEmpty: zod_1.z.boolean().optional(), // Allow empty values
    readOnly: zod_1.z.boolean().optional(), // Read-only field
    preserveCase: zod_1.z.boolean().optional(), // Preserve case in slugs
    allowedChars: zod_1.z.string().optional(), // Additional allowed characters
    prefix: zod_1.z.string().optional(), // Slug prefix
    suffix: zod_1.z.string().optional() // Slug suffix
}).passthrough(); // Allow additional properties for extensibility
// Content schema definition
exports.ContentSchemaSchema = zod_1.z.object({
    name: zod_1.z.string(),
    type: zod_1.z.enum(['document', 'singleton']),
    title: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    singleton: zod_1.z.boolean().optional(), // Allow singleton property
    fields: zod_1.z.record(exports.LegacyFieldDefinitionSchema)
});
var user_js_1 = require("./user.js");
Object.defineProperty(exports, "ROLE_PERMISSIONS", { enumerable: true, get: function () { return user_js_1.ROLE_PERMISSIONS; } });
