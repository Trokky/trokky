import { SchemaRegistry } from '../schema/registry.js';
import { ValidationResult } from '../types/index.js';
export declare class DocumentValidator {
    private schemaRegistry;
    constructor(schemaRegistry: SchemaRegistry);
    validateDocument(collection: string, data: unknown): ValidationResult;
    private buildZodSchema;
    private buildFieldSchema;
    private formatZodErrors;
}
//# sourceMappingURL=validator.d.ts.map