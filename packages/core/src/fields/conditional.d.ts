import { ConditionalExpression, FieldContext } from './field-type.js';
/**
 * Conditional logic evaluation error
 */
export declare class ConditionalEvaluationError extends Error {
    expression?: ConditionalExpression | undefined;
    constructor(message: string, expression?: ConditionalExpression | undefined);
}
/**
 * Evaluates conditional expressions for field logic
 */
export declare class ConditionalEvaluator {
    /**
     * Evaluate a conditional expression against a field context
     */
    static evaluate(expression: ConditionalExpression, context: FieldContext): boolean;
    /**
     * Internal expression evaluation
     */
    private static evaluateExpression;
    /**
     * Check equality with type coercion
     */
    private static equals;
    /**
     * Check if value is in array
     */
    private static isIn;
    /**
     * Check if value exists (not null or undefined)
     */
    private static exists;
    /**
     * Check if value is empty
     */
    private static isEmpty;
    /**
     * Numeric comparison: greater than
     */
    private static greaterThan;
    /**
     * Numeric comparison: less than
     */
    private static lessThan;
    /**
     * Numeric comparison: greater than or equal
     */
    private static greaterThanOrEqual;
    /**
     * Numeric comparison: less than or equal
     */
    private static lessThanOrEqual;
    /**
     * Convert value to number for numeric comparisons
     */
    private static toNumber;
}
/**
 * Utility functions for working with conditional expressions
 */
export declare class ConditionalUtils {
    /**
     * Create a simple equals condition
     */
    static equals(field: string, value: any): ConditionalExpression;
    /**
     * Create a simple not equals condition
     */
    static notEquals(field: string, value: any): ConditionalExpression;
    /**
     * Create an 'in' condition
     */
    static isIn(field: string, values: any[]): ConditionalExpression;
    /**
     * Create an 'exists' condition
     */
    static exists(field: string): ConditionalExpression;
    /**
     * Create an 'empty' condition
     */
    static empty(field: string): ConditionalExpression;
    /**
     * Create an AND condition
     */
    static and(...expressions: ConditionalExpression[]): ConditionalExpression;
    /**
     * Create an OR condition
     */
    static or(...expressions: ConditionalExpression[]): ConditionalExpression;
    /**
     * Create a NOT condition
     */
    static not(expression: ConditionalExpression): ConditionalExpression;
    /**
     * Create a greater than condition
     */
    static gt(field: string, value: any): ConditionalExpression;
    /**
     * Create a less than condition
     */
    static lt(field: string, value: any): ConditionalExpression;
    /**
     * Create a greater than or equal condition
     */
    static gte(field: string, value: any): ConditionalExpression;
    /**
     * Create a less than or equal condition
     */
    static lte(field: string, value: any): ConditionalExpression;
    /**
     * Validate a conditional expression structure
     */
    static validate(expression: ConditionalExpression): string[];
}
//# sourceMappingURL=conditional.d.ts.map