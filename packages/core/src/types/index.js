import { z } from 'zod';
// Schema field types
export const LegacyFieldTypeSchema = z.enum([
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
export const LegacyFieldDefinitionSchema = z.object({
    type: LegacyFieldTypeSchema,
    required: z.boolean().optional().default(false),
    description: z.string().optional(),
    validation: z.record(z.unknown()).optional(),
    options: z.record(z.unknown()).optional(), // For field-specific options
    items: z.lazy(() => LegacyFieldDefinitionSchema).optional(), // For arrays
    properties: z.record(z.lazy(() => LegacyFieldDefinitionSchema)).optional(), // For objects
    collection: z.string().optional(), // For references
    // Slug field specific properties
    source: z.union([z.string(), z.array(z.string())]).optional(), // Source field(s) for auto-generation
    autoGenerate: z.boolean().optional(), // Enable auto-generation
    unique: z.boolean().optional(), // Require uniqueness
    maxLength: z.number().optional(), // Maximum length
    minLength: z.number().optional(), // Minimum length
    allowEmpty: z.boolean().optional(), // Allow empty values
    readOnly: z.boolean().optional(), // Read-only field
    preserveCase: z.boolean().optional(), // Preserve case in slugs
    allowedChars: z.string().optional(), // Additional allowed characters
    prefix: z.string().optional(), // Slug prefix
    suffix: z.string().optional() // Slug suffix
}).passthrough(); // Allow additional properties for extensibility
// Content schema definition
export const ContentSchemaSchema = z.object({
    name: z.string(),
    type: z.enum(['document', 'singleton']),
    title: z.string().optional(),
    description: z.string().optional(),
    singleton: z.boolean().optional(), // Allow singleton property
    fields: z.record(LegacyFieldDefinitionSchema)
});
export { ROLE_PERMISSIONS } from './user.js';
