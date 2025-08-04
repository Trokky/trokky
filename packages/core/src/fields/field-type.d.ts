import type { User, Permission, UserRole } from '../types/user.js';
import type { ValidationResult } from '../types/index.js';
/**
 * Field categories for organizing field types in the Studio
 */
export declare enum FieldCategory {
    TEXT = "text",
    NUMBER = "number",
    DATE = "date",
    BOOLEAN = "boolean",
    MEDIA = "media",
    REFERENCE = "reference",
    STRUCTURE = "structure",
    SPECIALIZED = "specialized",
    EXTERNAL = "external",
    CUSTOM = "custom"
}
/**
 * Context provided to field types for validation, rendering, and conditional logic
 */
export interface FieldContext {
    document: Record<string, any>;
    parentPath?: string[];
    fieldPath: string[];
    user: User;
    permissions: Permission[];
    userRole: UserRole;
    httpClient: HttpClient;
    apiClient: ApiClient;
    getValue(path: string): any;
    setValue(path: string, value: any): void;
    getFieldConfig(path: string): FieldDefinition | undefined;
    errors: ValidationError[];
    touched: Record<string, boolean>;
    isStudio: boolean;
    isPreview: boolean;
    studioConfig?: Record<string, any>;
    emit(event: FieldEvent): void;
    on(event: string, handler: Function): void;
}
/**
 * HTTP client interface for external API access
 */
export interface HttpClient {
    get<T>(url: string, config?: RequestConfig): Promise<T>;
    post<T>(url: string, data?: any, config?: RequestConfig): Promise<T>;
    put<T>(url: string, data?: any, config?: RequestConfig): Promise<T>;
    delete<T>(url: string, config?: RequestConfig): Promise<T>;
}
/**
 * API client interface for Trokky operations
 */
export interface ApiClient {
    checkUnique(fieldPath: string, value: any): Promise<boolean>;
    search(collection: string, query: string): Promise<any[]>;
    upload(file: File): Promise<{
        id: string;
        url: string;
    }>;
}
/**
 * Request configuration for HTTP client
 */
export interface RequestConfig {
    headers?: Record<string, string>;
    timeout?: number;
    params?: Record<string, any>;
}
/**
 * Validation error structure
 */
export interface ValidationError {
    field: string;
    message: string;
    code?: string;
}
/**
 * Field event for the event system
 */
export interface FieldEvent {
    type: string;
    field: string;
    data?: any;
}
/**
 * Conditional expression for field logic
 */
export interface ConditionalExpression {
    field: string;
    operator?: 'equals' | 'notEquals' | 'in' | 'notIn' | 'exists' | 'empty' | 'gt' | 'lt' | 'gte' | 'lte';
    value?: any;
    values?: any[];
    and?: ConditionalExpression[];
    or?: ConditionalExpression[];
    not?: ConditionalExpression;
}
/**
 * Validation rule definition
 */
export interface ValidationRule {
    rule: string;
    value?: any;
    message?: string;
    async?: boolean;
    dependsOn?: string[];
    validate?: (value: any, context: FieldContext) => boolean | Promise<boolean>;
}
/**
 * Field definition interface used in schemas
 */
export interface FieldDefinition<TConfig = any> {
    name: string;
    type: string;
    title?: string;
    description?: string;
    required?: boolean | ((context: FieldContext) => boolean | Promise<boolean>);
    readOnly?: boolean | ((context: FieldContext) => boolean | Promise<boolean>);
    hidden?: boolean | ((context: FieldContext) => boolean | Promise<boolean>);
    disabled?: boolean | ((context: FieldContext) => boolean | Promise<boolean>);
    config?: TConfig;
    validation?: ValidationRule[];
    placeholder?: string;
    helpText?: string;
    group?: string;
    showIf?: ConditionalExpression;
    hideIf?: ConditionalExpression;
    requiredIf?: ConditionalExpression;
    defaultValue?: any | ((context: FieldContext) => any);
    dependsOn?: string[];
    affects?: string[];
}
/**
 * React component type for field components
 */
export interface ReactComponentType<P = {}> {
    (props: P): any;
}
/**
 * Props passed to field components in the Studio
 */
export interface FieldProps<TConfig = any, TValue = any> {
    field: FieldDefinition<TConfig>;
    value: TValue;
    onChange: (value: TValue) => void;
    context: FieldContext;
    readOnly?: boolean;
    disabled?: boolean;
    error?: string;
}
/**
 * Props for field preview components
 */
export interface PreviewProps<TValue = any> {
    value: TValue;
    config?: any;
    compact?: boolean;
}
/**
 * Core field type interface that all field types must implement
 */
export interface FieldType<TConfig = any, TValue = any> {
    name: string;
    category?: FieldCategory;
    validate(value: TValue, config: TConfig, context: FieldContext): ValidationResult | Promise<ValidationResult>;
    serialize(value: TValue, config: TConfig): any;
    deserialize(data: any, config: TConfig): TValue;
    defaultValue?: TValue | ((config: TConfig, context: FieldContext) => TValue | Promise<TValue>);
    component?: ReactComponentType<FieldProps<TConfig, TValue>>;
    preview?: ReactComponentType<PreviewProps<TValue>>;
    hidden?(config: TConfig, context: FieldContext): boolean | Promise<boolean>;
    readOnly?(config: TConfig, context: FieldContext): boolean | Promise<boolean>;
    disabled?(config: TConfig, context: FieldContext): boolean | Promise<boolean>;
    description?: string;
    icon?: string;
    examples?: Array<{
        title: string;
        config: TConfig;
        value: TValue;
    }>;
}
/**
 * Migration configuration for field types
 */
export interface FieldMigration {
    from: string;
    to: string;
    transform: (value: any, context: MigrationContext) => any;
}
/**
 * Context for field migrations
 */
export interface MigrationContext {
    document: Record<string, any>;
    fieldPath: string[];
    version: {
        from: string;
        to: string;
    };
}
/**
 * Field type registration options
 */
export interface FieldTypeRegistrationOptions {
    override?: boolean;
    migrations?: FieldMigration[];
}
/**
 * Field type metadata
 */
export interface FieldTypeMetadata {
    name: string;
    category: FieldCategory;
    description?: string;
    icon?: string;
    version: string;
    migrations: FieldMigration[];
}
//# sourceMappingURL=field-type.d.ts.map