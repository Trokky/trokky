import type { StringFieldDefinition } from '../StringField/definition.js';

export interface PasswordFieldDefinition extends Omit<StringFieldDefinition, 'type' | 'validation' | 'options'> {
  type: 'password';
  
  /** Password-specific validation options */
  validation?: {
    /** Whether the field is required */
    required?: boolean;
    /** Custom validation error message */
    message?: string;
    /** Minimum password length */
    minLength?: number;
    /** Maximum password length */
    maxLength?: number;
    /** Require uppercase letters */
    requireUppercase?: boolean;
    /** Require lowercase letters */
    requireLowercase?: boolean;
    /** Require numbers */
    requireNumbers?: boolean;
    /** Require special characters */
    requireSpecialChars?: boolean;
    /** Custom regex pattern */
    pattern?: string;
  };
  
  /** Password field options */
  options?: {
    /** Placeholder text */
    placeholder?: string;
    /** Show password strength indicator */
    showStrength?: boolean;
    /** Allow password visibility toggle */
    allowToggle?: boolean;
    /** Disable autocomplete (default: true) */
    disableAutocomplete?: boolean;
    /** Show password generator button */
    showGenerator?: boolean;
    /** Password generator settings */
    generator?: {
      /** Default length for generated passwords */
      length?: number;
      /** Include uppercase letters */
      includeUppercase?: boolean;
      /** Include lowercase letters */
      includeLowercase?: boolean;
      /** Include numbers */
      includeNumbers?: boolean;
      /** Include special characters */
      includeSpecialChars?: boolean;
      /** Custom character set */
      customChars?: string;
      /** Exclude similar looking characters (0/O, 1/l/I) */
      excludeSimilar?: boolean;
    };
  };
}

export interface PasswordValidation {
  required?: boolean;
  message?: string;
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  pattern?: string;
}

export interface PasswordFieldOptions {
  placeholder?: string;
  showStrength?: boolean;
  allowToggle?: boolean;
  disableAutocomplete?: boolean;
  showGenerator?: boolean;
  generator?: {
    length?: number;
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSpecialChars?: boolean;
    customChars?: string;
    excludeSimilar?: boolean;
  };
}

export const PASSWORD_FIELD_DEFAULTS: Partial<PasswordFieldDefinition> = {
  type: 'password',
  defaultValue: '',
  validation: {
    required: false,
    minLength: 8,
    maxLength: 128,
    requireUppercase: false,
    requireLowercase: false,
    requireNumbers: false,
    requireSpecialChars: false
  },
  options: {
    placeholder: 'Enter password',
    showStrength: false,
    allowToggle: true,
    disableAutocomplete: true,
    showGenerator: false,
    generator: {
      length: 16,
      includeUppercase: true,
      includeLowercase: true,
      includeNumbers: true,
      includeSpecialChars: true,
      excludeSimilar: false
    }
  }
};