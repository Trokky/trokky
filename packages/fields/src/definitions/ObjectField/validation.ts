import type { ValidationResult } from '../../base/FieldDefinition.js';
import type { 
  ObjectFieldDefinition, 
  ObjectFieldItem, 
  ObjectFieldMetadata, 
  ConditionalResult,
  TemplateContext
} from './definition.js';
import { fieldRegistry } from '../../registry/FieldRegistry.js';

/**
 * Validate entire object field with nested field validation
 */
export function validateObjectField(
  value: any, 
  definition: ObjectFieldDefinition, 
  documentContext?: any
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Security: Ensure value is an object to prevent prototype pollution
  if (value !== null && value !== undefined) {
    if (typeof value !== 'object' || Array.isArray(value)) {
      errors.push('Value must be an object');
      return { isValid: false, errors, warnings };
    }

    // Security: Check for dangerous properties
    const dangerousProps = ['__proto__', 'constructor', 'prototype'];
    for (const prop of dangerousProps) {
      if (prop in value) {
        errors.push(`Property '${prop}' is not allowed for security reasons`);
      }
    }
  }

  const objectValue = value && typeof value === 'object' ? value : {};
  const validation = definition.validation || {};

  // Validate object-level constraints
  const propertyCount = Object.keys(objectValue).length;

  if (validation.minProperties !== undefined && propertyCount < validation.minProperties) {
    errors.push(`Object must have at least ${validation.minProperties} properties`);
  }

  if (validation.maxProperties !== undefined && propertyCount > validation.maxProperties) {
    errors.push(`Object must have no more than ${validation.maxProperties} properties`);
  }

  // Check for additional properties if not allowed
  if (validation.additionalProperties === false) {
    const definedFields = new Set(definition.fields.map(f => f.name));
    const actualProps = Object.keys(objectValue);
    const extraProps = actualProps.filter(prop => !definedFields.has(prop));
    
    if (extraProps.length > 0) {
      errors.push(`Additional properties not allowed: ${extraProps.join(', ')}`);
    }
  }

  // Validate each defined field
  const metadata = getObjectMetadata(objectValue, definition);
  
  for (const fieldDef of definition.fields) {
    // Check conditional visibility
    const conditionalResult = evaluateConditional(fieldDef, objectValue);
    if (!conditionalResult.visible) {
      continue; // Skip validation for hidden fields
    }

    const fieldValue = objectValue[fieldDef.name];
    const fieldValidation = validateObjectFieldItem(fieldValue, fieldDef, objectValue, documentContext);
    
    if (!fieldValidation.isValid) {
      errors.push(...fieldValidation.errors.map(err => `${fieldDef.title || fieldDef.name}: ${err}`));
    }
    if (fieldValidation.warnings) {
      warnings.push(...fieldValidation.warnings.map(warn => `${fieldDef.title || fieldDef.name}: ${warn}`));
    }
  }

  // Check required fields
  if (validation.requiredFields) {
    for (const requiredField of validation.requiredFields) {
      const fieldDef = definition.fields.find(f => f.name === requiredField);
      if (fieldDef) {
        const conditionalResult = evaluateConditional(fieldDef, objectValue);
        if (conditionalResult.visible && (objectValue[requiredField] === undefined || objectValue[requiredField] === null || objectValue[requiredField] === '')) {
          errors.push(`${fieldDef.title || requiredField} is required`);
        }
      }
    }
  }

  // Check field-level required validation
  for (const fieldDef of definition.fields) {
    if (fieldDef.required) {
      const conditionalResult = evaluateConditional(fieldDef, objectValue);
      if (conditionalResult.visible) {
        const fieldValue = objectValue[fieldDef.name];
        if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
          errors.push(`${fieldDef.title || fieldDef.name} is required`);
        }
      }
    }
  }

  // Run custom validation if provided
  if (validation.customValidation && typeof validation.customValidation === 'function') {
    try {
      const customResult = validation.customValidation(objectValue);
      if (typeof customResult === 'string') {
        errors.push(customResult);
      }
    } catch (error) {
      // Security: Don't expose internal errors
      errors.push('Custom validation failed');
      console.error('ObjectField custom validation error:', error);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate individual field within object
 */
export function validateObjectFieldItem(
  value: any,
  fieldDefinition: ObjectFieldItem,
  objectValues: Record<string, any>,
  documentContext?: any
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get field plugin for validation
  const fieldPlugin = fieldRegistry.get(fieldDefinition.type);
  if (!fieldPlugin) {
    warnings.push(`Field type '${fieldDefinition.type}' is not registered`);
    return { isValid: true, errors, warnings };
  }

  // Create field definition compatible with the plugin
  const pluginDefinition = {
    type: fieldDefinition.type,
    title: fieldDefinition.title,
    description: fieldDefinition.description,
    required: fieldDefinition.required,
    defaultValue: fieldDefinition.defaultValue
  } as any;

  try {
    // Use the field plugin's validation
    const fieldValidation = fieldPlugin.validate(value, pluginDefinition, documentContext);
    return fieldValidation;
  } catch (error) {
    // Security: Don't expose internal validation errors
    errors.push('Field validation failed');
    console.error(`ObjectField validation error for field '${fieldDefinition.name}':`, error);
    return { isValid: false, errors, warnings };
  }
}

/**
 * Evaluate conditional visibility for a field
 */
export function evaluateConditional(
  fieldDefinition: ObjectFieldItem,
  objectValues: Record<string, any>
): ConditionalResult {
  // Handle function-based hidden property
  if (typeof fieldDefinition.hidden === 'function') {
    try {
      const isHidden = fieldDefinition.hidden(objectValues);
      return {
        visible: !isHidden,
        reason: isHidden ? 'Hidden by function' : 'Visible by function',
        evaluatedFields: Object.keys(objectValues)
      };
    } catch (error) {
      console.error('Error evaluating hidden function:', error);
      return { visible: true, reason: 'Function error - defaulting to visible', evaluatedFields: [] };
    }
  }

  // Handle boolean hidden property
  if (typeof fieldDefinition.hidden === 'boolean') {
    return {
      visible: !fieldDefinition.hidden,
      reason: fieldDefinition.hidden ? 'Hidden by boolean' : 'Visible by boolean',
      evaluatedFields: []
    };
  }

  // Handle conditional visibility
  if (fieldDefinition.conditional) {
    const { field, value, operator = 'equals', conditions, logic = 'and' } = fieldDefinition.conditional;
    const evaluatedFields = [field];

    // Single condition
    if (!conditions) {
      const actualValue = objectValues[field];
      const result = evaluateCondition(actualValue, value, operator);
      return {
        visible: result,
        reason: result ? `Condition met: ${field} ${operator} ${value}` : `Condition not met: ${field} ${operator} ${value}`,
        evaluatedFields
      };
    }

    // Multiple conditions
    const results = conditions.map(condition => {
      evaluatedFields.push(condition.field);
      const actualValue = objectValues[condition.field];
      return evaluateCondition(actualValue, condition.value, condition.operator || 'equals');
    });

    const visible = logic === 'and' ? results.every(r => r) : results.some(r => r);
    return {
      visible,
      reason: `Multiple conditions (${logic}): ${visible ? 'met' : 'not met'}`,
      evaluatedFields
    };
  }

  // Default to visible
  return { visible: true, reason: 'No conditions - default visible', evaluatedFields: [] };
}

/**
 * Evaluate single condition
 */
function evaluateCondition(actualValue: any, expectedValue: any, operator: string): boolean {
  switch (operator) {
    case 'equals':
      return actualValue === expectedValue;
    
    case 'notEquals':
      return actualValue !== expectedValue;
    
    case 'contains':
      if (typeof actualValue === 'string') {
        return actualValue.includes(String(expectedValue));
      }
      if (Array.isArray(actualValue)) {
        return actualValue.includes(expectedValue);
      }
      return false;
    
    case 'notContains':
      if (typeof actualValue === 'string') {
        return !actualValue.includes(String(expectedValue));
      }
      if (Array.isArray(actualValue)) {
        return !actualValue.includes(expectedValue);
      }
      return true;
    
    case 'exists':
      return actualValue !== undefined && actualValue !== null && actualValue !== '';
    
    case 'notExists':
      return actualValue === undefined || actualValue === null || actualValue === '';
    
    case 'greaterThan':
      return typeof actualValue === 'number' && typeof expectedValue === 'number' && actualValue > expectedValue;
    
    case 'lessThan':
      return typeof actualValue === 'number' && typeof expectedValue === 'number' && actualValue < expectedValue;
    
    default:
      console.warn(`Unknown conditional operator: ${operator}`);
      return false;
  }
}

/**
 * Calculate object field metadata for progress tracking
 */
export function getObjectMetadata(
  objectValue: Record<string, any>,
  definition: ObjectFieldDefinition
): ObjectFieldMetadata {
  const allFields = definition.fields;
  const visibleFields = allFields.filter(field => evaluateConditional(field, objectValue).visible);
  const requiredFields = visibleFields.filter(field => field.required);
  
  const filledFields = visibleFields.filter(field => {
    const value = objectValue[field.name];
    return value !== undefined && value !== null && value !== '';
  });

  const completedRequiredFields = requiredFields.filter(field => {
    const value = objectValue[field.name];
    return value !== undefined && value !== null && value !== '';
  });

  const missingRequiredFields = requiredFields
    .filter(field => {
      const value = objectValue[field.name];
      return value === undefined || value === null || value === '';
    })
    .map(field => field.name);

  const completionPercentage = visibleFields.length > 0 
    ? Math.round((filledFields.length / visibleFields.length) * 100)
    : 100;

  const requiredCompletionPercentage = requiredFields.length > 0
    ? Math.round((completedRequiredFields.length / requiredFields.length) * 100)
    : 100;

  return {
    totalFields: allFields.length,
    visibleFields: visibleFields.length,
    filledFields: filledFields.length,
    requiredFields: requiredFields.length,
    completedRequiredFields: completedRequiredFields.length,
    completionPercentage,
    requiredCompletionPercentage,
    missingRequiredFields,
    fieldsWithErrors: [], // This would be populated by validation
    isRequiredComplete: missingRequiredFields.length === 0,
    isComplete: completionPercentage === 100
  };
}

/**
 * Get default value for object field
 */
export function getDefaultObjectValue(definition: ObjectFieldDefinition): Record<string, any> {
  const defaultValue: Record<string, any> = {};

  // Start with definition's default value
  if (definition.defaultValue) {
    Object.assign(defaultValue, definition.defaultValue);
  }

  // Add field-level defaults
  for (const fieldDef of definition.fields) {
    if (fieldDef.defaultValue !== undefined && !(fieldDef.name in defaultValue)) {
      defaultValue[fieldDef.name] = fieldDef.defaultValue;
    }
  }

  return defaultValue;
}

/**
 * Sanitize object value for security
 */
export function sanitizeObjectValue(value: any): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const sanitized: Record<string, any> = {};
  const dangerousProps = ['__proto__', 'constructor', 'prototype'];

  for (const [key, val] of Object.entries(value)) {
    // Security: Skip dangerous properties
    if (dangerousProps.includes(key)) {
      continue;
    }

    // Security: Limit key length and validate key format
    if (typeof key !== 'string' || key.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(key)) {
      continue;
    }

    // Security: Basic value sanitization
    if (typeof val === 'string') {
      // Remove potential XSS patterns
      sanitized[key] = val
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/data:/gi, '') // Remove data: protocol
        .slice(0, 10000); // Limit length
    } else if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
      sanitized[key] = val;
    } else if (typeof val === 'boolean') {
      sanitized[key] = val;
    } else if (Array.isArray(val)) {
      // Recursively sanitize arrays (limit depth)
      sanitized[key] = sanitizeArray(val, 0, 3);
    } else if (val && typeof val === 'object') {
      // Recursively sanitize nested objects (limit depth)
      sanitized[key] = sanitizeObjectValue(val);
    } else if (val === null) {
      sanitized[key] = null;
    }
    // Skip undefined and other types
  }

  return sanitized;
}

/**
 * Sanitize array values with depth limiting
 */
function sanitizeArray(arr: any[], currentDepth: number, maxDepth: number): any[] {
  if (currentDepth >= maxDepth) {
    return [];
  }

  return arr.slice(0, 100).map(item => { // Limit array size
    if (typeof item === 'string') {
      return item.replace(/<[^>]*>/g, '').slice(0, 1000);
    } else if (typeof item === 'number' && !isNaN(item) && isFinite(item)) {
      return item;
    } else if (typeof item === 'boolean') {
      return item;
    } else if (Array.isArray(item)) {
      return sanitizeArray(item, currentDepth + 1, maxDepth);
    } else if (item && typeof item === 'object') {
      return sanitizeObjectValue(item);
    }
    return null;
  }).filter(item => item !== null);
}

/**
 * Render template string with object values
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  if (!template) return '';

  try {
    // Security: Simple template rendering without eval
    return template.replace(/\{([^}]+)\}/g, (match, fieldName) => {
      const cleanFieldName = fieldName.trim();
      
      // Security: Validate field name format
      if (!/^[a-zA-Z0-9_.-]+$/.test(cleanFieldName)) {
        return match;
      }

      // Support nested property access (e.g., user.name)
      const value = getNestedValue(context.values, cleanFieldName);
      
      if (value === undefined || value === null) {
        return '';
      }

      // Security: Sanitize output
      return String(value).replace(/<[^>]*>/g, '').slice(0, 200);
    });
  } catch (error) {
    console.error('Template rendering error:', error);
    return template;
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  
  const parts = path.split('.');
  let current = obj;
  
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return undefined;
    }
    current = current[part];
  }
  
  return current;
}

/**
 * Check if field is read-only based on conditions
 */
export function isFieldReadOnly(
  fieldDefinition: ObjectFieldItem,
  objectValues: Record<string, any>,
  isObjectReadOnly: boolean = false
): boolean {
  // If parent object is read-only, all fields are read-only
  if (isObjectReadOnly) return true;

  // Check function-based read-only
  if (typeof fieldDefinition.readOnly === 'function') {
    try {
      return fieldDefinition.readOnly(objectValues);
    } catch (error) {
      console.error('Error evaluating readOnly function:', error);
      return false;
    }
  }

  // Check boolean read-only
  if (typeof fieldDefinition.readOnly === 'boolean') {
    return fieldDefinition.readOnly;
  }

  return false;
}