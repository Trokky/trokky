import { StringFieldPreview } from '../StringField/preview.js';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { NumberFieldDefinition } from './definition.js';
import { formatNumber, parseFormattedNumber } from './validation.js';

// Number field preview props
type NumberFieldPreviewProps = FieldComponentProps;

export function NumberFieldPreview(props: NumberFieldPreviewProps) {
  const { value, definition } = props;
  const numberDefinition = definition as NumberFieldDefinition;
  
  if (value === null || value === undefined || value === '') {
    return (
      <StringFieldPreview 
        {...props} 
        definition={numberDefinition}
      />
    );
  }
  
  // Parse the value to ensure it's a valid number
  let numValue: number;
  if (typeof value === 'number') {
    numValue = value;
  } else {
    const parsed = parseFormattedNumber(String(value), numberDefinition);
    if (parsed === null || !isFinite(parsed)) {
      // Invalid number - fall back to string preview
      return (
        <StringFieldPreview 
          {...props} 
          definition={numberDefinition}
        />
      );
    }
    numValue = parsed;
  }
  
  // Format the number for display
  const formattedValue = formatNumber(numValue, numberDefinition);
  
  // Add appropriate styling based on number format
  const format = numberDefinition.options?.format || 'decimal';
  let className = 'font-mono'; // Monospace for better number alignment
  
  // Add color coding for different number types
  if (format === 'currency') {
    className += ' text-green-600 dark:text-green-400'; // Green for money
  } else if (format === 'percentage') {
    className += ' text-blue-600 dark:text-blue-400'; // Blue for percentages
  } else if (numValue < 0) {
    className += ' text-red-600 dark:text-red-400'; // Red for negative numbers
  } else {
    className += ' text-gray-900 dark:text-gray-100'; // Default color
  }
  
  return (
    <span className={className}>
      {formattedValue}
    </span>
  );
}