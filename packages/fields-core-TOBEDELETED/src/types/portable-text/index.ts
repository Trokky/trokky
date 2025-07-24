/**
 * Portable Text Module - Main Exports
 */

// Types
export type {
  PortableTextValue,
  PortableTextBlock,
  PortableTextSpan,
  PortableTextMarkDefinition,
  PortableTextObject,
  TextBlock,
  ListBlock,
  ImageBlock,
  CodeBlock,
  CalloutBlock,
  DecoratorMark,
  LinkAnnotation,
  InternalLinkAnnotation,
  CommentAnnotation,
  PortableTextFieldConfig,
  BlockTypeConfig,
  MarkConfig,
  AnnotationConfig,
  ListConfig,
  StyleConfig,
  SerializationOptions,
  PortableTextValidationResult,
  PortableTextValidationError,
  PortableTextEditorProps,
  PortableTextQuery,
  PortableTextTransform
} from './types.js'

// Constants
export {
  BUILTIN_BLOCK_TYPES,
  BUILTIN_DECORATOR_MARKS,
  BUILTIN_ANNOTATION_MARKS,
  BUILTIN_LIST_TYPES,
  BUILTIN_TEXT_STYLES,
  DEFAULT_PORTABLE_TEXT_CONFIG,
  MINIMAL_PORTABLE_TEXT_CONFIG,
  RICH_PORTABLE_TEXT_CONFIG,
  PORTABLE_TEXT_ERROR_CODES
} from './constants.js'

// Utilities
export {
  createTextBlock,
  createListBlock,
  createImageBlock,
  createCodeBlock,
  createCalloutBlock,
  createSpan,
  createMarkDef,
  createLinkMarkDef,
  createInternalLinkMarkDef,
  generateKey,
  isTextBlock,
  isListBlock,
  isImageBlock,
  isCodeBlock,
  isCalloutBlock,
  hasChildren,
  getPlainText,
  getWordCount,
  getCharacterCount,
  getReadingTime,
  queryBlocks,
  extractImages,
  extractLinks,
  extractHeadings,
  insertBlockAt,
  removeBlockAt,
  replaceBlockAt,
  moveBlock,
  addMarkToSpan,
  removeMarkFromSpan,
  toggleMarkOnSpan,
  validateBlockStructure,
  validatePortableTextValue,
  removeEmptyBlocks,
  removeOrphanedMarkDefs,
  normalizePortableText
} from './utils.js'

// Validation
export {
  PortableTextValidator,
  validatePortableText
} from './validation.js'

// Serializers
export {
  PortableTextHTMLSerializer,
  PortableTextMarkdownSerializer,
  PortableTextPlainTextSerializer,
  PortableTextReactSerializer,
  toHTML,
  toMarkdown,
  toPlainText,
  toReact
} from './serializers.js'

// Field Type
export {
  createPortableTextField,
  createSimplePortableTextField,
  createRichPortableTextField,
  portableTextToHTML,
  portableTextToMarkdown,
  portableTextToPlainText,
  htmlToPortableText,
  markdownToPortableText
} from './field.js'

// Standalone Field Type (for testing)
export {
  StandalonePortableTextFieldType
} from './field-standalone.js'

// Note: PortableTextFieldType is not exported here due to circular dependency with @trokky/core
// It will be exported from the main package index when the core dependency is resolved