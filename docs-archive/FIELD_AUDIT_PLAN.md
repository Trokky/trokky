# Trokky Field System Audit & Polish Plan

## Current Field Status Assessment

### Field Types Inventory
Let's audit what we have vs what we need for professional CMS usage:

```typescript
// Current fields (need verification)
- StringField ✅ Basic implementation
- TextareaField ✅ Basic implementation  
- NumberField ✅ Basic implementation
- BooleanField ✅ Basic implementation
- DateField ❓ Need to verify
- MediaField ❓ Just implemented, needs polish
- ReferenceField ❓ Need to verify
- ArrayField ❓ Need to verify
- ObjectField ❓ Need to verify
- RichTextField ❓ Need to verify (critical!)
- SlugField ❓ Auto-generation working?
- ColorField ❓ Do we have this?
- GeoField ❓ Do we have this?
- TagsField ❓ Do we have this?
```

## Phase 1: Field System Audit (This Week)

### Day 1: Core Field Assessment
**Goal: Identify what's working vs what needs fixing**

#### 1.1 Field Inventory Check
```bash
# Let's audit the current field implementations
find packages -name "*field*" -type f | head -20
grep -r "export.*Field" packages/*/src --include="*.ts" --include="*.tsx"
```

#### 1.2 Studio Rendering Check  
**Test each field type in Studio:**
- [ ] Does it render correctly?
- [ ] Does validation work?
- [ ] Does it save/load data properly?
- [ ] Is the UX intuitive?
- [ ] Are there any console errors?

#### 1.3 API Integration Check
**Test each field via client API:**
- [ ] Does TypeScript generation work?
- [ ] Do queries return correct data types?
- [ ] Does filtering/sorting work?

### Day 2: Critical Field Polish

#### 1.4 Priority Field Issues (Based on Enterprise Needs)

**String Field - CRITICAL**
```typescript
// Issues to check:
- Validation (required, min/max length, regex)
- Placeholder text
- Help text/descriptions
- Character counter
- Input types (email, url, tel)
```

**Rich Text Field - CRITICAL** 
```typescript
// This is make-or-break for content teams
- Editor quality (toolbar, formatting)
- Image embedding
- Link insertion
- HTML output quality
- Performance with large content
```

**Media Field - CRITICAL**
```typescript
// We just worked on this, but needs polish:
- Upload UX (drag & drop)
- Preview thumbnails
- Alt text editing
- Crop/resize tools
- Multiple file selection
- Progress indicators
```

**Reference Field - CRITICAL**
```typescript
// Essential for relational content:
- Search/filter referenced documents
- Preview referenced content
- Circular reference prevention
- Performance with large datasets
```

## Phase 2: Field-by-Field Polish Plan

### 2.1 String Field Enhancement
```typescript
// packages/fields/src/string/StringField.tsx
export interface StringFieldConfig {
  // Current
  required?: boolean
  minLength?: number
  maxLength?: number
  placeholder?: string
  
  // Add these professional features:
  inputType?: 'text' | 'email' | 'url' | 'tel' | 'password'
  pattern?: string // Regex validation
  description?: string // Help text
  showCharacterCount?: boolean
  autocomplete?: string
  suggestions?: string[] // Autocomplete suggestions
}

// Enhanced component:
export function StringField({ config, value, onChange }: FieldProps) {
  const [error, setError] = useState<string>()
  const characterCount = value?.length || 0
  
  return (
    <div className="field-container">
      <label className="field-label">
        {config.title}
        {config.required && <span className="required">*</span>}
      </label>
      
      {config.description && (
        <p className="field-description">{config.description}</p>
      )}
      
      <input
        type={config.inputType || 'text'}
        value={value || ''}
        onChange={handleChange}
        placeholder={config.placeholder}
        className={`field-input ${error ? 'error' : ''}`}
        pattern={config.pattern}
        minLength={config.minLength}
        maxLength={config.maxLength}
        autoComplete={config.autocomplete}
      />
      
      {config.showCharacterCount && config.maxLength && (
        <div className="character-count">
          {characterCount}/{config.maxLength}
        </div>
      )}
      
      {error && <div className="field-error">{error}</div>}
    </div>
  )
}
```

### 2.2 Rich Text Field (Most Critical)
```typescript
// This is where most CMS fail - the editor experience
export interface RichTextFieldConfig {
  toolbar?: ('bold' | 'italic' | 'link' | 'image' | 'list')[]
  allowHtml?: boolean
  maxLength?: number
  placeholder?: string
  
  // Advanced features:
  allowedElements?: string[] // Whitelist HTML tags
  plugins?: ('code' | 'table' | 'video' | 'embed')[]
  linkTargets?: ('_self' | '_blank')[]
  imageUpload?: boolean
  spellCheck?: boolean
}

// Implementation options:
// 1. TipTap (modern, extensible) - RECOMMENDED
// 2. Slate.js (complex but powerful)  
// 3. Quill (traditional, reliable)
// 4. Monaco (for code editing)

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'

export function RichTextField({ config, value, onChange }: FieldProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  return (
    <div className="rich-text-field">
      <div className="toolbar">
        <button onClick={() => editor.chain().focus().toggleBold().run()}>
          Bold
        </button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()}>
          Italic
        </button>
        {/* More toolbar buttons */}
      </div>
      
      <EditorContent editor={editor} className="editor-content" />
    </div>
  )
}
```

### 2.3 Media Field Polish
```typescript
// Building on our recent work
export interface MediaFieldConfig {
  accept?: string // File types: 'image/*', 'video/*', etc
  multiple?: boolean
  maxSize?: number // bytes
  maxFiles?: number
  allowedFormats?: string[] // ['jpg', 'png', 'webp']
  
  // UI enhancements:
  showPreview?: boolean
  allowCropping?: boolean
  allowAltText?: boolean
  showMetadata?: boolean
  uploadArea?: 'drag-drop' | 'button' | 'both'
}

export function MediaField({ config, value, onChange }: FieldProps) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  
  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = Array.from(e.dataTransfer?.files || [])
    await uploadFiles(files)
  }
  
  return (
    <div className="media-field">
      {/* Drag & drop area */}
      <div 
        className={`upload-area ${dragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {value ? (
          <MediaPreview media={value} onRemove={() => onChange(null)} />
        ) : (
          <div className="upload-prompt">
            <CloudUploadIcon />
            <p>Drag files here or click to upload</p>
            <p className="upload-hint">
              Max {formatBytes(config.maxSize)} • 
              {config.allowedFormats?.join(', ')}
            </p>
          </div>
        )}
      </div>
      
      {uploading && <ProgressBar progress={uploadProgress} />}
    </div>
  )
}
```

### 2.4 Reference Field Polish
```typescript
// Critical for relational content
export interface ReferenceFieldConfig {
  to: string | string[] // Collection(s) to reference
  multiple?: boolean
  searchFields?: string[] // Fields to search in
  displayField?: string // Field to show in selection
  filters?: Record<string, any> // Pre-filter options
  
  // UX improvements:
  allowCreate?: boolean // Create new referenced doc inline
  showPreview?: boolean // Show preview of referenced doc
  sortBy?: string
  limit?: number // Max options to show
}

export function ReferenceField({ config, value, onChange }: FieldProps) {
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<Document[]>([])
  const [loading, setLoading] = useState(false)
  
  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (search.length >= 2) {
        setLoading(true)
        const results = await trokky.searchDocuments(config.to, search, {
          fields: config.searchFields,
          limit: config.limit || 20
        })
        setOptions(results.data)
        setLoading(false)
      }
    }, 300)
    
    return () => clearTimeout(timeoutId)
  }, [search])
  
  return (
    <div className="reference-field">
      <Combobox value={value} onChange={onChange}>
        <div className="combobox-input">
          <Combobox.Input
            placeholder="Search documents..."
            onChange={(e) => setSearch(e.target.value)}
          />
          <Combobox.Button>
            <ChevronDownIcon />
          </Combobox.Button>
        </div>
        
        <Combobox.Options className="options-list">
          {loading && <div className="loading">Searching...</div>}
          
          {options.map((doc) => (
            <Combobox.Option key={doc._id} value={doc}>
              <div className="option-content">
                <div className="option-title">
                  {doc[config.displayField || 'title'] || 'Untitled'}
                </div>
                <div className="option-meta">
                  {doc._type} • {formatDate(doc._updatedAt)}
                </div>
              </div>
            </Combobox.Option>
          ))}
          
          {config.allowCreate && (
            <button className="create-new-option">
              + Create new {config.to}
            </button>
          )}
        </Combobox.Options>
      </Combobox>
    </div>
  )
}
```

## Phase 3: Field System Architecture

### 3.1 Field Registry System
```typescript
// Centralized field registration
export class FieldRegistry {
  private fields = new Map<string, FieldDefinition>()
  
  register(type: string, definition: FieldDefinition) {
    this.fields.set(type, definition)
  }
  
  get(type: string): FieldDefinition | undefined {
    return this.fields.get(type)
  }
  
  getAll(): FieldDefinition[] {
    return Array.from(this.fields.values())
  }
}

// Auto-register built-in fields
const fieldRegistry = new FieldRegistry()
fieldRegistry.register('string', StringField)
fieldRegistry.register('text', TextareaField)
fieldRegistry.register('richText', RichTextField)
fieldRegistry.register('media', MediaField)
fieldRegistry.register('reference', ReferenceField)
// etc...
```

### 3.2 Custom Field Plugin System
```typescript
// Allow users to create custom fields
export interface CustomFieldDefinition {
  name: string
  component: React.ComponentType<FieldProps>
  config?: Record<string, any>
  validation?: (value: any, config: any) => string | null
  serialize?: (value: any) => any
  deserialize?: (value: any) => any
}

// Usage:
fieldRegistry.register('customField', {
  component: MyCustomField,
  validation: (value, config) => {
    if (config.required && !value) return 'This field is required'
    return null
  }
})
```

## Phase 4: GraphQL Integration Planning

### 4.1 GraphQL Schema Generation
```typescript
// Auto-generate GraphQL schema from Trokky fields
export function generateGraphQLSchema(schemas: DocumentSchema[]) {
  const types: string[] = []
  
  schemas.forEach(schema => {
    const fields = schema.fields.map(field => {
      const gqlType = mapFieldToGraphQLType(field)
      return `  ${field.name}: ${gqlType}`
    }).join('\n')
    
    types.push(`
      type ${schema.name} {
        _id: ID!
        _type: String!
        _createdAt: DateTime!
        _updatedAt: DateTime!
      ${fields}
      }
    `)
  })
  
  return `
    ${types.join('\n')}
    
    type Query {
      ${schemas.map(s => `
        ${s.name}(id: ID!): ${s.name}
        ${s.name}s(limit: Int, offset: Int, filter: ${s.name}Filter): [${s.name}!]!
      `).join('')}
    }
  `
}
```

### 4.2 CLI Integration Points
```typescript
// Future CLI commands
trokky generate-types --graphql  // Generate GraphQL schema
trokky query --select="title,slug" --where="published:true"
trokky export --format=graphql --query="{ articles { title content } }"
```

## Immediate Action Plan

### This Week - Field Audit Tasks:

#### Day 1: Assessment
- [ ] **Inventory current fields** - What do we actually have?
- [ ] **Test each field in Studio** - Does it work correctly?
- [ ] **Document issues** - What's broken or missing?
- [ ] **Prioritize fixes** - Critical vs nice-to-have

#### Day 2: Quick Fixes
- [ ] **Fix critical bugs** in existing fields
- [ ] **Polish String field** - Most commonly used
- [ ] **Improve Media field** - Building on recent work
- [ ] **Test client integration** - Do types generate correctly?

#### Day 3: Rich Text Focus
- [ ] **Implement or fix Rich Text** - This is make-or-break
- [ ] **Add toolbar** with essential formatting
- [ ] **Test with content team workflows**

### Questions for Field Audit:

1. **Which fields are most critical** for your client presentation?
2. **What's the current Rich Text situation** - do we have one?
3. **Any specific field requirements** from your client's use case?
4. **Timeline constraints** - how much polish time do we have?

Let's start with a quick inventory of what we currently have. Want to check the current field implementations first?