import { ConditionalEvaluator } from './conditional.js';
/**
 * Helper function to define a field with TypeScript support
 */
export function defineField(definition) {
    return {
        ...definition,
        // Normalize conditional functions
        required: normalizeConditional(definition.required),
        readOnly: normalizeConditional(definition.readOnly),
        hidden: normalizeConditional(definition.hidden),
        disabled: normalizeConditional(definition.disabled),
    };
}
/**
 * Helper function to define a document type with fields
 */
export function defineType(definition) {
    return {
        ...definition,
        fields: Object.fromEntries(Object.entries(definition.fields).map(([name, field]) => [
            name,
            defineField({ ...field, name })
        ]))
    };
}
/**
 * Normalize conditional values to functions
 */
function normalizeConditional(value) {
    if (value === undefined)
        return undefined;
    if (typeof value === 'function')
        return value;
    return () => value;
}
/**
 * Utility class for field configuration helpers
 */
export class FieldUtils {
    /**
     * Evaluate if a field should be hidden based on conditional logic
     */
    static async isHidden(field, context) {
        // Check function-based hidden
        if (typeof field.hidden === 'function') {
            return await field.hidden(context);
        }
        // Check boolean hidden
        if (typeof field.hidden === 'boolean') {
            return field.hidden;
        }
        // Check conditional expressions
        if (field.hideIf) {
            return ConditionalEvaluator.evaluate(field.hideIf, context);
        }
        if (field.showIf) {
            return !ConditionalEvaluator.evaluate(field.showIf, context);
        }
        return false;
    }
    /**
     * Evaluate if a field should be read-only
     */
    static async isReadOnly(field, context) {
        if (typeof field.readOnly === 'function') {
            return await field.readOnly(context);
        }
        if (typeof field.readOnly === 'boolean') {
            return field.readOnly;
        }
        return false;
    }
    /**
     * Evaluate if a field should be disabled
     */
    static async isDisabled(field, context) {
        if (typeof field.disabled === 'function') {
            return await field.disabled(context);
        }
        if (typeof field.disabled === 'boolean') {
            return field.disabled;
        }
        return false;
    }
    /**
     * Evaluate if a field is required
     */
    static async isRequired(field, context) {
        // Check function-based required
        if (typeof field.required === 'function') {
            return await field.required(context);
        }
        // Check boolean required
        if (typeof field.required === 'boolean') {
            return field.required;
        }
        // Check conditional requirement
        if (field.requiredIf) {
            return ConditionalEvaluator.evaluate(field.requiredIf, context);
        }
        return false;
    }
    /**
     * Get the default value for a field
     */
    static async getDefaultValue(field, context) {
        if (typeof field.defaultValue === 'function') {
            return await field.defaultValue(context);
        }
        return field.defaultValue;
    }
    /**
     * Check if a field has conditional logic
     */
    static hasConditionalLogic(field) {
        return !!(field.showIf ||
            field.hideIf ||
            field.requiredIf ||
            typeof field.required === 'function' ||
            typeof field.readOnly === 'function' ||
            typeof field.hidden === 'function' ||
            typeof field.disabled === 'function');
    }
    /**
     * Get all field dependencies for conditional logic
     */
    static getFieldDependencies(field) {
        const dependencies = new Set();
        // Add explicit dependencies
        if (field.dependsOn) {
            field.dependsOn.forEach(dep => dependencies.add(dep));
        }
        // Extract dependencies from conditional expressions
        if (field.showIf) {
            this.extractConditionalDependencies(field.showIf, dependencies);
        }
        if (field.hideIf) {
            this.extractConditionalDependencies(field.hideIf, dependencies);
        }
        if (field.requiredIf) {
            this.extractConditionalDependencies(field.requiredIf, dependencies);
        }
        return Array.from(dependencies);
    }
    /**
     * Extract field dependencies from conditional expressions
     */
    static extractConditionalDependencies(expression, dependencies) {
        if (expression.field) {
            dependencies.add(expression.field);
        }
        if (expression.and) {
            expression.and.forEach(exp => this.extractConditionalDependencies(exp, dependencies));
        }
        if (expression.or) {
            expression.or.forEach(exp => this.extractConditionalDependencies(exp, dependencies));
        }
        if (expression.not) {
            this.extractConditionalDependencies(expression.not, dependencies);
        }
    }
    /**
     * Create a field context for testing/validation
     */
    static createMockContext(overrides = {}) {
        return {
            document: {},
            fieldPath: [],
            user: {
                id: 'test-user',
                username: 'testuser',
                email: 'test@example.com',
                passwordHash: 'test-hash',
                firstName: 'Test',
                lastName: 'User',
                role: 'admin',
                permissions: ['content:read', 'content:write', 'users:read'],
                isActive: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            permissions: ['content:read', 'content:write', 'users:read'],
            userRole: 'admin',
            httpClient: {
                get: async () => ({}),
                post: async () => ({}),
                put: async () => ({}),
                delete: async () => ({})
            },
            apiClient: {
                checkUnique: async () => false,
                search: async () => [],
                upload: async () => ({ id: 'test', url: 'test.jpg' })
            },
            getValue: (path) => undefined,
            setValue: (path, value) => { },
            getFieldConfig: (path) => undefined,
            errors: [],
            touched: {},
            isStudio: true,
            isPreview: false,
            emit: () => { },
            on: () => { },
            ...overrides
        };
    }
}
/**
 * Validation rule builder (Sanity-style)
 */
export class Rule {
    constructor() {
        this.rules = [];
    }
    required(message) {
        this.rules.push({ rule: 'required', message });
        return this;
    }
    min(value, message) {
        this.rules.push({ rule: 'min', value, message });
        return this;
    }
    max(value, message) {
        this.rules.push({ rule: 'max', value, message });
        return this;
    }
    length(value, message) {
        this.rules.push({ rule: 'length', value, message });
        return this;
    }
    email(message) {
        this.rules.push({ rule: 'email', message });
        return this;
    }
    url(message) {
        this.rules.push({ rule: 'url', message });
        return this;
    }
    pattern(regex, message) {
        this.rules.push({ rule: 'pattern', value: regex, message });
        return this;
    }
    custom(validate, message) {
        this.rules.push({ rule: 'custom', validate, message });
        return this;
    }
    unique(message) {
        this.rules.push({ rule: 'unique', async: true, message });
        return this;
    }
    getRules() {
        return this.rules;
    }
}
/**
 * Create a validation rule builder instance
 */
export function rule() {
    return new Rule();
}
//# sourceMappingURL=helpers.js.map