/**
 * Shortcode System for RichTextField
 * 
 * Provides bi-directional transformation between:
 * - Storage: Environment-agnostic shortcodes [trokky-image id="..." variant="..."]
 * - Studio: Real HTML images for visual editing
 */

export interface TrokkyImageShortcode {
  id: string;
  variant?: string;
  alt?: string;
  title?: string;
  className?: string;
  width?: string;
  height?: string;
}

export interface MediaUrlGenerator {
  getMediaUrl: (mediaId: string, variant?: string) => string;
}

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
 * Format attributes object to shortcode string
 */
export function formatShortcodeAttrs(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
}

/**
 * Create image shortcode from MediaFieldValue
 */
export function createImageShortcode(data: TrokkyImageShortcode): string {
  const attrs = {
    id: data.id,
    ...(data.variant && data.variant !== 'original' && { variant: data.variant }),
    ...(data.alt && { alt: data.alt }),
    ...(data.title && { title: data.title }),
    ...(data.className && { class: data.className }),
    ...(data.width && { width: data.width }),
    ...(data.height && { height: data.height })
  };
  
  const attrString = formatShortcodeAttrs(attrs);
  return `[trokky-image ${attrString}]`;
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
 * Convert shortcode to HTML image for Studio display
 * This is what users see while editing
 */
export function shortcodeToHtml(
  shortcode: string, 
  mediaUrlGenerator: MediaUrlGenerator
): string {
  const data = parseImageShortcode(shortcode);
  if (!data) return shortcode; // Return unchanged if not a valid shortcode
  
  const src = mediaUrlGenerator.getMediaUrl(data.id, data.variant);
  
  // Build HTML attributes
  const htmlAttrs = [
    `src="${src}"`,
    `data-trokky-id="${data.id}"`,
    ...(data.variant && data.variant !== 'original' ? [`data-trokky-variant="${data.variant}"`] : []),
    ...(data.alt ? [`alt="${data.alt}"`] : []),
    ...(data.title ? [`title="${data.title}"`] : []),
    ...(data.className ? [`class="${data.className}"`] : []),
    ...(data.width ? [`width="${data.width}"`] : []),
    ...(data.height ? [`height="${data.height}"`] : [])
  ];
  
  return `<img ${htmlAttrs.join(' ')}>`;
}

/**
 * Convert HTML image to shortcode for storage
 * This is what gets saved to the database
 */
export function htmlToShortcode(html: string): string {
  return html.replace(/<img[^>]*data-trokky-id="([^"]+)"[^>]*>/g, (match) => {
    const id = match.match(/data-trokky-id="([^"]+)"/)?.[1];
    const variant = match.match(/data-trokky-variant="([^"]+)"/)?.[1];
    const alt = match.match(/alt="([^"]*)"/)?.[1];
    const title = match.match(/title="([^"]*)"/)?.[1];
    const className = match.match(/class="([^"]*)"/)?.[1];
    const width = match.match(/width="([^"]*)"/)?.[1];
    const height = match.match(/height="([^"]*)"/)?.[1];
    
    if (!id) return match; // Keep original if no trokky-id
    
    return createImageShortcode({
      id,
      variant,
      alt,
      title,
      className,
      width,
      height
    });
  });
}

/**
 * Convert all shortcodes in content to HTML for Studio editing
 */
export function resolveShortcodes(
  content: string, 
  mediaUrlGenerator: MediaUrlGenerator
): string {
  return content.replace(/\[trokky-image\s+[^\]]+\]/g, (match) => {
    return shortcodeToHtml(match, mediaUrlGenerator);
  });
}

/**
 * Convert all HTML images to shortcodes for storage
 */
export function contentToShortcodes(content: string): string {
  return htmlToShortcode(content);
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