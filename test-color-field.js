import { ColorFieldPlugin } from './packages/fields/dist/definitions/ColorField/index.js'

console.log('Testing ColorField Plugin:')
console.log('Type:', ColorFieldPlugin.type)
console.log('Display Name:', ColorFieldPlugin.displayName)

// Test validation
const testDefinition = {
  type: 'color',
  title: 'Test Color',
  required: true,
  validation: {
    allowedColors: ['#FF0000', '#00FF00', '#0000FF'],
  },
}

// Test valid color
const validResult = ColorFieldPlugin.validate('#FF0000', testDefinition)
console.log('\nValid color test (#FF0000):', validResult)

// Test invalid hex format
const invalidHex = ColorFieldPlugin.validate('not-a-color', testDefinition)
console.log('Invalid hex test:', invalidHex)

// Test forbidden color
const forbiddenResult = ColorFieldPlugin.validate('#FFFF00', testDefinition)
console.log('Forbidden color test (#FFFF00):', forbiddenResult)

// Test required field
const requiredResult = ColorFieldPlugin.validate('', testDefinition)
console.log('Required field test (empty):', requiredResult)

// Test default value
const defaultValue = ColorFieldPlugin.getDefaultValue({
  type: 'color',
  title: 'Color',
  options: { defaultValue: '#3B82F6' },
})
console.log('\nDefault value test:', defaultValue)

// Test schema conversion
const schemaField = ColorFieldPlugin.toSchemaField(testDefinition)
console.log('\nSchema field conversion:', schemaField)

console.log('\n✅ ColorField tests completed')
