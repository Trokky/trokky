/**
 * How a portable text block style maps to an element and its classes, and how
 * a span's marks map to classes. The read-only renderer and the editor both
 * read from here so a block looks the same in either.
 */

type BlockTag = 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'blockquote';

export interface BlockPresentation {
  BlockElement: BlockTag;
  blockClasses: string;
}

export function getBlockPresentation(style: string | undefined): BlockPresentation {
  let BlockElement: BlockTag = 'p';
  let blockClasses = '';

  switch (style) {
    case 'h1':
      BlockElement = 'h1';
      blockClasses = 'text-3xl font-bold mb-4 mt-6';
      break;
    case 'h2':
      BlockElement = 'h2';
      blockClasses = 'text-2xl font-semibold mb-3 mt-5';
      break;
    case 'h3':
      BlockElement = 'h3';
      blockClasses = 'text-xl font-semibold mb-2 mt-4';
      break;
    case 'h4':
      BlockElement = 'h4';
      blockClasses = 'text-lg font-medium mb-2 mt-3';
      break;
    case 'h5':
      BlockElement = 'h5';
      blockClasses = 'text-base font-medium mb-1 mt-2';
      break;
    case 'h6':
      BlockElement = 'h6';
      blockClasses = 'text-sm font-medium mb-1 mt-2';
      break;
    case 'blockquote':
      BlockElement = 'blockquote';
      blockClasses = 'border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-600 dark:text-gray-400 my-4';
      break;
    default:
      blockClasses = 'mb-2';
  }

  return { BlockElement, blockClasses };
}

export function getMarkClasses(marks: string[]): string {
  let markClasses = '';
  if (marks.includes('strong')) markClasses += ' font-semibold';
  if (marks.includes('em')) markClasses += ' italic';
  if (marks.includes('underline')) markClasses += ' underline';
  if (marks.includes('strike')) markClasses += ' line-through';
  if (marks.includes('code')) markClasses += ' font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm';
  return markClasses;
}
