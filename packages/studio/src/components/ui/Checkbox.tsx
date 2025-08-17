import React from 'react';
import { cn } from '@/utils/cn';

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  indeterminate?: boolean;
  'aria-label'?: string;
}

export function Checkbox({
  checked = false,
  onChange,
  disabled = false,
  id,
  className,
  indeterminate = false,
  'aria-label': ariaLabel,
  ...props
}: CheckboxProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e.target.checked);
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel}
        ref={(input) => {
          if (input) {
            input.indeterminate = indeterminate;
          }
        }}
        className="sr-only"
        {...props}
      />
      <div
        className={cn(
          // Base styles
          "h-4 w-4 rounded border-2 transition-all duration-200 relative cursor-pointer",
          "focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500",
          
          // Light mode styling
          "border-gray-300 bg-white",
          
          // Dark mode styling
          "dark:border-gray-600 dark:bg-gray-700",
          
          // Hover states
          !disabled && "hover:border-gray-400 dark:hover:border-gray-500",
          
          // Checked states
          checked && "!border-blue-600 !bg-blue-600",
          checked && "dark:!border-blue-600 dark:!bg-blue-600",
          
          // Disabled states
          disabled && "opacity-50 cursor-not-allowed",
          
          className
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled && onChange) {
            onChange(!checked);
          }
        }}
      >
        {/* Checkmark */}
        {checked && (
          <svg
            className="absolute inset-0 w-4 h-4 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            style={{ stroke: '#ffffff', strokeWidth: 3 }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
        
        {/* Indeterminate state */}
        {indeterminate && !checked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-0.5 bg-white dark:bg-gray-300"></div>
          </div>
        )}
      </div>
    </div>
  );
}