/**
 * Textarea Field Definition
 * Multi-line text input field (Sanity-style 'text' type)
 */

import type { BaseFieldDefinition, BaseValidation, BaseFieldOptions } from '../../base/FieldDefinition.js';

// Textarea field specific validation (similar to string but for longer text)
export interface TextareaValidation extends BaseValidation {
  minLength?: number;
  maxLength?: number;
  wordCount?: { min?: number; max?: number };
  lineCount?: { min?: number; max?: number };
}

// Textarea field specific options
export interface TextareaFieldOptions extends BaseFieldOptions {
  rows?: number;
  minRows?: number;
  maxRows?: number;
  autoResize?: boolean;
  autoComplete?: string;
  spellCheck?: boolean;
  wrap?: 'soft' | 'hard' | 'off';
  size?: 'sm' | 'md' | 'lg';
}

// Textarea field definition
export interface TextareaFieldDefinition extends BaseFieldDefinition {
  type: 'text';
  validation?: TextareaValidation;
  options?: TextareaFieldOptions;
  defaultValue?: string;
}

// Default textarea field configuration
export const TEXTAREA_FIELD_DEFAULTS: Partial<TextareaFieldDefinition> = {
  type: 'text',
  required: false,
  options: {
    rows: 4,
    minRows: 2,
    autoResize: true,
    spellCheck: true,
    wrap: 'soft',
    layout: 'default',
    width: 'full'
  },
  validation: {},
  defaultValue: ''
};