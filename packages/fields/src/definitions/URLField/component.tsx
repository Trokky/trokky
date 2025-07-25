import React from 'react';
import { StringFieldComponent } from '../StringField/component.js';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { URLFieldDefinition } from './definition.js';

// URL field component props
type URLFieldComponentProps = FieldComponentProps;

export function URLFieldComponent(props: URLFieldComponentProps) {
  const { definition } = props;
  
  // Ensure URL-specific properties are set
  const urlDefinition = definition as URLFieldDefinition;
  const enhancedDefinition = {
    ...urlDefinition,
    options: {
      inputType: 'url' as const,
      placeholder: 'https://example.com',
      autoComplete: 'url',
      spellCheck: false, // Disable spellcheck for URLs
      ...urlDefinition.options
    }
  };

  // Use StringField component with URL-specific configuration
  return (
    <StringFieldComponent
      {...props}
      definition={enhancedDefinition}
    />
  );
}