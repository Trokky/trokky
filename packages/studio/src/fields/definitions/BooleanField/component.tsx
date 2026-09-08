import { useT } from '@trokky/trokky/i18n';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { BooleanFieldDefinition } from './definition.js';
import { convertToBoolean } from './validation.js';

// Boolean field component props
type BooleanFieldComponentProps = FieldComponentProps;

export function BooleanFieldComponent(props: BooleanFieldComponentProps) {
  const { definition, value, onChange, hasError, fieldId, isDisabled, isReadonly, mode } = props;
  const { t } = useT('fields');

  // Type guard for boolean field definition
  if (definition.type !== 'boolean') {
    return <div className="text-red-500 text-sm">{t('errors.invalidFieldConfig', { type: 'boolean' })}</div>;
  }

  const booleanDefinition = definition as BooleanFieldDefinition;
  const options = booleanDefinition.options || {};

  const style = options.style || 'checkbox';
  const size = options.size || 'md';
  const color = options.color || 'blue';
  const labelPosition = options.labelPosition || 'right';
  const label = options.label || booleanDefinition.title;
  const trueText = options.trueText || t('types.boolean.yes');
  const falseText = options.falseText || t('types.boolean.no');
  
  // Check if we're in read-only mode
  const isViewMode = mode === 'preview' || isReadonly || isDisabled;
  
  // Convert value to boolean with null fallback
  const boolValue = convertToBoolean(value) ?? false;
  const isChecked = boolValue === true;
  
  const handleChange = (newValue: boolean) => {
    if (isViewMode || !onChange) return;
    onChange(newValue);
  };
  
  // Size classes
  const sizeClasses = {
    sm: { control: 'w-4 h-4', text: 'text-sm' },
    md: { control: 'w-5 h-5', text: 'text-base' },
    lg: { control: 'w-6 h-6', text: 'text-lg' }
  };
  
  // Validate and sanitize color input to prevent CSS injection
  const ALLOWED_COLORS = ['blue', 'green', 'red', 'purple', 'gray'] as const;
  const sanitizedColor = ALLOWED_COLORS.includes(color as any) ? color : 'blue';
  
  // Color classes for checked state
  const colorClasses = {
    blue: { bg: 'bg-blue-600', border: 'border-blue-600', ring: 'focus:ring-blue-500' },
    green: { bg: 'bg-green-600', border: 'border-green-600', ring: 'focus:ring-green-500' },
    red: { bg: 'bg-red-600', border: 'border-red-600', ring: 'focus:ring-red-500' },
    purple: { bg: 'bg-purple-600', border: 'border-purple-600', ring: 'focus:ring-purple-500' },
    gray: { bg: 'bg-gray-600', border: 'border-gray-600', ring: 'focus:ring-gray-500' }
  };
  
  const currentSize = sizeClasses[size];
  const currentColor = colorClasses[sanitizedColor];
  
  // Render read-only view
  if (isViewMode) {
    return (
      <div className="py-2">
        <div className="flex items-center gap-2">
          {style === 'toggle' ? (
            <div className={`
              relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 opacity-60
              ${isChecked ? currentColor.bg : 'bg-gray-200 dark:bg-gray-700'}
            `}>
              <span className={`
                inline-block w-4 h-4 transform transition-transform duration-200 bg-white rounded-full shadow-lg ring-0
                ${isChecked ? 'translate-x-6' : 'translate-x-1'}
              `} />
            </div>
          ) : (
            <div className={`
              ${currentSize.control} rounded border-2 transition-all duration-200 relative
              ${isChecked 
                ? `${currentColor.bg} ${currentColor.border}` 
                : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
              }
              opacity-60
            `}>
              {/* Checkmark for checked state */}
              {isChecked && style === 'checkbox' && (
                <svg
                  className="w-full h-full text-white pointer-events-none p-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
          )}
          
          <span className={`${currentSize.text} text-gray-700 dark:text-gray-300`}>
            {label && label}
            {!label && (isChecked ? trueText : falseText)}
          </span>
        </div>
        
        {/* Show Yes/No for styles that don't have labels */}
        {(style === 'radio' || style === 'button') && (
          <div className="mt-1">
            <span className={`text-sm ${currentColor.bg.replace('bg-', 'text-')} font-medium`}>
              {isChecked ? trueText : falseText}
            </span>
          </div>
        )}
      </div>
    );
  }
  
  // Common classes for controls
  const baseControlClasses = `
    ${currentSize.control}
    border-2 rounded transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `.trim();
  
  const errorClasses = hasError 
    ? 'border-red-400 focus:ring-red-500'
    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700';
  
  // Render different styles
  const renderControl = () => {
    switch (style) {
      case 'toggle':
        return (
          <button
            type="button"
            id={fieldId}
            role="switch"
            aria-checked={isChecked}
            aria-label={label || booleanDefinition.title || t('types.boolean.toggle')}
            disabled={isDisabled || isReadonly}
            onClick={() => handleChange(!isChecked)}
            className={`
              relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-offset-2 ${currentColor.ring}
              ${isChecked ? currentColor.bg : 'bg-gray-200 dark:bg-gray-700'}
              ${hasError ? 'ring-1 ring-red-500' : ''}
              disabled:opacity-50 disabled:cursor-not-allowed
            `.trim()}
          >
            <span
              className={`
                inline-block w-4 h-4 transform transition-transform duration-200 bg-white rounded-full shadow-lg ring-0
                ${isChecked ? 'translate-x-6' : 'translate-x-1'}
              `.trim()}
            />
          </button>
        );
        
      case 'radio':
        return (
          <div className="flex space-x-4">
            <label className={`flex items-center space-x-2 ${currentSize.text}`}>
              <input
                type="radio"
                name={fieldId}
                checked={isChecked}
                disabled={isDisabled || isReadonly}
                onChange={() => handleChange(true)}
                className={`${baseControlClasses} rounded-full ${isChecked ? `${currentColor.bg} ${currentColor.border}` : errorClasses}`}
              />
              <span className="text-gray-700 dark:text-gray-300">{trueText}</span>
            </label>
            <label className={`flex items-center space-x-2 ${currentSize.text}`}>
              <input
                type="radio"
                name={fieldId}
                checked={!isChecked}
                disabled={isDisabled || isReadonly}
                onChange={() => handleChange(false)}
                className={`${baseControlClasses} rounded-full ${!isChecked ? `${currentColor.bg} ${currentColor.border}` : errorClasses}`}
              />
              <span className="text-gray-700 dark:text-gray-300">{falseText}</span>
            </label>
          </div>
        );
        
      case 'button':
        return (
          <div className="flex space-x-2">
            <button
              type="button"
              disabled={isDisabled || isReadonly}
              onClick={() => handleChange(true)}
              className={`
                px-4 py-2 rounded-lg border-2 transition-colors duration-200 ${currentSize.text}
                focus:outline-none focus:ring-2 focus:ring-offset-2 ${currentColor.ring}
                ${isChecked 
                  ? `${currentColor.bg} ${currentColor.border} text-white` 
                  : `border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800`}
                disabled:opacity-50 disabled:cursor-not-allowed
              `.trim()}
            >
              {trueText}
            </button>
            <button
              type="button"
              disabled={isDisabled || isReadonly}
              onClick={() => handleChange(false)}
              className={`
                px-4 py-2 rounded-lg border-2 transition-colors duration-200 ${currentSize.text}
                focus:outline-none focus:ring-2 focus:ring-offset-2 ${currentColor.ring}
                ${!isChecked 
                  ? `${currentColor.bg} ${currentColor.border} text-white` 
                  : `border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800`}
                disabled:opacity-50 disabled:cursor-not-allowed
              `.trim()}
            >
              {falseText}
            </button>
          </div>
        );
        
      default: // checkbox
        return (
          <div className="relative inline-block">
            <input
              type="checkbox"
              id={fieldId}
              checked={isChecked}
              disabled={isDisabled || isReadonly}
              onChange={(e) => handleChange(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`
                ${currentSize.control} rounded border-2 transition-all duration-200 relative cursor-pointer
                ${hasError ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}
                ${isChecked 
                  ? `${currentColor.bg} ${currentColor.border}` 
                  : 'bg-white dark:bg-gray-700'
                }
                ${isDisabled || isReadonly ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400 dark:hover:border-gray-500'}
                focus-within:ring-2 focus-within:ring-offset-2 ${currentColor.ring}
              `.trim()}
              onClick={() => {
                if (!isDisabled && !isReadonly) {
                  handleChange(!isChecked);
                }
              }}
            >
              {/* Checkmark */}
              {isChecked && (
                <svg
                  className="absolute inset-0 w-full h-full text-white pointer-events-none p-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
          </div>
        );
    }
  };
  
  // Render with label positioning
  const control = renderControl();
  
  if (style === 'radio' || style === 'button') {
    // Radio and button styles include their own labels
    return <div className="space-y-1">{control}</div>;
  }
  
  if (!label && style !== 'toggle') {
    // No label, just return the control
    return control;
  }
  
  // Render with label
  const labelElement = (
    <label 
      htmlFor={style !== 'toggle' ? fieldId : undefined}
      className={`${currentSize.text} text-gray-700 dark:text-gray-300 ${
        isDisabled ? 'opacity-50' : 'cursor-pointer'
      }`}
    >
      {label}
    </label>
  );
  
  return (
    <div className="flex items-center space-x-3">
      {labelPosition === 'left' && labelElement}
      {control}
      {labelPosition === 'right' && labelElement}
    </div>
  );
}