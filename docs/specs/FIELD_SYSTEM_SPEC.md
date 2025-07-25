# Trokky v2 - Field System Specification

## 🎯 Overview

The Trokky v2 Field System provides a powerful, extensible plugin-based architecture for defining content fields. Built on proven patterns from Trokky v1 and inspired by Sanity CMS, it offers enterprise-grade features including conditional logic, validation, and seamless Studio integration.

## 🏗️ Core Architecture

### Field Plugin Interface

Based on our current implementation in `@trokky/fields`, the core field plugin interface provides a clean, extensible foundation:

```typescript
export interface FieldPlugin<TDefinition extends BaseFieldDefinition = BaseFieldDefinition, TValue = any> {
  // Plugin identification
  type: string
  displayName: string
  description: string
  category: FieldCategory
  
  // React rendering
  component: ComponentType<FieldComponentProps<TDefinition, TValue>>
  previewComponent?: ComponentType<FieldComponentProps<TDefinition, TValue>>
  
  // Data validation
  validate: (value: TValue, definition: TDefinition, context?: DocumentContext) => ValidationResult
  
  // Default value generation
  getDefaultValue: (definition: TDefinition) => TValue
  
  // Schema conversion (for storage/API)
  toSchemaField: (definition: TDefinition) => any
  fromSchemaField: (schemaField: any) => TDefinition
  
  // Plugin metadata
  settings?: {
    icon?: string
    color?: string
    tags?: string[]
  }
}
```

### Base Field Definition

All field types extend from a common base definition:

```typescript
export interface BaseFieldDefinition {
  type: string
  title?: string
  description?: string
  required?: boolean
  hidden?: boolean
  readOnly?: boolean
  validation?: BaseValidation
}

export interface BaseValidation {
  required?: boolean
  custom?: (value: any, definition: any, context?: DocumentContext) => ValidationResult
}

export interface ValidationResult {
  isValid: boolean
  errors?: string[]
  warnings?: string[]
}
```

### Document Context (Current Simple Implementation)

The document context provides field access to document state and validation information:

```typescript
export interface DocumentContext {
  document: Record<string, any>
  fieldPath: string[]
  errors: ValidationError[]
  user?: User
  permissions?: Permission[]
  isStudio?: boolean
  isPreview?: boolean
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

Based on our research of legacy Trokky v1 and Sanity CMS, here are the field types we plan to implement:

### Phase 1: Core Field Types (Essential)

#### 1. Text Fields (`'text'` category)
- **StringField** ✅ (Currently implemented)
- **TextareaField** - Multi-line text input
- **RichTextField** - Rich text editor with formatting
- **EmailField** - Email validation (extends StringField)
- **UrlField** - URL validation (extends StringField)
- **SlugField** - URL-safe slugs with auto-generation

#### 2. Number Fields (`'number'` category)
- **NumberField** - Numeric input with validation
- **IntegerField** - Integer-only numbers

#### 3. Boolean Fields (`'boolean'` category)
- **BooleanField** - Checkbox/toggle input

#### 4. Date Fields (`'date'` category)
- **DateField** - Date picker with optional time

### Phase 2: Advanced Field Types (Important)

#### 5. Media Fields (`'media'` category)
- **ImageField** - Image upload with thumbnails, cropping
- **FileField** - Generic file upload
- **VideoField** - Video upload with metadata
- **AudioField** - Audio upload with metadata

#### 6. Reference Fields (`'reference'` category)
- **ReferenceField** - References to other documents

#### 7. Structure Fields (`'structure'` category)
- **ArrayField** - Arrays of items with drag/drop
- **ObjectField** - Nested objects with field grouping

### Current Implementation Status

Currently implemented (in `@trokky/fields`):
```typescript
// StringField with variants
const stringField: StringFieldDefinition = {
  type: 'string',
  title: 'Text Field',
  options: {
    inputType: 'text' | 'email' | 'url' | 'password',
    multiline?: boolean,
    placeholder?: string
  },
  validation: {
    required?: boolean,
    minLength?: number,
    maxLength?: number,
    pattern?: RegExp,
    email?: boolean,
    url?: boolean
  }
}
```

### Field Categories

```typescript
export enum FieldCategory {
  TEXT = 'text',
  NUMBER = 'number', 
  BOOLEAN = 'boolean',
  DATE = 'date',
  MEDIA = 'media',
  REFERENCE = 'reference',
  STRUCTURE = 'structure'
}
```

## 🔧 Field Registration System (Current Implementation)

Based on our current `@trokky/fields` implementation:

### Field Registry

```typescript
export class FieldRegistry {
  private plugins = new Map<string, FieldPlugin>()
  private sources = new Map<string, 'builtin' | 'external' | 'custom'>()
  private categories = new Map<FieldCategory, string[]>()
  private isInitialized = false

  // Register a field plugin
  register(plugin: FieldPlugin, source: 'builtin' | 'external' | 'custom' = 'external'): void {
    // Validation and registration logic
    this.plugins.set(plugin.type, plugin)
    this.sources.set(plugin.type, source)
    this.addToCategory(plugin.type, plugin.category)
  }

  // Get field plugin by type
  get(type: string): FieldPlugin | undefined {
    return this.plugins.get(type)
  }

  // Get all registered fields
  getAll(): FieldPlugin[] {
    return Array.from(this.plugins.values())
  }

  // Get fields by category
  getByCategory(category: FieldCategory): FieldPlugin[] {
    const types = this.categories.get(category) || []
    return types.map(type => this.plugins.get(type)!).filter(Boolean)
  }

  // Registry statistics
  getStats() {
    return {
      total: this.plugins.size,
      bySource: this.getSourceStats(),
      byCategory: this.getCategoryStats(),
      initialized: this.isInitialized
    }
  }
}

// Global registry instance
export const fieldRegistry = new FieldRegistry()
```

### Auto-Registration (Current)

Built-in fields are automatically registered:

```typescript
// packages/fields/src/builtin.ts
import { fieldRegistry } from './registry'
import { stringFieldPlugin } from './definitions/StringField'

export function registerBuiltinFields() {
  fieldRegistry.register(stringFieldPlugin, 'builtin')
  // More fields will be added here
}

// Auto-register when package is imported
registerBuiltinFields()
```

## 🚀 Future Extensions (Phase 2+)

The following features are planned for future phases but **not implemented yet**. They're documented here to ensure we design the current system to support them later:

### 1. Advanced Conditional Logic
Fields that show/hide or become required based on other field values:

```typescript
// Future extension to BaseFieldDefinition
interface BaseFieldDefinition {
  // ... current fields
  showIf?: ConditionalExpression
  hideIf?: ConditionalExpression
  requiredIf?: ConditionalExpression
}

interface ConditionalExpression {
  field: string
  operator?: 'equals' | 'notEquals' | 'in' | 'notIn' | 'exists' | 'empty'
  value?: any
  and?: ConditionalExpression[]
  or?: ConditionalExpression[]
}
```

### 2. Event System & Field Communication
Allow fields to react to changes in other fields:

```typescript
// Future extension to DocumentContext
interface DocumentContext {
  // ... current fields
  emit(event: FieldEvent): void
  on(event: string, handler: Function): void
  getValue(fieldPath: string): any
  setValue(fieldPath: string, value: any): void
}
```

### 3. HTTP Client Integration
Enable fields to make external API calls:

```typescript
// Future extension to DocumentContext
interface DocumentContext {
  // ... current fields
  httpClient: HttpClient
  apiClient: ApiClient
}

// Example: Unsplash image picker, address autocomplete
```

### 4. Advanced Permission System
Role-based field access control:

```typescript
// Future extension to DocumentContext
interface DocumentContext {
  // ... current fields
  user: User
  permissions: Permission[]
  userRole: UserRole
}

// Future extension to BaseFieldDefinition
interface BaseFieldDefinition {
  // ... current fields
  readOnly?: boolean | ((context: DocumentContext) => boolean)
  hidden?: boolean | ((context: DocumentContext) => boolean)
}
```

### 5. Field Dependencies & Validation
Fields that depend on or affect other fields:

```typescript
// Future extension to BaseFieldDefinition
interface BaseFieldDefinition {
  // ... current fields
  dependsOn?: string[]
  affects?: string[]
  validation?: {
    // ... current validation
    crossField?: (value: any, document: any) => ValidationResult
    async?: boolean
  }
}
```

### 6. Advanced Field Types
More specialized field types for later phases:
- **GeoLocationField** - GPS coordinates with map picker
- **ColorField** - Color picker with palette support
- **MarkdownField** - Markdown editor with preview
- **CodeField** - Syntax-highlighted code editor
- **JsonField** - JSON editor with schema validation

## 🎛️ Current Simple Implementation

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

## 🚀 Current Usage in Studio

### FieldRenderer Component

Our current implementation provides a universal field renderer:

```typescript
export function FieldRenderer({
  fieldId,
  value,
  onChange,
  definition,
  mode = 'edit',
  compact = false,
  maxLength
}: FieldRendererProps) {
  const plugin = fieldRegistry.get(definition.type)
  
  if (!plugin) {
    return <div>Unknown field type: {definition.type}</div>
  }
  
  const Component = mode === 'preview' && plugin.previewComponent 
    ? plugin.previewComponent 
    : plugin.component
  
  return (
    <FieldWrapper definition={definition} mode={mode}>
      <Component
        fieldId={fieldId}
        value={value}
        onChange={onChange}
        definition={definition}
        mode={mode}
        compact={compact}
        maxLength={maxLength}
      />
    </FieldWrapper>
  )
}
```

### Current Usage Examples (from FieldsDemo)

```typescript
// Edit Mode
<FieldRenderer
  fieldId="email-field"
  value={emailValue}
  onChange={setEmailValue}
  definition={{
    type: 'string',
    title: 'Email Field',
    options: { inputType: 'email' },
    validation: { email: true }
  }}
  mode="edit"
/>

// Preview Mode
<FieldRenderer
  fieldId="email-preview"
  value={emailValue}
  onChange={() => {}}
  definition={emailDefinition}
  mode="preview"
  compact={true}
  maxLength={50}
/>
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