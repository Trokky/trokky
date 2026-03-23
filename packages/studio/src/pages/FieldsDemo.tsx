/**
 * Fields Demo Page - Interactive Reference
 * Clean field reference with sidebar navigation and context panel integration
 */

import { useState, useMemo, useEffect } from 'react';
import { FieldRenderer, fieldRegistry } from '../fields/index';
import type { ValidationResult } from '../fields/index';
import { useStudioContext } from '@/contexts/StudioContext';

// Field demo configuration
interface FieldDemo {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string;
  definition: any;
  initialValue: any;
  invalidValue?: any;
  examples: { name: string; value: any; description: string; }[];
}

// Helper function to generate field demos from fieldRegistry
function generateFieldDemos(): FieldDemo[] {
  const plugins = fieldRegistry.getAll();
  const demos: FieldDemo[] = [];
  
  plugins.forEach(plugin => {
    if (!plugin.demoConfig) return;
    
    // Create a demo for each variant
    plugin.demoConfig.variants.forEach((variant, index) => {
      const id = `${plugin.type}-${index}`;
      const demo: FieldDemo = {
        id,
        name: variant.name,
        type: plugin.type,
        category: getCategoryDisplayName(plugin.category),
        description: plugin.description,
        definition: variant.definition,
        initialValue: plugin.getDefaultValue(variant.definition),
        invalidValue: plugin.demoConfig?.invalidValue,
        examples: plugin.demoConfig?.examples || []
      };
      demos.push(demo);
    });
  });

  return demos;
}

// Helper to convert field category to display name
function getCategoryDisplayName(category: string): string {
  const categoryMap: Record<string, string> = {
    'text': 'Text Fields',
    'number': 'Number Fields',
    'boolean': 'Boolean Fields',
    'date': 'Date Fields',
    'media': 'Media Fields',
    'reference': 'Reference Fields',
    'structure': 'Structure Fields',
    'custom': 'Custom Fields'
  };
  return categoryMap[category] || category;
}

export function FieldsDemo() {
  // Get Studio context for field access to Studio capabilities
  const studioContext = useStudioContext();
  
  // Generate field demos from registry
  const FIELD_DEMOS = useMemo(() => generateFieldDemos(), []);
  
  const [selectedFieldId, setSelectedFieldId] = useState<string>(() => 
    FIELD_DEMOS.length > 0 ? FIELD_DEMOS[0].id : ''
  );
  const [fieldValues, setFieldValues] = useState<Record<string, any>>(() => {
    const initialValues: Record<string, any> = {};
    FIELD_DEMOS.forEach(demo => {
      initialValues[demo.id] = demo.initialValue;
    });
    return initialValues;
  });
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  // Get current field demo
  const currentField = FIELD_DEMOS.find(field => field.id === selectedFieldId) || FIELD_DEMOS[0];

  // Run initial validation for all fields
  useEffect(() => {
    FIELD_DEMOS.forEach(demo => {
      const value = fieldValues[demo.id];
      if (value !== undefined) {
        validateField(demo.id, value);
      }
    });
  }, [FIELD_DEMOS]); // Only depend on FIELD_DEMOS to avoid infinite loops

  // Handle case where no field demos are available
  if (!currentField || FIELD_DEMOS.length === 0) {
    return (
      <div className="flex h-full bg-gray-50 dark:bg-gray-900 items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Field Demos Available</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Register field plugins with demoConfig to see them here.
          </p>
        </div>
      </div>
    );
  }
  
  // Group fields by category
  const fieldsByCategory = useMemo(() => {
    return FIELD_DEMOS.reduce((acc, field) => {
      if (!acc[field.category]) acc[field.category] = [];
      acc[field.category].push(field);
      return acc;
    }, {} as Record<string, FieldDemo[]>);
  }, [FIELD_DEMOS]);

  // Validate a field value
  const validateField = (fieldId: string, value: any) => {
    const demo = FIELD_DEMOS.find(d => d.id === fieldId);
    if (!demo) return;
    
    const plugin = fieldRegistry.get(demo.type);
    if (!plugin) return;
    
    const result = plugin.validate(value, demo.definition);
    setValidationResults(prev => ({ ...prev, [fieldId]: result }));
  };

  // Update field value and run validation
  const updateFieldValue = (fieldId: string, value: any) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
    validateField(fieldId, value);
  };

  // Toggle error demonstration
  const toggleErrors = () => {
    setShowErrors(!showErrors);
    if (!showErrors && currentField.invalidValue !== undefined) {
      updateFieldValue(currentField.id, currentField.invalidValue);
    } else {
      updateFieldValue(currentField.id, currentField.initialValue);
    }
  };


  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      
      {/* Left Sidebar - Navigation */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Fields Reference</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Auto-generated from field plugin registry
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {Object.entries(fieldsByCategory).map(([category, fields]) => (
            <div key={category} className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {fields.map(field => (
                  <button
                    key={field.id}
                    onClick={() => setSelectedFieldId(field.id)}
                    className={`w-full text-left px-3 py-3 rounded-lg text-sm transition-colors ${
                      selectedFieldId === field.id
                        ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="font-medium">{field.name}</div>
                    <div className="text-xs opacity-75 mt-1">type: '{field.type}'</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentField.name}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1 mb-4">
              {currentField.description}
            </p>
            <div className="flex items-center space-x-3">
              <button
                onClick={toggleErrors}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showErrors
                    ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {showErrors ? 'Hide Errors' : 'Show Errors'}
              </button>
              <span className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900 px-3 py-1.5 rounded">
                type: '{currentField.type}'
              </span>
            </div>
          </div>
        </div>

        {/* Demo Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* Interactive Demo */}
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
              <div className="border-b border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Interactive Demo</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Switch between edit and preview modes
                    </p>
                  </div>
                  
                  {/* Tab Controls */}
                  <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 p-1">
                    <button
                      onClick={() => setActiveTab('edit')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === 'edit'
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        <span>Edit</span>
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveTab('preview')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === 'preview'
                          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <span className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        <span>Preview</span>
                      </span>
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-4">
                {/* Tab Content */}
                <div>
                  {activeTab === 'edit' ? (
                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-900">
                      <FieldRenderer
                        fieldId={`${currentField.id}-demo`}
                        value={fieldValues[currentField.id] || ''}
                        onChange={(value) => updateFieldValue(currentField.id, value)}
                        definition={currentField.definition}
                        hasError={validationResults[currentField.id] && !validationResults[currentField.id].isValid}
                        error={validationResults[currentField.id]?.errors?.[0]}
                        validationState={validationResults[currentField.id] ? {
                          isValidating: false,
                          lastValidatedValue: fieldValues[currentField.id]
                        } : undefined}
                        mode="edit"
                        studioContext={studioContext || undefined}
                      />
                    </div>
                  ) : (
                    <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-900 min-h-[80px] flex items-center">
                      <FieldRenderer
                        fieldId={`${currentField.id}-preview`}
                        value={fieldValues[currentField.id] || ''}
                        onChange={() => {}}
                        definition={currentField.definition}
                        mode="preview"
                        studioContext={studioContext || undefined}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>


          </div>
        </div>
      </div>

    </div>
  );
}