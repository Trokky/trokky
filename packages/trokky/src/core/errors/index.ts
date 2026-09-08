export class TrokkyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'TrokkyError'
    Error.captureStackTrace?.(this, TrokkyError)
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: this.stack
    }
  }
}

export class ValidationError extends TrokkyError {
  constructor(message: string, public readonly validationErrors: ValidationErrorDetail[]) {
    super(message, 'VALIDATION_FAILED', { errors: validationErrors })
    this.name = 'ValidationError'
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors
    }
  }
}

export class SchemaNotFoundError extends TrokkyError {
  constructor(collection: string) {
    super(`Schema not found for collection: ${collection}`, 'SCHEMA_NOT_FOUND', { collection })
    this.name = 'SchemaNotFoundError'
  }
}

export class DocumentNotFoundError extends TrokkyError {
  constructor(collection: string, id: string) {
    super(`Document not found: ${collection}/${id}`, 'DOCUMENT_NOT_FOUND', { collection, id })
    this.name = 'DocumentNotFoundError'
  }
}

export class InvalidInputError extends TrokkyError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'INVALID_INPUT', { field })
    this.name = 'InvalidInputError'
  }
}

export class RateLimitError extends TrokkyError {
  constructor(operation: string) {
    super(`Rate limit exceeded for operation: ${operation}`, 'RATE_LIMIT_EXCEEDED', { operation })
    this.name = 'RateLimitError'
  }
}

export interface ValidationErrorDetail {
  field: string
  message: string
  code: string
}