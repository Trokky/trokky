import { useState, useCallback, useMemo, useEffect } from 'react';
import { useT } from '@trokky/trokky/i18n';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import { FieldWrapper } from '../../components/FieldWrapper.js';
import type {
  ObjectFieldDefinition,
  NestedFieldDefinition,
  ObjectOperations
} from './definition.js';
import {
  getObjectMetadata,
  evaluateConditional,
  getDefaultObjectValue,
  sanitizeObjectValue,
  isFieldReadOnly,
  renderTemplate
} from './validation.js';
import { fieldRegistry } from '../../registry/FieldRegistry.js';
import { getOrderedFields } from './definition.js';
import { ObjectModal } from './ObjectModal.js';

// ObjectField component props
type ObjectFieldComponentProps = FieldComponentProps;

export function ObjectFieldComponent(props: ObjectFieldComponentProps) {
  const { t } = useT('fields');
  const { definition, value, onChange, hasError, fieldId, isDisabled, isReadonly } = props;

  // Type guard for object field definition
  if (definition.type !== 'object') {
    return <div className="text-red-500 text-sm">{t('types.object.invalidConfig')}</div>;
  }
  
  const objectDefinition = definition as ObjectFieldDefinition;
  const options = objectDefinition.options || {};

  // Ensure value is always an object and selectively sanitized
  const objectValue = useMemo(() => {
    // If not an object, return empty object
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    // Selectively sanitize: preserve richtext fields, sanitize others
    const sanitized: Record<string, any> = {};
    const dangerousProps = ['__proto__', 'constructor', 'prototype'];

    for (const [key, val] of Object.entries(value)) {
      // Skip dangerous properties
      if (dangerousProps.includes(key)) {
        continue;
      }

      // Validate key format
      if (typeof key !== 'string' || key.length > 100 || !/^[a-zA-Z0-9_-]+$/.test(key)) {
        continue;
      }

      // Check if this field is a richtext field
      const fieldDef = objectDefinition.fields?.[key];
      const isRichtext = fieldDef?.type === 'richtext';

      // Preserve richtext field values as-is (they're already sanitized by RichTextField)
      // Sanitize other string fields to prevent XSS
      if (isRichtext || typeof val !== 'string') {
        sanitized[key] = val;
      } else {
        // Basic XSS prevention for non-richtext string fields
        sanitized[key] = val
          .replace(/javascript:/gi, '')
          .replace(/data:/gi, '')
          .slice(0, 10000);
      }
    }

    return sanitized;
  }, [value, objectDefinition.fields]);
  
  // Local state for UI interactions
  const [collapseState, setCollapseState] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Detect nesting level from documentContext (0 = top-level, 1+ = nested)
  const nestingLevel = (props.documentContext as any)?.nestingLevel ?? 0;
  const isTopLevel = nestingLevel === 0;
  
  // Initialize active tab
  useEffect(() => {
    if (options.layout === 'tabs' && options.tabs && options.tabs.length > 0 && !activeTab) {
      setActiveTab(options.tabs[0].title);
    }
  }, [options.layout, options.tabs, activeTab]);
  
  // Get field-specific collapse state
  const getCollapseState = (key: string): boolean => {
    // Default to collapsed for nested objects (better UX for arrays)
    // User can set options.collapsed = false to start expanded
    const defaultCollapsed = options.collapsed ?? true;
    return collapseState[`${fieldId}.${key}`] ?? defaultCollapsed;
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

      // Selectively sanitize: preserve richtext fields, sanitize others
      const sanitized: Record<string, any> = {};
      for (const [key, val] of Object.entries(newValue)) {
        const fieldDef = objectDefinition.fields?.[key];
        const isRichtext = fieldDef?.type === 'richtext';

        // Preserve richtext field values as-is (they're already sanitized by RichTextField)
        // Sanitize other string fields to prevent XSS
        if (isRichtext || typeof val !== 'string') {
          sanitized[key] = val;
        } else {
          // Basic XSS prevention for non-richtext string fields
          sanitized[key] = val
            .replace(/javascript:/gi, '')
            .replace(/data:/gi, '')
            .slice(0, 10000);
        }
      }

      onChange(sanitized);
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
    
    getFieldNames: () => Object.keys(objectDefinition.fields || {}),
    
    getFieldDefinition: (fieldName: string) => {
      const field = objectDefinition.fields?.[fieldName];
      return field ? { name: fieldName, ...field } : undefined;
    }
  }), [objectValue, objectDefinition, onChange]);
  
  // Get ordered fields and filter visible ones based on conditional logic
  const visibleFields = useMemo(() => {
    const orderedFields = getOrderedFields(objectDefinition);
    
    return orderedFields.filter(({ name, definition: fieldDef }) => {
      const conditionalResult = evaluateConditional(
        { 
          name, 
          conditional: fieldDef.conditional,
          hidden: fieldDef.hidden 
        }, 
        objectValue
      );
      return conditionalResult.visible;
    });
  }, [objectDefinition, objectValue]);
  
  // Render individual field
  const renderField = useCallback((fieldName: string, fieldDef: NestedFieldDefinition, className: string = '') => {
    const fieldPlugin = fieldRegistry.get(fieldDef.type);
    if (!fieldPlugin) {
      return (
        <div key={fieldName} className={`space-y-2 ${className}`}>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {fieldDef.title}
            {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md">
            {t('types.object.fieldNotRegistered', { type: fieldDef.type })}
          </div>
        </div>
      );
    }

    const FieldComponent = fieldPlugin.component;
    const fieldValue = objectValue[fieldName];
    const fieldHasError = !!fieldErrors[fieldName];
    const fieldIsReadOnly = isFieldReadOnly(fieldDef, objectValue, isReadonly);

    // Use FieldWrapper for consistent rendering with hideLabel support
    return (
      <FieldWrapper
        key={fieldName}
        fieldId={`${fieldId}.${fieldName}`}
        definition={fieldDef as any}
        hasError={fieldHasError}
        error={fieldErrors[fieldName]}
        validationState={undefined}
      >
        <FieldComponent
          fieldId={`${fieldId}.${fieldName}`}
          value={fieldValue}
          onChange={(newValue: any) => operations.updateField(fieldName, newValue)}
          definition={fieldDef as any}
          hasError={fieldHasError}
          isDisabled={isDisabled}
          isReadonly={fieldIsReadOnly}
          documentContext={props.documentContext ? {
            ...props.documentContext,
            nestingLevel: nestingLevel + 1  // Increment nesting level for child fields
          } : undefined}
          studioContext={props.studioContext}
          onValidationChange={(result) => {
            // Handle nested field validation
            if (!result.isValid) {
              setFieldErrors(prev => ({ ...prev, [fieldName]: result.errors[0] || 'Validation failed' }));
            } else {
              setFieldErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[fieldName];
                return newErrors;
              });
            }
          }}
          onFocus={() => {}}
          onBlur={() => {}}
        />
      </FieldWrapper>
    );
  }, [objectValue, fieldErrors, operations, fieldId, isDisabled, isReadonly]);
  
  // Get dynamic title based on titleTemplate or fallback to definition.title
  const getDisplayTitle = useCallback(() => {
    if (options.titleTemplate) {
      return renderTemplate(options.titleTemplate, {
        values: objectValue,
        fields: objectDefinition.fields,
        metadata
      });
    }
    return definition.title;
  }, [options.titleTemplate, objectValue, objectDefinition.fields, metadata, definition.title]);

  // Render object header with progress
  const renderHeader = () => {
    const isCollapsible = options.collapsible !== false; // Default to true
    const isCollapsed = getCollapseState('main');
    // Only use dynamic title if explicitly configured via titleTemplate
    const displayTitle = options.titleTemplate ? getDisplayTitle() : definition.title;

    // Get array item preview if passed from ArrayField
    const arrayItemPreview = (definition as any)._arrayItemPreview;
    const previewTitle = arrayItemPreview?.title;
    const previewSubtitle = arrayItemPreview?.subtitle;

    return (
      <div className={`flex items-center justify-between ${isCollapsed ? '' : 'mb-4'}`}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Title with collapse toggle */}
          {isCollapsible ? (
            <button
              type="button"
              onClick={() => setCollapseStateForKey('main', !isCollapsed)}
              className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors min-w-0"
            >
              <svg
                className={`w-4 h-4 mr-2 flex-shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {/* Show preview title if available, otherwise show definition title */}
              {previewTitle ? (
                <span className="truncate">{previewTitle}</span>
              ) : (
                displayTitle
              )}
            </button>
          ) : (
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {previewTitle || displayTitle}
            </h3>
          )}

          {/* Preview subtitle */}
          {previewSubtitle && isCollapsed && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:inline">
              {previewSubtitle}
            </span>
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
      </div>
    );
  };
  
  // Render main content based on layout
  const renderMainContent = () => {
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
        {visibleFields.map(field => renderField(field.name, field.definition))}
      </div>
    );
  };
  
  // Columns layout - responsive grid
  const renderColumnsLayout = () => {
    const cols = typeof options.columns === 'object' ? options.columns : { md: options.columns || 1 };
    
    // Use static Tailwind classes based on column values
    const getGridClass = () => {
      const classes = ['grid', 'gap-4', 'grid-cols-1'];
      
      // Map column numbers to static Tailwind classes
      if (cols.md === 2) classes.push('md:grid-cols-2');
      else if (cols.md === 3) classes.push('md:grid-cols-3');
      else if (cols.md === 4) classes.push('md:grid-cols-4');
      else classes.push('md:grid-cols-1');
      
      if (cols.lg === 2) classes.push('lg:grid-cols-2');
      else if (cols.lg === 3) classes.push('lg:grid-cols-3');
      else if (cols.lg === 4) classes.push('lg:grid-cols-4');
      else if (!cols.lg) classes.push('lg:grid-cols-2');
      
      if (cols.xl === 2) classes.push('xl:grid-cols-2');
      else if (cols.xl === 3) classes.push('xl:grid-cols-3');
      else if (cols.xl === 4) classes.push('xl:grid-cols-4');
      else if (!cols.xl) classes.push('xl:grid-cols-2');
      
      return classes.join(' ');
    };
    
    return (
      <div className={getGridClass()}>
        {visibleFields.map(field => renderField(field.name, field.definition))}
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
          {visibleFields.map(field => renderField(field.name, field.definition))}
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
                  {sectionFields.map(field => renderField(field.name, field.definition))}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Ungrouped fields */}
        {ungroupedFields.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2">
              {t('types.object.otherFields')}
            </h4>
            {ungroupedFields.map(field => renderField(field.name, field.definition))}
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
      currentTab.fields.includes(field.name)
    );
    
    return (
      <div className="space-y-4">
        {/* Tab navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8">
            {options.tabs.map(tab => {
              const tabFieldCount = visibleFields.filter(field => 
                tab.fields.includes(field.name)
              ).length;
              const filledTabFields = visibleFields.filter(field => 
                tab.fields.includes(field.name) && operations.hasField(field.name)
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
          {tabFields.map(field => renderField(field.name, field.definition))}
        </div>
      </div>
    );
  };
  
  // Render top-level collapsed card (clickable to open modal)
  const renderTopLevelCard = () => {
    // Ensure we get numeric counts, not arrays or objects
    const filledCount = typeof metadata.filledFields === 'number'
      ? metadata.filledFields
      : (Array.isArray(metadata.filledFields) ? metadata.filledFields.length : 0);
    const totalCount = typeof metadata.visibleFields === 'number'
      ? metadata.visibleFields
      : (Array.isArray(metadata.visibleFields) ? metadata.visibleFields.length : 0);

    return (
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        disabled={isDisabled || isReadonly}
        className={`
          w-full text-left
          border rounded-md p-4
          transition-colors cursor-pointer
          ${isModalOpen
            ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : hasError
              ? 'border-red-300 dark:border-red-600'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }
          ${isDisabled || isReadonly ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              className="w-5 h-5 text-gray-400 dark:text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                {definition.title}
              </h3>
              {definition.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {definition.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{filledCount}/{totalCount} {t('types.object.fields')}</span>
          </div>
        </div>
      </button>
    );
  };

  // Main render
  const wrapperClasses = useMemo(() => {
    const classes = ['object-field'];
    
    // Add subtle border for better visual distinction (like ArrayField)
    if (options.layout !== 'inline') {
      classes.push('border border-gray-200 dark:border-gray-700');
      classes.push('rounded-lg');
      classes.push('p-4');
      
      if (!isDisabled && !isReadonly) {
        classes.push('hover:border-gray-300 dark:hover:border-gray-600');
        classes.push('transition-colors');
      }
    }
    
    // Add error state
    if (hasError) {
      classes.push('border-red-300 dark:border-red-600');
    }
    
    return classes.join(' ');
  }, [options.layout, isDisabled, isReadonly, hasError]);
  
  // Conditional render based on nesting level
  if (isTopLevel) {
    // Top-level: Show collapsed card + modal
    return (
      <>
        {renderTopLevelCard()}

        <ObjectModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          definition={objectDefinition}
          value={objectValue}
          onChange={onChange}
          fieldId={fieldId}
          isDisabled={isDisabled}
          isReadonly={isReadonly}
          studioContext={props.studioContext}
          documentContext={props.documentContext ? {
            ...props.documentContext,
            nestingLevel: nestingLevel + 1
          } : undefined}
          visibleFields={visibleFields}
          renderField={renderField}
        />
      </>
    );
  }

  // Nested level 1+: Show traditional accordion behavior
  return (
    <div className={wrapperClasses}>
      {/* Always render header for collapsible functionality */}
      {renderHeader()}

      {/* Content - only show when not collapsed */}
      {!getCollapseState('main') && (
        <div className={options.animations?.enabled ? 'transition-all duration-200' : ''}>
          {renderMainContent()}
        </div>
      )}

      {/* Preview when collapsed - DISABLED for now to debug concatenation issue */}
      {/* {getCollapseState('main') && renderPreview()} */}
    </div>
  );
}