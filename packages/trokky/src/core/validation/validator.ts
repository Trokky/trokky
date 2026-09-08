import { z } from 'zod'
import { SchemaRegistry } from '../schema/registry.js'
import { FieldDefinition, ValidationResult, ValidationErrorDetail } from '../types/index.js'

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

  private buildZodSchema(fields: Record<string, FieldDefinition>): z.ZodSchema {
    const schemaShape: Record<string, z.ZodSchema> = {}

    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      let fieldSchema = this.buildFieldSchema(fieldDef)
      
      if (!fieldDef.required) {
        // The Studio sends null for every field it has no value for
        fieldSchema = fieldSchema.nullish()
      }

      schemaShape[fieldName] = fieldSchema
    }

    return z.object(schemaShape).passthrough()
  }

  private buildFieldSchema(fieldDef: FieldDefinition): z.ZodSchema {
    const isOptional = !fieldDef.required

    switch (fieldDef.type) {
      case 'string':
        // Optional strings may be sent as null by the Studio when cleared
        return isOptional ? z.string().nullable() : z.string()

      case 'number':
        return z.number().nullable()

      case 'boolean':
        return z.boolean()
      
      case 'date':
        return z.date()
          .or(z.string().refine(str => {
            // Handle special "now" value
            if (str === 'now') {
              return true
            }
            const date = new Date(str)
            return !isNaN(date.getTime())
          }, { message: 'Invalid date string' }).transform(str => {
            // Transform "now" to current date
            if (str === 'now') {
              return new Date()
            }
            return new Date(str)
          }))
          .or(z.null()) // Allow null values for optional date fields
      
      case 'array':
        // Use modern 'of' format for array item definition
        if (!fieldDef.of) {
          return z.array(z.unknown())
        }
        const itemSchema = this.buildFieldSchema(fieldDef.of)
        return z.array(itemSchema)
      
      case 'object':
        if (!fieldDef.fields) {
          return isOptional ? z.record(z.unknown()).nullable() : z.record(z.unknown())
        }

        const objectShape: Record<string, z.ZodSchema> = {}
        
        // Handle modern format: fields is a Record<string, FieldDefinition>
        for (const [propName, propDef] of Object.entries(fieldDef.fields)) {
          const typedPropDef = propDef as FieldDefinition
          let propSchema = this.buildFieldSchema(typedPropDef)
          if (!typedPropDef.required) {
            // The Studio sends null for every field it has no value for
            propSchema = propSchema.nullish()
          }
          objectShape[propName] = propSchema
        }
        
        return isOptional ? z.object(objectShape).nullable() : z.object(objectShape)

      case 'reference':
        return z.union([
          z.string(), // Still allow string IDs for backward compatibility
          z.object({
            _ref: z.string(),
            _type: z.string().optional()
          }).passthrough(), // Allow additional metadata
          z.null() // Allow null when a reference is cleared
        ])
      
      case 'media':
        // Media fields can be either a string ID, a complex object with asset reference, or null (when removed)
        return z.union([
          z.string(),
          z.object({
            _type: z.literal('media'),
            asset: z.object({
              _ref: z.string(),
              _type: z.literal('mediaAsset')
            }),
            alt: z.string().optional(),
            caption: z.string().optional(),
            title: z.string().optional(),
            variant: z.string().optional()
          }).passthrough(),
          z.null()
        ])
      
      case 'slug':
        // TODO(#8): Refactor to use field plugin validation instead of duplicating logic
        // See: https://github.com/Trokky/trokky/issues/8
        //
        // Removed overly restrictive regex validation - let field plugin handle format validation
        // This allows slugs to be flexible and respect schema-level options like:
        // - allowSlashes (for hierarchical paths like "blog/posts/my-article")
        // - preserveCase (for case-sensitive slugs)
        // - allowedChars (for additional characters like underscores, dots, etc.)
        //
        // Basic validation: just ensure it's a string within length limits
        // Optional slugs may be empty (the slug processor can regenerate them later)
        {
          const maxLength = (fieldDef as any).maxLength || 200
          const slugSchema = z.string().max(maxLength, 'Slug is too long')
          return isOptional ? slugSchema : slugSchema.min(1, 'Slug cannot be empty')
        }
      
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