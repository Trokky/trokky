import { FieldDefinition, FieldContext } from './field-type.js';
/**
 * Helper function to define a field with TypeScript support
 */
export declare function defineField<T = any>(definition: FieldDefinition<T>): FieldDefinition<T>;
/**
 * Helper function to define a document type with fields
 */
export declare function defineType(definition: {
    name: string;
    type: 'document' | 'singleton';
    title?: string;
    description?: string;
    fields: Record<string, FieldDefinition>;
    [key: string]: any;
}): {
    fields: {
        [k: string]: FieldDefinition<any>;
    };
    name: string;
    type: "document" | "singleton";
    title?: string;
    description?: string;
};
/**
 * Utility class for field configuration helpers
 */
export declare class FieldUtils {
    /**
     * Evaluate if a field should be hidden based on conditional logic
     */
    static isHidden(field: FieldDefinition, context: FieldContext): Promise<boolean>;
    /**
     * Evaluate if a field should be read-only
     */
    static isReadOnly(field: FieldDefinition, context: FieldContext): Promise<boolean>;
    /**
     * Evaluate if a field should be disabled
     */
    static isDisabled(field: FieldDefinition, context: FieldContext): Promise<boolean>;
    /**
     * Evaluate if a field is required
     */
    static isRequired(field: FieldDefinition, context: FieldContext): Promise<boolean>;
    /**
     * Get the default value for a field
     */
    static getDefaultValue(field: FieldDefinition, context: FieldContext): Promise<any>;
    /**
     * Check if a field has conditional logic
     */
    static hasConditionalLogic(field: FieldDefinition): boolean;
    /**
     * Get all field dependencies for conditional logic
     */
    static getFieldDependencies(field: FieldDefinition): string[];
    /**
     * Extract field dependencies from conditional expressions
     */
    private static extractConditionalDependencies;
    /**
     * Create a field context for testing/validation
     */
    static createMockContext(overrides?: Partial<FieldContext>): FieldContext;
}
/**
 * Validation rule builder (Sanity-style)
 */
export declare class Rule {
    private rules;
    required(message?: string): this;
    min(value: number, message?: string): this;
    max(value: number, message?: string): this;
    length(value: number, message?: string): this;
    email(message?: string): this;
    url(message?: string): this;
    pattern(regex: RegExp, message?: string): this;
    custom(validate: (value: any, context: FieldContext) => boolean | Promise<boolean>, message?: string): this;
    unique(message?: string): this;
    getRules(): any[];
}
/**
 * Create a validation rule builder instance
 */
export declare function rule(): Rule;
//# sourceMappingURL=helpers.d.ts.map