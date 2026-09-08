import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { PortableTextFieldDefinition, PortableTextContent, PortableTextBlock } from './definition.js';
import { getPlainTextFromPortableText, getPortableTextStats } from './validation.js';

type PortableTextFieldPreviewProps = FieldComponentProps;

export function PortableTextFieldPreview(props: PortableTextFieldPreviewProps) {
  const { definition, value } = props;
  
  if (definition.type !== 'portable') {
    return <span className="text-red-500 text-sm">Invalid field type</span>;
  }
  
  const portableDefinition = definition as PortableTextFieldDefinition;
  const options = portableDefinition.options || {};
  const portableValue = value as PortableTextContent;
  
  if (!portableValue || !portableValue.blocks || portableValue.blocks.length === 0) {
    return (
      <span className="text-gray-400 dark:text-gray-500 text-sm italic">
        No content
      </span>
    );
  }
  
  const textContent = getPlainTextFromPortableText(portableValue);
  const stats = getPortableTextStats(portableValue);
  
  if (!textContent.trim()) {
    return (
      <span className="text-gray-400 dark:text-gray-500 text-sm italic">
        Empty content
      </span>
    );
  }
  const maxPreviewLength = 150;

  // Render a simplified version of the blocks
  const renderBlockPreview = (block: PortableTextBlock, index: number) => {
    const text = block.children?.[0]?.text || '';
    if (!text.trim()) return null;
    
    const truncatedBlockText = text.length > 80 ? text.slice(0, 80) + '...' : text;
    
    switch (block.style) {
      case 'h1':
        return <h1 key={index} className="text-lg font-bold text-gray-900 dark:text-gray-100">{truncatedBlockText}</h1>;
      case 'h2':
        return <h2 key={index} className="text-base font-bold text-gray-900 dark:text-gray-100">{truncatedBlockText}</h2>;
      case 'h3':
        return <h3 key={index} className="text-sm font-bold text-gray-900 dark:text-gray-100">{truncatedBlockText}</h3>;
      case 'blockquote':
        return <blockquote key={index} className="text-sm italic text-gray-700 dark:text-gray-300 border-l-2 border-gray-300 dark:border-gray-600 pl-2">{truncatedBlockText}</blockquote>;
      default:
        return <p key={index} className="text-sm text-gray-900 dark:text-gray-100">{truncatedBlockText}</p>;
    }
  };
  
  const previewBlocks = portableValue.blocks.slice(0, 3); // Show first 3 blocks
  const hasMoreBlocks = portableValue.blocks.length > 3;
  
  return (
    <div className="space-y-2">
      {/* Content preview */}
      <div className="space-y-1">
        {previewBlocks.map((block, index) => renderBlockPreview(block, index))}
        
        {hasMoreBlocks && (
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">
            ...and {portableValue.blocks.length - 3} more block{portableValue.blocks.length - 3 !== 1 ? 's' : ''}
          </p>
        )}
      </div>
      
      {/* Content stats */}
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Portable
        </span>
        
        {(options.showBlockCount !== false) && (
          <span>{stats.blocks} block{stats.blocks !== 1 ? 's' : ''}</span>
        )}
        
        {(options.showWordCount !== false) && (
          <span>{stats.words} word{stats.words !== 1 ? 's' : ''}</span>
        )}
        
        {(options.showCharacterCount !== false) && (
          <span>{stats.characters} char{stats.characters !== 1 ? 's' : ''}</span>
        )}
        
        {textContent.length > maxPreviewLength && (
          <span className="text-gray-400">
            +{textContent.length - maxPreviewLength} more chars
          </span>
        )}
      </div>
      
      {/* Block type indicators */}
      {portableValue.blocks.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Array.from(new Set(portableValue.blocks.map(block => block.style || 'normal')))
            .slice(0, 4)
            .map(style => (
              <span 
                key={style}
                className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1 py-0.5 rounded"
              >
                {style === 'normal' ? 'text' : style}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}