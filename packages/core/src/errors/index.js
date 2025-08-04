"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.InvalidInputError = exports.DocumentNotFoundError = exports.SchemaNotFoundError = exports.ValidationError = exports.TrokkyError = void 0;
class TrokkyError extends Error {
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
exports.TrokkyError = TrokkyError;
class ValidationError extends TrokkyError {
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
exports.ValidationError = ValidationError;
class SchemaNotFoundError extends TrokkyError {
    constructor(collection) {
        super(`Schema not found for collection: ${collection}`, 'SCHEMA_NOT_FOUND', { collection });
        this.name = 'SchemaNotFoundError';
    }
}
exports.SchemaNotFoundError = SchemaNotFoundError;
class DocumentNotFoundError extends TrokkyError {
    constructor(collection, id) {
        super(`Document not found: ${collection}/${id}`, 'DOCUMENT_NOT_FOUND', { collection, id });
        this.name = 'DocumentNotFoundError';
    }
}
exports.DocumentNotFoundError = DocumentNotFoundError;
class InvalidInputError extends TrokkyError {
    constructor(message, field) {
        super(message, 'INVALID_INPUT', { field });
        this.name = 'InvalidInputError';
    }
}
exports.InvalidInputError = InvalidInputError;
class RateLimitError extends TrokkyError {
    constructor(operation) {
        super(`Rate limit exceeded for operation: ${operation}`, 'RATE_LIMIT_EXCEEDED', { operation });
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
