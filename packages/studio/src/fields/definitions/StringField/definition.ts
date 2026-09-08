/**
 * String Field Definition
 * Based on proven legacy architecture from Trokky v1
 */

import type { BaseFieldDefinition, BaseValidation, BaseFieldOptions } from '../../base/FieldDefinition.js';

// String field specific validation
export interface StringValidation extends BaseValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string | RegExp;
  email?: boolean;
  url?: boolean;
}

// List option for dropdown/select
export interface StringListOption {
  title: string;
  value: string;
}

// String field specific options
export interface StringFieldOptions extends BaseFieldOptions {
  inputType?: 'text' | 'email' | 'url' | 'tel' | 'password';
  multiline?: boolean;
  rows?: number;
  autoComplete?: string;
  spellCheck?: boolean;
  transform?: 'lowercase' | 'uppercase' | 'capitalize';
  size?: 'sm' | 'md' | 'lg';
  list?: StringListOption[] | string[];  // Sanity-style list for dropdown
}

// String field definition
export interface StringFieldDefinition extends BaseFieldDefinition {
  type: 'string';
  validation?: StringValidation;
  options?: StringFieldOptions;
  defaultValue?: string;
}

// Default string field configuration
export const STRING_FIELD_DEFAULTS: Partial<StringFieldDefinition> = {
  type: 'string',
  required: false,
  options: {
    inputType: 'text',
    multiline: false,
    spellCheck: true,
    layout: 'default',
    width: 'full'
  },
  validation: {},
  defaultValue: ''
};