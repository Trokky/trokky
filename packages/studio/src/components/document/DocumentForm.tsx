/**
 * DocumentForm - Form-based document editing
 * 
 * Handles schema-driven form rendering and field interactions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { FieldRenderer } from '@trokky/fields';
import { useDocumentEditor } from './DocumentEditorContext';
import { useStudioContext } from '@/contexts/StudioContext';
import { createStudioLogger } from '@/utils/logger';

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

export function DocumentForm() {
  logger.debug('Component initializing');
  
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
      
      // Debug each field to see what properties they have
      fields.forEach((field, index) => {
        if (field.type === 'slug') {
          logger.debug('🐛 Array field slug found:', {
            index,
            field,
            hasSource: 'source' in field,
            hasAutoGenerate: 'autoGenerate' in field,
            hasUnique: 'unique' in field
          });
        }
      });
      
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
        
        // Debug media field processing
        if (field.type === 'media') {
          logger.debug('Processing media field in getFieldsArray', {
            fieldName: name,
            hasOptions: !!field.options
          });
        }
        
        // Debug slug field processing
        if (field.type === 'slug') {
          logger.debug('🐛 Processing slug field in getFieldsArray', {
            fieldName: name,
            originalField: field,
            processedField,
            allProperties: Object.keys(field),
            hasSource: 'source' in field,
            hasAutoGenerate: 'autoGenerate' in field,
            hasUnique: 'unique' in field
          });
        }
        
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
      validateAllFields(fieldsArray);
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
          Loading form...
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
  }, [onDocumentChange, fieldErrors]);

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
  }, [document, validateField]);

  // Create document context for field rendering
  const documentContext = useMemo(() => {
    if (!schema || !document) return undefined;
    
    return {
      documentId: documentId || undefined,
      schema: schema.name,
      isNewDocument: isNewDocument || false,
      allValues: document // Current form values for field interactions
    };
  }, [schema, document, documentId, isNewDocument]);

  const renderField = useCallback((field: any) => {
    const value = document[field.name];
    const error = fieldErrors[field.name];

    // Debug field definition for media fields
    if (field.type === 'media') {
      logger.debug('Rendering media field in DocumentForm', {
        fieldName: field.name,
        hasOptions: !!field.options,
        enableUpload: field.options?.enableUpload,
        enableBrowse: field.options?.enableBrowse
      });
    }
    
    // Debug field definition for slug fields
    if (field.type === 'slug') {
      logger.debug('🐛 Rendering slug field in DocumentForm', {
        fieldName: field.name,
        fieldDefinition: field,
        source: field.source,
        autoGenerate: field.autoGenerate,
        unique: field.unique,
        documentContext: !!documentContext,
        allValues: documentContext?.allValues
      });
    }

    // Use FieldRenderer for all field types (same as FieldsDemo)
    // Add extra padding wrapper for object fields to create space from the left border
    const fieldRenderer = (
      <FieldRenderer
        key={field.name}
        fieldId={field.name}
        value={value}
        onChange={isReadOnly ? undefined : (newValue: any) => handleFieldChange(field.name, newValue)}
        onBlur={isReadOnly ? undefined : () => handleFieldBlur(field.name, field)}
        definition={field}
        hasError={!!error}
        error={error}
        mode={isReadOnly ? "view" : "edit"}
        disabled={isReadOnly}
        studioContext={studioContext || undefined}
        documentContext={documentContext}
      />
    );

    // Wrap object fields with extra left padding to create space from their border
    if (field.type === 'object') {
      return (
        <div key={field.name} className="pl-2">
          {fieldRenderer}
        </div>
      );
    }

    return fieldRenderer;
  }, [document, fieldErrors, handleFieldChange, handleFieldBlur, studioContext, documentContext]);

  const renderFormSection = (fields: any[]) => {
    return (
      <div className="space-y-6">
        {fields.map(renderField)}
      </div>
    );
  };

  const fieldsArray = useMemo(() => getFieldsArray(schema.fields), [schema.fields, getFieldsArray]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            {fieldsArray.length > 0 && renderFormSection(fieldsArray)}
            
            {fieldsArray.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  No fields defined in schema
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}