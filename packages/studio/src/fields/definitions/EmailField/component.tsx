/**
 * Email Field Component
 * Extends StringField component with email-specific features
 */

import { useT } from 'trokky/i18n';
import { StringFieldComponent } from '../StringField/component.js';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { EmailFieldDefinition } from './definition.js';

// Email field component props
type EmailFieldComponentProps = FieldComponentProps;

export function EmailFieldComponent(props: EmailFieldComponentProps) {
  const { definition, value, isReadonly, isDisabled } = props;
  const { t } = useT('fields');

  // Read-only mode: render as display text with email link
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

    // Display as clickable email link
    return (
      <div className="py-2">
        <a 
          href={`mailto:${displayValue}`}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          {displayValue}
        </a>
      </div>
    );
  }
  
  // Ensure email-specific properties are set
  const emailDefinition = definition as EmailFieldDefinition;
  const enhancedDefinition = {
    ...emailDefinition,
    options: {
      inputType: 'email' as const,
      placeholder: t('types.email.enterEmail'),
      autoComplete: 'email',
      spellCheck: false, // Disable spellcheck for emails
      ...emailDefinition.options
    }
  };

  // Use StringField component with email-specific configuration
  return (
    <StringFieldComponent
      {...props}
      definition={enhancedDefinition}
    />
  );
}