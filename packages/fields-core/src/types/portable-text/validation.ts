/**
 * Portable Text Validation System
 */

import type {
  PortableTextValue,
  PortableTextBlock,
  PortableTextSpan,
  PortableTextFieldConfig,
  PortableTextValidationResult,
  PortableTextValidationError
} from './types'
import { PORTABLE_TEXT_ERROR_CODES } from './constants'
import { hasChildren, validateBlockStructure } from './utils'
import type { FieldContext } from '@trokky/core'
import { getFieldPath } from '../../utils/validation'

export class PortableTextValidator {
  private config: PortableTextFieldConfig
  private context: FieldContext

  constructor(config: PortableTextFieldConfig, context: FieldContext) {
    this.config = config
    this.context = context
  }

  validate(value: PortableTextValue): PortableTextValidationResult {
    const errors: PortableTextValidationError[] = []

    // Basic structure validation
    if (!Array.isArray(value)) {
      errors.push(this.createError(
        [],
        'Portable text value must be an array',
        'INVALID_STRUCTURE'
      ))
      return { valid: false, errors }
    }

    // Block count validation
    this.validateBlockCount(value, errors)

    // Validate each block
    value.forEach((block, index) => {
      this.validateBlock(block, index, errors)
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }

  private validateBlockCount(value: PortableTextValue, errors: PortableTextValidationError[]): void {
    if (this.config.maxBlocks && value.length > this.config.maxBlocks) {
      errors.push(this.createError(
        [],
        `Too many blocks. Maximum allowed: ${this.config.maxBlocks}`,
        PORTABLE_TEXT_ERROR_CODES.EXCEEDS_MAX_BLOCKS
      ))
    }

    if (this.config.minBlocks && value.length < this.config.minBlocks) {
      errors.push(this.createError(
        [],
        `Too few blocks. Minimum required: ${this.config.minBlocks}`,
        PORTABLE_TEXT_ERROR_CODES.BELOW_MIN_BLOCKS
      ))
    }
  }

  private validateBlock(block: PortableTextBlock, index: number, errors: PortableTextValidationError[]): void {
    const blockPath = [index.toString()]

    // Basic structure validation
    if (!validateBlockStructure(block)) {
      errors.push(this.createError(
        blockPath,
        'Invalid block structure',
        PORTABLE_TEXT_ERROR_CODES.INVALID_BLOCK_TYPE,
        index
      ))
      return
    }

    // Block type validation
    this.validateBlockType(block, blockPath, errors, index)

    // Block-specific validation
    if (block._type === 'block') {
      this.validateTextBlock(block, blockPath, errors, index)
    } else {
      this.validateCustomBlock(block, blockPath, errors, index)
    }
  }

  private validateBlockType(
    block: PortableTextBlock,
    path: string[],
    errors: PortableTextValidationError[],
    blockIndex: number
  ): void {
    if (this.config.allowedBlockTypes && !this.config.allowedBlockTypes.includes(block._type)) {
      errors.push(this.createError(
        path,
        `Block type "${block._type}" is not allowed`,
        PORTABLE_TEXT_ERROR_CODES.INVALID_BLOCK_TYPE,
        blockIndex
      ))
    }
  }

  private validateTextBlock(
    block: PortableTextBlock,
    path: string[],
    errors: PortableTextValidationError[],
    blockIndex: number
  ): void {
    if (!hasChildren(block)) {
      errors.push(this.createError(
        path,
        'Text block must have children',
        PORTABLE_TEXT_ERROR_CODES.INVALID_SPAN_STRUCTURE,
        blockIndex
      ))
      return
    }

    // Validate style
    if ('style' in block && block.style) {
      this.validateTextStyle(block.style, path, errors, blockIndex)
    }

    // Validate list structure
    if ('listItem' in block && block.listItem) {
      this.validateListStructure(block as PortableTextBlock & { listItem: string; level?: number }, path, errors, blockIndex)
    }

    // Validate children (spans)
    block.children.forEach((span, spanIndex) => {
      this.validateSpan(span, [...path, 'children', spanIndex.toString()], errors, blockIndex, spanIndex)
    })

    // Validate mark definitions
    if (block.markDefs) {
      this.validateMarkDefinitions(block.markDefs, block.children, path, errors, blockIndex)
    }
  }

  private validateTextStyle(
    style: string,
    path: string[],
    errors: PortableTextValidationError[],
    blockIndex: number
  ): void {
    const allowedStyles = this.config.styles?.map(s => s.type) || []
    if (allowedStyles.length > 0 && !allowedStyles.includes(style)) {
      errors.push(this.createError(
        [...path, 'style'],
        `Text style "${style}" is not allowed`,
        PORTABLE_TEXT_ERROR_CODES.INVALID_TEXT_STYLE,
        blockIndex
      ))
    }
  }

  private validateListStructure(
    block: PortableTextBlock & { listItem: string; level?: number },
    path: string[],
    errors: PortableTextValidationError[],
    blockIndex: number
  ): void {
    const allowedListTypes = this.config.lists?.map(l => l.type) || []
    if (allowedListTypes.length > 0 && !allowedListTypes.includes(block.listItem as any)) {
      errors.push(this.createError(
        [...path, 'listItem'],
        `List type "${block.listItem}" is not allowed`,
        PORTABLE_TEXT_ERROR_CODES.INVALID_LIST_STRUCTURE,
        blockIndex
      ))
    }

    // Validate nesting level
    if (block.level !== undefined) {
      const maxNesting = this.config.lists?.find(l => l.type === block.listItem)?.maxNesting || 5
      if (block.level > maxNesting) {
        errors.push(this.createError(
          [...path, 'level'],
          `List nesting level ${block.level} exceeds maximum of ${maxNesting}`,
          PORTABLE_TEXT_ERROR_CODES.INVALID_LIST_STRUCTURE,
          blockIndex
        ))
      }
    }
  }

  private validateSpan(
    span: PortableTextSpan,
    path: string[],
    errors: PortableTextValidationError[],
    blockIndex: number,
    spanIndex: number
  ): void {
    // Basic span structure
    if (span._type !== 'span') {
      errors.push(this.createError(
        path,
        `Invalid span type: ${span._type}`,
        PORTABLE_TEXT_ERROR_CODES.INVALID_SPAN_STRUCTURE,
        blockIndex,
        spanIndex
      ))
    }

    if (typeof span.text !== 'string') {
      errors.push(this.createError(
        [...path, 'text'],
        'Span text must be a string',
        PORTABLE_TEXT_ERROR_CODES.INVALID_SPAN_STRUCTURE,
        blockIndex,
        spanIndex
      ))
    }

    // Validate marks
    if (span.marks) {
      span.marks.forEach((mark, markIndex) => {
        this.validateMark(mark, [...path, 'marks', markIndex.toString()], errors, blockIndex, spanIndex)
      })
    }
  }

  private validateMark(
    mark: string,
    path: string[],
    errors: PortableTextValidationError[],
    blockIndex: number,
    spanIndex: number
  ): void {
    const allowedMarks = this.config.allowedMarks || []
    if (allowedMarks.length > 0 && !allowedMarks.includes(mark)) {
      errors.push(this.createError(
        path,
        `Mark "${mark}" is not allowed`,
        PORTABLE_TEXT_ERROR_CODES.INVALID_MARK,
        blockIndex,
        spanIndex
      ))
    }
  }

  private validateMarkDefinitions(
    markDefs: any[],
    children: PortableTextSpan[],
    path: string[],
    errors: PortableTextValidationError[],
    blockIndex: number
  ): void {
    const usedMarkKeys = new Set<string>()
    
    // Collect all used mark keys from spans
    children.forEach(span => {
      span.marks?.forEach(mark => {
        usedMarkKeys.add(mark)
      })
    })

    // Validate each mark definition
    markDefs.forEach((markDef, index) => {
      const markDefPath = [...path, 'markDefs', index.toString()]

      // Check if mark definition is used
      if (!usedMarkKeys.has(markDef._key)) {
        errors.push(this.createError(
          markDefPath,
          `Orphaned mark definition: ${markDef._key}`,
          PORTABLE_TEXT_ERROR_CODES.ORPHANED_MARK_DEF,
          blockIndex
        ))
      }

      // Validate annotation type
      if (markDef._type && this.config.allowedAnnotations) {
        if (!this.config.allowedAnnotations.includes(markDef._type)) {
          errors.push(this.createError(
            [...markDefPath, '_type'],
            `Annotation type "${markDef._type}" is not allowed`,
            PORTABLE_TEXT_ERROR_CODES.INVALID_ANNOTATION,
            blockIndex
          ))
        }
      }

      // Validate annotation-specific fields
      this.validateAnnotationFields(markDef, markDefPath, errors, blockIndex)
    })

    // Check for missing mark definitions
    usedMarkKeys.forEach(markKey => {
      const isBuiltinMark = ['strong', 'em', 'underline', 'strike-through', 'code'].includes(markKey)
      if (!isBuiltinMark) {
        const hasMarkDef = markDefs.some(def => def._key === markKey)
        if (!hasMarkDef) {
          errors.push(this.createError(
            path,
            `Missing mark definition for: ${markKey}`,
            PORTABLE_TEXT_ERROR_CODES.MISSING_MARK_DEF,
            blockIndex
          ))
        }
      }
    })
  }

  private validateAnnotationFields(
    markDef: any,
    path: string[],
    errors: PortableTextValidationError[],
    blockIndex: number
  ): void {
    // Validate link annotations
    if (markDef._type === 'link') {
      if (!markDef.href || typeof markDef.href !== 'string') {
        errors.push(this.createError(
          [...path, 'href'],
          'Link annotation must have a valid href',
          PORTABLE_TEXT_ERROR_CODES.MISSING_REQUIRED_FIELD,
          blockIndex
        ))
      }
    }

    // Validate internal link annotations
    if (markDef._type === 'internalLink') {
      if (!markDef.reference || !markDef.reference._ref) {
        errors.push(this.createError(
          [...path, 'reference'],
          'Internal link annotation must have a valid reference',
          PORTABLE_TEXT_ERROR_CODES.MISSING_REQUIRED_FIELD,
          blockIndex
        ))
      }
    }
  }

  private validateCustomBlock(
    block: PortableTextBlock,
    path: string[],
    errors: PortableTextValidationError[],
    blockIndex: number
  ): void {
    // Find block type configuration
    const blockConfig = this.config.blocks?.find(b => b.type === block._type)
    
    if (!blockConfig) {
      // Already validated in validateBlockType, so just return
      return
    }

    // Validate required fields based on block configuration
    if (blockConfig.fields) {
      Object.entries(blockConfig.fields).forEach(([fieldName, fieldConfig]) => {
        if (fieldConfig.required && !(fieldName in block)) {
          errors.push(this.createError(
            [...path, fieldName],
            `Required field "${fieldName}" is missing`,
            PORTABLE_TEXT_ERROR_CODES.MISSING_REQUIRED_FIELD,
            blockIndex
          ))
        }
      })
    }

    // Custom validation for specific block types
    this.validateSpecificBlockTypes(block, path, errors, blockIndex)
  }

  private validateSpecificBlockTypes(
    block: PortableTextBlock,
    path: string[],
    errors: PortableTextValidationError[],
    blockIndex: number
  ): void {
    switch (block._type) {
      case 'image':
        this.validateImageBlock(block as any, path, errors, blockIndex)
        break
      case 'code':
        this.validateCodeBlock(block as any, path, errors, blockIndex)
        break
      case 'callout':
        this.validateCalloutBlock(block as any, path, errors, blockIndex)
        break
    }
  }

  private validateImageBlock(
    block: any,
    path: string[],
    errors: PortableTextValidationError[],
    blockIndex: number
  ): void {
    if (!block.asset || !block.asset._ref) {
      errors.push(this.createError(
        [...path, 'asset'],
        'Image block must have a valid asset reference',
        PORTABLE_TEXT_ERROR_CODES.MISSING_REQUIRED_FIELD,
        blockIndex
      ))
    }
  }

  private validateCodeBlock(
    block: any,
    path: string[],
    errors: PortableTextValidationError[],
    blockIndex: number
  ): void {
    if (!block.code || typeof block.code !== 'string') {
      errors.push(this.createError(
        [...path, 'code'],
        'Code block must have valid code content',
        PORTABLE_TEXT_ERROR_CODES.MISSING_REQUIRED_FIELD,
        blockIndex
      ))
    }
  }

  private validateCalloutBlock(
    block: any,
    path: string[],
    errors: PortableTextValidationError[],
    blockIndex: number
  ): void {
    const validTypes = ['info', 'warning', 'error', 'success']
    if (!block.calloutType || !validTypes.includes(block.calloutType)) {
      errors.push(this.createError(
        [...path, 'calloutType'],
        `Invalid callout type. Must be one of: ${validTypes.join(', ')}`,
        PORTABLE_TEXT_ERROR_CODES.MISSING_REQUIRED_FIELD,
        blockIndex
      ))
    }
  }

  private createError(
    path: string[],
    message: string,
    code: string,
    blockIndex?: number,
    spanIndex?: number
  ): PortableTextValidationError {
    const fieldPath = getFieldPath(this.context)
    const fullPath = fieldPath ? [fieldPath, ...path] : path

    return {
      path: fullPath,
      message,
      code,
      blockIndex,
      spanIndex
    }
  }
}

// Convenience function for validation
export function validatePortableText(
  value: PortableTextValue,
  config: PortableTextFieldConfig,
  context: FieldContext
): PortableTextValidationResult {
  const validator = new PortableTextValidator(config, context)
  return validator.validate(value)
}