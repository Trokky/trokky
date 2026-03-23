/**
 * GeoCoordinate Field Definition
 */

import type { BaseFieldDefinition, BaseValidation, BaseFieldOptions } from '../../base/FieldDefinition.js';

export interface GeoCoordinate {
  lat: number;      // Latitude (-90 to 90)
  lng: number;      // Longitude (-180 to 180)
  alt?: number;     // Altitude in meters (optional)
  accuracy?: number; // Accuracy in meters (optional)
}

export interface GeoCoordinateValidation extends BaseValidation {
  bounds?: {
    north: number;
    south: number; 
    east: number;
    west: number;
  };
  requireAltitude?: boolean;
  maxAccuracy?: number; // Max allowed accuracy in meters
}

export interface GeoCoordinateFieldOptions extends BaseFieldOptions {
  mapProvider?: 'openstreetmap' | 'google' | 'mapbox';
  defaultZoom?: number;
  enableGeolocation?: boolean;
  showAltitude?: boolean;
  showAccuracy?: boolean;
  inputMode?: 'map' | 'manual' | 'both';
  mapHeight?: number;
  defaultCenter?: GeoCoordinate;
}

export interface GeoCoordinateFieldDefinition extends BaseFieldDefinition {
  type: 'geoCoordinate';
  validation?: GeoCoordinateValidation;
  options?: GeoCoordinateFieldOptions;
  defaultValue?: GeoCoordinate;
}

export const GEO_COORDINATE_FIELD_DEFAULTS: Partial<GeoCoordinateFieldDefinition> = {
  type: 'geoCoordinate',
  required: false,
  options: {
    mapProvider: 'openstreetmap',
    defaultZoom: 10,
    enableGeolocation: true,
    showAltitude: false,
    showAccuracy: false,
    inputMode: 'both',
    mapHeight: 300,
    defaultCenter: { lat: 40.7128, lng: -74.0060 }, // NYC
    layout: 'default',
    width: 'full'
  },
  validation: {}
};
