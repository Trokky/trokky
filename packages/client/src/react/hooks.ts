/**
 * React Hooks for Shortcode Support
 * Optional React integration for easy shortcode handling
 */

// Note: This file assumes React is available in the consuming application
// Import types only to avoid runtime dependency
import type { DependencyList } from 'react';
import type { TrokkyClient } from '../client.js';

// Import React dynamically to avoid build-time dependency
declare const React: any;

/**
 * Hook to resolve shortcodes in content using TrokkyClient
 * 
 * @param client TrokkyClient instance
 * @param content Content that may contain shortcodes
 * @returns Resolved content with HTML images
 * 
 * @example
 * ```tsx
 * function BlogPost({ content }: { content: string }) {
 *   const client = useTrokkyClient(); // Your client instance
 *   const resolvedContent = useResolvedContent(client, content);
 *   
 *   return (
 *     <div dangerouslySetInnerHTML={{ __html: resolvedContent }} />
 *   );
 * }
 * ```
 */
export function useResolvedContent(client: TrokkyClient, content: string): string {
  return React.useMemo(() => {
    if (!content || !client) return content;
    return client.resolveContent(content);
  }, [client, content]);
}

/**
 * Hook to check if content has shortcodes
 * 
 * @param client TrokkyClient instance
 * @param content Content to check
 * @returns Boolean indicating if content contains shortcodes
 */
export function useHasShortcodes(client: TrokkyClient, content: string): boolean {
  return React.useMemo(() => {
    if (!content || !client) return false;
    return client.hasShortcodes(content);
  }, [client, content]);
}

/**
 * Hook to extract media dependencies from content
 * 
 * @param client TrokkyClient instance  
 * @param content Content to analyze
 * @returns Array of image shortcode data
 */
export function useContentMedia(client: TrokkyClient, content: string) {
  return React.useMemo(() => {
    if (!content || !client) return [];
    return client.extractContentMedia(content);
  }, [client, content]);
}