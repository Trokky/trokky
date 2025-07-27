import React from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { ReferenceFieldDefinition, ReferenceValue } from './definition.js';
import { normalizeReferenceValue, getReferenceDisplayValue } from './validation.js';

type ReferenceFieldPreviewProps = FieldComponentProps;

export function ReferenceFieldPreview(props: ReferenceFieldPreviewProps) {
  const { definition, value } = props;
  
  if (definition.type !== 'reference') {
    return <span className="text-red-500 text-sm">Invalid field type</span>;
  }
  
  const referenceDefinition = definition as ReferenceFieldDefinition;
  const options = referenceDefinition.options || {};
  const validation = referenceDefinition.validation || {};
  
  const references = normalizeReferenceValue(value);
  
  if (references.length === 0) {
    return (
      <span className="text-gray-400 dark:text-gray-500 text-sm italic">
        No references
      </span>
    );
  }
  
  // For single reference
  if (!validation.multiple && references.length === 1) {
    const ref = references[0];
    const displayValue = getReferenceDisplayValue(ref, options.displayField);
    
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {displayValue}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
          {ref._type}
        </span>
      </div>
    );
  }
  
  // For multiple references
  const displayLimit = 3;
  const visibleReferences = references.slice(0, displayLimit);
  const remainingCount = Math.max(0, references.length - displayLimit);
  
  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleReferences.map((ref, index) => {
        const displayValue = getReferenceDisplayValue(ref, options.displayField);
        
        return (
          <span
            key={ref._ref}
            className="inline-flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded"
          >
            {displayValue}
            <span className="text-blue-500 dark:text-blue-400">
              ({ref._type})
            </span>
          </span>
        );
      })}
      
      {remainingCount > 0 && (
        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
          +{remainingCount} more
        </span>
      )}
      
      {options.showCount && (
        <span className="text-xs text-gray-400 dark:text-gray-500 ml-1">
          ({references.length} total)
        </span>
      )}
    </div>
  );
}