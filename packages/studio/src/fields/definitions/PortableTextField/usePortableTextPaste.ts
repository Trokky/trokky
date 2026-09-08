import { useCallback } from 'react';
import type React from 'react';
import type { PortableTextBlock, PortableTextFieldDefinition } from './definition';
import { generateKey } from './validation';
import { createStudioLogger } from '../../../utils/logger';

const logger = createStudioLogger('PortableTextField');

interface UsePortableTextPasteOptions {
  blocksToRender: PortableTextBlock[];
  updateContent: (blocks: PortableTextBlock[]) => void;
  options: NonNullable<PortableTextFieldDefinition['options']>;
}

/**
 * Pasting into a block: what the clipboard is allowed to bring in, and how the
 * lines it leaves behind become blocks.
 */
export function usePortableTextPaste({
  blocksToRender,
  updateContent,
  options,
}: UsePortableTextPasteOptions) {
  // Sanitize pasted content
  const sanitizePastedContent = useCallback((html: string): string => {
    // Create a temporary DOM element to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Remove all scripts, styles, and dangerous elements
    const dangerousElements = tempDiv.querySelectorAll('script, style, iframe, object, embed, form, input, button, link, meta');
    dangerousElements.forEach(el => el.remove());
    
    // Remove all event handlers and dangerous attributes
    const allElements = tempDiv.querySelectorAll('*');
    allElements.forEach(el => {
      // Remove all event attributes (onclick, onmouseover, etc.)
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on') || 
            ['javascript:', 'data:', 'vbscript:'].some(prefix => attr.value.toLowerCase().includes(prefix))) {
          el.removeAttribute(attr.name);
        }
      });
      
      // Remove dangerous attributes
      ['src', 'href', 'action', 'formaction', 'background', 'cite', 'codebase', 'data'].forEach(attr => {
        if (el.hasAttribute(attr)) {
          const value = el.getAttribute(attr);
          if (value && (value.toLowerCase().startsWith('javascript:') || 
                       value.toLowerCase().startsWith('data:') ||
                       value.toLowerCase().startsWith('vbscript:'))) {
            el.removeAttribute(attr);
          }
        }
      });
    });
    
    // Extract only plain text to be safe
    return tempDiv.textContent || tempDiv.innerText || '';
  }, []);
  
  // Handle paste events
  const handlePaste = useCallback((e: React.ClipboardEvent, blockKey: string) => {
    e.preventDefault();
    
    const clipboardData = e.clipboardData;
    const htmlData = clipboardData.getData('text/html');
    const textData = clipboardData.getData('text/plain');
    
    // Get paste security settings (default to strict mode for safety)
    const pasteSecurity = options.pasteSecurity || { mode: 'strict' };
    const mode = pasteSecurity.mode || 'strict';
    const maxLength = pasteSecurity.maxPasteLength || 10000;
    const warnOnUnsafe = pasteSecurity.warnOnUnsafeContent !== false;
    
    // Check for dangerous content and warn user
    if (warnOnUnsafe && htmlData && (
      htmlData.includes('<script') || 
      htmlData.includes('javascript:') ||
      htmlData.includes('on"') || 
      htmlData.includes('<iframe') ||
      htmlData.includes('<object') ||
      htmlData.includes('<embed')
    )) {
      logger.error('Dangerous content detected in paste', { 
        containsScript: htmlData.includes('<script'),
        containsJavascript: htmlData.includes('javascript:'),
        containsEventHandlers: htmlData.includes('on"'),
        containsIframe: htmlData.includes('<iframe')
      });
    }
    
    let sanitizedText: string;
    
    // Handle different security modes
    switch (mode) {
      case 'strict':
        // Always use plain text only - safest option
        sanitizedText = textData;
        break;
        
      case 'safe':
        // Use sanitized HTML content, fallback to plain text
        sanitizedText = htmlData ? sanitizePastedContent(htmlData) : textData;
        break;
        
      case 'permissive':
        // Minimal sanitization - only remove obvious threats
        if (htmlData) {
          sanitizedText = sanitizePastedContent(htmlData);
        } else {
          sanitizedText = textData;
        }
        break;
        
      default:
        sanitizedText = textData; // Default to strict
    }
    
    if (!sanitizedText) return;
    
    // Apply length limit
    if (sanitizedText.length > maxLength) {
      sanitizedText = sanitizedText.substring(0, maxLength);
      logger.warn('Paste content truncated due to length limit', { maxLength });
    }
    
    // Split pasted content into lines and create blocks
    const lines = sanitizedText.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return;
    
    // Update current block with first line
    const blocks = blocksToRender.map(block => {
      if (block._key === blockKey) {
        return {
          ...block,
          children: [{
            ...block.children![0],
            text: lines[0]
          }]
        };
      }
      return block;
    });
    
    // Create additional blocks for remaining lines
    if (lines.length > 1) {
      const currentIndex = blocks.findIndex(b => b._key === blockKey);
      for (let i = 1; i < lines.length; i++) {
        const newBlock: PortableTextBlock = {
          _key: generateKey(),
          _type: 'block',
          style: 'normal',
          children: [{
            _key: generateKey(),
            _type: 'span',
            text: lines[i],
            marks: []
          }]
        };
        blocks.splice(currentIndex + i, 0, newBlock);
      }
    }
    
    updateContent(blocks);
  }, [blocksToRender, updateContent, sanitizePastedContent, options.pasteSecurity]);
  return { sanitizePastedContent, handlePaste };
}
