import type { ValidationResult } from '../../base/index.js';
import type { DateFieldDefinition, DateFieldValue } from './definition.js';

export function validateDateField(
  value: DateFieldValue,
  definition: DateFieldDefinition
): ValidationResult {
  const errors: string[] = [];
  
  // Check required
  if (definition.required && !value) {
    errors.push(`${definition.title || 'Date'} is required`);
    return { isValid: false, errors };
  }
  
  // If no value and not required, it's valid
  if (!value) {
    return { isValid: true, errors: [] };
  }
  
  // Parse the date
  let dateValue: Date;
  if (typeof value === 'string') {
    dateValue = new Date(value);
  } else if (value instanceof Date) {
    dateValue = value;
  } else {
    errors.push('Invalid date value');
    return { isValid: false, errors };
  }
  
  // Check if valid date
  if (isNaN(dateValue.getTime())) {
    errors.push('Invalid date format');
    return { isValid: false, errors };
  }
  
  const validation = definition.validation || {};
  
  // Check min date
  if (validation.min) {
    const minDate = typeof validation.min === 'string' ? new Date(validation.min) : validation.min;
    if (dateValue < minDate) {
      errors.push(`Date must be after ${minDate.toLocaleDateString()}`);
    }
  }
  
  // Check max date
  if (validation.max) {
    const maxDate = typeof validation.max === 'string' ? new Date(validation.max) : validation.max;
    if (dateValue > maxDate) {
      errors.push(`Date must be before ${maxDate.toLocaleDateString()}`);
    }
  }
  
  // Check disable past
  if (validation.disablePast) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateValue < today) {
      errors.push('Past dates are not allowed');
    }
  }
  
  // Check disable future
  if (validation.disableFuture) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (dateValue > today) {
      errors.push('Future dates are not allowed');
    }
  }
  
  // Check disable weekends
  if (validation.disableWeekends) {
    const dayOfWeek = dateValue.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      errors.push('Weekend dates are not allowed');
    }
  }
  
  // Check disabled dates
  if (validation.disabledDates && validation.disabledDates.length > 0) {
    const dateStr = dateValue.toISOString().split('T')[0];
    const isDisabled = validation.disabledDates.some(disabled => {
      const disabledStr = typeof disabled === 'string' 
        ? disabled 
        : disabled.toISOString().split('T')[0];
      return disabledStr === dateStr;
    });
    if (isDisabled) {
      errors.push('This date is not available');
    }
  }
  
  // Check allowed dates
  if (validation.allowedDates && validation.allowedDates.length > 0) {
    const dateStr = dateValue.toISOString().split('T')[0];
    const isAllowed = validation.allowedDates.some(allowed => {
      const allowedStr = typeof allowed === 'string' 
        ? allowed 
        : allowed.toISOString().split('T')[0];
      return allowedStr === dateStr;
    });
    if (!isAllowed) {
      errors.push('This date is not in the allowed dates');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function getDefaultDateValue(definition: DateFieldDefinition): DateFieldValue {
  if (definition.default === 'now') {
    return new Date().toISOString().split('T')[0];
  }
  if (definition.default) {
    if (typeof definition.default === 'string') {
      return definition.default;
    }
    if (definition.default instanceof Date) {
      return definition.default.toISOString().split('T')[0];
    }
  }
  return null;
}

export function formatDateForDisplay(
  value: DateFieldValue,
  _format?: string
): string {
  if (!value) return '';
  
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return '';
  
  // Simple formatting (can be enhanced with a date library)
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };
  
  return date.toLocaleDateString('en-US', options);
}