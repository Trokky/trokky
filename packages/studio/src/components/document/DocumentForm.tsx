/**
 * DocumentForm - Form-based document editing
 * 
 * Handles schema-driven form rendering and field interactions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { FieldRenderer } from '../../fields/index';
import { useDocumentEditor } from './DocumentEditorContext';
import { useStudioContext } from '@/contexts/StudioContext';
import { createStudioLogger } from '@/utils/logger';
import { useT } from 'trokky/i18n';

const logger = createStudioLogger('DocumentForm');

// Helper function to format field names into readable titles
function formatFieldName(fieldName: string): string {
  // Convert camelCase/snake_case to Title Case
  return fieldName
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim();
}

// Conditional visibility evaluation functions (copied from ObjectField)
function evaluateCondition(actualValue: any, expectedValue: any, operator: string): boolean {
  switch (operator) {
    case 'equals':
      return actualValue === expectedValue;
    case 'notEquals':
      return actualValue !== expectedValue;
    case 'contains':
      if (typeof actualValue === 'string') {
        return actualValue.includes(String(expectedValue));
      }
      if (Array.isArray(actualValue)) {
        return actualValue.includes(expectedValue);
      }
      return false;
    case 'notContains':
      if (typeof actualValue === 'string') {
        return !actualValue.includes(String(expectedValue));
      }
      if (Array.isArray(actualValue)) {
        return !actualValue.includes(expectedValue);
      }
      return true;
    case 'exists':
      return actualValue !== undefined && actualValue !== null && actualValue !== '';
    case 'notExists':
      return actualValue === undefined || actualValue === null || actualValue === '';
    case 'greaterThan':
      return typeof actualValue === 'number' && typeof expectedValue === 'number' && actualValue > expectedValue;
    case 'lessThan':
      return typeof actualValue === 'number' && typeof expectedValue === 'number' && actualValue < expectedValue;
    default:
      console.warn(`Unknown conditional operator: ${operator}`);
      return false;
  }
}

function evaluateConditional(
  fieldDefinition: any,
  documentValues: Record<string, any>
): { visible: boolean; reason: string; evaluatedFields: string[] } {
  // Handle function-based hidden property
  if (typeof fieldDefinition.hidden === 'function') {
    try {
      const isHidden = fieldDefinition.hidden(documentValues);
      return {
        visible: !isHidden,
        reason: isHidden ? 'Hidden by function' : 'Visible by function',
        evaluatedFields: Object.keys(documentValues)
      };
    } catch (error) {
      console.error('Error evaluating hidden function:', error);
      return { visible: true, reason: 'Function error - defaulting to visible', evaluatedFields: [] };
    }
  }

  // Handle boolean hidden property
  if (typeof fieldDefinition.hidden === 'boolean') {
    return {
      visible: !fieldDefinition.hidden,
      reason: fieldDefinition.hidden ? 'Hidden by boolean' : 'Visible by boolean',
      evaluatedFields: []
    };
  }

  // Handle conditional visibility
  if (fieldDefinition.conditional) {
    const { field, value, operator = 'equals', conditions, logic = 'and' } = fieldDefinition.conditional;
    const evaluatedFields = [field];

    // Single condition
    if (!conditions) {
      const actualValue = documentValues[field];
      const result = evaluateCondition(actualValue, value, operator);
      return {
        visible: result,
        reason: result ? `Condition met: ${field} ${operator} ${value}` : `Condition not met: ${field} ${operator} ${value}`,
        evaluatedFields
      };
    }

    // Multiple conditions
    const results = conditions.map((condition: any) => {
      evaluatedFields.push(condition.field);
      const actualValue = documentValues[condition.field];
      return evaluateCondition(actualValue, condition.value, condition.operator || 'equals');
    });

    const visible = logic === 'and' ? results.every((r: boolean) => r) : results.some((r: boolean) => r);
    return {
      visible,
      reason: `Multiple conditions (${logic}): ${visible ? 'met' : 'not met'}`,
      evaluatedFields
    };
  }

  // Default to visible
  return { visible: true, reason: 'No conditions - default visible', evaluatedFields: [] };
}

export function DocumentForm() {
  logger.debug('Component initializing');

  const { t } = useT('studio');
  const { documentId } = useParams();
  const {
    schema,
    document,
    onDocumentChange,
    onValidationChange,
    saving,
    isNewDocument,
    isReadOnly
  } = useDocumentEditor();

  const studioContext = useStudioContext();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Define validateField function first
  const validateField = useCallback((field: any, value: any): string | null => {
    const fieldTitle = field.title || field.name;

    // Required field validation
    if (field.required && (!value || value === '' || (Array.isArray(value) && value.length === 0))) {
      return `${fieldTitle} is required`;
    }

    // Skip further validation if value is empty and not required
    if (!value || value === '') {
      return null;
    }

    // String validation
    if (field.type === 'string') {
      if (field.maxLength && value.length > field.maxLength) {
        return `${fieldTitle} must be ${field.maxLength} characters or less`;
      }
      if (field.minLength && value.length < field.minLength) {
        return `${fieldTitle} must be at least ${field.minLength} characters`;
      }
    }

    // Email validation
    if (field.type === 'email' || (field.type === 'string' && field.name === 'email')) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return `${fieldTitle} must be a valid email address`;
      }
    }

    // Number validation
    if (field.type === 'number') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return `${fieldTitle} must be a valid number`;
      }
      if (field.min !== undefined && numValue < field.min) {
        return `${fieldTitle} must be at least ${field.min}`;
      }
      if (field.max !== undefined && numValue > field.max) {
        return `${fieldTitle} must be no more than ${field.max}`;
      }
    }

    // URL validation
    if (field.type === 'url') {
      try {
        new URL(value);
      } catch {
        return `${fieldTitle} must be a valid URL`;
      }
    }

    return null;
  }, []);

  // Define getFieldsArray function
  const getFieldsArray = useCallback((fields: any): any[] => {
    logger.debug('DocumentForm - Processing fields', { 
      fields, 
      isArray: Array.isArray(fields), 
      isObject: fields && typeof fields === 'object',
      keys: fields ? Object.keys(fields) : null
    });
    
    if (Array.isArray(fields)) {
      logger.debug('DocumentForm - Using array fields', { count: fields.length });
      return fields;
    }
    
    if (fields && typeof fields === 'object') {
      // Convert object fields to array format
      const fieldsArray = Object.entries(fields).map(([name, field]: [string, any]) => {
        // Add title if missing (fallback to formatted field name)
        const title = field.title || formatFieldName(name);
        
        const processedField = {
          name,
          title, // Ensure title is always present
          ...field
        };

        return processedField;
      });
      
      logger.debug('Converted object fields to array', { 
        originalFieldCount: Object.keys(fields).length,
        convertedFieldCount: fieldsArray.length
      });
      return fieldsArray;
    }
    
    logger.warn('No valid fields found', { fieldsType: typeof fields });
    return [];
  }, []);

  // Validate all fields (called from parent when saving)
  const validateAllFields = useCallback((fieldsArray: any[]): boolean => {
    const errors: Record<string, string> = {};
    let hasErrors = false;

    fieldsArray.forEach(field => {
      const value = document[field.name];
      const error = validateField(field, value);
      if (error) {
        errors[field.name] = error;
        hasErrors = true;
      }
    });

    setFieldErrors(errors);
    return !hasErrors;
  }, [document, validateField]);

  // Validate all fields when saving starts
  useEffect(() => {
    if (saving && schema && document) {
      const fieldsArray = getFieldsArray(schema.fields);
      // Filter to only validate visible fields
      const visibleFieldsForValidation = fieldsArray.filter(field => {
        const conditionalResult = evaluateConditional(
          {
            name: field.name,
            conditional: field.conditional,
            hidden: field.hidden
          },
          document
        );
        return conditionalResult.visible;
      });
      validateAllFields(visibleFieldsForValidation);
    }
  }, [saving, schema, document, getFieldsArray, validateAllFields]);

  // Notify parent component about validation errors
  useEffect(() => {
    const hasErrors = Object.keys(fieldErrors).length > 0;
    onValidationChange(hasErrors);
  }, [fieldErrors, onValidationChange]);

  if (!schema || !document) {
    logger.debug('Waiting for schema or document to load', {
      hasSchema: !!schema,
      hasDocument: !!document
    });
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">
          {t('documentEditor.loadingForm')}
        </div>
      </div>
    );
  }

  logger.debug('Schema loaded successfully', { 
    schemaName: schema.name, 
    fieldsType: typeof schema.fields
  });

  const handleFieldChange = useCallback((fieldName: string, value: any) => {
    onDocumentChange({ [fieldName]: value });
    
    // Clear field error when user starts typing
    if (fieldErrors[fieldName]) {
      setFieldErrors(prev => {
        const updated = { ...prev };
        delete updated[fieldName];
        return updated;
      });
    }
  }, [onDocumentChange, fieldErrors, isReadOnly]);

  const handleFieldBlur = useCallback((fieldName: string, field: any) => {
    const value = document[fieldName];
    const error = validateField(field, value);
    
    if (error) {
      setFieldErrors(prev => ({
        ...prev,
        [fieldName]: error
      }));
    } else {
      setFieldErrors(prev => {
        const updated = { ...prev };
        delete updated[fieldName];
        return updated;
      });
    }
  }, [document, validateField, isReadOnly]);

  // Create document context for field rendering
  const documentContext = useMemo(() => {
    if (!schema || !document) return undefined;

    return {
      documentId: documentId || undefined,
      schema: schema.name,
      isNewDocument: isNewDocument || false,
      allValues: document, // Current form values for field interactions
      nestingLevel: 0 // Top-level document fields start at level 0
    };
  }, [schema, document, documentId, isNewDocument]);

  const renderField = useCallback((field: any) => {
    const value = document[field.name];
    const error = fieldErrors[field.name];

    // Use FieldRenderer for all field types (same as FieldsDemo)
    return (
      <FieldRenderer
        key={field.name}
        fieldId={field.name}
        value={value}
        onChange={isReadOnly ? () => {} : (newValue: any) => handleFieldChange(field.name, newValue)}
        onBlur={isReadOnly ? () => {} : () => handleFieldBlur(field.name, field)}
        definition={field}
        hasError={!!error}
        error={error}
        mode="edit"
        disabled={isReadOnly}
        studioContext={studioContext || undefined}
        documentContext={documentContext}
      />
    );
  }, [document, fieldErrors, handleFieldChange, handleFieldBlur, studioContext, documentContext, isReadOnly]);

  const renderFormSection = (fields: any[]) => {
    return (
      <div className="space-y-6">
        {fields.map(renderField)}
      </div>
    );
  };

  const fieldsArray = useMemo(() => getFieldsArray(schema.fields), [schema.fields, getFieldsArray]);

  // Filter fields based on conditional visibility
  const visibleFields = useMemo(() => {
    if (!fieldsArray || !document) return fieldsArray || [];

    return fieldsArray.filter(field => {
      const conditionalResult = evaluateConditional(
        {
          name: field.name,
          conditional: field.conditional,
          hidden: field.hidden
        },
        document
      );

      logger.debug('Field visibility evaluation', {
        fieldName: field.name,
        visible: conditionalResult.visible,
        reason: conditionalResult.reason
      });

      return conditionalResult.visible;
    });
  }, [fieldsArray, document]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto px-3 py-4 md:px-8 md:py-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="px-4 py-4 md:px-8 md:py-6">
            {visibleFields.length > 0 && renderFormSection(visibleFields)}
            
            {visibleFields.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  {t('documentEditor.noFieldsDefined')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}