/**
 * Color Field Definition
 * Provides color picker with various format support
 */

import { z } from 'zod'
import type { BaseFieldDefinition } from '../../base/index.js'

export interface ColorFieldOptions {
  /**
   * Color format to use for storage
   * @default 'hex'
   */
  format?: 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla'

  /**
   * Enable alpha channel (transparency)
   * @default false
   */
  enableAlpha?: boolean

  /**
   * Predefined color swatches for quick selection
   */
  swatches?: string[]

  /**
   * Default color value
   * @default '#000000'
   */
  defaultValue?: string

  /**
   * Show format switcher in UI
   * @default false
   */
  showFormatSwitcher?: boolean

  /**
   * Show color code input
   * @default true
   */
  showInput?: boolean

  /**
   * Enable eyedropper tool (if browser supports it)
   * @default true
   */
  enableEyedropper?: boolean
}

export interface ColorFieldValidation {
  /**
   * List of allowed colors (whitelist)
   */
  allowedColors?: string[]

  /**
   * List of forbidden colors (blacklist)
   */
  forbiddenColors?: string[]

  /**
   * Custom validation function
   */
  custom?: (value: string) => boolean | string
}

export interface ColorFieldDefinition extends BaseFieldDefinition {
  type: 'color'
  options?: ColorFieldOptions
  validation?: ColorFieldValidation
}

// Default swatches - Material Design colors
export const DEFAULT_SWATCHES = [
  '#F44336', // Red
  '#E91E63', // Pink
  '#9C27B0', // Purple
  '#673AB7', // Deep Purple
  '#3F51B5', // Indigo
  '#2196F3', // Blue
  '#03A9F4', // Light Blue
  '#00BCD4', // Cyan
  '#009688', // Teal
  '#4CAF50', // Green
  '#8BC34A', // Light Green
  '#CDDC39', // Lime
  '#FFEB3B', // Yellow
  '#FFC107', // Amber
  '#FF9800', // Orange
  '#FF5722', // Deep Orange
  '#795548', // Brown
  '#9E9E9E', // Grey
  '#607D8B', // Blue Grey
  '#000000', // Black
  '#FFFFFF', // White
]

export const COLOR_FIELD_DEFAULTS: ColorFieldOptions = {
  format: 'hex',
  enableAlpha: false,
  swatches: DEFAULT_SWATCHES,
  defaultValue: '#000000',
  showFormatSwitcher: false,
  showInput: true,
  enableEyedropper: true,
}

// Validation schema
export const colorFieldSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/)
