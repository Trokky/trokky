import { ContentSchema, TrokkyConfig } from '../types/index.js';
export declare class SchemaRegistry {
    private schemas;
    private config;
    constructor(schemas: ContentSchema[] | string, config?: TrokkyConfig['features']);
    private loadSchemas;
    private validateAndRegisterSchema;
    /**
     * Automatically injects a slug field for document schemas if:
     * 1. It's a document type (not singleton necessarily, but typically)
     * 2. No slug field is already defined
     * 3. There's a 'title' field to generate from (or fallback to the first string field)
     */
    private injectAutoSlugField;
    /**
     * Automatically injects a thumbnail field for document schemas if:
     * 1. Feature is enabled in configuration (default: true)
     * 2. It's a document type (or singleton if configured to include them)
     * 3. No thumbnail/featured image field is already defined
     * 4. Schema is not in the skip list
     */
    private injectAutoThumbnailField;
    /**
     * Find the best field to use as slug source
     * Priority: 'title' > 'name' > first string field
     */
    private findSlugSourceField;
    getSchema(name: string): ContentSchema | null;
    hasSchema(name: string): boolean;
    getAllSchemas(): ContentSchema[];
    getSchemaNames(): string[];
    registerSchema(schema: ContentSchema): void;
    unregisterSchema(name: string): boolean;
}
//# sourceMappingURL=registry.d.ts.map