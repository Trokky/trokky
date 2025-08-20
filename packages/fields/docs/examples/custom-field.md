# Custom Field Example: Color Picker

Complete implementation of a custom color picker field for @trokky/fields.

## Overview

This example demonstrates creating a fully-featured color picker field with:
- Color format support (hex, rgb, hsl)
- Predefined color palette
- Custom color input
- Transparency support
- Proper validation and TypeScript types

## File Structure

```
color-field/
├── types.ts              # TypeScript interfaces
├── validation.ts         # Validation logic
├── component.tsx         # Main edit component
├── preview.tsx          # Preview component
├── utils.ts             # Utility functions
├── styles.css           # Component styles
└── index.ts             # Main export and plugin definition
```

## Implementation

### 1. Type Definitions (`types.ts`)

```typescript
import type { BaseFieldDefinition, BaseValidation, BaseFieldOptions } from '@trokky/fields';

// Color format types
export type ColorFormat = 'hex' | 'rgb' | 'hsl';

// Color field validation
export interface ColorValidation extends BaseValidation {
  allowTransparent?: boolean;
  format?: ColorFormat;
  allowedFormats?: ColorFormat[];
}

// Predefined color option
export interface ColorOption {
  name: string;
  value: string;
  category?: string;
}

// Color field options
export interface ColorFieldOptions extends BaseFieldOptions {
  palette?: ColorOption[] | string[];  // Predefined colors
  showSwatches?: boolean;               // Show color swatches
  allowCustom?: boolean;                // Allow custom color input
  format?: ColorFormat;                 // Preferred format
  showFormatToggle?: boolean;           // Show format toggle buttons
  showAlpha?: boolean;                  // Show alpha/transparency
  showPreview?: boolean;                // Show color preview
  size?: 'sm' | 'md' | 'lg';           // Component size
}

// Color field definition
export interface ColorFieldDefinition extends BaseFieldDefinition {
  type: 'color';
  validation?: ColorValidation;
  options?: ColorFieldOptions;
  defaultValue?: string;
}

// Color field value (always a string)
export type ColorFieldValue = string;

// Default color options
export const DEFAULT_COLOR_PALETTE: ColorOption[] = [
  { name: 'Red', value: '#FF0000', category: 'primary' },
  { name: 'Green', value: '#00FF00', category: 'primary' },
  { name: 'Blue', value: '#0000FF', category: 'primary' },
  { name: 'Yellow', value: '#FFFF00', category: 'secondary' },
  { name: 'Magenta', value: '#FF00FF', category: 'secondary' },
  { name: 'Cyan', value: '#00FFFF', category: 'secondary' },
  { name: 'Black', value: '#000000', category: 'neutral' },
  { name: 'White', value: '#FFFFFF', category: 'neutral' },
  { name: 'Gray', value: '#808080', category: 'neutral' }
];

// Default configuration
export const COLOR_FIELD_DEFAULTS: Partial<ColorFieldDefinition> = {
  type: 'color',
  required: false,
  options: {
    showSwatches: true,
    allowCustom: true,
    format: 'hex',
    showFormatToggle: false,
    showAlpha: false,
    showPreview: true,
    size: 'md',
    palette: DEFAULT_COLOR_PALETTE
  },
  validation: {
    allowTransparent: false,
    format: 'hex'
  },
  defaultValue: '#000000'
};
```

### 2. Utility Functions (`utils.ts`)

```typescript
import type { ColorFormat } from './types';

// Color conversion utilities
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number, s: number;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }

    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Color format detection
export function detectColorFormat(color: string): ColorFormat | null {
  if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
    return 'hex';
  }
  if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(color)) {
    return 'rgb';
  }
  if (/^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/.test(color)) {
    return 'hsl';
  }
  return null;
}

// Color format conversion
export function convertColorFormat(color: string, targetFormat: ColorFormat): string {
  const currentFormat = detectColorFormat(color);
  if (!currentFormat || currentFormat === targetFormat) {
    return color;
  }

  // Convert to RGB first
  let rgb: { r: number; g: number; b: number } | null = null;

  if (currentFormat === 'hex') {
    rgb = hexToRgb(color);
  } else if (currentFormat === 'rgb') {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      rgb = {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3])
      };
    }
  }

  if (!rgb) return color;

  // Convert to target format
  switch (targetFormat) {
    case 'hex':
      return rgbToHex(rgb.r, rgb.g, rgb.b);
    case 'rgb':
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    case 'hsl':
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      return `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
    default:
      return color;
  }
}

// Color brightness calculation (for determining text color)
export function getColorBrightness(color: string): number {
  const rgb = hexToRgb(color);
  if (!rgb) return 0;
  
  // Calculate luminance
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
}

// Get contrasting text color
export function getContrastColor(backgroundColor: string): string {
  return getColorBrightness(backgroundColor) > 128 ? '#000000' : '#FFFFFF';
}
```

### 3. Validation (`validation.ts`)

```typescript
import type { ValidationResult } from '@trokky/fields';
import type { ColorFieldDefinition, ColorFormat } from './types';
import { detectColorFormat } from './utils';

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
  if (!value || value.trim() === '') {
    return { isValid: true };
  }

  const trimmedValue = value.trim();

  // Transparency validation
  if (!validation.allowTransparent) {
    const lowerValue = trimmedValue.toLowerCase();
    if (lowerValue === 'transparent' || lowerValue.includes('rgba') || 
        (lowerValue.includes('hsla') && lowerValue.includes('0)'))) {
      return {
        isValid: false,
        message: 'Transparent colors are not allowed'
      };
    }
  }

  // Format validation
  const detectedFormat = detectColorFormat(trimmedValue);
  if (!detectedFormat) {
    return {
      isValid: false,
      message: 'Invalid color format. Use hex (#FF0000), rgb(255,0,0), or hsl(0,100%,50%)'
    };
  }

  // Allowed formats validation
  if (validation.allowedFormats && validation.allowedFormats.length > 0) {
    if (!validation.allowedFormats.includes(detectedFormat)) {
      const allowedList = validation.allowedFormats.join(', ');
      return {
        isValid: false,
        message: `Color must be in one of these formats: ${allowedList}`
      };
    }
  }

  // Specific format validation
  if (validation.format && detectedFormat !== validation.format) {
    return {
      isValid: false,
      message: `Color must be in ${validation.format} format`
    };
  }

  return { isValid: true };
}

// Validate color format string
export function isValidColorFormat(color: string, format: ColorFormat): boolean {
  switch (format) {
    case 'hex':
      return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
    case 'rgb':
      return /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(color);
    case 'hsl':
      return /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/.test(color);
    default:
      return false;
  }
}
```

### 4. Main Component (`component.tsx`)

```typescript
import React, { useState, useCallback, useEffect } from 'react';
import type { FieldComponentProps } from '@trokky/fields';
import type { ColorFieldDefinition, ColorOption, ColorFormat } from './types';
import { validateColorField, isValidColorFormat } from './validation';
import { convertColorFormat, getContrastColor } from './utils';
import './styles.css';

interface ColorFieldComponentProps extends FieldComponentProps {
  value?: string;
  definition: ColorFieldDefinition;
}

export function ColorFieldComponent({
  value,
  onChange,
  definition,
  hasError,
  onValidationChange,
  onFocus,
  onBlur
}: ColorFieldComponentProps) {
  const { options = {} } = definition;
  const [currentFormat, setCurrentFormat] = useState<ColorFormat>(
    options.format || 'hex'
  );
  const [showPicker, setShowPicker] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');

  // Sync input value with prop value
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value]);

  // Validation
  const validateAndNotify = useCallback((val: string) => {
    const result = validateColorField(val, definition);
    onValidationChange?.(result);
    return result.isValid;
  }, [definition, onValidationChange]);

  // Handle color change
  const handleColorChange = useCallback((newColor: string) => {
    setInputValue(newColor);
    onChange(newColor);
    validateAndNotify(newColor);
  }, [onChange, validateAndNotify]);

  // Handle format change
  const handleFormatChange = useCallback((format: ColorFormat) => {
    setCurrentFormat(format);
    if (value && isValidColorFormat(value, currentFormat)) {
      const converted = convertColorFormat(value, format);
      handleColorChange(converted);
    }
  }, [value, currentFormat, handleColorChange]);

  // Handle input blur
  const handleInputBlur = useCallback(() => {
    // Convert to preferred format on blur if valid
    if (inputValue && options.format) {
      const converted = convertColorFormat(inputValue, options.format);
      if (converted !== inputValue) {
        handleColorChange(converted);
      }
    }
    onBlur?.();
  }, [inputValue, options.format, handleColorChange, onBlur]);

  // Render color swatches
  const renderColorSwatches = () => {
    if (!options.showSwatches || !options.palette) return null;

    const palette = Array.isArray(options.palette) 
      ? options.palette.map(color => 
          typeof color === 'string' ? { name: color, value: color } : color
        )
      : options.palette;

    return (
      <div className="color-field-swatches">
        {palette.map((color: ColorOption, index: number) => (
          <button
            key={`${color.value}-${index}`}
            type="button"
            className={`color-swatch ${value === color.value ? 'selected' : ''}`}
            style={{ backgroundColor: color.value }}
            onClick={() => handleColorChange(color.value)}
            title={color.name}
            aria-label={`Select ${color.name}`}
          />
        ))}
      </div>
    );
  };

  // Render format toggle
  const renderFormatToggle = () => {
    if (!options.showFormatToggle) return null;

    const formats: ColorFormat[] = ['hex', 'rgb', 'hsl'];

    return (
      <div className="color-format-toggle">
        {formats.map(format => (
          <button
            key={format}
            type="button"
            className={`format-btn ${currentFormat === format ? 'active' : ''}`}
            onClick={() => handleFormatChange(format)}
          >
            {format.toUpperCase()}
          </button>
        ))}
      </div>
    );
  };

  const colorValue = value || '#000000';
  const contrastColor = getContrastColor(colorValue);

  return (
    <div className={`color-field color-field-${options.size || 'md'}`}>
      {/* Label */}
      <label className="color-field-label">
        {definition.title}
        {definition.required && <span className="required">*</span>}
      </label>

      {/* Main input container */}
      <div className="color-input-container">
        {/* Color preview */}
        {options.showPreview !== false && (
          <div 
            className="color-preview"
            style={{ 
              backgroundColor: colorValue,
              color: contrastColor
            }}
            onClick={() => setShowPicker(!showPicker)}
            title="Click to open color picker"
          >
            <span className="color-preview-text">
              {colorValue}
            </span>
          </div>
        )}

        {/* Text input */}
        {options.allowCustom !== false && (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleInputBlur}
            onFocus={onFocus}
            placeholder={`Enter ${currentFormat} color...`}
            className={`color-input ${hasError ? 'error' : ''}`}
            aria-describedby={hasError ? `${definition.title}-error` : undefined}
          />
        )}

        {/* Native color picker */}
        <input
          type="color"
          value={colorValue}
          onChange={(e) => handleColorChange(e.target.value)}
          className="color-picker-native"
          title="Color picker"
        />
      </div>

      {/* Format toggle */}
      {renderFormatToggle()}

      {/* Color swatches */}
      {renderColorSwatches()}

      {/* Help text */}
      {definition.description && (
        <div className="color-field-description">
          {definition.description}
        </div>
      )}
    </div>
  );
}
```

### 5. Preview Component (`preview.tsx`)

```typescript
import React from 'react';
import type { FieldComponentProps } from '@trokky/fields';
import type { ColorFieldDefinition } from './types';
import { getContrastColor } from './utils';

interface ColorFieldPreviewProps extends FieldComponentProps {
  value?: string;
  definition: ColorFieldDefinition;
}

export function ColorFieldPreview({ 
  value, 
  definition,
  compact = false 
}: ColorFieldPreviewProps) {
  if (!value) {
    return <span className="color-preview-empty">No color selected</span>;
  }

  const contrastColor = getContrastColor(value);

  if (compact) {
    return (
      <div 
        className="color-preview-compact"
        style={{ backgroundColor: value }}
        title={value}
      />
    );
  }

  return (
    <div className="color-preview-full">
      <div 
        className="color-preview-swatch"
        style={{ 
          backgroundColor: value,
          color: contrastColor
        }}
      >
        <span className="color-value">{value}</span>
      </div>
      {definition.title && (
        <span className="color-label">{definition.title}</span>
      )}
    </div>
  );
}
```

### 6. Styles (`styles.css`)

```css
/* Color Field Styles */
.color-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.color-field-label {
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.25rem;
}

.required {
  color: #ef4444;
  margin-left: 0.25rem;
}

.color-input-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-preview {
  width: 2.5rem;
  height: 2.5rem;
  border: 2px solid #d1d5db;
  border-radius: 0.375rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 500;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  transition: border-color 0.2s;
}

.color-preview:hover {
  border-color: #9ca3af;
}

.color-preview-text {
  display: none;
}

.color-field-md .color-preview {
  width: 3rem;
  height: 3rem;
}

.color-field-lg .color-preview {
  width: 4rem;
  height: 4rem;
}

.color-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: monospace;
}

.color-input:focus {
  outline: none;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.color-input.error {
  border-color: #ef4444;
}

.color-picker-native {
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
}

.color-format-toggle {
  display: flex;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.format-btn {
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
}

.format-btn:hover {
  background: #f3f4f6;
}

.format-btn.active {
  background: #2563eb;
  color: white;
  border-color: #2563eb;
}

.color-field-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.color-swatch {
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid #d1d5db;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s;
}

.color-swatch:hover {
  transform: scale(1.1);
  border-color: #9ca3af;
}

.color-swatch.selected {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
}

.color-field-description {
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.25rem;
}

/* Preview styles */
.color-preview-empty {
  color: #9ca3af;
  font-style: italic;
}

.color-preview-compact {
  width: 1rem;
  height: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  display: inline-block;
}

.color-preview-full {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-preview-swatch {
  width: 2rem;
  height: 2rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 500;
  font-family: monospace;
}

.color-label {
  font-size: 0.875rem;
  color: #374151;
}
```

### 7. Main Export (`index.ts`)

```typescript
import type { FieldPlugin } from '@trokky/fields';
import type { ColorFieldDefinition, ColorFieldValue } from './types';
import { ColorFieldComponent } from './component';
import { ColorFieldPreview } from './preview';
import { validateColorField } from './validation';
import { COLOR_FIELD_DEFAULTS } from './types';

// Export types
export type {
  ColorFieldDefinition,
  ColorFieldValue,
  ColorValidation,
  ColorFieldOptions,
  ColorOption,
  ColorFormat
} from './types';

// Export components
export { ColorFieldComponent } from './component';
export { ColorFieldPreview } from './preview';
export { validateColorField } from './validation';
export * from './utils';

// Field plugin definition
export const colorFieldPlugin: FieldPlugin<ColorFieldDefinition, ColorFieldValue> = {
  type: 'color',
  displayName: 'Color Picker',
  description: 'A color picker field with format support and predefined palettes',
  category: 'specialized',
  
  component: ColorFieldComponent,
  previewComponent: ColorFieldPreview,
  validate: validateColorField,
  
  getDefaultValue: (definition) => 
    definition.defaultValue || COLOR_FIELD_DEFAULTS.defaultValue || '#000000',
  
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
    tags: ['color', 'picker', 'design', 'visual']
  }
};

// Auto-register the field (optional)
// Uncomment if you want auto-registration
// import { fieldRegistry } from '@trokky/fields';
// fieldRegistry.register(colorFieldPlugin);
```

## Usage Example

```typescript
import { colorFieldPlugin } from './color-field';
import { fieldRegistry, FieldRenderer } from '@trokky/fields';

// Register the field
fieldRegistry.register(colorFieldPlugin);

// Use in a form
function MyForm() {
  const [color, setColor] = useState('#FF0000');
  
  return (
    <FieldRenderer
      fieldId="primaryColor"
      value={color}
      onChange={setColor}
      definition={{
        type: 'color',
        title: 'Primary Brand Color',
        required: true,
        validation: {
          format: 'hex'
        },
        options: {
          showSwatches: true,
          showFormatToggle: true,
          palette: [
            '#FF0000', '#00FF00', '#0000FF',
            '#FFFF00', '#FF00FF', '#00FFFF'
          ]
        }
      }}
    />
  );
}
```

This example demonstrates a complete, production-ready custom field implementation with proper TypeScript support, validation, and UI components.