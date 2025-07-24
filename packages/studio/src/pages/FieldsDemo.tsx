/**
 * Fields Demo Page
 * Simple page to test and demo the new @trokky/fields system
 */

import { useState } from 'react';
import { FieldRenderer, fieldRegistry, type StringFieldDefinition } from '@trokky/fields';

export function FieldsDemo() {
  const [stringValue, setStringValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [multilineValue, setMultilineValue] = useState('');

  // Example field definitions
  const basicStringField: StringFieldDefinition = {
    type: 'string',
    title: 'Basic String Field',
    description: 'A simple text input field',
    required: false,
    options: {
      placeholder: 'Enter some text...'
    }
  };

  const emailField: StringFieldDefinition = {
    type: 'string',
    title: 'Email Field',
    description: 'Email input with validation',
    required: true,
    options: {
      inputType: 'email',
      placeholder: 'your@email.com'
    },
    validation: {
      email: true
    }
  };

  const multilineField: StringFieldDefinition = {
    type: 'string',
    title: 'Multiline Text',
    description: 'A textarea for longer text',
    options: {
      multiline: true,
      rows: 4,
      placeholder: 'Write something longer...'
    },
    validation: {
      maxLength: 500
    }
  };

  // Check field registry status
  const registryStats = fieldRegistry.getStats();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Fields Demo</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Testing the new @trokky/fields system with live examples
        </p>
      </div>

      {/* Registry Status */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-2">Registry Status</h2>
        <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <p>Total registered fields: {registryStats.total}</p>
          <p>Initialized: {registryStats.initialized ? 'Yes' : 'No'}</p>
          <p>Available types: {fieldRegistry.getTypes().join(', ')}</p>
        </div>
      </div>

      {/* Field Examples */}
      <div className="space-y-8">
        
        {/* Basic String Field */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Basic String Field</h3>
          <FieldRenderer
            fieldId="basic-string"
            value={stringValue}
            onChange={setStringValue}
            definition={basicStringField}
          />
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Current value: <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">{JSON.stringify(stringValue)}</code>
          </div>
        </div>

        {/* Email Field */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Email Field</h3>
          <FieldRenderer
            fieldId="email-field"
            value={emailValue}
            onChange={setEmailValue}
            definition={emailField}
          />
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Current value: <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">{JSON.stringify(emailValue)}</code>
          </div>
        </div>

        {/* Multiline Field */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Multiline Text Field</h3>
          <FieldRenderer
            fieldId="multiline-field"
            value={multilineValue}
            onChange={setMultilineValue}
            definition={multilineField}
          />
          <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Current value: <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">{JSON.stringify(multilineValue)}</code>
          </div>
        </div>

        {/* All Values Summary */}
        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">All Values</h3>
          <pre className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 p-4 rounded border border-gray-200 dark:border-gray-600 overflow-auto">
{JSON.stringify({
  basicString: stringValue,
  email: emailValue,
  multiline: multilineValue
}, null, 2)}
          </pre>
        </div>

      </div>
    </div>
  );
}