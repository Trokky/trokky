export class TrokkyError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'TrokkyError';
        Error.captureStackTrace?.(this, TrokkyError);
    }
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            stack: this.stack
        };
    }
}
export class ValidationError extends TrokkyError {
    validationErrors;
    constructor(message, validationErrors) {
        super(message, 'VALIDATION_FAILED', { errors: validationErrors });
        this.validationErrors = validationErrors;
        this.name = 'ValidationError';
    }
    toJSON() {
        return {
            ...super.toJSON(),
            validationErrors: this.validationErrors
        };
    }
}
export class SchemaNotFoundError extends TrokkyError {
    constructor(collection) {
        super(`Schema not found for collection: ${collection}`, 'SCHEMA_NOT_FOUND', { collection });
        this.name = 'SchemaNotFoundError';
    }
}
export class DocumentNotFoundError extends TrokkyError {
    constructor(collection, id) {
        super(`Document not found: ${collection}/${id}`, 'DOCUMENT_NOT_FOUND', { collection, id });
        this.name = 'DocumentNotFoundError';
    }
}
export class InvalidInputError extends TrokkyError {
    constructor(message, field) {
        super(message, 'INVALID_INPUT', { field });
        this.name = 'InvalidInputError';
    }
}
export class RateLimitError extends TrokkyError {
    constructor(operation) {
        super(`Rate limit exceeded for operation: ${operation}`, 'RATE_LIMIT_EXCEEDED', { operation });
        this.name = 'RateLimitError';
    }
}
