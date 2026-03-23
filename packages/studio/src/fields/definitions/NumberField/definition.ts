import type { StringFieldDefinition } from '../StringField/definition.js';

export interface NumberFieldDefinition extends Omit<StringFieldDefinition, 'type' | 'validation' | 'options'> {
  type: 'number';
  
  /** Number-specific validation options */
  validation?: {
    /** Whether the field is required */
    required?: boolean;
    /** Custom validation error message */
    message?: string;
    /** Minimum allowed value */
    min?: number;
    /** Maximum allowed value */
    max?: number;
    /** Step increment (e.g., 0.01 for currency, 1 for integers) */
    step?: number;
    /** Maximum number of decimal places */
    precision?: number;
    /** Only allow integer values */
    integerOnly?: boolean;
    /** Only allow positive numbers (> 0) */
    positiveOnly?: boolean;
    /** Only allow non-negative numbers (>= 0) */
    nonNegativeOnly?: boolean;
  };
  
  /** Number field options */
  options?: {
    /** Placeholder text */
    placeholder?: string;
    /** Number format style */
    format?: 'decimal' | 'currency' | 'percentage' | 'scientific';
    /** Currency code for currency format (e.g., 'USD', 'EUR') */
    currency?: string;
    /** Locale for number formatting (e.g., 'en-US', 'de-DE') */
    locale?: string;
    /** Show thousand separators */
    showThousandSeparator?: boolean;
    /** Show increment/decrement buttons */
    showSpinButtons?: boolean;
    /** Prefix symbol (e.g., '$', '€') */
    prefix?: string;
    /** Suffix symbol (e.g., '%', 'kg', 'USD') */
    suffix?: string;
    /** Auto-format on blur */
    autoFormat?: boolean;
    /** Display mode: input (default), slider, or both */
    displayMode?: 'input' | 'slider';
    /** Show current value next to slider */
    showValue?: boolean;
  };
}

export interface NumberValidation {
  required?: boolean;
  message?: string;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  integerOnly?: boolean;
  positiveOnly?: boolean;
  nonNegativeOnly?: boolean;
}

export interface NumberFieldOptions {
  placeholder?: string;
  format?: 'decimal' | 'currency' | 'percentage' | 'scientific';
  currency?: string;
  locale?: string;
  showThousandSeparator?: boolean;
  showSpinButtons?: boolean;
  prefix?: string;
  suffix?: string;
  autoFormat?: boolean;
  displayMode?: 'input' | 'slider';
  showValue?: boolean;
}

export const NUMBER_FIELD_DEFAULTS: Partial<NumberFieldDefinition> = {
  type: 'number',
  defaultValue: undefined,
  validation: {
    required: false,
    precision: 2,
    integerOnly: false,
    positiveOnly: false,
    nonNegativeOnly: false
  },
  options: {
    placeholder: 'Enter number',
    format: 'decimal',
    locale: 'en-US',
    showThousandSeparator: true,
    showSpinButtons: true,
    autoFormat: true
  }
};