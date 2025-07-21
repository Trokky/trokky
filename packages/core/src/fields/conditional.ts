import { ConditionalExpression, FieldContext } from './field-type'

/**
 * Conditional logic evaluation error
 */
export class ConditionalEvaluationError extends Error {
  constructor(message: string, public expression?: ConditionalExpression) {
    super(message)
    this.name = 'ConditionalEvaluationError'
  }
}

/**
 * Evaluates conditional expressions for field logic
 */
export class ConditionalEvaluator {
  /**
   * Evaluate a conditional expression against a field context
   */
  static evaluate(
    expression: ConditionalExpression, 
    context: FieldContext
  ): boolean {
    try {
      return this.evaluateExpression(expression, context)
    } catch (error) {
      throw new ConditionalEvaluationError(
        `Failed to evaluate conditional expression: ${error instanceof Error ? error.message : String(error)}`,
        expression
      )
    }
  }
  
  /**
   * Internal expression evaluation
   */
  private static evaluateExpression(
    expression: ConditionalExpression,
    context: FieldContext
  ): boolean {
    // Handle logical operators first
    if (expression.and) {
      return expression.and.every(exp => this.evaluateExpression(exp, context))
    }
    
    if (expression.or) {
      return expression.or.some(exp => this.evaluateExpression(exp, context))
    }
    
    if (expression.not) {
      return !this.evaluateExpression(expression.not, context)
    }
    
    // Handle field-based conditions
    const fieldValue = context.getValue(expression.field)
    const operator = expression.operator || 'equals'
    
    switch (operator) {
      case 'equals':
        return this.equals(fieldValue, expression.value)
      
      case 'notEquals':
        return !this.equals(fieldValue, expression.value)
      
      case 'in':
        return this.isIn(fieldValue, expression.values)
      
      case 'notIn':
        return !this.isIn(fieldValue, expression.values)
      
      case 'exists':
        return this.exists(fieldValue)
      
      case 'empty':
        return this.isEmpty(fieldValue)
      
      case 'gt':
        return this.greaterThan(fieldValue, expression.value)
      
      case 'lt':
        return this.lessThan(fieldValue, expression.value)
      
      case 'gte':
        return this.greaterThanOrEqual(fieldValue, expression.value)
      
      case 'lte':
        return this.lessThanOrEqual(fieldValue, expression.value)
      
      default:
        throw new Error(`Unknown conditional operator: ${operator}`)
    }
  }
  
  /**
   * Check equality with type coercion
   */
  private static equals(fieldValue: any, expectedValue: any): boolean {
    // Handle null/undefined
    if (fieldValue == null && expectedValue == null) return true
    if (fieldValue == null || expectedValue == null) return false
    
    // Handle arrays
    if (Array.isArray(fieldValue) && Array.isArray(expectedValue)) {
      return fieldValue.length === expectedValue.length &&
        fieldValue.every((val, index) => this.equals(val, expectedValue[index]))
    }
    
    // Handle objects
    if (typeof fieldValue === 'object' && typeof expectedValue === 'object') {
      const fieldKeys = Object.keys(fieldValue)
      const expectedKeys = Object.keys(expectedValue)
      
      return fieldKeys.length === expectedKeys.length &&
        fieldKeys.every(key => this.equals(fieldValue[key], expectedValue[key]))
    }
    
    // Handle primitives
    return fieldValue === expectedValue
  }
  
  /**
   * Check if value is in array
   */
  private static isIn(fieldValue: any, values: any[] = []): boolean {
    return values.some(value => this.equals(fieldValue, value))
  }
  
  /**
   * Check if value exists (not null or undefined)
   */
  private static exists(fieldValue: any): boolean {
    return fieldValue != null
  }
  
  /**
   * Check if value is empty
   */
  private static isEmpty(fieldValue: any): boolean {
    if (fieldValue == null) return true
    if (typeof fieldValue === 'string') return fieldValue.trim() === ''
    if (Array.isArray(fieldValue)) return fieldValue.length === 0
    if (typeof fieldValue === 'object') return Object.keys(fieldValue).length === 0
    return false
  }
  
  /**
   * Numeric comparison: greater than
   */
  private static greaterThan(fieldValue: any, compareValue: any): boolean {
    const fieldNum = this.toNumber(fieldValue)
    const compareNum = this.toNumber(compareValue)
    return fieldNum != null && compareNum != null && fieldNum > compareNum
  }
  
  /**
   * Numeric comparison: less than
   */
  private static lessThan(fieldValue: any, compareValue: any): boolean {
    const fieldNum = this.toNumber(fieldValue)
    const compareNum = this.toNumber(compareValue)
    return fieldNum != null && compareNum != null && fieldNum < compareNum
  }
  
  /**
   * Numeric comparison: greater than or equal
   */
  private static greaterThanOrEqual(fieldValue: any, compareValue: any): boolean {
    const fieldNum = this.toNumber(fieldValue)
    const compareNum = this.toNumber(compareValue)
    return fieldNum != null && compareNum != null && fieldNum >= compareNum
  }
  
  /**
   * Numeric comparison: less than or equal
   */
  private static lessThanOrEqual(fieldValue: any, compareValue: any): boolean {
    const fieldNum = this.toNumber(fieldValue)
    const compareNum = this.toNumber(compareValue)
    return fieldNum != null && compareNum != null && fieldNum <= compareNum
  }
  
  /**
   * Convert value to number for numeric comparisons
   */
  private static toNumber(value: any): number | null {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const num = parseFloat(value)
      return isNaN(num) ? null : num
    }
    if (value instanceof Date) return value.getTime()
    return null
  }
}

/**
 * Utility functions for working with conditional expressions
 */
export class ConditionalUtils {
  /**
   * Create a simple equals condition
   */
  static equals(field: string, value: any): ConditionalExpression {
    return { field, operator: 'equals', value }
  }
  
  /**
   * Create a simple not equals condition
   */
  static notEquals(field: string, value: any): ConditionalExpression {
    return { field, operator: 'notEquals', value }
  }
  
  /**
   * Create an 'in' condition
   */
  static isIn(field: string, values: any[]): ConditionalExpression {
    return { field, operator: 'in', values }
  }
  
  /**
   * Create an 'exists' condition
   */
  static exists(field: string): ConditionalExpression {
    return { field, operator: 'exists' }
  }
  
  /**
   * Create an 'empty' condition
   */
  static empty(field: string): ConditionalExpression {
    return { field, operator: 'empty' }
  }
  
  /**
   * Create an AND condition
   */
  static and(...expressions: ConditionalExpression[]): ConditionalExpression {
    return { field: '', and: expressions }
  }
  
  /**
   * Create an OR condition
   */
  static or(...expressions: ConditionalExpression[]): ConditionalExpression {
    return { field: '', or: expressions }
  }
  
  /**
   * Create a NOT condition
   */
  static not(expression: ConditionalExpression): ConditionalExpression {
    return { field: '', not: expression }
  }

  /**
   * Create a greater than condition
   */
  static gt(field: string, value: any): ConditionalExpression {
    return { field, operator: 'gt', value }
  }

  /**
   * Create a less than condition
   */
  static lt(field: string, value: any): ConditionalExpression {
    return { field, operator: 'lt', value }
  }

  /**
   * Create a greater than or equal condition
   */
  static gte(field: string, value: any): ConditionalExpression {
    return { field, operator: 'gte', value }
  }

  /**
   * Create a less than or equal condition
   */
  static lte(field: string, value: any): ConditionalExpression {
    return { field, operator: 'lte', value }
  }
  
  /**
   * Validate a conditional expression structure
   */
  static validate(expression: ConditionalExpression): string[] {
    const errors: string[] = []
    
    // Check for logical operators
    if (expression.and || expression.or || expression.not) {
      if (expression.and) {
        if (!Array.isArray(expression.and) || expression.and.length === 0) {
          errors.push('AND condition must have at least one expression')
        } else {
          expression.and.forEach((exp, index) => {
            const subErrors = this.validate(exp)
            errors.push(...subErrors.map(err => `AND[${index}]: ${err}`))
          })
        }
      }
      
      if (expression.or) {
        if (!Array.isArray(expression.or) || expression.or.length === 0) {
          errors.push('OR condition must have at least one expression')
        } else {
          expression.or.forEach((exp, index) => {
            const subErrors = this.validate(exp)
            errors.push(...subErrors.map(err => `OR[${index}]: ${err}`))
          })
        }
      }
      
      if (expression.not) {
        const subErrors = this.validate(expression.not)
        errors.push(...subErrors.map(err => `NOT: ${err}`))
      }
    } else {
      // Field-based condition
      if (!expression.field || typeof expression.field !== 'string') {
        errors.push('Field name is required and must be a string')
      }
      
      const operator = expression.operator || 'equals'
      const requiresValue = ['equals', 'notEquals', 'gt', 'lt', 'gte', 'lte']
      const requiresValues = ['in', 'notIn']
      
      if (requiresValue.includes(operator) && expression.value === undefined) {
        errors.push(`Operator '${operator}' requires a value`)
      }
      
      if (requiresValues.includes(operator)) {
        if (!Array.isArray(expression.values) || expression.values.length === 0) {
          errors.push(`Operator '${operator}' requires a non-empty values array`)
        }
      }
    }
    
    return errors
  }
}