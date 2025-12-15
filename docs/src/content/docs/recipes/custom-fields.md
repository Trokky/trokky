---
title: Custom Fields
description: Create custom field types for Trokky
---

This recipe shows how to create custom field types to extend Trokky's built-in field system.

## Field Architecture

Custom fields consist of:

1. **Field definition** - Schema structure and validation
2. **React component** - Studio editor UI
3. **Preview component** - List/preview display

## Basic Custom Field

### 1. Define the Field Type

```typescript
// fields/color-field.ts
import { FieldDefinition } from '@trokky/core';

export const colorField: FieldDefinition = {
  name: 'color',
  title: 'Color',

  // Validation
  validate(value, field) {
    if (field.required && !value) {
      return 'Color is required';
    }
    if (value && !/^#[0-9A-Fa-f]{6}$/.test(value)) {
      return 'Invalid hex color format';
    }
    return true;
  },

  // Default value
  getDefaultValue() {
    return '#000000';
  },

  // Serialization
  serialize(value) {
    return value?.toUpperCase();
  },

  deserialize(value) {
    return value?.toLowerCase();
  },
};
```

### 2. Create the Editor Component

```tsx
// fields/color-field-component.tsx
import React, { useState } from 'react';
import { FieldProps } from '@trokky/studio';

export function ColorFieldComponent({ value, onChange, field }: FieldProps) {
  const [localValue, setLocalValue] = useState(value || '#000000');

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="color-field">
      <label className="block text-sm font-medium mb-1">
        {field.title}
        {field.required && <span className="text-red-500">*</span>}
      </label>

      <div className="flex items-center gap-2">
        <input
          type="color"
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          className="w-12 h-10 rounded cursor-pointer"
        />
        <input
          type="text"
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="#000000"
          pattern="^#[0-9A-Fa-f]{6}$"
          className="flex-1 px-3 py-2 border rounded"
        />
      </div>

      {field.description && (
        <p className="text-sm text-gray-500 mt-1">{field.description}</p>
      )}
    </div>
  );
}
```

### 3. Register the Field

```typescript
// fields/index.ts
import { registerField } from '@trokky/studio';
import { colorField } from './color-field';
import { ColorFieldComponent } from './color-field-component';

registerField({
  ...colorField,
  component: ColorFieldComponent,
});
```

### 4. Use in Schema

```typescript
const categorySchema = {
  name: 'category',
  title: 'Category',
  fields: [
    { name: 'name', type: 'string', required: true },
    {
      name: 'color',
      type: 'color',  // Custom field type
      title: 'Category Color',
      description: 'Color used to identify this category',
    },
  ],
};
```

## Complex Custom Field: Location Picker

### Field Definition

```typescript
// fields/location-field.ts
export interface LocationValue {
  lat: number;
  lng: number;
  address?: string;
}

export const locationField: FieldDefinition = {
  name: 'location',
  title: 'Location',

  validate(value: LocationValue | undefined, field) {
    if (field.required && !value) {
      return 'Location is required';
    }
    if (value) {
      if (typeof value.lat !== 'number' || value.lat < -90 || value.lat > 90) {
        return 'Invalid latitude';
      }
      if (typeof value.lng !== 'number' || value.lng < -180 || value.lng > 180) {
        return 'Invalid longitude';
      }
    }
    return true;
  },

  getDefaultValue() {
    return null;
  },
};
```

### Editor Component

```tsx
// fields/location-field-component.tsx
import React, { useState, useCallback } from 'react';
import { FieldProps } from '@trokky/studio';
import type { LocationValue } from './location-field';

export function LocationFieldComponent({
  value,
  onChange,
  field
}: FieldProps<LocationValue>) {
  const [localValue, setLocalValue] = useState<LocationValue | null>(value);

  const handleChange = useCallback((updates: Partial<LocationValue>) => {
    const newValue = { ...localValue, ...updates } as LocationValue;
    setLocalValue(newValue);
    onChange(newValue);
  }, [localValue, onChange]);

  const handleClear = () => {
    setLocalValue(null);
    onChange(null);
  };

  return (
    <div className="location-field">
      <label className="block text-sm font-medium mb-2">
        {field.title}
        {field.required && <span className="text-red-500">*</span>}
      </label>

      <div className="grid grid-cols-2 gap-4 mb-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Latitude</label>
          <input
            type="number"
            step="0.000001"
            min="-90"
            max="90"
            value={localValue?.lat ?? ''}
            onChange={(e) => handleChange({ lat: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border rounded"
            placeholder="e.g., 40.7128"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Longitude</label>
          <input
            type="number"
            step="0.000001"
            min="-180"
            max="180"
            value={localValue?.lng ?? ''}
            onChange={(e) => handleChange({ lng: parseFloat(e.target.value) })}
            className="w-full px-3 py-2 border rounded"
            placeholder="e.g., -74.0060"
          />
        </div>
      </div>

      <div className="mb-2">
        <label className="block text-xs text-gray-500 mb-1">
          Address (optional)
        </label>
        <input
          type="text"
          value={localValue?.address ?? ''}
          onChange={(e) => handleChange({ address: e.target.value })}
          className="w-full px-3 py-2 border rounded"
          placeholder="e.g., New York, NY"
        />
      </div>

      {localValue && (
        <div className="flex items-center justify-between">
          <a
            href={`https://maps.google.com/?q=${localValue.lat},${localValue.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View on Google Maps
          </a>
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-red-600 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {field.description && (
        <p className="text-sm text-gray-500 mt-2">{field.description}</p>
      )}
    </div>
  );
}
```

### Preview Component

```tsx
// fields/location-field-preview.tsx
import React from 'react';
import { PreviewProps } from '@trokky/studio';
import type { LocationValue } from './location-field';

export function LocationFieldPreview({ value }: PreviewProps<LocationValue>) {
  if (!value) {
    return <span className="text-gray-400">No location</span>;
  }

  return (
    <span className="text-sm">
      {value.address || `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`}
    </span>
  );
}
```

### Registration

```typescript
// fields/index.ts
import { registerField } from '@trokky/studio';
import { locationField } from './location-field';
import { LocationFieldComponent } from './location-field-component';
import { LocationFieldPreview } from './location-field-preview';

registerField({
  ...locationField,
  component: LocationFieldComponent,
  preview: LocationFieldPreview,
});
```

## Field with External API

### Rating Field (with API)

```tsx
// fields/rating-field-component.tsx
import React, { useState } from 'react';
import { FieldProps } from '@trokky/studio';

interface RatingValue {
  score: number;
  maxScore: number;
}

export function RatingFieldComponent({
  value,
  onChange,
  field,
}: FieldProps<RatingValue>) {
  const maxScore = field.options?.maxScore || 5;
  const currentScore = value?.score || 0;

  const handleClick = (score: number) => {
    onChange({
      score: score === currentScore ? 0 : score,
      maxScore,
    });
  };

  return (
    <div className="rating-field">
      <label className="block text-sm font-medium mb-2">
        {field.title}
      </label>

      <div className="flex gap-1">
        {Array.from({ length: maxScore }, (_, i) => i + 1).map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => handleClick(score)}
            className={`w-8 h-8 text-xl ${
              score <= currentScore
                ? 'text-yellow-400'
                : 'text-gray-300'
            }`}
          >
            ★
          </button>
        ))}
      </div>

      {currentScore > 0 && (
        <p className="text-sm text-gray-500 mt-1">
          {currentScore} / {maxScore}
        </p>
      )}
    </div>
  );
}
```

## Using Custom Fields

### In Schema

```typescript
const venueSchema = {
  name: 'venue',
  title: 'Venue',
  fields: [
    { name: 'name', type: 'string', required: true },
    { name: 'location', type: 'location', required: true },
    { name: 'brandColor', type: 'color' },
    {
      name: 'rating',
      type: 'rating',
      options: { maxScore: 5 },
    },
  ],
};
```

### Querying

```typescript
const venues = await client.documents.list('venue');

// Access custom field values
venues.forEach((venue) => {
  console.log(venue.location.lat, venue.location.lng);
  console.log(venue.brandColor);
  console.log(venue.rating.score);
});
```

## Best Practices

1. **Validation**: Always validate on both client and server
2. **Serialization**: Ensure values can be JSON serialized
3. **Accessibility**: Make components keyboard accessible
4. **Error handling**: Show clear error messages
5. **Documentation**: Document field options and usage

## Next Steps

- [Field Types Reference](/reference/field-types/)
- [Studio Customization](/guides/studio/)
- [@trokky/studio Package](/packages/studio/)
