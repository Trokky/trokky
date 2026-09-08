import { useT } from '@trokky/trokky/i18n';
import type { PortableTextBlock } from './definition';
import { getBlockPresentation, getMarkClasses } from './blockStyles';

interface PortableTextRendererProps {
  blocks: PortableTextBlock[];
}

/**
 * The read-only rendering of portable text: one element per block, marks as
 * classes, and link markDefs resolved to anchors.
 */
export function PortableTextRenderer({ blocks }: PortableTextRendererProps) {
  const { t } = useT('fields');

  if (!blocks || blocks.length === 0) {
    return <span className="text-gray-500 dark:text-gray-400 italic text-sm">{t('types.portableText.noContent')}</span>;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block) => {
        const text = block.children?.[0]?.text || '';
        const marks = block.children?.[0]?.marks || [];

        // Determine element type based on block style
        const { BlockElement, blockClasses } = getBlockPresentation(block.style);

        // Apply text marks
        const markClasses = getMarkClasses(marks);

        // Handle links
        const linkMark = block.markDefs?.find(mark => mark._type === 'link' && marks.includes(mark._key));
        const isLink = linkMark && linkMark.href;

        const content = text || <em className="text-gray-400">{t('types.portableText.emptyBlock')}</em>;

        return (
          <BlockElement
            key={block._key}
            className={`text-gray-900 dark:text-gray-100 ${blockClasses}${markClasses}`}
          >
            {isLink ? (
              <a
                href={linkMark.href}
                className="text-blue-600 dark:text-blue-400 underline hover:text-blue-700 dark:hover:text-blue-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                {content}
              </a>
            ) : (
              content
            )}
          </BlockElement>
        );
      })}
    </div>
  );
}
