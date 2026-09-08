import type { 
  PortableTextFieldDefinition, 
  PortableTextValidation,
  PortableTextContent,
  PortableTextBlock,
  PortableTextSpan
} from './definition.js';
import type { ValidationResult, DocumentContext } from '../../base/FieldDefinition.js';
import { PORTABLE_TEXT_FIELD_DEFAULTS } from './definition.js';

export function validatePortableTextField(
  value: PortableTextContent | undefined,
  definition: PortableTextFieldDefinition,
  _context?: DocumentContext
): ValidationResult {
  const validation = { ...PORTABLE_TEXT_FIELD_DEFAULTS.validation, ...definition.validation };
  const errors: string[] = [];
  
  // Handle required validation
  if (validation.required) {
    const textContent = getPlainTextFromPortableText(value);
    if (!textContent || textContent.trim().length === 0) {
      errors.push('This field is required');
    }
  }
  
  if (!value || !value.blocks) {
    return { isValid: errors.length === 0, errors };
  }
  
  const { blocks } = value;
  
  // Block count validation
  if (validation.minBlocks && blocks.length < validation.minBlocks) {
    errors.push(`Content must have at least ${validation.minBlocks} block${validation.minBlocks > 1 ? 's' : ''}`);
  }
  
  if (validation.maxBlocks && blocks.length > validation.maxBlocks) {
    errors.push(`Content must not exceed ${validation.maxBlocks} block${validation.maxBlocks > 1 ? 's' : ''}`);
  }
  
  // Length validation
  const textContent = getPlainTextFromPortableText(value);
  if (validation.minLength && textContent.length < validation.minLength) {
    errors.push(`Content must be at least ${validation.minLength} characters long`);
  }
  
  if (validation.maxLength && textContent.length > validation.maxLength) {
    errors.push(`Content must not exceed ${validation.maxLength} characters`);
  }
  
  // Block type validation
  if (validation.allowedBlockTypes && validation.allowedBlockTypes.length > 0) {
    const invalidBlocks = blocks.filter(block => !validation.allowedBlockTypes!.includes(block._type));
    if (invalidBlocks.length > 0) {
      errors.push(`Invalid block types found: ${invalidBlocks.map(b => b._type).join(', ')}`);
    }
  }
  
  // Required block types validation
  if (validation.requiredBlockTypes && validation.requiredBlockTypes.length > 0) {
    const presentBlockTypes = new Set(blocks.map(block => block._type));
    const missingBlockTypes = validation.requiredBlockTypes.filter(type => !presentBlockTypes.has(type));
    if (missingBlockTypes.length > 0) {
      errors.push(`Required block types missing: ${missingBlockTypes.join(', ')}`);
    }
  }
  
  // Validate individual blocks
  blocks.forEach((block, index) => {
    const blockErrors = validatePortableTextBlock(block, validation);
    if (blockErrors.length > 0) {
      errors.push(`Block ${index + 1}: ${blockErrors.join(', ')}`);
    }
  });
  
  // Custom validation
  if (validation.customValidation) {
    const customResult = validation.customValidation(value);
    if (customResult !== true) {
      errors.push(typeof customResult === 'string' ? customResult : 'Invalid content');
    }
  }
  
  return { isValid: errors.length === 0, errors };
}

function validatePortableTextBlock(block: PortableTextBlock, validation: PortableTextValidation): string[] {
  const errors: string[] = [];
  
  // Validate block structure
  if (!block._key) {
    errors.push('Block is missing _key');
  }
  
  if (!block._type) {
    errors.push('Block is missing _type');
  }
  
  // Validate children if present
  if (block.children) {
    block.children.forEach((child, index) => {
      if (!child._key) {
        errors.push(`Child ${index + 1} is missing _key`);
      }
      
      if (child._type !== 'span') {
        errors.push(`Child ${index + 1} has invalid type: ${child._type}`);
      }
      
      // Validate marks
      if (child.marks && validation.allowedMarks) {
        const invalidMarks = child.marks.filter(mark => !validation.allowedMarks!.includes(mark));
        if (invalidMarks.length > 0) {
          errors.push(`Child ${index + 1} has invalid marks: ${invalidMarks.join(', ')}`);
        }
      }
    });
  }
  
  // Validate style
  if (block.style && validation.allowedStyles && !validation.allowedStyles.includes(block.style)) {
    errors.push(`Invalid style: ${block.style}`);
  }
  
  return errors;
}

export function sanitizePortableTextValue(
  value: any
): PortableTextContent | undefined {
  if (!value) return undefined;
  
  // Handle string input (convert to single block)
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    
    return {
      blocks: [{
        _key: generateKey(),
        _type: 'block',
        style: 'normal',
        children: [{
          _key: generateKey(),
          _type: 'span',
          text: trimmed,
          marks: []
        }]
      }],
      metadata: {
        blockCount: 1,
        characterCount: trimmed.length,
        wordCount: countWords(trimmed),
        lastModified: new Date().toISOString(),
        version: '1.0'
      }
    };
  }
  
  // Handle object input
  if (typeof value === 'object' && value.blocks) {
    const sanitizedBlocks = value.blocks
      .map(sanitizePortableTextBlock)
      .filter((block: PortableTextBlock | null) => block !== null);
    
    if (sanitizedBlocks.length === 0) return undefined;
    
    const plainText = getPlainTextFromBlocks(sanitizedBlocks);
    
    return {
      blocks: sanitizedBlocks,
      metadata: {
        blockCount: sanitizedBlocks.length,
        characterCount: plainText.length,
        wordCount: countWords(plainText),
        lastModified: new Date().toISOString(),
        version: '1.0',
        ...value.metadata
      }
    };
  }
  
  return undefined;
}

function sanitizePortableTextBlock(block: any): PortableTextBlock | null {
  if (!block || typeof block !== 'object') return null;
  
  const sanitized: PortableTextBlock = {
    _key: block._key || generateKey(),
    _type: block._type || 'block',
    style: block.style,
    level: block.level,
    children: [],
    markDefs: block.markDefs || []
  };
  
  // Sanitize children
  if (block.children && Array.isArray(block.children)) {
    sanitized.children = block.children
      .map(sanitizePortableTextSpan)
      .filter((span: PortableTextSpan | null) => span !== null);
  }
  
  // Keep all blocks including empty ones (empty blocks are valid for editing)
  return sanitized;
}

function sanitizePortableTextSpan(span: any): PortableTextSpan | null {
  if (!span || typeof span !== 'object') return null;
  
  return {
    _key: span._key || generateKey(),
    _type: 'span',
    text: String(span.text || ''),
    marks: Array.isArray(span.marks) ? span.marks.filter((mark: any) => typeof mark === 'string') : []
  };
}

export function getDefaultPortableTextValue(definition: PortableTextFieldDefinition): PortableTextContent {
  const defaultValue = definition.default;
  
  if (defaultValue) {
    return sanitizePortableTextValue(defaultValue) || PORTABLE_TEXT_FIELD_DEFAULTS.default;
  }
  
  return PORTABLE_TEXT_FIELD_DEFAULTS.default;
}

export function getPlainTextFromPortableText(value: PortableTextContent | undefined): string {
  if (!value || !value.blocks) return '';
  
  return getPlainTextFromBlocks(value.blocks);
}

function getPlainTextFromBlocks(blocks: PortableTextBlock[]): string {
  return blocks
    .map(block => {
      if (!block.children) return '';
      return block.children
        .map(child => child.text || '')
        .join('');
    })
    .join('\n');
}

export function countWords(text: string): number {
  if (!text.trim()) return 0;
  
  return text
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0)
    .length;
}

export function generateKey(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function getPortableTextStats(value: PortableTextContent | undefined) {
  if (!value || !value.blocks) {
    return {
      blocks: 0,
      characters: 0,
      words: 0
    };
  }
  
  const plainText = getPlainTextFromPortableText(value);
  
  return {
    blocks: value.blocks.length,
    characters: plainText.length,
    words: countWords(plainText)
  };
}

export function normalizePortableTextContent(value: any): PortableTextContent {
  const sanitized = sanitizePortableTextValue(value);
  
  if (!sanitized) {
    return PORTABLE_TEXT_FIELD_DEFAULTS.default;
  }
  
  return sanitized;
}