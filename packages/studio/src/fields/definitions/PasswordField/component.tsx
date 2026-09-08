import { useState } from 'react';
import { useT } from 'trokky/i18n';
import { StringFieldComponent } from '../StringField/component.js';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { PasswordFieldDefinition } from './definition.js';
import { calculatePasswordStrength, generatePassword } from './validation.js';

// Password field component props
type PasswordFieldComponentProps = FieldComponentProps;

// Map strength score to translation key
const strengthKeyMap: Record<number, string> = {
  0: 'veryWeak',
  1: 'weak',
  2: 'fair',
  3: 'good',
  4: 'strong'
};

export function PasswordFieldComponent(props: PasswordFieldComponentProps) {
  const { definition, value, onChange, isReadonly, isDisabled } = props;
  const { t } = useT('fields');
  const [showPassword, setShowPassword] = useState(false);
  
  // Ensure password-specific properties are set
  const passwordDefinition = definition as PasswordFieldDefinition;
  const allowToggle = passwordDefinition.options?.allowToggle !== false; // Default true
  const showStrength = passwordDefinition.options?.showStrength === true;
  const showGenerator = passwordDefinition.options?.showGenerator === true;
  const disableAutocomplete = passwordDefinition.options?.disableAutocomplete !== false; // Default true

  // Read-only mode: render as masked display text
  if (isReadonly && !isDisabled) {
    const displayValue = (value as string) || '';
    
    // Handle empty values
    if (!displayValue || displayValue.trim() === '') {
      return (
        <div className="text-gray-400 dark:text-gray-500 italic text-sm py-2">
          {t('noValue')}
        </div>
      );
    }

    // Display as masked password
    return (
      <div className="text-gray-500 dark:text-gray-400 font-mono text-sm py-2">
        {'•'.repeat(Math.min(displayValue.length, 12))}
      </div>
    );
  }
  
  const enhancedDefinition = {
    ...passwordDefinition,
    options: {
      inputType: showPassword ? 'text' : 'password',
      placeholder: t('types.password.placeholder'),
      autoComplete: disableAutocomplete ? 'new-password' : 'current-password',
      spellCheck: false, // Disable spellcheck for passwords
      ...passwordDefinition.options
    }
  };

  const passwordStrength = showStrength && value ? calculatePasswordStrength(value) : null;

  const handleGeneratePassword = () => {
    const generatorOptions = passwordDefinition.options?.generator || {};
    const newPassword = generatePassword(generatorOptions);
    onChange(newPassword);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <StringFieldComponent
          {...props}
          definition={enhancedDefinition}
        />
        
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
          {/* Password generator button */}
          {showGenerator && (
            <button
              type="button"
              onClick={handleGeneratePassword}
              className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 focus:outline-none"
              title={t('types.password.generatePassword')}
              tabIndex={-1}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          
          {/* Password visibility toggle */}
          {allowToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 focus:outline-none"
              title={showPassword ? t('types.password.hidePassword') : t('types.password.showPassword')}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Password strength indicator */}
      {passwordStrength && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{t('types.password.passwordStrength')}</span>
            <span
              className="font-medium"
              style={{ color: passwordStrength.color }}
            >
              {t(`types.password.strength.${strengthKeyMap[passwordStrength.score]}`)}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(passwordStrength.score / 4) * 100}%`,
                backgroundColor: passwordStrength.color
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}