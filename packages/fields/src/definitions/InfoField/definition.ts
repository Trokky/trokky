/**
 * Info Field Definition
 * Display-only field for showing informational messages in the Studio
 */

import type { BaseFieldDefinition } from '../../base/FieldDefinition.js';

// Info field variants matching Studio design system
export type InfoVariant =
  | 'info'      // Blue - general information
  | 'warning'   // Yellow - warnings and cautions
  | 'tip'       // Green - helpful tips
  | 'success'   // Green - success messages
  | 'error';    // Red - error messages or critical info

// Info field specific options
export interface InfoFieldOptions {
  // Visual variant
  variant?: InfoVariant;

  // Whether content is markdown
  markdown?: boolean;

  // Whether the info box can be collapsed
  collapsible?: boolean;

  // Whether the info box starts collapsed
  defaultCollapsed?: boolean;

  // Custom icon (overrides variant default)
  icon?: string;

  // Custom CSS class
  className?: string;
}

// Info field definition
export interface InfoFieldDefinition extends BaseFieldDefinition {
  type: 'info';

  // Content to display
  content: string;

  // Info-specific options
  options?: InfoFieldOptions;
}

// Default options
export const INFO_FIELD_DEFAULTS: Required<Pick<InfoFieldOptions, 'variant' | 'markdown' | 'collapsible' | 'defaultCollapsed'>> = {
  variant: 'info',
  markdown: true,
  collapsible: false,
  defaultCollapsed: false,
};

// Variant styling configurations
export interface VariantConfig {
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconColor: string;
  icon: string;
}

export const VARIANT_CONFIGS: Record<InfoVariant, VariantConfig> = {
  info: {
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    textColor: 'text-blue-900 dark:text-blue-100',
    iconColor: 'text-blue-600 dark:text-blue-400',
    icon: 'information-circle',
  },
  warning: {
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    textColor: 'text-yellow-900 dark:text-yellow-100',
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    icon: 'exclamation-triangle',
  },
  tip: {
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-900 dark:text-green-100',
    iconColor: 'text-green-600 dark:text-green-400',
    icon: 'light-bulb',
  },
  success: {
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    textColor: 'text-green-900 dark:text-green-100',
    iconColor: 'text-green-600 dark:text-green-400',
    icon: 'check-circle',
  },
  error: {
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800',
    textColor: 'text-red-900 dark:text-red-100',
    iconColor: 'text-red-600 dark:text-red-400',
    icon: 'x-circle',
  },
};
