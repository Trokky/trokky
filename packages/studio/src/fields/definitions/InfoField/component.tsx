/**
 * Info Field Component
 * Display-only field for showing informational messages with markdown support
 */

import React, { useState } from 'react';
import { useT } from 'trokky/i18n';
import type { FieldComponentProps } from '../../base/FieldPlugin.js';
import type { InfoFieldDefinition, InfoVariant } from './definition.js';
import { INFO_FIELD_DEFAULTS, VARIANT_CONFIGS } from './definition.js';

type InfoFieldComponentProps = FieldComponentProps;

/**
 * Simple markdown to HTML converter for basic formatting
 * Supports: bold, italic, code, links, headings, lists
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Escape HTML first
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers (## Header)
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-base font-semibold mb-2 mt-3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold mb-2 mt-4">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mb-3 mt-4">$1</h1>');

  // Bold (**text**)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>');

  // Italic (*text*)
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-sm font-mono">$1</code>');

  // Links ([text](url))
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');

  // Unordered lists (- item)
  html = html.replace(/^\- (.+)$/gim, '<li class="ml-4">$1</li>');
  html = html.replace(/(<li.*<\/li>)/s, '<ul class="list-disc ml-4 my-2">$1</ul>');

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p class="mb-2">');
  html = html.replace(/\n/g, '<br />');

  // Wrap in paragraph if not already wrapped
  if (!html.startsWith('<h') && !html.startsWith('<ul') && !html.startsWith('<p')) {
    html = `<p class="mb-2">${html}</p>`;
  }

  return html;
}

/**
 * Get Heroicon component by name
 */
function getHeroIcon(iconName: string) {
  // Simple SVG icons as fallback
  const svgIcons: Record<string, React.ReactElement> = {
    'information-circle': (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    'exclamation-triangle': (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    'light-bulb': (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    'check-circle': (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    'x-circle': (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return svgIcons[iconName] || svgIcons['information-circle'];
}

export function InfoFieldComponent(props: InfoFieldComponentProps) {
  const { definition } = props;
  const { t } = useT('fields');

  // Type-safe access to info field specific properties
  const infoDefinition = definition as InfoFieldDefinition;
  const options = infoDefinition.options || {};

  // Get configuration
  const variant: InfoVariant = options.variant || INFO_FIELD_DEFAULTS.variant;
  const markdown = options.markdown !== undefined ? options.markdown : INFO_FIELD_DEFAULTS.markdown;
  const collapsible = options.collapsible !== undefined ? options.collapsible : INFO_FIELD_DEFAULTS.collapsible;
  const defaultCollapsed = options.defaultCollapsed !== undefined ? options.defaultCollapsed : INFO_FIELD_DEFAULTS.defaultCollapsed;

  // State for collapsible
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Get variant configuration
  const variantConfig = VARIANT_CONFIGS[variant];
  const icon = options.icon ? getHeroIcon(options.icon) : getHeroIcon(variantConfig.icon);

  // Process content
  const content = infoDefinition.content || '';
  const processedContent = markdown ? markdownToHtml(content) : content;

  // Render
  return (
    <div
      className={`
        rounded-lg border p-4
        ${variantConfig.bgColor}
        ${variantConfig.borderColor}
        ${variantConfig.textColor}
        ${options.className || ''}
      `.trim()}
    >
      <div className="flex items-start gap-3">
        {/* Collapsible chevron on the left */}
        {collapsible && (
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={`flex-shrink-0 ${variantConfig.iconColor} hover:opacity-70 transition-all mt-0.5`}
            aria-label={isCollapsed ? t('types.info.expand') : t('types.info.collapse')}
          >
            <svg
              className={`w-5 h-5 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Icon (if not collapsible, or always show) */}
        {!collapsible && (
          <div className={`flex-shrink-0 ${variantConfig.iconColor} mt-0.5`}>
            {icon}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          {infoDefinition.title && (
            <h4 className="text-sm font-semibold mb-2">
              {infoDefinition.title}
            </h4>
          )}

          {/* Description (if provided) */}
          {infoDefinition.description && (
            <p className="text-xs opacity-80 mb-2">
              {infoDefinition.description}
            </p>
          )}

          {/* Content */}
          {(!collapsible || !isCollapsed) && (
            <div className="text-sm">
              {markdown ? (
                <div
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: processedContent }}
                />
              ) : (
                <div className="whitespace-pre-wrap">
                  {content}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
