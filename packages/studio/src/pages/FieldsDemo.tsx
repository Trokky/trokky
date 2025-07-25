/**
 * Fields Demo Page - Interactive Reference
 * Clean field reference with sidebar navigation and context panel integration
 */

import { useState } from 'react';
import { FieldRenderer, fieldRegistry, type StringFieldDefinition, type TextareaFieldDefinition } from '@trokky/fields';

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

// Sample field configurations
const FIELD_DEMOS: FieldDemo[] = [
  {
    id: 'string-basic',
    name: 'String Field',
    type: 'string',
    category: 'Text Fields',
    description: 'Single-line text input for short content like titles, names, and labels.',
    definition: {
      type: 'string',
      title: 'String Field',
      description: 'Basic text input',
      options: { placeholder: 'Enter text...' }
    } as StringFieldDefinition,
    initialValue: 'Hello World!',
    invalidValue: '',
    examples: [
      { name: 'Title', value: 'My Blog Post Title', description: 'Article title' },
      { name: 'Name', value: 'John Doe', description: 'Person name' },
      { name: 'Label', value: 'Important', description: 'Category label' }
    ]
  },
  {
    id: 'string-email',
    name: 'Email Field',
    type: 'string',
    category: 'Text Fields',
    description: 'Email input with built-in validation and clickable preview.',
    definition: {
      type: 'string',
      title: 'Email Field',
      description: 'Email with validation',
      required: true,
      options: { inputType: 'email', placeholder: 'user@example.com' },
      validation: { email: true }
    } as StringFieldDefinition,
    initialValue: 'user@example.com',
    invalidValue: 'invalid-email',
    examples: [
      { name: 'Personal', value: 'john@gmail.com', description: 'Personal email' },
      { name: 'Business', value: 'contact@company.com', description: 'Business email' }
    ]
  },
  {
    id: 'string-url',
    name: 'URL Field',
    type: 'string',
    category: 'Text Fields',
    description: 'URL input with validation and clickable link preview.',
    definition: {
      type: 'string',
      title: 'URL Field',
      description: 'URL with validation',
      options: { inputType: 'url', placeholder: 'https://example.com' },
      validation: { url: true }
    } as StringFieldDefinition,
    initialValue: 'https://example.com',
    invalidValue: 'not-a-url',
    examples: [
      { name: 'Website', value: 'https://mysite.com', description: 'Company website' },
      { name: 'GitHub', value: 'https://github.com/user/repo', description: 'Repository' }
    ]
  },
  {
    id: 'textarea-basic',
    name: 'Textarea Field',
    type: 'text',
    category: 'Text Fields',
    description: 'Multi-line text input for longer content with auto-resize.',
    definition: {
      type: 'text',
      title: 'Textarea Field',
      description: 'Multi-line text input',
      options: { rows: 4, autoResize: true, placeholder: 'Write your content...' },
      validation: { maxLength: 500, wordCount: { max: 100 } }
    } as TextareaFieldDefinition,
    initialValue: 'This is a longer text\\nthat spans multiple lines\\nand shows how textarea works.',
    invalidValue: 'A'.repeat(501),
    examples: [
      { name: 'Description', value: 'This is a detailed description\\nof the product features.', description: 'Product description' },
      { name: 'Notes', value: 'Meeting notes:\\n- Discussed new features\\n- Set deadlines', description: 'Meeting notes' }
    ]
  }
];

export function FieldsDemo() {
  const [selectedFieldId, setSelectedFieldId] = useState<string>('string-basic');
  const [fieldValues, setFieldValues] = useState<Record<string, any>>(() => {
    const initialValues: Record<string, any> = {};
    FIELD_DEMOS.forEach(demo => {
      initialValues[demo.id] = demo.initialValue;
    });
    return initialValues;
  });
  const [showErrors, setShowErrors] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  // Get current field demo
  const currentField = FIELD_DEMOS.find(field => field.id === selectedFieldId) || FIELD_DEMOS[0];
  
  // Group fields by category
  const fieldsByCategory = FIELD_DEMOS.reduce((acc, field) => {
    if (!acc[field.category]) acc[field.category] = [];
    acc[field.category].push(field);
    return acc;
  }, {} as Record<string, FieldDemo[]>);

  // Update field value
  const updateFieldValue = (fieldId: string, value: any) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
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
            UPDATED+ field documentation with watch mode
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
                        mode="edit"
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