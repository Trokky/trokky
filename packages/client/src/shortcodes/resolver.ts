/**
 * Shortcode Resolver for Client Applications
 * High-level utilities for resolving shortcodes in client content
 */

import type { HttpClient } from '../http/client.js';
import type { MediaHelper } from '../media/helper.js';
import type { MediaUrlResolver, RichTextNode, RichTextValue } from './types.js';
import { resolveShortcodes, hasShortcodes, extractImageShortcodes, resolveProseMirrorShortcodes, rebaseStoredMediaUrls } from './parser.js';

/**
 * Create a media URL resolver from TrokkyClient's MediaHelper
 */
export function createMediaUrlResolver(
  http: HttpClient,
  mediaHelper?: MediaHelper,
  mediaBaseUrl?: string
): MediaUrlResolver {
  return {
    getMediaUrl: (mediaId: string, variant?: string) => {
      const base = mediaBaseUrl !== undefined ? mediaBaseUrl.replace(/\/+$/, '') : `${http.getBaseUrl()}/media`;
      if (!variant || variant === 'original') {
        return `${base}/${mediaId}/file`;
      }
      return `${base}/${mediaId}/variants/${variant}`;
    }
  };
}

/**
 * Shortcode Resolver class for convenient shortcode handling
 */
export class ShortcodeResolver {
  private mediaUrlResolver: MediaUrlResolver;
  
  constructor(
    private http: HttpClient,
    private mediaHelper?: MediaHelper,
    private mediaBaseUrl?: string
  ) {
    this.mediaUrlResolver = createMediaUrlResolver(http, mediaHelper, mediaBaseUrl);
  }

  /**
   * Resolve shortcodes in content to HTML
   * 
   * @param content Content that may contain shortcodes
   * @returns Content with shortcodes resolved to HTML
   * 
   * @example
   * ```typescript
   * const resolver = new ShortcodeResolver(httpClient);
   * const htmlContent = resolver.resolveContent(rawContent);
   * ```
   */
  resolveContent(content: string | null | undefined, options?: { mediaBaseUrl?: string }): string;
  resolveContent(content: RichTextNode, options?: { mediaBaseUrl?: string }): RichTextNode;
  resolveContent(content: RichTextValue | null | undefined, options?: { mediaBaseUrl?: string }): RichTextValue;
  resolveContent(content: RichTextValue | null | undefined, options?: { mediaBaseUrl?: string }): RichTextValue {
    if (content === null || content === undefined) return '';
    const mediaBaseUrl = options?.mediaBaseUrl ?? this.mediaBaseUrl;
    const resolver = options?.mediaBaseUrl !== undefined
      ? createMediaUrlResolver(this.http, this.mediaHelper, options.mediaBaseUrl)
      : this.mediaUrlResolver;
    if (typeof content !== 'string') {
      return resolveProseMirrorShortcodes(content, resolver);
    }
    // Stored images keep the path they were saved with, which works on the CMS's own origin.
    // With a media base they are rebuilt from their media id, so where the API was when the
    // content was saved stops mattering.
    const rebased = mediaBaseUrl !== undefined
      ? rebaseStoredMediaUrls(content, resolver, this.http.getBaseUrl())
      : content;
    // Placeholders written by earlier Studio versions
    return hasShortcodes(rebased) ? resolveShortcodes(rebased, resolver) : rebased;
  }

  /**
   * Check if content contains shortcodes
   */
  hasShortcodes(content: string): boolean {
    return hasShortcodes(content);
  }

  /**
   * Extract all image shortcodes from content
   * Useful for preloading media or understanding content dependencies
   */
  extractImageShortcodes(content: string) {
    return extractImageShortcodes(content);
  }

  /**
   * Get media URLs for all images in content
   * Useful for preloading or prefetching
   */
  async getContentMediaUrls(content: string): Promise<string[]> {
    const shortcodes = this.extractImageShortcodes(content);
    const urls: string[] = [];
    
    for (const shortcode of shortcodes) {
      const url = this.mediaUrlResolver.getMediaUrl(shortcode.id, shortcode.variant);
      urls.push(url);
    }
    
    return urls;
  }

  /**
   * Preload all media in content
   * Creates link preload tags for faster loading
   */
  async preloadContentMedia(content: string): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return; // Server-side, skip preloading
    }
    
    const urls = await this.getContentMediaUrls(content);
    
    for (const url of urls) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    }
  }

  /**
   * Get the underlying media URL resolver
   */
  getMediaUrlResolver(): MediaUrlResolver {
    return this.mediaUrlResolver;
  }
}