/**
 * Email Field Definition
 * Extends StringField with email-specific validation and options
 */

import type { StringFieldDefinition, StringValidation, StringFieldOptions } from '../StringField/definition.js';

// Email-specific validation extends string validation
export interface EmailValidation extends StringValidation {
  email: true; // Always required for email fields
}

// Email-specific options extend string options
export interface EmailFieldOptions extends StringFieldOptions {
  inputType: 'email'; // Always email type
  placeholder?: string; // Default: 'Enter email address'
  autoComplete?: 'email' | 'username'; // Email-specific autocomplete
}

// Email field definition extends string field
export interface EmailFieldDefinition extends Omit<StringFieldDefinition, 'type' | 'validation' | 'options'> {
  type: 'email';
  validation?: EmailValidation;
  options?: EmailFieldOptions;
}

// Default configuration for email fields
export const EMAIL_FIELD_DEFAULTS: Partial<EmailFieldDefinition> = {
  type: 'email',
  title: 'Email',
  description: 'Email address',
  required: false,
  validation: {
    email: true
  },
  options: {
    inputType: 'email',
    placeholder: 'Enter email address',
    autoComplete: 'email'
  }
};