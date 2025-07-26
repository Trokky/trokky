import type { StringFieldDefinition } from '../StringField/definition.js';

export interface BooleanFieldDefinition extends Omit<StringFieldDefinition, 'type' | 'validation' | 'options'> {
  type: 'boolean';
  
  /** Boolean-specific validation options */
  validation?: {
    /** Whether the field is required */
    required?: boolean;
    /** Custom validation error message */
    message?: string;
    /** Require true value (useful for "I agree" checkboxes) */
    mustBeTrue?: boolean;
    /** Require false value (rare, but possible use case) */
    mustBeFalse?: boolean;
  };
  
  /** Boolean field options */
  options?: {
    /** Display style for the boolean input */
    style?: 'checkbox' | 'toggle' | 'radio' | 'button';
    /** Label to display next to the control */
    label?: string;
    /** Text to show when value is true */
    trueText?: string;
    /** Text to show when value is false */
    falseText?: string;
    /** Size of the control */
    size?: 'sm' | 'md' | 'lg';
    /** Color theme for the control */
    color?: 'blue' | 'green' | 'red' | 'purple' | 'gray';
    /** Show label on the left or right of control */
    labelPosition?: 'left' | 'right';
    /** Disabled state styling */
    disabledStyle?: 'opacity' | 'grayscale';
  };
}

export interface BooleanValidation {
  required?: boolean;
  message?: string;
  mustBeTrue?: boolean;
  mustBeFalse?: boolean;
}

export interface BooleanFieldOptions {
  style?: 'checkbox' | 'toggle' | 'radio' | 'button';
  label?: string;
  trueText?: string;
  falseText?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'red' | 'purple' | 'gray';
  labelPosition?: 'left' | 'right';
  disabledStyle?: 'opacity' | 'grayscale';
}

export const BOOLEAN_FIELD_DEFAULTS: Partial<BooleanFieldDefinition> = {
  type: 'boolean',
  defaultValue: undefined,
  validation: {
    required: false,
    mustBeTrue: false,
    mustBeFalse: false
  },
  options: {
    style: 'checkbox',
    trueText: 'Yes',
    falseText: 'No',
    size: 'md',
    color: 'blue',
    labelPosition: 'right',
    disabledStyle: 'opacity'
  }
};