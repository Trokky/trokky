import { z } from 'zod'
import { SchemaRegistry } from '../schema/registry'
import { LegacyFieldDefinition, ValidationResult, ValidationErrorDetail } from '../types/index'

export class DocumentValidator {
  constructor(private schemaRegistry: SchemaRegistry) {}

  public validateDocument(collection: string, data: unknown): ValidationResult {
    const schema = this.schemaRegistry.getSchema(collection)
    if (!schema) {
      return {
        valid: false,
        errors: [{
          field: '_collection',
          message: `Schema not found for collection: ${collection}`,
          code: 'SCHEMA_NOT_FOUND'
        }]
      }
    }

    try {
      const zodSchema = this.buildZodSchema(schema.fields)
      zodSchema.parse(data)
      
      return {
        valid: true,
        errors: []
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: this.formatZodErrors(error)
        }
      }

      return {
        valid: false,
        errors: [{
          field: '_root',
          message: `Validation error: ${error}`,
          code: 'VALIDATION_ERROR'
        }]
      }
    }
  }

  private buildZodSchema(fields: Record<string, LegacyFieldDefinition>): z.ZodSchema {
    const schemaShape: Record<string, z.ZodSchema> = {}

    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      let fieldSchema = this.buildFieldSchema(fieldDef)
      
      if (!fieldDef.required) {
        fieldSchema = fieldSchema.optional()
      }

      schemaShape[fieldName] = fieldSchema
    }

    return z.object(schemaShape)
  }

  private buildFieldSchema(fieldDef: LegacyFieldDefinition): z.ZodSchema {
    switch (fieldDef.type) {
      case 'string':
        return z.string()
      
      case 'number':
        return z.number()
      
      case 'boolean':
        return z.boolean()
      
      case 'date':
        return z.date().or(z.string().refine(str => {
          const date = new Date(str)
          return !isNaN(date.getTime())
        }, { message: 'Invalid date string' }).transform(str => new Date(str)))
      
      case 'array':
        if (!fieldDef.items) {
          return z.array(z.unknown())
        }
        const itemSchema = this.buildFieldSchema(fieldDef.items)
        return z.array(itemSchema)
      
      case 'object':
        if (!fieldDef.properties) {
          return z.record(z.unknown())
        }
        const objectShape: Record<string, z.ZodSchema> = {}
        for (const [propName, propDef] of Object.entries(fieldDef.properties)) {
          const typedPropDef = propDef as LegacyFieldDefinition
          let propSchema = this.buildFieldSchema(typedPropDef)
          if (!typedPropDef.required) {
            propSchema = propSchema.optional()
          }
          objectShape[propName] = propSchema
        }
        return z.object(objectShape)
      
      case 'reference':
        return z.string() // Reference IDs are strings
      
      case 'media':
        return z.string() // Media file IDs are strings
      
      default:
        return z.unknown()
    }
  }

  private formatZodErrors(zodError: z.ZodError): ValidationErrorDetail[] {
    return zodError.errors.map(error => ({
      field: error.path.join('.') || '_root',
      message: error.message,
      code: error.code
    }))
  }
}