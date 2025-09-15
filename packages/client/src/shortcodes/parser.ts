/**
 * Shortcode Parser for Client-Side Usage
 * Handles parsing and resolving shortcodes in client applications
 */

import type { TrokkyImageShortcode, MediaUrlResolver } from './types.js';

/**
 * Parse shortcode attributes from string
 * Example: 'id="media-123" variant="thumbnail" alt="Alt text"'
 */
export function parseShortcodeAttrs(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  
  // Match attribute="value" patterns
  const attrRegex = /(\w+)="([^"]*)"/g;
  let match;
  
  while ((match = attrRegex.exec(attrString)) !== null) {
    const [, key, value] = match;
    attrs[key] = value;
  }
  
  return attrs;
}

/**
 * Parse image shortcode to data object
 */
export function parseImageShortcode(shortcode: string): TrokkyImageShortcode | null {
  const match = shortcode.match(/\[trokky-image\s+([^\]]+)\]/);
  if (!match) return null;
  
  const attrs = parseShortcodeAttrs(match[1]);
  
  if (!attrs.id) return null;
  
  return {
    id: attrs.id,
    variant: attrs.variant,
    alt: attrs.alt,
    title: attrs.title,
    className: attrs.class || attrs.className,
    width: attrs.width,
    height: attrs.height
  };
}

/**
 * Convert shortcode to HTML image for display
 * This resolves shortcodes to actual HTML for rendering
 */
export function shortcodeToHtml(
  shortcode: string, 
  mediaUrlResolver: MediaUrlResolver
): string {
  const data = parseImageShortcode(shortcode);
  if (!data) return shortcode; // Return unchanged if not a valid shortcode
  
  const src = mediaUrlResolver.getMediaUrl(data.id, data.variant);
  
  // Build HTML attributes
  const htmlAttrs = [
    `src="${src}"`,
    ...(data.alt ? [`alt="${data.alt}"`] : []),
    ...(data.title ? [`title="${data.title}"`] : []),
    ...(data.className ? [`class="${data.className}"`] : []),
    ...(data.width ? [`width="${data.width}"`] : []),
    ...(data.height ? [`height="${data.height}"`] : [])
  ];
  
  return `<img ${htmlAttrs.join(' ')}>`;
}

/**
 * Convert all shortcodes in content to HTML for display
 */
export function resolveShortcodes(
  content: string, 
  mediaUrlResolver: MediaUrlResolver
): string {
  return content.replace(/\[trokky-image\s+[^\]]+\]/g, (match) => {
    return shortcodeToHtml(match, mediaUrlResolver);
  });
}

/**
 * Validate if a string contains Trokky shortcodes
 */
export function hasShortcodes(content: string): boolean {
  return /\[trokky-image\s+[^\]]+\]/g.test(content);
}

/**
 * Extract all image shortcodes from content
 */
export function extractImageShortcodes(content: string): TrokkyImageShortcode[] {
  const shortcodes: TrokkyImageShortcode[] = [];
  const matches = content.matchAll(/\[trokky-image\s+[^\]]+\]/g);
  
  for (const match of matches) {
    const data = parseImageShortcode(match[0]);
    if (data) {
      shortcodes.push(data);
    }
  }
  
  return shortcodes;
}