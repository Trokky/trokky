import { ContentSchema } from '../types/index.js';
export declare class SchemaRegistry {
    private schemas;
    constructor(schemas: ContentSchema[] | string);
    private loadSchemas;
    private validateAndRegisterSchema;
    getSchema(name: string): ContentSchema | null;
    hasSchema(name: string): boolean;
    getAllSchemas(): ContentSchema[];
    getSchemaNames(): string[];
    registerSchema(schema: ContentSchema): void;
    unregisterSchema(name: string): boolean;
}
//# sourceMappingURL=registry.d.ts.map