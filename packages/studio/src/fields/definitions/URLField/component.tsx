import { StringFieldComponent } from '../StringField/component.js';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { URLFieldDefinition } from './definition.js';
import { useT } from 'trokky/i18n';

// URL field component props
type URLFieldComponentProps = FieldComponentProps;

export function URLFieldComponent(props: URLFieldComponentProps) {
  const { definition, value, isReadonly, isDisabled } = props;
  const { t } = useT('fields');
  
  // Read-only mode: render as display text with clickable link
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

    // Display as clickable URL link
    return (
      <div className="py-2">
        <a 
          href={displayValue}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline text-sm"
        >
          {displayValue}
        </a>
      </div>
    );
  }
  
  // Ensure URL-specific properties are set
  const urlDefinition = definition as URLFieldDefinition;
  const enhancedDefinition = {
    ...urlDefinition,
    options: {
      inputType: 'url' as const,
      placeholder: t('types.url.placeholder'),
      autoComplete: 'url',
      spellCheck: false, // Disable spellcheck for URLs
      ...urlDefinition.options
    }
  };

  // Use StringField component with URL-specific configuration
  return (
    <StringFieldComponent
      {...props}
      definition={enhancedDefinition}
    />
  );
}