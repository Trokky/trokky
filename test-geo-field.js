/**
 * Test GeoCoordinate Field
 */

import { fieldRegistry } from './packages/fields/dist/index.js';

console.log('Testing GeoCoordinate Field...');

// Check if field is registered
const geoField = fieldRegistry.get('geoCoordinate');
if (geoField) {
  console.log('✅ GeoCoordinate field is registered');
  console.log('   Display Name:', geoField.displayName);
  console.log('   Category:', geoField.category);
  console.log('   Description:', geoField.description);
} else {
  console.log('❌ GeoCoordinate field not found');
}

// Test validation
if (geoField) {
  const testDefinition = {
    type: 'geoCoordinate',
    title: 'Test Location',
    required: true
  };

  // Test valid coordinates
  const validCoord = { lat: 40.7128, lng: -74.0060 };
  const validResult = geoField.validate(validCoord, testDefinition);
  console.log('✅ Valid coordinates test:', validResult.isValid ? 'PASS' : 'FAIL');

  // Test invalid coordinates
  const invalidCoord = { lat: 200, lng: -74.0060 };
  const invalidResult = geoField.validate(invalidCoord, testDefinition);
  console.log('✅ Invalid coordinates test:', !invalidResult.isValid ? 'PASS' : 'FAIL');
  if (!invalidResult.isValid) {
    console.log('   Errors:', invalidResult.errors);
  }

  // Test default value
  const defaultValue = geoField.getDefaultValue(testDefinition);
  console.log('✅ Default value:', defaultValue);
}

// List all registered fields
console.log('\nAll registered fields:');
const allFields = fieldRegistry.getAll();
allFields.forEach(field => {
  console.log(`  - ${field.type} (${field.category}): ${field.displayName}`);
});
