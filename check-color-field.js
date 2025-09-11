// Test to verify ColorField is properly integrated
import { fieldRegistry } from './packages/fields/dist/registry/FieldRegistry.js'
import './packages/fields/dist/builtin.js' // This registers all builtin fields

// Check if ColorField is registered
const colorField = fieldRegistry.get('color')

if (colorField) {
  console.log('✅ ColorField is registered successfully!')
  console.log('Field details:')
  console.log('- Type:', colorField.type)
  console.log('- Display Name:', colorField.displayName)
  console.log('- Description:', colorField.description)
  console.log('- Category:', colorField.category)

  // Test validation
  const testDef = {
    type: 'color',
    title: 'Test Color',
    options: {
      defaultValue: '#FF5733',
    },
  }

  const validColor = '#FF5733'
  const invalidColor = 'not-a-color'

  const validResult = colorField.validate(validColor, testDef)
  console.log('\nValidation test (valid):', validResult)

  const invalidResult = colorField.validate(invalidColor, testDef)
  console.log('Validation test (invalid):', invalidResult)

  // Test default value
  const defaultValue = colorField.getDefaultValue(testDef)
  console.log('\nDefault value:', defaultValue)
} else {
  console.error('❌ ColorField is NOT registered!')
  console.log(
    'Registered field types:',
    Array.from(fieldRegistry['plugins'].keys())
  )
}
