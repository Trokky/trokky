/**
 * HTML Sanitization utilities for RichTextField
 * Provides XSS protection for pasted content
 */

import type { PasteSecurityConfig } from './definition.js';

interface SanitizationResult {
  sanitizedContent: string;
  originalContent: string;
  wasModified: boolean;
  warnings: string[];
}

// Default security configurations
export const SECURITY_PRESETS: Record<string, PasteSecurityConfig> = {
  strict: {
    mode: 'strict',
    maxPasteLength: 5000,
    allowedTags: [],
    allowedAttributes: {},
    linkPolicy: 'strip',
    allowedDomains: [],
    imagePolicy: 'strip',
    showSanitizationWarning: true,
    stripFormatting: true
  },
  safe: {
    mode: 'safe',
    maxPasteLength: 10000,
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'code', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'],
    allowedAttributes: {
      'a': ['href', 'title']
    },
    linkPolicy: 'sanitize',
    allowedDomains: [],
    imagePolicy: 'strip',
    showSanitizationWarning: true,
    stripFormatting: false
  },
  permissive: {
    mode: 'permissive',
    maxPasteLength: 50000,
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'code', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'img', 'pre', 'span', 'div'],
    allowedAttributes: {
      'a': ['href', 'title', 'target'],
      'img': ['src', 'alt', 'width', 'height'],
      'span': ['style'],
      'div': ['style']
    },
    linkPolicy: 'validate',
    allowedDomains: ['github.com', 'stackoverflow.com', 'developer.mozilla.org'],
    imagePolicy: 'allow',
    showSanitizationWarning: true,
    stripFormatting: false
  }
};

/**
 * Validates and sanitizes URLs
 */
export function sanitizeUrl(url: string, policy: 'strip' | 'sanitize' | 'validate', allowedDomains: string[] = []): string | null {
  if (!url) return null;
  
  // Strip javascript:, data:, vbscript:, and other dangerous protocols
  const dangerousProtocols = /^(javascript|data|vbscript|file|about):/i;
  if (dangerousProtocols.test(url)) {
    return policy === 'strip' ? null : '#';
  }
  
  // For relative URLs, allow them
  if (url.startsWith('/') || url.startsWith('#') || url.startsWith('?')) {
    return url;
  }
  
  // For absolute URLs, check protocol and domain
  try {
    const urlObj = new URL(url);
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return policy === 'strip' ? null : '#';
    }
    
    // In validate mode, check against allowlist
    if (policy === 'validate' && allowedDomains.length > 0) {
      const isAllowed = allowedDomains.some(domain => 
        urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
      );
      if (!isAllowed) {
        return '#';
      }
    }
    
    return url;
  } catch {
    return policy === 'strip' ? null : '#';
  }
}

/**
 * Simple HTML tag and attribute sanitizer
 */
export function sanitizeHtml(html: string, config: PasteSecurityConfig): SanitizationResult {
  const warnings: string[] = [];
  let wasModified = false;
  const originalContent = html;
  
  // Length check
  if (config.maxPasteLength && html.length > config.maxPasteLength) {
    html = html.substring(0, config.maxPasteLength);
    warnings.push(`Content truncated to ${config.maxPasteLength} characters`);
    wasModified = true;
  }
  
  // Strict mode: strip all HTML
  if (config.mode === 'strict' || config.stripFormatting) {
    const textContent = html.replace(/<[^>]*>/g, '');
    if (textContent !== html) {
      warnings.push('All HTML formatting was removed for security');
      wasModified = true;
    }
    return {
      sanitizedContent: textContent,
      originalContent,
      wasModified,
      warnings
    };
  }
  
  // Parse HTML and sanitize
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const container = doc.querySelector('div');
  
  if (!container) {
    return {
      sanitizedContent: html,
      originalContent,
      wasModified: false,
      warnings: []
    };
  }
  
  // Walk through all elements and sanitize
  const walker = doc.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT,
    null
  );
  
  const elementsToRemove: Element[] = [];
  let node = walker.nextNode() as Element;
  
  while (node) {
    const tagName = node.tagName.toLowerCase();
    
    // Check if tag is allowed
    if (!config.allowedTags?.includes(tagName)) {
      // Remove disallowed tags but keep content
      elementsToRemove.push(node);
      warnings.push(`Removed unsupported tag: ${tagName}`);
      wasModified = true;
    } else {
      // Sanitize attributes
      const allowedAttrs = config.allowedAttributes?.[tagName] || [];
      const attributesToRemove: string[] = [];
      
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i];
        const attrName = attr.name.toLowerCase();
        
        if (!allowedAttrs.includes(attrName)) {
          attributesToRemove.push(attrName);
          wasModified = true;
        } else if (attrName === 'href') {
          // Special handling for links
          const sanitizedUrl = sanitizeUrl(attr.value, config.linkPolicy || 'sanitize', config.allowedDomains);
          if (sanitizedUrl !== attr.value) {
            if (sanitizedUrl === null) {
              attributesToRemove.push(attrName);
            } else {
              node.setAttribute(attrName, sanitizedUrl);
            }
            warnings.push(`Sanitized or removed unsafe URL in ${tagName}`);
            wasModified = true;
          }
        } else if (attrName === 'src' && tagName === 'img') {
          // Handle images based on policy
          if (config.imagePolicy === 'strip') {
            elementsToRemove.push(node);
            warnings.push('Removed image for security');
            wasModified = true;
          } else if (config.imagePolicy === 'proxy') {
            // In a real implementation, you'd proxy through your CDN
            warnings.push('Image should be proxied through secure CDN');
          }
        }
      }
      
      // Remove disallowed attributes
      attributesToRemove.forEach(attrName => {
        node.removeAttribute(attrName);
      });
    }
    
    node = walker.nextNode() as Element;
  }
  
  // Remove flagged elements (do this after walking to avoid iterator issues)
  elementsToRemove.forEach(element => {
    // Move children up before removing element
    while (element.firstChild) {
      element.parentNode?.insertBefore(element.firstChild, element);
    }
    element.parentNode?.removeChild(element);
  });
  
  return {
    sanitizedContent: container.innerHTML,
    originalContent,
    wasModified,
    warnings
  };
}

/**
 * Main sanitization function for pasted content
 */
export function sanitizePastedContent(
  content: string,
  config: PasteSecurityConfig
): SanitizationResult {
  // Merge with defaults
  const mergedConfig = {
    ...SECURITY_PRESETS[config.mode || 'safe'],
    ...config
  };
  
  return sanitizeHtml(content, mergedConfig);
}