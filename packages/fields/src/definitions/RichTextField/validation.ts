import type { 
  RichTextFieldDefinition, 
  RichTextValidation,
  RichTextContent
} from './definition.js';
import type { ValidationResult, DocumentContext } from '../../base/FieldDefinition.js';
import { RICHTEXT_FIELD_DEFAULTS } from './definition.js';

export function validateRichTextField(
  value: string | RichTextContent | undefined,
  definition: RichTextFieldDefinition,
  context?: DocumentContext
): ValidationResult {
  const validation = { ...RICHTEXT_FIELD_DEFAULTS.validation, ...definition.validation };
  
  const errors: string[] = [];
  
  // Handle required validation
  if (validation.required) {
    const textContent = getTextContent(value);
    if (!textContent || textContent.trim().length === 0) {
      errors.push('This field is required');
    }
  }
  
  if (!value) {
    return { isValid: true, errors: [] };
  }
  
  const textContent = getTextContent(value);
  const htmlContent = getHTMLContent(value);
  
  // Length validation
  if (validation.minLength && textContent.length < validation.minLength) {
    errors.push(`Content must be at least ${validation.minLength} characters long`);
  }
  
  if (validation.maxLength && textContent.length > validation.maxLength) {
    errors.push(`Content must not exceed ${validation.maxLength} characters`);
  }
  
  // Word count validation
  const wordCount = countWords(textContent);
  
  if (validation.minWords && wordCount < validation.minWords) {
    errors.push(`Content must have at least ${validation.minWords} words`);
  }
  
  if (validation.maxWords && wordCount > validation.maxWords) {
    errors.push(`Content must not exceed ${validation.maxWords} words`);
  }
  
  // Required elements validation
  if (validation.requiredElements && validation.requiredElements.length > 0) {
    const missingElements = validation.requiredElements.filter(element => 
      !htmlContent.includes(`<${element}`)
    );
    
    if (missingElements.length > 0) {
      errors.push(`Content must include: ${missingElements.join(', ')}`);
    }
  }
  
  // Prohibited elements validation
  if (validation.prohibitedElements && validation.prohibitedElements.length > 0) {
    const foundProhibited = validation.prohibitedElements.filter(element => 
      htmlContent.includes(`<${element}`)
    );
    
    if (foundProhibited.length > 0) {
      errors.push(`Content must not include: ${foundProhibited.join(', ')}`);
    }
  }
  
  // Custom validation
  if (validation.customValidation) {
    const customResult = validation.customValidation(htmlContent);
    if (customResult !== true) {
      errors.push(typeof customResult === 'string' ? customResult : 'Invalid content');
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

export function sanitizeRichTextValue(
  value: any
): string | RichTextContent | undefined {
  if (!value) return undefined;
  
  // Handle string input
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  
  // Handle object input (RichTextContent)
  if (typeof value === 'object') {
    const sanitized: RichTextContent = {
      html: '',
      text: ''
    };
    
    if (value.html && typeof value.html === 'string') {
      sanitized.html = value.html.trim();
    }
    
    if (value.text && typeof value.text === 'string') {
      sanitized.text = value.text.trim();
    }
    
    if (value.metadata && typeof value.metadata === 'object') {
      sanitized.metadata = { ...value.metadata };
    }
    
    // Return undefined if no meaningful content
    if (!sanitized.html && !sanitized.text) {
      return undefined;
    }
    
    return sanitized;
  }
  
  return undefined;
}

export function getDefaultRichTextValue(definition: RichTextFieldDefinition): any {
  const defaultValue = definition.default;
  
  if (defaultValue !== undefined) {
    return sanitizeRichTextValue(defaultValue);
  }
  
  return '';
}

export function getHTMLContent(value: string | RichTextContent | undefined): string {
  if (!value) return '';
  
  if (typeof value === 'string') {
    return value;
  }
  
  if (typeof value === 'object' && value.html) {
    return value.html;
  }
  
  return '';
}

export function getTextContent(value: string | RichTextContent | undefined): string {
  if (!value) return '';
  
  if (typeof value === 'string') {
    // Strip HTML tags to get plain text
    return stripHTML(value);
  }
  
  if (typeof value === 'object') {
    if (value.text) {
      return value.text;
    }
    
    if (value.html) {
      return stripHTML(value.html);
    }
    
  }
  
  return '';
}

export function stripHTML(html: string): string {
  // Simple HTML stripping - in production, use a proper HTML parser
  return html.replace(/<[^>]*>/g, '').trim();
}

export function countWords(text: string): number {
  if (!text.trim()) return 0;
  
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length;
}

export function calculateReadTime(text: string, wordsPerMinute: number = 200): number {
  const wordCount = countWords(text);
  return Math.ceil(wordCount / wordsPerMinute);
}

export function getContentStats(value: string | RichTextContent | undefined) {
  const textContent = getTextContent(value);
  const htmlContent = getHTMLContent(value);
  
  return {
    characters: textContent.length,
    charactersWithSpaces: textContent.length,
    charactersWithoutSpaces: textContent.replace(/\s/g, '').length,
    words: countWords(textContent),
    readTime: calculateReadTime(textContent),
    htmlLength: htmlContent.length
  };
}

export function normalizeRichTextContent(value: any): RichTextContent {
  const sanitized = sanitizeRichTextValue(value);
  
  if (!sanitized) {
    return { html: '', text: '' };
  }
  
  if (typeof sanitized === 'string') {
    return {
      html: sanitized,
      text: stripHTML(sanitized),
      metadata: {
        wordCount: countWords(stripHTML(sanitized)),
        characterCount: stripHTML(sanitized).length,
        readTime: calculateReadTime(stripHTML(sanitized)),
        lastModified: new Date().toISOString()
      }
    };
  }
  
  // Ensure all fields are present
  const normalized: RichTextContent = {
    html: sanitized.html || '',
    text: sanitized.text || stripHTML(sanitized.html || ''),
    metadata: {
      ...sanitized.metadata,
      wordCount: countWords(sanitized.text || stripHTML(sanitized.html || '')),
      characterCount: (sanitized.text || stripHTML(sanitized.html || '')).length,
      readTime: calculateReadTime(sanitized.text || stripHTML(sanitized.html || '')),
      lastModified: new Date().toISOString()
    }
  };
  
  return normalized;
}