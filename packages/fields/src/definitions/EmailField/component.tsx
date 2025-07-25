/**
 * Email Field Component
 * Extends StringField component with email-specific features
 */

import React from 'react';
import { StringFieldComponent } from '../StringField/component.js';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { EmailFieldDefinition } from './definition.js';

// Email field component props
type EmailFieldComponentProps = FieldComponentProps;

export function EmailFieldComponent(props: EmailFieldComponentProps) {
  const { definition } = props;
  
  // Ensure email-specific properties are set
  const emailDefinition = definition as EmailFieldDefinition;
  const enhancedDefinition = {
    ...emailDefinition,
    options: {
      inputType: 'email' as const,
      placeholder: 'Enter email address',
      autoComplete: 'email',
      spellCheck: false, // Disable spellcheck for emails
      ...emailDefinition.options
    }
  };

  // Use StringField component with email-specific configuration
  return (
    <StringFieldComponent
      {...props}
      definition={enhancedDefinition}
    />
  );
}