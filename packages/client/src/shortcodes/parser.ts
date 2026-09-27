/**
 * Shortcode Parser for Client-Side Usage
 * Handles parsing and resolving shortcodes in client applications
 */

import type { TrokkyImageShortcode, MediaUrlResolver, RichTextNode } from './types.js';

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
/** The placeholder ProseMirror storage puts in an image node's `src` */
const PROSEMIRROR_IMAGE_SRC = /^\[trokky-image:([^\]]+)\]$/;

/**
 * Resolve the image placeholders in rich text stored as ProseMirror JSON: each image node
 * whose `src` is `[trokky-image:<id>]` gets a real URL, for the variant in
 * `data-trokky-variant`. Returns a new document; the input is not changed.
 */
export function resolveProseMirrorShortcodes(
  node: RichTextNode,
  mediaUrlResolver: MediaUrlResolver
): RichTextNode {
  let resolved = node;
  const src = node.type === 'image' ? node.attrs?.src : undefined;
  const match = typeof src === 'string' ? src.match(PROSEMIRROR_IMAGE_SRC) : null;
  if (match) {
    const variant = node.attrs?.['data-trokky-variant'];
    resolved = {
      ...node,
      attrs: {
        ...node.attrs,
        src: mediaUrlResolver.getMediaUrl(match[1], typeof variant === 'string' ? variant : undefined)
      }
    };
  }
  if (Array.isArray(node.content)) {
    resolved = { ...resolved, content: node.content.map(child => resolveProseMirrorShortcodes(child, mediaUrlResolver)) };
  }
  return resolved;
}

/**
 * Point the images Studio stores in HTML and Markdown at another media base, such as the
 * site's own proxy route. Studio stores them with the CMS's own relative path
 * (`<img src="/api/media/<id>/variants/<v>" data-trokky-id="<id>" …>`, and
 * `![alt](/api/media/<id>/file)` in Markdown), which only resolves on the CMS's own origin.
 *
 * HTML images are recognised by `data-trokky-id`, or like Markdown images by a path on this
 * origin (or a URL on `apiUrl`) ending in `/media/<id>/file` or `/media/<id>/variants/<name>`.
 * Images from elsewhere, and Markdown inside code, are left alone.
 */
export function rebaseStoredMediaUrls(
  content: string,
  mediaUrlResolver: MediaUrlResolver,
  apiUrl?: string
): string {
  const origin = apiUrl ? apiUrl.replace(/\/+$/, '') : undefined;
  /** The media id and variant of a URL on the CMS (a path, or on `apiUrl`), else null */
  const storedMedia = (url: string): { id: string; variant?: string } | null => {
    const onCms = (url.startsWith('/') && !url.startsWith('//')) ||
      (origin !== undefined && url.startsWith(`${origin}/`));
    const match = url.match(/\/media\/([A-Za-z0-9_-]+)\/(?:file|variants\/([A-Za-z0-9_-]+))$/);
    return onCms && match ? { id: match[1], variant: match[2] } : null;
  };

  const html = content.replace(/<img\b[^>]*>/gi, (tag) => {
    // Walk the attributes in order, so a quoted value that merely contains `src="` is skipped
    const attrs: Array<{ name: string; value: string; start: number; end: number }> = [];
    const attrPattern = /\s([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (let m = attrPattern.exec(tag); m; m = attrPattern.exec(tag)) {
      const value = m[2] ?? m[3] ?? m[4] ?? '';
      const valueStart = m.index + m[0].length - value.length - (m[2] !== undefined || m[3] !== undefined ? 1 : 0);
      attrs.push({ name: m[1].toLowerCase(), value, start: valueStart, end: valueStart + value.length });
    }
    const attr = (name: string) => attrs.find(a => a.name === name);
    const src = attr('src');
    if (!src) return tag;
    const id = attr('data-trokky-id')?.value;
    const media = id && /^[A-Za-z0-9_-]+$/.test(id)
      ? { id, variant: attr('data-trokky-variant')?.value.match(/^[A-Za-z0-9_-]+$/)?.[0] }
      : storedMedia(src.value);
    if (!media) return tag;
    const url = mediaUrlResolver.getMediaUrl(media.id, media.variant);
    return tag.slice(0, src.start) + url + tag.slice(src.end);
  });

  // Markdown images, leaving code (fenced blocks and inline spans) as written
  return html.replace(
    /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)|(!\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g,
    (whole, code: string | undefined, open: string, url: string, close: string) => {
      if (code !== undefined) return whole;
      const media = storedMedia(url);
      return media ? `${open}${mediaUrlResolver.getMediaUrl(media.id, media.variant)}${close}` : whole;
    }
  );
}
