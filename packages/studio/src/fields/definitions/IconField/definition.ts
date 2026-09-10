/**
 * Icon Field Definition
 * Field type for selecting icons from various icon libraries
 */

import { z } from 'zod';
import type { BaseFieldDefinition, BaseValidation, BaseFieldOptions } from '../../base/FieldDefinition.js';

// Supported icon libraries
export type IconLibrary = 'fontawesome' | 'heroicons' | 'lucide' | 'material' | 'custom';

// Heroicons styles
export type HeroiconsStyle = 'outline' | 'solid';

// FontAwesome styles
export type FontAwesomeStyle = 'solid' | 'regular' | 'brands' | 'light' | 'duotone';

// Icon value stored in database
export interface IconValue {
  library: IconLibrary;
  name: string;
  style?: string;
  // For custom icons
  svg?: string;
}

// Icon metadata for display
export interface IconMeta {
  name: string;
  label?: string;
  category?: string;
  tags?: string[];
  style?: string;
  unicode?: string;
}

// Custom icon definition with SVG path
export interface CustomIconDefinition {
  /** SVG path data (the "d" attribute) */
  path: string;
  /** Icon style: stroke (outline) or fill (solid) */
  style?: 'stroke' | 'fill';
  /** Display label */
  label?: string;
  /** Category for grouping */
  category?: string;
  /** Search tags */
  tags?: string[];
  /** Custom viewBox (defaults to "0 0 24 24") */
  viewBox?: string;
}

// Icon library adapter interface
export interface IconLibraryAdapter {
  name: IconLibrary;
  displayName: string;
  version?: string;
  getIcons: (options?: { style?: string; category?: string }) => IconMeta[];
  getCategories: () => string[];
  getStyles?: () => string[];
  renderIcon: (icon: IconMeta, size?: number) => React.ReactNode;
  searchIcons: (query: string, options?: { style?: string; category?: string }) => IconMeta[];
}

// Icon field validation
export interface IconFieldValidation extends Omit<BaseValidation, 'custom'> {
  /** Allowed icon libraries */
  allowedLibraries?: IconLibrary[];
  /** Allowed categories */
  allowedCategories?: string[];
  /** Custom validation function */
  custom?: (value: IconValue) => boolean | string;
}

// Icon field options
export interface IconFieldOptions extends BaseFieldOptions {
  /** Default icon library (single library mode) */
  library?: IconLibrary;
  /** Available libraries (multi-library mode) - if not specified, all registered libraries are available */
  libraries?: IconLibrary[];
  /** Default style for FontAwesome */
  style?: FontAwesomeStyle;
  /** Default style for Heroicons */
  heroiconsStyle?: HeroiconsStyle;
  /** Show only specific categories */
  categories?: string[];
  /** Enable search */
  allowSearch?: boolean;
  /** Show icon preview in field */
  showPreview?: boolean;
  /** Number of columns in grid */
  columns?: number;
  /** Icons per page */
  pageSize?: number;
  /** Show recently used icons */
  showRecent?: boolean;
  /** Custom icon set (for library: 'custom') - record of name to icon definition */
  customIcons?: Record<string, CustomIconDefinition>;
}

// Complete icon field definition
export interface IconFieldDefinition extends BaseFieldDefinition {
  type: 'icon';
  validation?: IconFieldValidation;
  options?: IconFieldOptions;
}

// Zod schema for validation
export const iconValueSchema = z.object({
  library: z.enum(['fontawesome', 'heroicons', 'lucide', 'material', 'custom']),
  name: z.string().min(1),
  style: z.string().optional(),
  svg: z.string().optional(),
});

export const iconFieldSchema = iconValueSchema.nullable();

/**
 * Coerce a stored icon value into the object form the field expects.
 *
 * Icon values used to be plain FontAwesome class strings ("fas fa-user"), and
 * documents written before the field became structured still hold them. The
 * editor has always rendered those, but validation used to reject them
 * outright, so a single unrelated edit turned every legacy icon in the
 * document into "Expected object, received string" with no way to fix it from
 * the UI. Normalising here means such documents stay editable.
 *
 * Returns null for anything genuinely unusable, which the nullable schema
 * accepts unless the field is required.
 */
export function normalizeIconValue(value: unknown): IconValue | null {
  if (!value) return null;
  if (typeof value === 'object') return value as IconValue;
  if (typeof value !== 'string') return null;

  const faMatch = value.match(/^(fas|far|fab|fal|fad)\s+(fa-[\w-]+)$/);
  if (faMatch) {
    const styleMap: Record<string, string> = {
      fas: 'solid',
      far: 'regular',
      fab: 'brands',
      fal: 'light',
      fad: 'duotone',
    };
    return {
      library: 'fontawesome' as const,
      name: faMatch[2],
      style: styleMap[faMatch[1]] || 'solid',
    };
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as IconValue) : null;
  } catch {
    return null;
  }
}

// Default configuration
export const ICON_FIELD_DEFAULTS: Partial<IconFieldDefinition> = {
  type: 'icon',
  options: {
    library: 'fontawesome',
    style: 'solid',
    allowSearch: true,
    showPreview: true,
    columns: 8,
    pageSize: 100,
    showRecent: true,
  },
};
