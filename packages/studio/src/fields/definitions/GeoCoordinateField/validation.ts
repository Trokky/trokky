/**
 * GeoCoordinate Field Validation
 */

import type { ValidationResult } from '../../base/FieldDefinition.js';
import type { GeoCoordinate, GeoCoordinateFieldDefinition } from './definition.js';

export function validateGeoCoordinate(
  value: GeoCoordinate | null | undefined,
  definition: GeoCoordinateFieldDefinition
): ValidationResult {
  const errors: string[] = [];

  // Required validation
  if (definition.required && (!value || value.lat === undefined || value.lng === undefined)) {
    errors.push('Coordinates are required');
    return { isValid: false, errors };
  }

  if (!value) {
    return { isValid: true, errors: [] };
  }

  // Latitude validation (-90 to 90)
  if (typeof value.lat !== 'number' || value.lat < -90 || value.lat > 90) {
    errors.push('Latitude must be between -90 and 90 degrees');
  }

  // Longitude validation (-180 to 180)
  if (typeof value.lng !== 'number' || value.lng < -180 || value.lng > 180) {
    errors.push('Longitude must be between -180 and 180 degrees');
  }

  // Bounds validation
  if (definition.validation?.bounds) {
    const { north, south, east, west } = definition.validation.bounds;
    if (value.lat > north || value.lat < south) {
      errors.push(`Latitude must be between ${south} and ${north} degrees`);
    }
    if (value.lng > east || value.lng < west) {
      errors.push(`Longitude must be between ${west} and ${east} degrees`);
    }
  }

  // Altitude validation
  if (definition.validation?.requireAltitude && value.alt === undefined) {
    errors.push('Altitude is required');
  }

  // Accuracy validation
  if (definition.validation?.maxAccuracy && value.accuracy && value.accuracy > definition.validation.maxAccuracy) {
    errors.push(`Accuracy must be better than ${definition.validation.maxAccuracy} meters`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
