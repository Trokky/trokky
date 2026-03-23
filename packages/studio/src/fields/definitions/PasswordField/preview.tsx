import React from 'react';
import { StringFieldPreview } from '../StringField/preview.js';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { PasswordFieldDefinition } from './definition.js';

// Password field preview props
type PasswordFieldPreviewProps = FieldComponentProps;

export function PasswordFieldPreview(props: PasswordFieldPreviewProps) {
  const { value, definition } = props;
  const passwordDefinition = definition as PasswordFieldDefinition;
  
  if (!value || typeof value !== 'string') {
    return (
      <StringFieldPreview 
        {...props} 
        definition={passwordDefinition}
      />
    );
  }
  
  // For security, never show actual password in preview
  // Instead show masked dots based on password length
  const maskedPassword = '•'.repeat(Math.min(value.length, 12)); // Cap display at 12 dots
  
  return (
    <span className="font-mono text-gray-700 dark:text-gray-300 tracking-wider">
      {maskedPassword}
    </span>
  );
}