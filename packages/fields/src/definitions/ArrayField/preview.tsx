import React from 'react';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { ArrayFieldDefinition } from './definition.js';

export function ArrayFieldPreview(props: FieldComponentProps) {
  const { value, definition } = props;
  const arrayDefinition = definition as ArrayFieldDefinition;
  const options = arrayDefinition.options || {};
  
  // Ensure value is an array
  const arrayValue = Array.isArray(value) ? value : [];
  
  if (arrayValue.length === 0) {
    return (
      <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        <span className="text-sm">Empty array</span>
      </div>
    );
  }
  
  const previewOptions = options.preview || {};
  const maxPreviewItems = previewOptions.maxPreviewItems || 3;
  const itemsToShow = arrayValue.slice(0, maxPreviewItems);
  const hasMore = arrayValue.length > maxPreviewItems;
  
  // Get display text for an item
  const getItemDisplayText = (item: any, index: number): string => {
    if (previewOptions.template) {
      // Simple template replacement - in production would use more sophisticated templating
      return previewOptions.template
        .replace('{title}', String(item?.title || item))
        .replace('{description}', String(item?.description || ''))
        .replace('{index}', String(index + 1));
    }
    
    // Default display based on item type
    switch (arrayDefinition.itemType) {
      case 'string':
      case 'number':
      case 'boolean':
        return String(item);
        
      case 'object':
        return item?.title || item?.name || JSON.stringify(item);
        
      case 'reference':
        return item?._ref || 'Reference';
        
      default:
        return String(item);
    }
  };
  
  // Get appropriate icon based on layout/type
  const getLayoutIcon = () => {
    switch (options.layout) {
      case 'select':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        );
      case 'checkboxes':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'radio':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'tags':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
        );
      case 'grid':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        );
      default: // list
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        );
    }
  };
  
  // Render based on layout
  if (options.layout === 'tags') {
    return (
      <div className="flex items-center space-x-2">
        {getLayoutIcon()}
        <div className="flex flex-wrap gap-1">
          {itemsToShow.map((item, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {getItemDisplayText(item, index)}
            </span>
          ))}
          {hasMore && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
              +{arrayValue.length - maxPreviewItems} more
            </span>
          )}
        </div>
      </div>
    );
  }
  
  // Default list-style preview
  return (
    <div className="flex items-center space-x-2">
      {getLayoutIcon()}
      <div className="flex items-center space-x-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {arrayValue.length} item{arrayValue.length !== 1 ? 's' : ''}
        </span>
        {itemsToShow.length > 0 && (
          <>
            <span className="text-gray-400">:</span>
            <div className="flex items-center space-x-1">
              {itemsToShow.map((item, index) => (
                <React.Fragment key={index}>
                  <span className="text-sm text-gray-600 dark:text-gray-400 max-w-[100px] truncate">
                    {getItemDisplayText(item, index)}
                  </span>
                  {index < itemsToShow.length - 1 && (
                    <span className="text-gray-400">,</span>
                  )}
                </React.Fragment>
              ))}
              {hasMore && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  +{arrayValue.length - maxPreviewItems}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}