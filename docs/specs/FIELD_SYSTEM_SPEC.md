# Trokky v2 - Field System Specification

## 🎯 Overview

The Trokky v2 Field System provides a powerful, extensible architecture for defining content fields with enterprise-grade features including conditional logic, external API integration, and permission-aware controls.

## 🏗️ Core Architecture

### Field Type Interface

```typescript
export interface FieldType<TConfig = any, TValue = any> {
  // Basic field identification
  name: string
  category?: FieldCategory
  
  // Validation
  validate(
    value: TValue,
    config: TConfig,
    context: FieldContext
  ): ValidationResult | Promise<ValidationResult>
  
  // Data handling
  serialize(value: TValue, config: TConfig): any
  deserialize(data: any, config: TConfig): TValue
  defaultValue?: TValue | ((config: TConfig, context: FieldContext) => TValue)
  
  // Studio components (optional - for headless usage)
  component?: React.ComponentType<FieldProps<TConfig, TValue>>
  preview?: React.ComponentType<PreviewProps<TValue>>
  
  // Conditional behavior
  hidden?(config: TConfig, context: FieldContext): boolean | Promise<boolean>
  readOnly?(config: TConfig, context: FieldContext): boolean | Promise<boolean>
  disabled?(config: TConfig, context: FieldContext): boolean | Promise<boolean>
  
  // Field metadata
  description?: string
  icon?: string
  examples?: Array<{
    title: string
    config: TConfig
    value: TValue
  }>
}
```

### Field Context System

```typescript
export interface FieldContext {
  // Document state
  document: Record<string, any>
  parentPath?: string[]
  fieldPath: string[]
  
  // User & permissions
  user: User
  permissions: Permission[]
  userRole: UserRole
  
  // API access
  httpClient: HttpClient
  apiClient: ApiClient
  
  // Document manipulation
  getValue(path: string): any
  setValue(path: string, value: any): void
  getFieldConfig(path: string): FieldDefinition | undefined
  
  // Validation state
  errors: ValidationError[]
  touched: Record<string, boolean>
  
  // Runtime environment
  isStudio: boolean
  isPreview: boolean
  studioConfig?: StudioConfig
  
  // Event system
  emit(event: FieldEvent): void
  on(event: string, handler: Function): void
}
```

### Field Configuration

```typescript
export interface FieldDefinition<TConfig = any> {
  // Core properties
  name: string
  type: string
  title?: string
  description?: string
  
  // Behavior modifiers
  required?: boolean | ((context: FieldContext) => boolean)
  readOnly?: boolean | ((context: FieldContext) => boolean)
  hidden?: boolean | ((context: FieldContext) => boolean)
  disabled?: boolean | ((context: FieldContext) => boolean)
  
  // Field-specific configuration
  config?: TConfig
  
  // Validation rules
  validation?: ValidationRule[]
  
  // UI configuration
  placeholder?: string
  helpText?: string
  group?: string
  
  // Conditional logic
  showIf?: ConditionalExpression
  hideIf?: ConditionalExpression
  requiredIf?: ConditionalExpression
  
  // Default value
  defaultValue?: any | ((context: FieldContext) => any)
  
  // Field dependencies
  dependsOn?: string[]
  affects?: string[]
}
```

## 📝 Schema Definition API

### defineField Helper Function

```typescript
export function defineField<T = any>(definition: FieldDefinition<T>): FieldDefinition<T> {
  return {
    ...definition,
    // Normalize configuration
    required: normalizeConditional(definition.required),
    readOnly: normalizeConditional(definition.readOnly),
    hidden: normalizeConditional(definition.hidden),
    disabled: normalizeConditional(definition.disabled),
  }
}
```

### Usage Examples

```typescript
// Basic field
defineField({
  name: 'title',
  type: 'string',
  title: 'Title',
  required: true,
  validation: [
    { rule: 'minLength', value: 1, message: 'Title is required' },
    { rule: 'maxLength', value: 200, message: 'Title too long' }
  ]
})

// Conditional field
defineField({
  name: 'publishedDate',
  type: 'date',
  title: 'Published Date',
  showIf: { field: 'status', equals: 'published' },
  requiredIf: { field: 'status', equals: 'published' }
})

// Permission-based field
defineField({
  name: 'internalNotes',
  type: 'text',
  title: 'Internal Notes',
  readOnly: (context) => !context.permissions.includes('admin'),
  hidden: (context) => context.userRole === 'viewer'
})

// Dynamic default value
defineField({
  name: 'slug',
  type: 'slug',
  source: 'title',
  defaultValue: (context) => generateSlug(context.document.title)
})

// Field with external API
defineField({
  name: 'heroImage',
  type: 'unsplashImage',
  title: 'Hero Image',
  config: {
    orientation: 'landscape',
    minWidth: 1200
  }
})
```

## 🧩 Built-in Field Types

### Core Field Types

#### String Field
```typescript
interface StringFieldConfig {
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  format?: 'email' | 'url' | 'tel' | 'password'
  placeholder?: string
  multiline?: boolean
  rows?: number
}
```

#### Number Field
```typescript
interface NumberFieldConfig {
  min?: number
  max?: number
  step?: number
  format?: 'integer' | 'float' | 'currency' | 'percentage'
  currency?: string
  precision?: number
}
```

#### Boolean Field
```typescript
interface BooleanFieldConfig {
  layout?: 'checkbox' | 'switch' | 'radio'
  trueLabel?: string
  falseLabel?: string
}
```

#### Date Field
```typescript
interface DateFieldConfig {
  includeTime?: boolean
  format?: string
  min?: Date | string
  max?: Date | string
  timezone?: string
}
```

### Advanced Field Types

#### Array Field
```typescript
interface ArrayFieldConfig {
  of: FieldDefinition[]
  min?: number
  max?: number
  sortable?: boolean
  layout?: 'list' | 'grid' | 'tags'
  addLabel?: string
}
```

#### Object Field
```typescript
interface ObjectFieldConfig {
  fields: Record<string, FieldDefinition>
  layout?: 'sections' | 'tabs' | 'accordion'
  collapsible?: boolean
  collapsed?: boolean
}
```

#### Reference Field
```typescript
interface ReferenceFieldConfig {
  to: string[]
  weak?: boolean
  bidirectional?: boolean
  searchable?: string[]
  preview?: PreviewConfig
  filter?: FilterExpression
}
```

#### Portable Text Field
```typescript
interface PortableTextFieldConfig {
  marks?: MarkConfig[]
  blocks?: BlockConfig[]
  lists?: ListConfig[]
  annotations?: AnnotationConfig[]
  styles?: StyleConfig[]
}
```

### Media Field Types

#### Image Field
```typescript
interface ImageFieldConfig {
  accept?: string[]
  maxSize?: number
  dimensions?: {
    width?: number
    height?: number
    aspectRatio?: number
  }
  crop?: boolean
  hotspot?: boolean
  variants?: ImageVariantConfig[]
}
```

#### File Field
```typescript
interface FileFieldConfig {
  accept?: string[]
  maxSize?: number
  storeOriginalFilename?: boolean
  metadata?: boolean
}
```

### Specialized Field Types

#### Slug Field
```typescript
interface SlugFieldConfig {
  source: string | string[]
  prefix?: string
  suffix?: string
  separator?: string
  lowercase?: boolean
  validation?: SlugValidationConfig
}
```

#### Email Field
```typescript
interface EmailFieldConfig {
  domains?: string[]
  verification?: boolean
  placeholder?: string
}
```

#### URL Field
```typescript
interface URLFieldConfig {
  schemes?: string[]
  allowRelative?: boolean
  validation?: URLValidationConfig
}
```

## 🔧 Field Registration System

### Field Type Registry

```typescript
export class FieldTypeRegistry {
  private static types = new Map<string, FieldType>()
  private static categories = new Map<FieldCategory, FieldType[]>()
  
  static register<T extends FieldType>(fieldType: T): void {
    this.types.set(fieldType.name, fieldType)
    
    const category = fieldType.category || 'other'
    if (!this.categories.has(category)) {
      this.categories.set(category, [])
    }
    this.categories.get(category)!.push(fieldType)
  }
  
  static get(name: string): FieldType | undefined {
    return this.types.get(name)
  }
  
  static getAll(): FieldType[] {
    return Array.from(this.types.values())
  }
  
  static getByCategory(category: FieldCategory): FieldType[] {
    return this.categories.get(category) || []
  }
  
  static exists(name: string): boolean {
    return this.types.has(name)
  }
}
```

### Auto-Registration

```typescript
// packages/fields-core/src/index.ts
import { FieldTypeRegistry } from '@trokky/core'
import * as BuiltInFields from './types'

// Auto-register all built-in field types
Object.values(BuiltInFields).forEach(fieldType => {
  FieldTypeRegistry.register(fieldType)
})

export * from './types'
export { FieldTypeRegistry }
```

## 🎛️ Conditional Logic System

### Conditional Expressions

```typescript
interface ConditionalExpression {
  field: string
  operator?: 'equals' | 'notEquals' | 'in' | 'notIn' | 'exists' | 'empty' | 'gt' | 'lt' | 'gte' | 'lte'
  value?: any
  values?: any[]
  
  // Logical operators
  and?: ConditionalExpression[]
  or?: ConditionalExpression[]
  not?: ConditionalExpression
}
```

### Usage Examples

```typescript
// Simple condition
showIf: { field: 'status', equals: 'published' }

// Multiple conditions
showIf: {
  and: [
    { field: 'status', equals: 'published' },
    { field: 'publishedDate', exists: true }
  ]
}

// Complex conditions
showIf: {
  or: [
    { field: 'userRole', equals: 'admin' },
    {
      and: [
        { field: 'userRole', equals: 'editor' },
        { field: 'department', in: ['content', 'marketing'] }
      ]
    }
  ]
}
```

## 🔒 Permission System Integration

### Permission-Aware Fields

```typescript
// Read-only for non-admin users
defineField({
  name: 'seoMetadata',
  type: 'object',
  readOnly: (context) => !context.permissions.includes('seo_edit')
})

// Hidden for certain roles
defineField({
  name: 'internalId',
  type: 'string',
  hidden: (context) => context.userRole !== 'admin'
})

// Conditional requirement based on permissions
defineField({
  name: 'approvalRequired',
  type: 'boolean',
  requiredIf: (context) => 
    context.userRole === 'editor' && 
    context.permissions.includes('require_approval')
})
```

## 🌐 HTTP Client Integration

### External API Fields

```typescript
// Unsplash image search
export const UnsplashImageFieldType: FieldType = {
  name: 'unsplashImage',
  category: 'media',
  
  component: ({ field, value, onChange, context }) => {
    const searchImages = async (query: string) => {
      const response = await context.httpClient.get(
        `/api/integrations/unsplash/search?q=${encodeURIComponent(query)}`
      )
      return response.data.photos
    }
    
    return (
      <UnsplashImagePicker
        value={value}
        onChange={onChange}
        onSearch={searchImages}
        config={field.config}
      />
    )
  }
}

// External reference field
export const ExternalReferenceFieldType: FieldType = {
  name: 'externalReference',
  category: 'reference',
  
  component: ({ field, value, onChange, context }) => {
    const searchReferences = async (query: string) => {
      const { apiEndpoint } = field.config
      return await context.httpClient.get(`${apiEndpoint}?search=${query}`)
    }
    
    return (
      <ExternalReferencePicker
        value={value}
        onChange={onChange}
        onSearch={searchReferences}
        config={field.config}
      />
    )
  }
}
```

## 📊 Validation System

### Validation Rules

```typescript
interface ValidationRule {
  rule: string
  value?: any
  message?: string
  async?: boolean
  dependsOn?: string[]
}

// Built-in validation rules
const ValidationRules = {
  required: (value: any) => value != null && value !== '',
  minLength: (value: string, min: number) => value.length >= min,
  maxLength: (value: string, max: number) => value.length <= max,
  pattern: (value: string, pattern: RegExp) => pattern.test(value),
  email: (value: string) => emailRegex.test(value),
  url: (value: string) => urlRegex.test(value),
  unique: async (value: any, context: FieldContext) => {
    // Check uniqueness via API
    const exists = await context.apiClient.checkUnique(
      context.fieldPath.join('.'),
      value
    )
    return !exists
  }
}
```

### Custom Validation

```typescript
defineField({
  name: 'endDate',
  type: 'date',
  validation: [
    { rule: 'required' },
    {
      rule: 'custom',
      async: false,
      message: 'End date must be after start date',
      validate: (value, context) => {
        const startDate = context.getValue('startDate')
        return !startDate || !value || new Date(value) > new Date(startDate)
      }
    }
  ]
})
```

## 🎨 Field Categories

```typescript
enum FieldCategory {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  BOOLEAN = 'boolean',
  MEDIA = 'media',
  REFERENCE = 'reference',
  STRUCTURE = 'structure',
  SPECIALIZED = 'specialized',
  EXTERNAL = 'external',
  CUSTOM = 'custom'
}
```

## 📦 Package Structure

```
@trokky/core
├── fields/
│   ├── field-type.ts          # FieldType interface
│   ├── field-context.ts       # FieldContext interface
│   ├── registry.ts            # FieldTypeRegistry
│   ├── validation.ts          # Validation system
│   └── conditional.ts         # Conditional logic

@trokky/fields-core
├── text/
│   ├── string-field.ts
│   ├── text-field.ts
│   ├── email-field.ts
│   └── url-field.ts
├── number/
│   └── number-field.ts
├── boolean/
│   └── boolean-field.ts
├── date/
│   └── date-field.ts
├── media/
│   ├── image-field.ts
│   └── file-field.ts
├── structure/
│   ├── array-field.ts
│   ├── object-field.ts
│   └── reference-field.ts
├── specialized/
│   ├── slug-field.ts
│   └── portable-text-field.ts
└── index.ts

@trokky/field-*               # Individual field packages
├── @trokky/field-geolocation
├── @trokky/field-color-picker
├── @trokky/field-unsplash
└── @trokky/field-markdown
```

## 🚀 Usage in Studio

### Field Renderer

```typescript
export function FieldRenderer({ 
  field, 
  value, 
  onChange, 
  context 
}: FieldRendererProps) {
  const fieldType = FieldTypeRegistry.get(field.type)
  
  if (!fieldType) {
    return <UnknownFieldType type={field.type} />
  }
  
  // Evaluate conditional logic
  const isHidden = fieldType.hidden?.(field.config, context) || false
  const isReadOnly = fieldType.readOnly?.(field.config, context) || false
  const isDisabled = fieldType.disabled?.(field.config, context) || false
  
  if (isHidden) return null
  
  const FieldComponent = fieldType.component
  if (!FieldComponent) {
    return <div>Field type '{field.type}' has no Studio component</div>
  }
  
  return (
    <FieldWrapper field={field} readOnly={isReadOnly} disabled={isDisabled}>
      <FieldComponent
        field={field}
        value={value}
        onChange={onChange}
        context={context}
        readOnly={isReadOnly}
        disabled={isDisabled}
      />
    </FieldWrapper>
  )
}
```

## 🔄 Migration & Compatibility

### Field Version Management

```typescript
interface FieldMigration {
  from: string
  to: string
  transform: (value: any, context: MigrationContext) => any
}

// Example migration
const stringFieldMigrations: FieldMigration[] = [
  {
    from: '1.0',
    to: '1.1',
    transform: (value, context) => {
      // Migrate from old string format to new format
      return typeof value === 'string' ? { text: value } : value
    }
  }
]
```

## 🧪 Testing

### Field Type Testing

```typescript
describe('StringFieldType', () => {
  it('validates required fields', () => {
    const result = StringFieldType.validate('', { required: true }, mockContext)
    expect(result.valid).toBe(false)
    expect(result.message).toContain('required')
  })
  
  it('respects conditional logic', () => {
    const context = { ...mockContext, document: { status: 'draft' } }
    const isHidden = StringFieldType.hidden?.({ hideWhen: { status: 'draft' } }, context)
    expect(isHidden).toBe(true)
  })
})
```

---

This specification provides a comprehensive foundation for building a world-class field system that rivals and exceeds Sanity's capabilities while maintaining extensibility and developer experience.