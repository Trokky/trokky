export declare class TrokkyError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, details?: Record<string, unknown> | undefined);
    toJSON(): Record<string, unknown>;
}
export declare class ValidationError extends TrokkyError {
    readonly validationErrors: ValidationErrorDetail[];
    constructor(message: string, validationErrors: ValidationErrorDetail[]);
    toJSON(): Record<string, unknown>;
}
export declare class SchemaNotFoundError extends TrokkyError {
    constructor(collection: string);
}
export declare class DocumentNotFoundError extends TrokkyError {
    constructor(collection: string, id: string);
}
export declare class InvalidInputError extends TrokkyError {
    constructor(message: string, field?: string);
}
export declare class RateLimitError extends TrokkyError {
    constructor(operation: string);
}
export interface ValidationErrorDetail {
    field: string;
    message: string;
    code: string;
}
//# sourceMappingURL=index.d.ts.map