/**
 * Shortcode Types for Client-Side Usage
 * Shared types for shortcode handling between Studio and Client
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

export interface MediaUrlResolver {
  getMediaUrl: (mediaId: string, variant?: string) => string;
}
/** A node of rich text stored as ProseMirror (TipTap) JSON, as far as resolving needs it */
export interface RichTextNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  [key: string]: unknown;
}

/** Rich text as a field stores it: HTML or Markdown text, or a ProseMirror document */
export type RichTextValue = string | RichTextNode;
