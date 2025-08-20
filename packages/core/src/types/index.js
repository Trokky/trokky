import { z } from 'zod';
import { CORE_FIELD_TYPES } from '@trokky/types';
// Audit actor types
export const AUDIT_ACTOR_TYPES = {
    USER: 'user',
    API: 'api',
    SYSTEM: 'system',
    WEBHOOK: 'webhook'
};
// Audit log operations
export const AUDIT_OPERATIONS = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    PUBLISH: 'publish',
    UNPUBLISH: 'unpublish',
    RESTORE: 'restore'
};
// Dynamic field type registry - allows @trokky/fields to register types at runtime
let _fieldRegistry = null;
export function setFieldRegistry(registry) {
    _fieldRegistry = registry;
}
export function getRegisteredFieldTypes() {
    if (_fieldRegistry) {
        return _fieldRegistry.getTypes();
    }
    // Fallback to core types
    return [...CORE_FIELD_TYPES];
}
// Field type schema - accepts any string to allow dynamic types
export const FieldTypeSchema = z.string();
// Schema field definition Zod schema
export const FieldDefinitionSchema = z.object({
    type: FieldTypeSchema,
    required: z.boolean().optional().default(false),
    description: z.string().optional(),
    validation: z.record(z.unknown()).optional(),
    options: z.record(z.unknown()).optional(), // For field-specific options
    of: z.lazy(() => FieldDefinitionSchema).optional(), // For arrays
    fields: z.union([
        z.record(z.lazy(() => FieldDefinitionSchema)),
        z.array(z.object({
            name: z.string(),
            type: z.string(),
            title: z.string(),
            description: z.string().optional(),
            required: z.boolean().optional(),
            validation: z.any().optional(),
            options: z.any().optional(),
            default: z.any().optional(),
            fields: z.any().optional(),
            to: z.any().optional(),
            of: z.any().optional()
        }))
    ]).optional(), // For objects - support both Record and Array formats
    to: z.string().optional(), // For references
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
    fields: z.record(FieldDefinitionSchema)
});
export { ROLE_PERMISSIONS } from './user.js';
//# sourceMappingURL=index.js.map