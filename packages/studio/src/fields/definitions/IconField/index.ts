/**
 * Icon Field Plugin
 * Visual icon picker with support for multiple icon libraries
 */

import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { DocumentContext, ValidationResult } from '../../base/FieldDefinition.js';
import { IconFieldComponent } from './component.js';
import { IconFieldPreview } from './preview.js';
import type { IconFieldDefinition, IconValue } from './definition.js';
import { iconFieldSchema } from './definition.js';

export * from './definition.js';
export { IconFieldComponent, registerIconLibrary } from './component.js';
export { IconFieldPreview } from './preview.js';
export { fontawesomeAdapter } from './adapters/fontawesome.js';
export { heroiconsAdapter } from './adapters/heroicons.js';
export { customSvgAdapter, setCustomIcons, getCustomIcons, clearCustomIcons, renderSvgPath } from './adapters/custom-svg.js';

export const IconFieldPlugin: FieldPlugin<IconFieldDefinition, IconValue | null> = {
  // Plugin metadata
  type: 'icon',
  displayName: 'Icon',
  description: 'Visual icon picker with search and filtering',
  category: 'custom',

  // React component for Studio rendering
  component: IconFieldComponent,

  // Optional preview component
  previewComponent: IconFieldPreview,

  // Validation function
  validate: (
    value: IconValue | null,
    definition: IconFieldDefinition,
    _context?: DocumentContext
  ): ValidationResult => {
    if (!value) {
      if (definition.required) {
        return {
          isValid: false,
          errors: ['This field is required'],
        };
      }
      return { isValid: true, errors: [] };
    }

    const result = iconFieldSchema.safeParse(value);

    if (!result.success) {
      return {
        isValid: false,
        errors: result.error.errors.map(err => err.message),
      };
    }

    // Check allowed libraries
    if (
      definition.validation?.allowedLibraries &&
      !definition.validation.allowedLibraries.includes(value.library)
    ) {
      return {
        isValid: false,
        errors: [`Icon library '${value.library}' is not allowed`],
      };
    }

    // Custom validation
    if (definition.validation?.custom) {
      const customResult = definition.validation.custom(value);
      if (customResult !== true) {
        return {
          isValid: false,
          errors: [typeof customResult === 'string' ? customResult : 'Invalid icon'],
        };
      }
    }

    return { isValid: true, errors: [] };
  },

  // Default value generator
  getDefaultValue: (_definition: IconFieldDefinition): IconValue | null => {
    return null;
  },

  // Schema conversion utilities
  toSchemaField: (_definition: IconFieldDefinition) => {
    return {
      type: 'object',
      properties: {
        library: { type: 'string' },
        name: { type: 'string' },
        style: { type: 'string' },
        svg: { type: 'string' },
      },
      required: ['library', 'name'],
    };
  },

  fromSchemaField: (schemaField: any): IconFieldDefinition => {
    return {
      type: 'icon',
      title: schemaField.title || 'Icon',
      options: {
        library: 'fontawesome',
        style: 'solid',
        allowSearch: true,
        showPreview: true,
      },
    };
  },

  // Optional settings
  settings: {
    icon: '🎨',
    color: '#6366F1',
    tags: ['icon', 'image', 'symbol', 'fontawesome'],
  },

  // Demo configuration
  demoConfig: {
    examples: [
      {
        name: 'User Icon',
        value: { library: 'fontawesome', name: 'fa-user', style: 'solid' },
        description: 'A user profile icon',
      },
      {
        name: 'Heart Icon',
        value: { library: 'fontawesome', name: 'fa-heart', style: 'solid' },
        description: 'A heart icon for favorites',
      },
      {
        name: 'GitHub Brand',
        value: { library: 'fontawesome', name: 'fa-github', style: 'brands' },
        description: 'GitHub brand icon',
      },
    ],
    invalidValue: { library: 'fontawesome', name: '' },
    variants: [
      {
        name: 'Basic',
        definition: {
          type: 'icon' as const,
          title: 'Select Icon',
          options: {
            library: 'fontawesome',
            style: 'solid',
          },
        },
      },
      {
        name: 'Brands Only',
        definition: {
          type: 'icon' as const,
          title: 'Brand Icon',
          options: {
            library: 'fontawesome',
            style: 'brands',
          },
        },
      },
    ],
  },
};
