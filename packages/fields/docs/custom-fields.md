# Custom Fields Development Guide

Learn how to create custom field types for the Trokky v2 field system.

## Overview

The @trokky/fields package provides a plugin architecture that allows you to create custom field types that integrate seamlessly with Trokky Studio and the broader ecosystem.

## Quick Start

Here's a minimal custom field implementation:

```typescript
import type { FieldPlugin, FieldComponentProps, ValidationResult } from '@trokky/fields';
import { fieldRegistry } from '@trokky/fields';

// 1. Define the field plugin
const colorFieldPlugin: FieldPlugin = {
  type: 'color',
  displayName: 'Color Picker',
  description: 'A color picker field for selecting colors',
  category: 'specialized',
  
  // React component for editing
  component: ColorFieldComponent,
  
  // Validation function
  validate: (value, definition) => ({
    isValid: !definition.required || !!value,
    message: definition.required && !value ? 'Color is required' : undefined
  }),
  
  // Default value generator
  getDefaultValue: () => '#000000',
  
  // Schema conversion
  toSchemaField: (definition) => definition,
  fromSchemaField: (schemaField) => schemaField
};

// 2. Create the React component
function ColorFieldComponent({ value, onChange, definition }: FieldComponentProps) {
  return (
    <div>
      <label>{definition.title}</label>
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// 3. Register the field
fieldRegistry.register(colorFieldPlugin);
```

## Field Plugin Interface

Every custom field must implement the `FieldPlugin` interface:

```typescript
interface FieldPlugin<TDefinition = any, TValue = any> {
  // Required metadata
  type: string;                    // Unique identifier
  displayName: string;             // Human-readable name
  description: string;             // Description for Studio
  category: FieldCategory;         // Field category
  
  // Required methods
  component: React.ComponentType<FieldComponentProps>;
  validate: (value: TValue, definition: TDefinition) => ValidationResult;
  getDefaultValue: (definition: TDefinition) => TValue;
  toSchemaField: (definition: TDefinition) => any;
  fromSchemaField: (schemaField: any) => TDefinition;
  
  // Optional methods
  previewComponent?: React.ComponentType<FieldComponentProps>;
  settings?: {
    icon?: string;
    color?: string;
    tags?: string[];
  };
}
```

## Step-by-Step Development

### 1. Define Field Types

Start by defining TypeScript interfaces for your field:

```typescript
// Color field definition
export interface ColorFieldDefinition extends BaseFieldDefinition {
  type: 'color';
  validation?: ColorValidation;
  options?: ColorFieldOptions;
  defaultValue?: string;
}

// Field-specific validation
export interface ColorValidation extends BaseValidation {
  allowTransparent?: boolean;
  format?: 'hex' | 'rgb' | 'hsl';
}

// Field-specific options
export interface ColorFieldOptions extends BaseFieldOptions {
  palette?: string[];       // Predefined color palette
  showSwatches?: boolean;   // Show color swatches
  allowCustom?: boolean;    // Allow custom colors
  format?: 'hex' | 'rgb' | 'hsl';
}
```

### 2. Create the Edit Component

The main component for editing the field value:

```typescript
import React, { useState } from 'react';
import type { FieldComponentProps } from '@trokky/fields';

interface ColorFieldComponentProps extends FieldComponentProps {
  value?: string;
  definition: ColorFieldDefinition;
}

export function ColorFieldComponent({
  value,
  onChange,
  definition,
  hasError,
  onValidationChange
}: ColorFieldComponentProps) {
  const { options = {} } = definition;
  const [isOpen, setIsOpen] = useState(false);
  
  const handleColorChange = (newColor: string) => {
    onChange(newColor);
    
    // Trigger validation
    const validationResult = validateColorField(newColor, definition);
    onValidationChange?.(validationResult);
  };
  
  return (
    <div className="color-field">
      <label className="field-label">
        {definition.title}
        {definition.required && <span className="required">*</span>}
      </label>
      
      <div className="color-input-container">
        {/* Color preview */}
        <div 
          className="color-preview"
          style={{ backgroundColor: value || '#000000' }}
          onClick={() => setIsOpen(!isOpen)}
        />
        
        {/* Hex input */}
        <input
          type="text"
          value={value || ''}
          onChange={(e) => handleColorChange(e.target.value)}
          placeholder="#000000"
          className={hasError ? 'error' : ''}
        />
        
        {/* Color picker */}
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => handleColorChange(e.target.value)}
        />
      </div>
      
      {/* Predefined palette */}
      {options.palette && (
        <div className="color-palette">
          {options.palette.map(color => (
            <button
              key={color}
              className="palette-color"
              style={{ backgroundColor: color }}
              onClick={() => handleColorChange(color)}
            />
          ))}
        </div>
      )}
      
      {/* Help text */}
      {definition.description && (
        <div className="field-description">{definition.description}</div>
      )}
    </div>
  );
}
```

### 3. Create Preview Component

Optional component for read-only display:

```typescript
export function ColorFieldPreview({ 
  value, 
  definition 
}: FieldComponentProps) {
  if (!value) return <span className="empty-value">No color selected</span>;
  
  return (
    <div className="color-preview-readonly">
      <div 
        className="color-swatch"
        style={{ backgroundColor: value }}
      />
      <span className="color-value">{value}</span>
    </div>
  );
}
```

### 4. Implement Validation

Create validation logic for your field:

```typescript
export function validateColorField(
  value: string | undefined,
  definition: ColorFieldDefinition
): ValidationResult {
  const { required, validation = {} } = definition;
  
  // Required validation
  if (required && (!value || value.trim() === '')) {
    return {
      isValid: false,
      message: 'Color is required'
    };
  }
  
  // Skip validation if no value
  if (!value) {
    return { isValid: true };
  }
  
  // Format validation
  const isValidHex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value);
  const isValidRgb = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(value);
  const isValidHsl = /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/.test(value);
  
  if (!isValidHex && !isValidRgb && !isValidHsl) {
    return {
      isValid: false,
      message: 'Invalid color format'
    };
  }
  
  // Transparency validation
  if (!validation.allowTransparent && value.toLowerCase().includes('transparent')) {
    return {
      isValid: false,
      message: 'Transparent colors are not allowed'
    };
  }
  
  return { isValid: true };
}
```

### 5. Create the Field Plugin

Combine everything into a field plugin:

```typescript
export const colorFieldPlugin: FieldPlugin<ColorFieldDefinition, string> = {
  type: 'color',
  displayName: 'Color Picker',
  description: 'A color picker field for selecting colors',
  category: 'specialized',
  
  component: ColorFieldComponent,
  previewComponent: ColorFieldPreview,
  validate: validateColorField,
  
  getDefaultValue: (definition) => definition.defaultValue || '#000000',
  
  toSchemaField: (definition) => ({
    type: definition.type,
    title: definition.title,
    description: definition.description,
    required: definition.required,
    validation: definition.validation,
    options: definition.options,
    defaultValue: definition.defaultValue
  }),
  
  fromSchemaField: (schemaField) => ({
    type: 'color',
    title: schemaField.title,
    description: schemaField.description,
    required: schemaField.required,
    validation: schemaField.validation,
    options: schemaField.options,
    defaultValue: schemaField.defaultValue
  }),
  
  settings: {
    icon: '🎨',
    color: '#FF6B6B',
    tags: ['color', 'picker', 'design']
  }
};
```

## Advanced Features

### Studio Context Integration

Access Studio APIs and utilities:

```typescript
export function AdvancedFieldComponent({ 
  studioContext,
  ...props 
}: FieldComponentProps) {
  const { apiClient, auth, utils, logger } = studioContext || {};
  
  const handleSpecialAction = async () => {
    try {
      // Check permissions
      if (!auth?.hasPermission('content', 'edit')) {
        utils?.showToast('Permission denied', 'error');
        return;
      }
      
      // Make API call
      const result = await apiClient?.get('/api/special-endpoint');
      
      // Show success message
      utils?.showToast('Action completed successfully', 'success');
      
      // Log for debugging
      logger?.info('Special action completed', { result });
      
    } catch (error) {
      logger?.error('Special action failed', error);
      utils?.showToast('Action failed', 'error');
    }
  };
  
  return (
    <div>
      {/* Field content */}
      <button onClick={handleSpecialAction}>
        Special Action
      </button>
    </div>
  );
}
```

### Field Communication

Enable fields to communicate with each other:

```typescript
export function DependentFieldComponent({ 
  studioContext,
  ...props 
}: FieldComponentProps) {
  const { fieldEvents } = studioContext || {};
  
  useEffect(() => {
    // Listen to other field changes
    const unsubscribe = fieldEvents?.on('field:title:change', (value) => {
      // React to title field changes
      console.log('Title changed:', value);
    });
    
    return unsubscribe;
  }, [fieldEvents]);
  
  const handleChange = (value: any) => {
    props.onChange(value);
    
    // Emit event for other fields
    fieldEvents?.emit('field:myField:change', value);
  };
  
  // Get value from another field
  const titleValue = fieldEvents?.getFieldValue('title');
  
  return (
    <div>
      <p>Current title: {titleValue}</p>
      {/* Rest of component */}
    </div>
  );
}
```

### External API Integration

Create fields that interact with external services:

```typescript
export function UnsplashImageField({ 
  studioContext,
  ...props 
}: FieldComponentProps) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const searchImages = async (query: string) => {
    if (!studioContext?.apiClient) return;
    
    setLoading(true);
    try {
      const response = await studioContext.apiClient.get(
        `/api/integrations/unsplash/search?q=${encodeURIComponent(query)}`
      );
      setImages(response.data.photos);
    } catch (error) {
      studioContext.logger?.error('Unsplash search failed', error);
      studioContext.utils?.showToast('Image search failed', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="unsplash-field">
      <input
        type="text"
        placeholder="Search Unsplash..."
        onChange={(e) => searchImages(e.target.value)}
      />
      
      {loading && <div>Loading...</div>}
      
      <div className="image-grid">
        {images.map(image => (
          <img
            key={image.id}
            src={image.urls.small}
            onClick={() => props.onChange(image)}
            alt={image.alt_description}
          />
        ))}
      </div>
    </div>
  );
}
```

## Best Practices

### 1. TypeScript First

Always define proper TypeScript interfaces:

```typescript
// Define field-specific types
interface MyFieldDefinition extends BaseFieldDefinition {
  type: 'myField';
  validation?: MyFieldValidation;
  options?: MyFieldOptions;
}

// Use generic typing for the plugin
const myFieldPlugin: FieldPlugin<MyFieldDefinition, MyFieldValue> = {
  // Implementation
};
```

### 2. Validation Excellence

Implement comprehensive validation:

```typescript
function validateMyField(value: any, definition: MyFieldDefinition): ValidationResult {
  // Always handle required validation
  if (definition.required && !value) {
    return { isValid: false, message: 'Field is required' };
  }
  
  // Skip further validation if no value
  if (!value) return { isValid: true };
  
  // Field-specific validation
  // Return detailed error messages
  // Handle edge cases
  
  return { isValid: true };
}
```

### 3. Accessible Components

Follow accessibility best practices:

```typescript
function AccessibleField({ definition, ...props }: FieldComponentProps) {
  const fieldId = `field-${props.fieldId}`;
  const errorId = `${fieldId}-error`;
  
  return (
    <div>
      <label htmlFor={fieldId}>
        {definition.title}
        {definition.required && (
          <span aria-label="required">*</span>
        )}
      </label>
      
      <input
        id={fieldId}
        aria-describedby={props.hasError ? errorId : undefined}
        aria-invalid={props.hasError}
        // ... other props
      />
      
      {props.hasError && (
        <div id={errorId} role="alert">
          {props.error}
        </div>
      )}
    </div>
  );
}
```

### 4. Performance Optimization

Optimize for performance:

```typescript
import { memo, useCallback, useMemo } from 'react';

const OptimizedField = memo(function MyField(props: FieldComponentProps) {
  // Memoize expensive calculations
  const processedOptions = useMemo(
    () => processOptions(props.definition.options),
    [props.definition.options]
  );
  
  // Memoize event handlers
  const handleChange = useCallback(
    (value: any) => {
      props.onChange(value);
    },
    [props.onChange]
  );
  
  return (
    <div>
      {/* Component content */}
    </div>
  );
});
```

### 5. Error Handling

Implement robust error handling:

```typescript
function RobustField({ studioContext, ...props }: FieldComponentProps) {
  const [error, setError] = useState<string | null>(null);
  
  const handleAsyncAction = async () => {
    try {
      setError(null);
      // Async operation
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      studioContext?.logger?.error('Field operation failed', err);
    }
  };
  
  if (error) {
    return (
      <div className="field-error">
        <p>Field Error: {error}</p>
        <button onClick={() => setError(null)}>Retry</button>
      </div>
    );
  }
  
  return (
    <div>
      {/* Normal field content */}
    </div>
  );
}
```

## Testing Custom Fields

### Unit Testing

Test field validation and logic:

```typescript
import { validateMyField } from './my-field';

describe('MyField', () => {
  describe('validation', () => {
    it('should validate required fields', () => {
      const definition = { type: 'myField', required: true };
      
      const result = validateMyField('', definition);
      expect(result.isValid).toBe(false);
      expect(result.message).toContain('required');
    });
    
    it('should allow valid values', () => {
      const definition = { type: 'myField' };
      
      const result = validateMyField('valid-value', definition);
      expect(result.isValid).toBe(true);
    });
  });
});
```

### Component Testing

Test React components:

```typescript
import { render, fireEvent } from '@testing-library/react';
import { MyFieldComponent } from './my-field-component';

describe('MyFieldComponent', () => {
  it('should call onChange when value changes', () => {
    const onChange = jest.fn();
    const definition = { type: 'myField', title: 'Test Field' };
    
    const { getByLabelText } = render(
      <MyFieldComponent
        fieldId="test"
        value=""
        onChange={onChange}
        definition={definition}
      />
    );
    
    fireEvent.change(getByLabelText('Test Field'), {
      target: { value: 'new-value' }
    });
    
    expect(onChange).toHaveBeenCalledWith('new-value');
  });
});
```

## Registration and Distribution

### Local Registration

Register fields in your application:

```typescript
import { fieldRegistry } from '@trokky/fields';
import { myCustomField } from './my-custom-field';

// Register during app initialization
fieldRegistry.register(myCustomField);
```

### Package Distribution

Create a separate npm package for reusable fields:

```json
{
  "name": "@mycompany/trokky-field-color",
  "version": "1.0.0",
  "description": "Color picker field for Trokky CMS",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@trokky/fields": "^0.1.0",
    "react": "^18.0.0"
  }
}
```

Package entry point:

```typescript
// src/index.ts
export { colorFieldPlugin } from './color-field-plugin';
export type { 
  ColorFieldDefinition,
  ColorFieldOptions,
  ColorValidation 
} from './types';

// Auto-register when imported
import { fieldRegistry } from '@trokky/fields';
import { colorFieldPlugin } from './color-field-plugin';

fieldRegistry.register(colorFieldPlugin);
```

## Examples

See the [examples directory](./examples/) for complete implementations of:
- Custom color picker field
- Geolocation field with map integration
- External API integration field
- Complex multi-part field

---

Custom fields are a powerful way to extend Trokky's capabilities. Start simple and gradually add more features as needed.