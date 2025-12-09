import React, { useState, useRef, useEffect } from 'react';
import { useT } from '@trokky/i18n';
import type { FieldComponentProps } from '../../base/index.js';
import type { DateFieldDefinition, DateFieldValue } from './definition.js';
import { DATE_FIELD_DEFAULTS } from './definition.js';

export const DateFieldComponent: React.FC<FieldComponentProps> = ({
  value,
  onChange,
  definition,
  hasError,
  error,
  isDisabled,
  isReadonly,
  mode,
  ...props
}) => {
  const { t } = useT('fields');
  const fieldDef = definition as DateFieldDefinition;
  const options = { ...DATE_FIELD_DEFAULTS, ...fieldDef.options };
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (value) {
      const date = typeof value === 'string' ? new Date(value) : value;
      return isNaN(date.getTime()) ? null : date;
    }
    return null;
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  // Check if we're in read-only mode
  const isViewMode = mode === 'preview' || isReadonly || isDisabled;

  // Format date for input display
  const formatDateForInput = (date: Date | null): string => {
    if (!date || isNaN(date.getTime())) return '';
    
    if (options.includeTime) {
      // Format as datetime-local input value
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } else {
      // Format as date input value
      return date.toISOString().split('T')[0];
    }
  };

  // Format date for read-only display
  const formatDateForDisplay = (date: Date | null): string => {
    if (!date || isNaN(date.getTime())) return '';
    
    if (options.includeTime) {
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } else {
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isViewMode || !onChange) return;
    
    const newValue = e.target.value;
    if (!newValue) {
      setSelectedDate(null);
      onChange(null);
    } else {
      const date = new Date(newValue);
      if (!isNaN(date.getTime())) {
        setSelectedDate(date);
        onChange(options.includeTime ? date.toISOString() : date.toISOString().split('T')[0]);
      }
    }
  };

  // Handle clear
  const handleClear = () => {
    if (isViewMode || !onChange) return;
    
    setSelectedDate(null);
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  // Close calendar on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

  // Get validation constraints
  const getInputConstraints = () => {
    const constraints: Record<string, any> = {};
    
    if (fieldDef.validation?.min) {
      const minDate = typeof fieldDef.validation.min === 'string' 
        ? fieldDef.validation.min 
        : fieldDef.validation.min.toISOString().split('T')[0];
      constraints.min = minDate;
    }
    
    if (fieldDef.validation?.max) {
      const maxDate = typeof fieldDef.validation.max === 'string' 
        ? fieldDef.validation.max 
        : fieldDef.validation.max.toISOString().split('T')[0];
      constraints.max = maxDate;
    }
    
    return constraints;
  };

  const inputType = options.includeTime ? 'datetime-local' : 'date';

  // Render read-only view
  if (isViewMode) {
    return (
      <div className="py-2">
        {selectedDate ? (
          <div className="flex items-center gap-2">
            <span className="text-gray-900 dark:text-gray-100">
              {formatDateForDisplay(selectedDate)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({options.includeTime ? t('types.date.dateAndTime') : t('types.date.dateOnly')})
            </span>
          </div>
        ) : (
          <span className="text-gray-500 dark:text-gray-400 italic text-sm">{t('types.date.noDateSet')}</span>
        )}
        {fieldDef.description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {fieldDef.description}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="date-field">
      <div className="relative">
        <input
          ref={inputRef}
          type={inputType}
          value={formatDateForInput(selectedDate)}
          onChange={handleInputChange}
          disabled={isDisabled}
          readOnly={isReadonly}
          placeholder={options.placeholder}
          className={`
            w-full px-3 py-2 
            border rounded-lg
            bg-white dark:bg-gray-700
            text-gray-900 dark:text-white
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed
            ${hasError 
              ? 'border-red-500 dark:border-red-400' 
              : 'border-gray-300 dark:border-gray-600'
            }
            ${options.clearable && selectedDate ? 'pr-10' : ''}
          `}
          {...getInputConstraints()}
        />
        
        {/* Clear button */}
        {options.clearable && selectedDate && !isDisabled && !isReadonly && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={t('types.date.clearDate')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Error message */}
      {hasError && error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Helper text */}
      {fieldDef.description && !hasError && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {fieldDef.description}
        </p>
      )}
    </div>
  );
};