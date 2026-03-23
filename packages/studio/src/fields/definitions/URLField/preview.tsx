import React from 'react';
import { StringFieldPreview } from '../StringField/preview.js';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { URLFieldDefinition } from './definition.js';

// URL field preview props
type URLFieldPreviewProps = FieldComponentProps;

export function URLFieldPreview(props: URLFieldPreviewProps) {
  const { value, definition } = props;
  const urlDefinition = definition as URLFieldDefinition;
  
  if (!value || typeof value !== 'string') {
    return (
      <StringFieldPreview 
        {...props} 
        definition={urlDefinition}
      />
    );
  }
  
  // Validate URL before displaying
  let isValidUrl = false;
  try {
    new URL(value);
    isValidUrl = true;
  } catch (e) {
    // Invalid URL - fall back to string preview
    return (
      <StringFieldPreview 
        {...props} 
        definition={urlDefinition}
      />
    );
  }
  
  const openInNewTab = urlDefinition.options?.openInNewTab !== false; // Default true
  
  return (
    <a 
      href={value}
      target={openInNewTab ? '_blank' : '_self'}
      rel={openInNewTab ? 'noopener noreferrer' : undefined}
      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
    >
      {value}
    </a>
  );
}