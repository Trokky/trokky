/**
 * Shortcode Support for Trokky Client
 * 
 * This module provides client-side support for the shortcode system implemented
 * in RichTextField. It allows developers to easily resolve shortcodes in their
 * applications for portable content across environments.
 */

export type { TrokkyImageShortcode, MediaUrlResolver } from './types';

export {
  parseShortcodeAttrs,
  parseImageShortcode,
  shortcodeToHtml,
  resolveShortcodes,
  hasShortcodes,
  extractImageShortcodes
} from './parser';

export {
  createMediaUrlResolver,
  ShortcodeResolver
} from './resolver';