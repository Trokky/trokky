import type { StringFieldDefinition } from '../StringField/definition.js';

export interface URLFieldDefinition extends Omit<StringFieldDefinition, 'type' | 'validation' | 'options'> {
  type: 'url';
  
  /** URL-specific validation options */
  validation?: {
    /** Whether the field is required */
    required?: boolean;
    /** Custom validation error message */
    message?: string;
    /** Allowed URL protocols (default: ['http', 'https']) */
    protocols?: string[];
    /** Whether to require HTTPS */
    requireHttps?: boolean;
  };
  
  /** URL field options */
  options?: {
    /** Placeholder text */
    placeholder?: string;
    /** Open in new tab when previewing */
    openInNewTab?: boolean;
  };
}

export interface URLValidation {
  required?: boolean;
  message?: string;
  protocols?: string[];
  requireHttps?: boolean;
}

export interface URLFieldOptions {
  placeholder?: string;
  openInNewTab?: boolean;
}

export const URL_FIELD_DEFAULTS: Partial<URLFieldDefinition> = {
  type: 'url',
  defaultValue: '',
  validation: {
    required: false,
    protocols: ['http:', 'https:'],
    requireHttps: false
  },
  options: {
    placeholder: 'https://example.com',
    openInNewTab: true
  }
};