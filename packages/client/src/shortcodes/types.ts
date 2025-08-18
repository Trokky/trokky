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