/**
 * GeoCoordinate Field Plugin
 */

import type { FieldPlugin } from '../../base/FieldPlugin.js';
import type { GeoCoordinate, GeoCoordinateFieldDefinition } from './definition.js';
import { GeoCoordinateFieldComponent } from './component.js';
import { GeoCoordinateFieldPreview } from './preview.js';
import { validateGeoCoordinate } from './validation.js';

export const geoCoordinateFieldPlugin: FieldPlugin<GeoCoordinateFieldDefinition, GeoCoordinate> = {
  type: 'geoCoordinate',
  displayName: 'Geo Coordinate',
  description: 'Geographic coordinates with latitude and longitude',
  category: 'location',
  
  component: GeoCoordinateFieldComponent,
  previewComponent: GeoCoordinateFieldPreview,
  
  validate: validateGeoCoordinate,
  
  getDefaultValue: (definition) => {
    return definition.defaultValue || definition.options?.defaultCenter || { lat: 0, lng: 0 };
  },
  
  toSchemaField: (definition) => {
    return {
      type: 'geoCoordinate',
      title: definition.title,
      description: definition.description,
      required: definition.required,
      validation: definition.validation,
      options: definition.options,
      defaultValue: definition.defaultValue
    };
  },
  
  fromSchemaField: (schemaField) => {
    return {
      type: 'geoCoordinate' as const,
      title: schemaField.title || 'Geo Coordinate',
      description: schemaField.description,
      required: schemaField.required || false,
      validation: schemaField.validation || {},
      options: schemaField.options || {},
      defaultValue: schemaField.defaultValue
    };
  },
  
  settings: {
    icon: 'map-pin',
    color: '#10B981',
    tags: ['location', 'coordinates', 'map', 'geo']
  },

  demoConfig: {
    examples: [
      { 
        name: 'New York City', 
        value: { lat: 40.7128, lng: -74.0060 }, 
        description: 'NYC coordinates' 
      },
      { 
        name: 'London', 
        value: { lat: 51.5074, lng: -0.1278 }, 
        description: 'London coordinates' 
      },
      { 
        name: 'Tokyo', 
        value: { lat: 35.6762, lng: 139.6503 }, 
        description: 'Tokyo coordinates' 
      }
    ],
    invalidValue: { lat: 0, lng: 0 },
    variants: [
      {
        name: 'Basic Coordinates',
        definition: {
          type: 'geoCoordinate' as const,
          title: 'Location',
          description: 'Geographic coordinates',
          options: { inputMode: 'manual' }
        }
      },
      {
        name: 'With Geolocation',
        definition: {
          type: 'geoCoordinate' as const,
          title: 'Current Location',
          description: 'Location with geolocation support',
          options: { 
            inputMode: 'both',
            enableGeolocation: true 
          }
        }
      },
      {
        name: 'With Altitude',
        definition: {
          type: 'geoCoordinate' as const,
          title: 'Precise Location',
          description: 'Location with altitude data',
          options: { 
            showAltitude: true,
            showAccuracy: true 
          }
        }
      }
    ]
  }
};

// Export components and types for direct use
export { GeoCoordinateFieldComponent } from './component.js';
export { GeoCoordinateFieldPreview } from './preview.js';
export { validateGeoCoordinate } from './validation.js';
export type { 
  GeoCoordinate, 
  GeoCoordinateFieldDefinition, 
  GeoCoordinateValidation, 
  GeoCoordinateFieldOptions 
} from './definition.js';
