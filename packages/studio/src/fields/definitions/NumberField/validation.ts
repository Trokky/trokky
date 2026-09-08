import type { ValidationResult } from '../../base/FieldDefinition.js';
import type { NumberFieldDefinition } from './definition.js';

export function validateNumberField(value: string | number | null | undefined, definition: NumberFieldDefinition): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Handle null/undefined values
  if (value === null || value === undefined || value === '') {
    if (definition.validation?.required || definition.required) {
      errors.push(definition.validation?.message || 'Number is required');
    }
    return { isValid: errors.length === 0, errors, warnings };
  }
  
  // Convert to number for validation
  let numValue: number;
  if (typeof value === 'string') {
    // Remove formatting characters for validation
    const cleanValue = cleanNumberString(value);
    
    // Check for scientific notation (security vulnerability)
    if (/[eE]/.test(cleanValue)) {
      errors.push('Scientific notation is not allowed');
      return { isValid: false, errors, warnings };
    }
    
    numValue = parseFloat(cleanValue);
  } else {
    numValue = value;
  }
  
  // Check if it's a valid number
  if (isNaN(numValue) || !isFinite(numValue)) {
    errors.push('Please enter a valid number');
    return { isValid: false, errors, warnings };
  }
  
  const validation = definition.validation || {};
  
  // Integer validation
  if (validation.integerOnly && !Number.isInteger(numValue)) {
    errors.push('Number must be a whole number (no decimal places)');
  }
  
  // Positive number validation
  if (validation.positiveOnly && numValue <= 0) {
    errors.push('Number must be greater than 0');
  }
  
  // Non-negative validation
  if (validation.nonNegativeOnly && numValue < 0) {
    errors.push('Number must be 0 or greater');
  }
  
  // Range validation
  if (validation.min !== undefined && numValue < validation.min) {
    errors.push(`Number must be at least ${validation.min}`);
  }
  
  if (validation.max !== undefined && numValue > validation.max) {
    errors.push(`Number must be no more than ${validation.max}`);
  }
  
  // Step validation with proper floating-point handling
  if (validation.step !== undefined && validation.step > 0) {
    if (!isValidStep(numValue, validation.step, validation.min || 0)) {
      errors.push(`Number must be a multiple of ${validation.step}`);
    }
  }
  
  // Precision validation
  if (validation.precision !== undefined) {
    const decimalPlaces = getDecimalPlaces(numValue);
    if (decimalPlaces > validation.precision) {
      errors.push(`Number can have at most ${validation.precision} decimal places`);
    }
  }
  
  // Warnings for potential issues
  if (errors.length === 0) {
    // Warn about very large numbers that might lose precision
    if (Math.abs(numValue) > Number.MAX_SAFE_INTEGER) {
      warnings.push('Very large numbers may lose precision');
    }
    
    // Warn about scientific notation input
    if (typeof value === 'string' && /[eE]/.test(value)) {
      warnings.push('Scientific notation detected - verify the intended value');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Secure step validation that handles floating-point precision issues
 */
function isValidStep(value: number, step: number, min: number = 0): boolean {
  const adjusted = value - min;
  const steps = Math.round(adjusted / step);
  const expected = steps * step;
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(value), Math.abs(expected));
  
  return Math.abs(adjusted - expected) <= tolerance;
}

/**
 * Clean number string by removing formatting characters
 * Uses whitelist approach for security
 */
export function cleanNumberString(value: string): string {
  // Whitelist approach - only allow safe numeric characters and basic formatting
  return value
    .replace(/[^0-9.\-+,\s]/g, '') // Only allow digits, decimal, minus, plus, comma, space
    .replace(/[\s,]/g, '') // Remove spaces and commas
    .replace(/^[+]/, '') // Remove leading plus sign
    .trim();
}

/**
 * Get number of decimal places in a number
 */
export function getDecimalPlaces(num: number): number {
  if (!isFinite(num)) return 0;
  
  const str = num.toString();
  if (str.indexOf('.') === -1 && str.indexOf('e-') === -1) {
    return 0;
  }
  
  if (str.indexOf('e-') !== -1) {
    const parts = str.split('e-');
    return parseInt(parts[1], 10);
  }
  
  return str.split('.')[1]?.length || 0;
}

/**
 * Format number according to field options
 */
export function formatNumber(value: number, definition: NumberFieldDefinition): string {
  if (!isFinite(value)) return '';
  
  const options = definition.options || {};
  const format = options.format || 'decimal';
  const locale = options.locale || 'en-US';
  
  try {
    let formatted: string;
    
    switch (format) {
      case 'currency':
        formatted = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: options.currency || 'USD',
          minimumFractionDigits: definition.validation?.precision ?? 2,
          maximumFractionDigits: definition.validation?.precision ?? 2
        }).format(value);
        break;
        
      case 'percentage':
        formatted = new Intl.NumberFormat(locale, {
          style: 'percent',
          minimumFractionDigits: definition.validation?.precision ?? 2,
          maximumFractionDigits: definition.validation?.precision ?? 2
        }).format(value / 100); // Intl.NumberFormat expects decimal (0.5 for 50%)
        break;
        
      case 'scientific':
        formatted = value.toExponential(definition.validation?.precision ?? 2);
        break;
        
      default: // decimal
        formatted = new Intl.NumberFormat(locale, {
          style: 'decimal',
          useGrouping: options.showThousandSeparator ?? true,
          minimumFractionDigits: definition.validation?.integerOnly ? 0 : undefined,
          maximumFractionDigits: definition.validation?.precision ?? (definition.validation?.integerOnly ? 0 : undefined)
        }).format(value);
        break;
    }
    
    // Add custom prefix/suffix
    if (options.prefix && !format.includes('currency')) {
      formatted = options.prefix + formatted;
    }
    if (options.suffix && !format.includes('percentage')) {
      formatted = formatted + options.suffix;
    }
    
    return formatted;
  } catch (error) {
    // Fallback to simple formatting if Intl fails
    console.warn('Number formatting failed, using fallback:', error);
    return value.toString();
  }
}

/**
 * Parse formatted number string back to number
 */
export function parseFormattedNumber(value: string, definition: NumberFieldDefinition): number | null {
  if (!value || typeof value !== 'string') return null;
  
  const options = definition.options || {};
  const format = options.format || 'decimal';
  
  // Handle percentage format
  if (format === 'percentage' && value.includes('%')) {
    const cleanValue = cleanNumberString(value.replace('%', ''));
    const num = parseFloat(cleanValue);
    return isNaN(num) ? null : num; // User enters actual percentage (50 for 50%, not 0.5)
  }
  
  // Clean and parse the number
  const cleanValue = cleanNumberString(value);
  const num = parseFloat(cleanValue);
  
  return isNaN(num) ? null : num;
}