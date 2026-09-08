import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { ObjectFieldDefinition } from './definition.js';
import { 
  getObjectMetadata, 
  renderTemplate, 
  sanitizeObjectValue 
} from './validation.js';

type ObjectPreviewProps = FieldComponentProps;

export function ObjectFieldPreview({ value, definition }: ObjectPreviewProps) {
  // Type guard for object field definition
  if (definition.type !== 'object') {
    return <span className="text-gray-400 text-sm italic">Invalid field configuration</span>;
  }

  const objectDefinition = definition as ObjectFieldDefinition;
  const sanitizedValue = sanitizeObjectValue(value);
  
  // Handle empty or invalid values
  if (!sanitizedValue || Object.keys(sanitizedValue).length === 0) {
    return (
      <span className="text-gray-400 text-sm italic">
        Empty object
      </span>
    );
  }

  const options = objectDefinition.options || {};
  const preview = options.preview || {};
  const metadata = getObjectMetadata(sanitizedValue, objectDefinition);

  // Use template if provided
  if (preview.template) {
    const rendered = renderTemplate(preview.template, {
      values: sanitizedValue,
      fields: objectDefinition.fields, // Already a Record<string, NestedFieldDefinition>
      metadata
    });
    
    const maxLength = preview.maxLength || 80;
    const displayText = rendered.length > maxLength 
      ? `${rendered.slice(0, maxLength)}...` 
      : rendered;
    
    return (
      <span className="text-sm text-gray-700 dark:text-gray-300" title={rendered}>
        {displayText || 'No preview available'}
      </span>
    );
  }

  // Use specific preview fields if configured
  if (preview.fields && preview.fields.length > 0) {
    const previewValues = preview.fields
      .slice(0, 3) // Limit to 3 fields for preview
      .map(fieldName => {
        const field = objectDefinition.fields[fieldName];
        const fieldValue = sanitizedValue[fieldName];
        
        if (!field || fieldValue === undefined || fieldValue === null || fieldValue === '') {
          return null;
        }

        // Format value based on type
        let displayValue: string;
        if (typeof fieldValue === 'string') {
          displayValue = fieldValue.length > 20 ? `${fieldValue.slice(0, 20)}...` : fieldValue;
        } else if (typeof fieldValue === 'number') {
          displayValue = fieldValue.toString();
        } else if (typeof fieldValue === 'boolean') {
          displayValue = fieldValue ? 'Yes' : 'No';
        } else if (Array.isArray(fieldValue)) {
          displayValue = `[${fieldValue.length} items]`;
        } else if (typeof fieldValue === 'object') {
          const keys = Object.keys(fieldValue);
          displayValue = `{${keys.length} properties}`;
        } else {
          displayValue = String(fieldValue).slice(0, 20);
        }

        return `${field.title}: ${displayValue}`;
      })
      .filter(Boolean);

    if (previewValues.length > 0) {
      const previewText = previewValues.join(', ');
      const maxLength = preview.maxLength || 80;
      const displayText = previewText.length > maxLength 
        ? `${previewText.slice(0, maxLength)}...` 
        : previewText;

      return (
        <span className="text-sm text-gray-700 dark:text-gray-300" title={previewText}>
          {displayText}
          {preview.showCount && (
            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
              ({metadata.filledFields} of {metadata.visibleFields} fields)
            </span>
          )}
        </span>
      );
    }
  }

  // Default preview: show field count and completion
  const filledFieldsText = metadata.filledFields.length === 1 ? '1 field' : `${metadata.filledFields.length} fields`;
  const totalFieldsText = metadata.visibleFields.length === 1 ? '1 field' : `${metadata.visibleFields.length} fields`;
  
  // Show some key field values if available
  const keyFields = Object.entries(objectDefinition.fields)
    .filter(([fieldName]) => {
      const fieldValue = sanitizedValue[fieldName];
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    })
    .slice(0, 2);

  if (keyFields.length > 0) {
    const keyValues = keyFields.map(([fieldName]) => {
      const fieldValue = sanitizedValue[fieldName];
      let displayValue: string;
      
      if (typeof fieldValue === 'string') {
        displayValue = fieldValue.length > 15 ? `${fieldValue.slice(0, 15)}...` : fieldValue;
      } else if (typeof fieldValue === 'number') {
        displayValue = fieldValue.toString();
      } else if (typeof fieldValue === 'boolean') {
        displayValue = fieldValue ? 'Yes' : 'No';
      } else {
        displayValue = String(fieldValue).slice(0, 15);
      }
      
      return displayValue;
    }).join(', ');

    return (
      <span className="text-sm text-gray-700 dark:text-gray-300">
        {keyValues}
        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
          ({filledFieldsText} filled)
        </span>
      </span>
    );
  }

  // Fallback: just show completion status
  return (
    <span className="text-sm text-gray-600 dark:text-gray-400">
      {filledFieldsText} of {totalFieldsText} filled
      {metadata.isRequiredComplete && metadata.requiredFieldsStatus.total > 0 && (
        <span className="ml-2 text-green-600 dark:text-green-400">✓</span>
      )}
    </span>
  );
}