import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { RichTextFieldDefinition } from './definition.js';
import { getTextContent, getHTMLContent, stripHTML } from './validation.js';

type RichTextFieldPreviewProps = FieldComponentProps;

export function RichTextFieldPreview(props: RichTextFieldPreviewProps) {
  const { definition, value } = props;
  
  if (definition.type !== 'richtext') {
    return <span className="text-red-500 text-sm">Invalid field type</span>;
  }
  
  const richtextDefinition = definition as RichTextFieldDefinition;
  const options = richtextDefinition.options || {};
  
  const textContent = getTextContent(value);
  const htmlContent = getHTMLContent(value);
  
  if (!textContent.trim()) {
    return (
      <span className="text-gray-400 dark:text-gray-500 text-sm italic">
        No content
      </span>
    );
  }
  
  // Truncate content for preview
  const maxPreviewLength = 150;
  const truncatedText = textContent.length > maxPreviewLength 
    ? textContent.slice(0, maxPreviewLength) + '...'
    : textContent;
  
  // Count words and characters
  const wordCount = textContent.trim().split(/\s+/).filter(word => word.length > 0).length;
  const charCount = textContent.length;
  
  // Check if content has formatting
  const hasFormatting = htmlContent !== textContent && htmlContent.includes('<');
  
  return (
    <div className="space-y-2">
      {/* Content preview */}
      <div className="text-sm text-gray-900 dark:text-gray-100">
        {hasFormatting ? (
          <div 
            className="rich-text-preview prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ 
              __html: htmlContent.length > maxPreviewLength 
                ? stripHTML(htmlContent).slice(0, maxPreviewLength) + '...'
                : htmlContent 
            }}
          />
        ) : (
          <p className="whitespace-pre-wrap">{truncatedText}</p>
        )}
      </div>
      
      {/* Content stats */}
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        {(options.showWordCount !== false) && (
          <span>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
        )}
        
        {(options.showCharacterCount !== false) && (
          <span>{charCount} char{charCount !== 1 ? 's' : ''}</span>
        )}
        
        {hasFormatting && (
          <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Rich
          </span>
        )}
        
        {textContent.length > maxPreviewLength && (
          <span className="text-gray-400">
            +{textContent.length - maxPreviewLength} more chars
          </span>
        )}
      </div>
    </div>
  );
}