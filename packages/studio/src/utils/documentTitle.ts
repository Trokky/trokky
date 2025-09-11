/**
 * Utility functions for smart document title display
 */

import type { Document } from '@/types';

/**
 * Get smart document title with intelligent fallbacks
 * Prioritizes user input over default "New ..." values
 */
export function getSmartDocumentTitle(doc: Document, schema?: any): string {
  if (!doc) return 'Untitled';
  
  // First, try to get the first field value from schema (prioritize user input)
  if (schema?.fields) {
    const fields = Array.isArray(schema.fields) 
      ? schema.fields 
      : Object.entries(schema.fields).map(([name, field]) => ({ name, ...field }));
    
    const firstField = fields[0];
    if (firstField && doc[firstField.name]) {
      const value = doc[firstField.name];
      if (typeof value === 'string' && value.trim() && !value.startsWith('New ')) {
        return value;
      }
    }
  }
  
  // Then try common fields (but skip default values)
  if (doc.name && !doc.name.startsWith('New ')) {
    return doc.name;
  }
  if (doc.title && !doc.title.startsWith('New ')) {
    return doc.title;
  }
  if (doc.slug) {
    return doc.slug;
  }
  
  // Fallback to any existing title/name (even if it starts with "New")
  return doc.title || doc.name || doc.slug || 'Untitled';
}

/**
 * Get document value using dot notation
 */
export function getDocumentValue(doc: Document, key: string): any {
  return key.split('.').reduce((obj: any, k: string) => obj?.[k], doc);
}
