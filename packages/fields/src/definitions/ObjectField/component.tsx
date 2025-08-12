import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { 
  ObjectFieldDefinition, 
  ObjectFieldItem, 
  ObjectOperations, 
  ObjectFieldMetadata,
  ObjectLayout 
} from './definition.js';
import { 
  validateObjectField, 
  getObjectMetadata, 
  evaluateConditional, 
  getDefaultObjectValue,
  sanitizeObjectValue,
  isFieldReadOnly,
  renderTemplate
} from './validation.js';
import { fieldRegistry } from '../../registry/FieldRegistry.js';

// ObjectField component props
type ObjectFieldComponentProps = FieldComponentProps;

export function ObjectFieldComponent(props: ObjectFieldComponentProps) {
  const { definition, value, onChange, hasError, fieldId, isDisabled, isReadonly } = props;
  
  // Type guard for object field definition
  if (definition.type !== 'object') {
    return <div className="text-red-500 text-sm">Invalid field configuration: expected object field</div>;
  }
  
  const objectDefinition = definition as ObjectFieldDefinition;
  const options = objectDefinition.options || {};
  
  // Ensure value is always an object and sanitized
  const objectValue = useMemo(() => 
    sanitizeObjectValue(value), 
    [value]
  );
  
  // Local state for UI interactions
  const [collapseState, setCollapseState] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // Initialize active tab
  useEffect(() => {
    if (options.layout === 'tabs' && options.tabs && options.tabs.length > 0 && !activeTab) {
      setActiveTab(options.tabs[0].title);
    }
  }, [options.layout, options.tabs, activeTab]);
  
  // Get field-specific collapse state
  const getCollapseState = (key: string): boolean => {
    return collapseState[`${fieldId}.${key}`] ?? (options.collapsed || false);
  };
  
  const setCollapseStateForKey = (key: string, collapsed: boolean) => {
    setCollapseState(prev => ({ ...prev, [`${fieldId}.${key}`]: collapsed }));
  };
  
  // Calculate metadata
  const metadata = useMemo(() => 
    getObjectMetadata(objectValue, objectDefinition), 
    [objectValue, objectDefinition]
  );
  
  // Object operations
  const operations: ObjectOperations = useMemo(() => ({
    updateField: (fieldName: string, fieldValue: any) => {
      const newValue = { ...objectValue, [fieldName]: fieldValue };
      onChange(sanitizeObjectValue(newValue));
    },
    
    getField: (fieldName: string) => {
      return objectValue[fieldName];
    },
    
    removeField: (fieldName: string) => {
      const newValue = { ...objectValue };
      delete newValue[fieldName];
      onChange(sanitizeObjectValue(newValue));
    },
    
    hasField: (fieldName: string) => {
      const val = objectValue[fieldName];
      return val !== undefined && val !== null && val !== '';
    },
    
    clear: () => {
      onChange({});
    },
    
    reset: () => {
      const defaultValue = getDefaultObjectValue(objectDefinition);
      onChange(sanitizeObjectValue(defaultValue));
    },
    
    getFieldNames: () => {
      if (Array.isArray(objectDefinition.fields)) {
        return objectDefinition.fields.map(f => f.name);
      }
      return Object.keys(objectDefinition.fields || {});
    },
    
    getFieldDefinition: (fieldName: string) => {
      if (Array.isArray(objectDefinition.fields)) {
        return objectDefinition.fields.find(f => f.name === fieldName);
      }
      const field = (objectDefinition.fields as any)?.[fieldName];
      return field ? { name: fieldName, ...field } : undefined;
    }
  }), [objectValue, objectDefinition, onChange]);
  
  // Normalize fields and filter visible ones based on conditional logic
  const visibleFields = useMemo(() => {
    // Handle both array and object formats for fields
    let fieldsArray: ObjectFieldItem[] = [];
    
    if (Array.isArray(objectDefinition.fields)) {
      fieldsArray = objectDefinition.fields;
    } else if (objectDefinition.fields && typeof objectDefinition.fields === 'object') {
      // Convert object format to array format
      fieldsArray = Object.entries(objectDefinition.fields as any).map(([name, field]: [string, any]) => ({
        name,
        type: field.type,
        title: field.title || name,
        description: field.description,
        required: field.required,
        validation: field.validation,
        options: field.options,
        defaultValue: field.defaultValue || field.default,
        fields: field.fields,
        of: field.of,
        to: field.to,
        hidden: field.hidden,
        readOnly: field.readOnly,
        conditional: field.conditional
      }));
    }
    
    return fieldsArray.filter(field => {
      const conditionalResult = evaluateConditional(field, objectValue);
      return conditionalResult.visible;
    });
  }, [objectDefinition.fields, objectValue]);
  
  // Render individual field
  const renderField = useCallback((fieldDef: ObjectFieldItem, className: string = '') => {
    const fieldPlugin = fieldRegistry.get(fieldDef.type);
    if (!fieldPlugin) {
      return (
        <div key={fieldDef.name} className={`space-y-2 ${className}`}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {fieldDef.title}
            {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
            Field type '{fieldDef.type}' is not registered. Please ensure the field plugin is loaded.
          </div>
        </div>
      );
    }
    
    const FieldComponent = fieldPlugin.component;
    const fieldValue = objectValue[fieldDef.name];
    const fieldHasError = !!fieldErrors[fieldDef.name];
    const fieldIsReadOnly = isFieldReadOnly(fieldDef, objectValue, isReadonly);
    
    return (
      <div key={fieldDef.name} className={`space-y-2 ${className}`}>
        {/* Field label */}
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {fieldDef.title}
          {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        
        {/* Field description */}
        {options.showDescriptions && fieldDef.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{fieldDef.description}</p>
        )}
        
        {/* Help text */}
        {fieldDef.helpText && (
          <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
            {fieldDef.helpText}
          </p>
        )}
        
        {/* Field component */}
        <FieldComponent
          fieldId={`${fieldId}.${fieldDef.name}`}
          value={fieldValue}
          onChange={(newValue: any) => operations.updateField(fieldDef.name, newValue)}
          definition={fieldDef as any}
          hasError={fieldHasError}
          isDisabled={isDisabled}
          isReadonly={fieldIsReadOnly}
        />
        
        {/* Field error */}
        {fieldHasError && (
          <p className="text-xs text-red-600 dark:text-red-400">{fieldErrors[fieldDef.name]}</p>
        )}
      </div>
    );
  }, [objectValue, fieldErrors, operations, fieldId, isDisabled, isReadonly, options.showDescriptions]);
  
  // Render object header with progress
  const renderHeader = () => {
    const isCollapsible = options.collapsible && options.layout !== 'tabs';
    const isCollapsed = getCollapseState('main');
    
    return (
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Title with collapse toggle */}
          {isCollapsible ? (
            <button
              type="button"
              onClick={() => setCollapseStateForKey('main', !isCollapsed)}
              className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <svg 
                className={`w-4 h-4 mr-2 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {definition.title}
            </button>
          ) : (
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {definition.title}
            </h3>
          )}
          
          {/* Field count and progress */}
          {/* {options.showFieldCount && (
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>
                ({metadata.filledFields}/{metadata.visibleFields} fields)
              </span>
              {metadata.isRequiredComplete && metadata.requiredFields > 0 && (
                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          )} */}
          
          {/* {options.showProgress && (
            <div className="flex items-center gap-2">
              <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${metadata.completionPercentage}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {metadata.completionPercentage}%
              </span>
            </div>
          )} */}
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          {!isDisabled && !isReadonly && (
            <>
              <button
                type="button"
                onClick={operations.reset}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Reset to defaults"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                type="button"
                onClick={operations.clear}
                className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Clear all fields"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    );
  };
  
  // Render preview when collapsed
  const renderPreview = () => {
    if (!getCollapseState('main') || !options.preview) return null;
    
    const { fields: previewFields = [], template, maxLength = 150 } = options.preview;
    // const { fields: previewFields = [], template, maxLength = 150, showCount } = options.preview;
    
    if (template) {
      const fieldsArray = Array.isArray(objectDefinition.fields) 
        ? objectDefinition.fields 
        : Object.entries(objectDefinition.fields || {}).map(([name, field]: [string, any]) => ({ name, type: field.type, title: field.title || name }));
      
      const normalizedFields = Array.isArray(objectDefinition.fields) 
        ? objectDefinition.fields 
        : Object.entries(objectDefinition.fields || {}).map(([name, field]: [string, any]) => ({ 
            name, 
            type: field.type,
            title: field.title || name,
            description: field.description,
            required: field.required,
            validation: field.validation,
            options: field.options,
            defaultValue: field.defaultValue
          }));
      
      const rendered = renderTemplate(template, {
        values: objectValue,
        fields: normalizedFields.reduce((acc, f) => ({ ...acc, [f.name]: f }), {}),
        metadata
      });
      return (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md text-sm text-gray-600 dark:text-gray-400">
          {rendered.slice(0, maxLength)}{rendered.length > maxLength && '...'}
        </div>
      );
    }
    
    if (previewFields.length > 0) {
      const fieldsArray = Array.isArray(objectDefinition.fields) 
        ? objectDefinition.fields 
        : Object.entries(objectDefinition.fields || {}).map(([name, field]: [string, any]) => ({ name, type: field.type, title: field.title || name }));
      
      const previewFieldsArray = Array.isArray(objectDefinition.fields) 
        ? objectDefinition.fields 
        : Object.entries(objectDefinition.fields || {}).map(([name, field]: [string, any]) => ({ 
            name, 
            type: field.type,
            title: field.title || name,
            description: field.description,
            required: field.required
          }));
      
      const previewText = previewFields
        .map(fieldName => {
          const field = previewFieldsArray.find(f => f.name === fieldName);
          const value = objectValue[fieldName];
          if (!field || !value) return null;
          return `${field.title}: ${String(value)}`;
        })
        .filter(Boolean)
        .join(', ');
        
      if (previewText) {
        return (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md text-sm text-gray-600 dark:text-gray-400">
            {previewText.slice(0, maxLength)}{previewText.length > maxLength && '...'}
            {showCount && (
              <span className="ml-2 text-xs">({metadata.filledFields} fields)</span>
            )}
          </div>
        );
      }
    }
    
    return null;
  };
  
  // Render content based on layout
  const renderContent = () => {
    if (options.collapsible && getCollapseState('main')) {
      return renderPreview();
    }
    
    switch (options.layout) {
      case 'tabs':
        return renderTabsLayout();
      case 'sections':
        return renderSectionsLayout();
      case 'columns':
        return renderColumnsLayout();
      case 'card':
        return renderCardLayout();
      case 'inline':
      default:
        return renderInlineLayout();
    }
  };
  
  // Inline layout - simple vertical stack
  const renderInlineLayout = () => {
    const spacingClass = options.spacing === 'compact' ? 'space-y-3' : 
                        options.spacing === 'relaxed' ? 'space-y-6' : 'space-y-4';
    
    return (
      <div className={spacingClass}>
        {visibleFields.map(field => renderField(field))}
      </div>
    );
  };
  
  // Columns layout - responsive grid
  const renderColumnsLayout = () => {
    const cols = options.columns || {};
    const gridClass = `grid gap-4 grid-cols-1 ${cols.md ? `md:grid-cols-${cols.md}` : 'md:grid-cols-1'} ${cols.lg ? `lg:grid-cols-${cols.lg}` : 'lg:grid-cols-2'} ${cols.xl ? `xl:grid-cols-${cols.xl}` : 'xl:grid-cols-2'}`;
    
    return (
      <div className={gridClass}>
        {visibleFields.map(field => renderField(field))}
      </div>
    );
  };
  
  // Card layout - bordered container
  const renderCardLayout = () => {
    const spacingClass = options.spacing === 'compact' ? 'space-y-3' : 
                        options.spacing === 'relaxed' ? 'space-y-6' : 'space-y-4';
    
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
        <div className={spacingClass}>
          {visibleFields.map(field => renderField(field))}
        </div>
      </div>
    );
  };
  
  // Sections layout - organized into collapsible sections
  const renderSectionsLayout = () => {
    if (!options.sections || options.sections.length === 0) {
      return renderInlineLayout();
    }
    
    const fieldsInSections = new Set();
    options.sections.forEach(section => {
      section.fields.forEach(fieldName => fieldsInSections.add(fieldName));
    });
    
    const ungroupedFields = visibleFields.filter(field => !fieldsInSections.has(field.name));
    
    return (
      <div className="space-y-6">
        {options.sections.map((section, index) => {
          const sectionFields = visibleFields.filter(field => section.fields.includes(field.name));
          if (sectionFields.length === 0) return null;
          
          const sectionKey = `section-${index}`;
          const isCollapsed = getCollapseState(sectionKey);
          
          return (
            <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Section header */}
              <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {section.icon && (
                      <span className="text-gray-400 dark:text-gray-500">{section.icon}</span>
                    )}
                    {section.collapsible ? (
                      <button
                        type="button"
                        onClick={() => setCollapseStateForKey(sectionKey, !isCollapsed)}
                        className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        <svg 
                          className={`w-4 h-4 mr-2 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        {section.title}
                      </button>
                    ) : (
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {section.title}
                      </h4>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {sectionFields.filter(f => operations.hasField(f.name)).length}/{sectionFields.length}
                  </span>
                </div>
                {section.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{section.description}</p>
                )}
              </div>
              
              {/* Section content */}
              {!isCollapsed && (
                <div className="p-4 space-y-4">
                  {sectionFields.map(field => renderField(field))}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Ungrouped fields */}
        {ungroupedFields.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2">
              Other Fields
            </h4>
            {ungroupedFields.map(field => renderField(field))}
          </div>
        )}
      </div>
    );
  };
  
  // Tabs layout - tabbed interface
  const renderTabsLayout = () => {
    if (!options.tabs || options.tabs.length === 0) {
      return renderInlineLayout();
    }
    
    const currentTab = options.tabs.find(tab => tab.title === activeTab) || options.tabs[0];
    const tabFields = visibleFields.filter(field => 
      field.tab === currentTab.title //|| currentTab.fields.includes(field.name)
    );
    
    return (
      <div className="space-y-4">
        {/* Tab navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8">
            {options.tabs.map(tab => {
              const tabFieldCount = visibleFields.filter(field => 
                field.tab === tab.title || tab.fields.includes(field.name)
              ).length;
              const filledTabFields = visibleFields.filter(field => 
                (field.tab === tab.title || tab.fields.includes(field.name)) && operations.hasField(field.name)
              ).length;
              
              return (
                <button
                  key={tab.title}
                  type="button"
                  onClick={() => setActiveTab(tab.title)}
                  className={`
                    py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2
                    ${activeTab === tab.title 
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  {tab.icon && <span>{tab.icon}</span>}
                  {tab.title}
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                    {filledTabFields}/{tabFieldCount}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
        
        {/* Tab content */}
        <div className="space-y-4">
          {currentTab.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{currentTab.description}</p>
          )}
          {tabFields.map(field => renderField(field))}
        </div>
      </div>
    );
  };
  
  // Main render
  return (
    <div className="object-field">
      {/* Content */}
      <div className={options.animations?.enabled ? 'transition-all duration-200' : ''}>
        {renderContent()}
      </div>
      
      {/* Required fields warning */}
      {/* {metadata.missingRequiredFields.length > 0 && (
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-amber-400 mt-0.5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 19c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="text-sm font-medium !text-amber-800 dark:!text-amber-200">
                Required fields missing
              </p>
              <p className="text-sm !text-amber-700 dark:!text-amber-300 mt-1">
                {metadata.missingRequiredFields.map(fieldName => {
                  const errorFieldsArray = Array.isArray(objectDefinition.fields) 
                    ? objectDefinition.fields 
                    : Object.entries(objectDefinition.fields || {}).map(([name, field]: [string, any]) => ({ name, ...field }));
                  const field = errorFieldsArray.find(f => f.name === fieldName);
                  return field?.title || fieldName;
                }).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )} */}
    </div>
  );
}