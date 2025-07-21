/**
 * Portable Text Serialization Layer
 * Converts Portable Text to HTML, Markdown, React, and plain text
 */

import type {
  PortableTextValue,
  PortableTextBlock,
  PortableTextSpan,
  PortableTextMarkDefinition,
  TextBlock,
  ListBlock,
  ImageBlock,
  CodeBlock,
  CalloutBlock,
  SerializationOptions
} from './types'
import { 
  isTextBlock, 
  isListBlock, 
  isImageBlock, 
  isCodeBlock, 
  isCalloutBlock, 
  hasChildren,
  getPlainText 
} from './utils'

// HTML Serializer
export class PortableTextHTMLSerializer {
  private options: SerializationOptions

  constructor(options: Partial<SerializationOptions> = {}) {
    this.options = {
      format: 'html',
      customComponents: {},
      markComponents: {},
      blockComponents: {},
      ...options
    }
  }

  serialize(blocks: PortableTextValue): string {
    return blocks.map(block => this.serializeBlock(block)).join('\n')
  }

  private serializeBlock(block: PortableTextBlock): string {
    // Use custom block component if provided
    if (this.options.blockComponents?.[block._type]) {
      return this.options.blockComponents[block._type](block)
    }

    switch (block._type) {
      case 'block':
        return this.serializeTextBlock(block as TextBlock)
      case 'image':
        return this.serializeImageBlock(block as ImageBlock)
      case 'code':
        return this.serializeCodeBlock(block as CodeBlock)
      case 'callout':
        return this.serializeCalloutBlock(block as CalloutBlock)
      default:
        if (this.options.unknownBlockComponent) {
          return this.options.unknownBlockComponent(block)
        }
        return `<!-- Unknown block type: ${block._type} -->`
    }
  }

  private serializeTextBlock(block: TextBlock): string {
    if (!hasChildren(block)) {
      return ''
    }

    const content = this.serializeSpans(block.children, block.markDefs || [])
    
    if (block.listItem) {
      return this.serializeListItem(block as ListBlock, content)
    }

    return this.wrapWithStyle(content, block.style || 'normal')
  }

  private serializeListItem(block: ListBlock, content: string): string {
    const indent = '  '.repeat((block.level || 1) - 1)
    const bullet = block.listItem === 'bullet' ? '•' : '1.'
    return `${indent}<li>${content}</li>`
  }

  private wrapWithStyle(content: string, style: string): string {
    switch (style) {
      case 'h1': return `<h1>${content}</h1>`
      case 'h2': return `<h2>${content}</h2>`
      case 'h3': return `<h3>${content}</h3>`
      case 'h4': return `<h4>${content}</h4>`
      case 'h5': return `<h5>${content}</h5>`
      case 'h6': return `<h6>${content}</h6>`
      case 'blockquote': return `<blockquote>${content}</blockquote>`
      case 'normal':
      default:
        return `<p>${content}</p>`
    }
  }

  private serializeSpans(spans: PortableTextSpan[], markDefs: PortableTextMarkDefinition[]): string {
    return spans.map(span => this.serializeSpan(span, markDefs)).join('')
  }

  private serializeSpan(span: PortableTextSpan, markDefs: PortableTextMarkDefinition[]): string {
    let content = this.escapeHtml(span.text)
    
    if (!span.marks || span.marks.length === 0) {
      return content
    }

    // Apply marks in reverse order to ensure proper nesting
    const marks = [...span.marks].reverse()
    
    for (const mark of marks) {
      content = this.applyMark(content, mark, markDefs)
    }

    return content
  }

  private applyMark(content: string, mark: string, markDefs: PortableTextMarkDefinition[]): string {
    // Use custom mark component if provided
    if (this.options.markComponents?.[mark]) {
      return this.options.markComponents[mark](content, markDefs.find(def => def._key === mark))
    }

    // Built-in decorator marks
    switch (mark) {
      case 'strong': return `<strong>${content}</strong>`
      case 'em': return `<em>${content}</em>`
      case 'underline': return `<u>${content}</u>`
      case 'strike-through': return `<s>${content}</s>`
      case 'code': return `<code>${content}</code>`
      default:
        // Annotation marks
        const markDef = markDefs.find(def => def._key === mark)
        if (markDef) {
          return this.applyAnnotation(content, markDef)
        }
        if (this.options.unknownMarkComponent) {
          return this.options.unknownMarkComponent(content, mark)
        }
        return content
    }
  }

  private applyAnnotation(content: string, markDef: PortableTextMarkDefinition): string {
    switch (markDef._type) {
      case 'link':
        const href = markDef.href || '#'
        const title = markDef.title ? ` title="${this.escapeHtml(markDef.title)}"` : ''
        const target = markDef.target ? ` target="${markDef.target}"` : ''
        return `<a href="${this.escapeHtml(href)}"${title}${target}>${content}</a>`
      case 'internalLink':
        const ref = markDef.reference?._ref || '#'
        return `<a href="#${ref}" data-internal-link="${ref}">${content}</a>`
      case 'comment':
        return `<span class="comment" data-comment="${this.escapeHtml(markDef.comment || '')}">${content}</span>`
      default:
        return content
    }
  }

  private serializeImageBlock(block: ImageBlock): string {
    const src = block.asset?._ref ? `/assets/${block.asset._ref}` : ''
    const alt = block.alt ? this.escapeHtml(block.alt) : ''
    const caption = block.caption ? `<figcaption>${this.escapeHtml(block.caption)}</figcaption>` : ''
    
    return `<figure><img src="${src}" alt="${alt}" />${caption}</figure>`
  }

  private serializeCodeBlock(block: CodeBlock): string {
    const language = block.language ? ` class="language-${block.language}"` : ''
    const filename = block.filename ? `<div class="code-filename">${this.escapeHtml(block.filename)}</div>` : ''
    const code = this.escapeHtml(block.code || '')
    
    return `<div class="code-block">${filename}<pre><code${language}>${code}</code></pre></div>`
  }

  private serializeCalloutBlock(block: CalloutBlock): string {
    const type = block.calloutType || 'info'
    const title = block.title ? `<div class="callout-title">${this.escapeHtml(block.title)}</div>` : ''
    const content = hasChildren(block) ? this.serializeSpans(block.children, []) : ''
    
    return `<div class="callout callout-${type}">${title}<div class="callout-content">${content}</div></div>`
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }
}

// Markdown Serializer
export class PortableTextMarkdownSerializer {
  private options: SerializationOptions

  constructor(options: Partial<SerializationOptions> = {}) {
    this.options = {
      format: 'markdown',
      ...options
    }
  }

  serialize(blocks: PortableTextValue): string {
    return blocks.map(block => this.serializeBlock(block)).join('\n\n')
  }

  private serializeBlock(block: PortableTextBlock): string {
    switch (block._type) {
      case 'block':
        return this.serializeTextBlock(block as TextBlock)
      case 'image':
        return this.serializeImageBlock(block as ImageBlock)
      case 'code':
        return this.serializeCodeBlock(block as CodeBlock)
      case 'callout':
        return this.serializeCalloutBlock(block as CalloutBlock)
      default:
        return `<!-- Unknown block type: ${block._type} -->`
    }
  }

  private serializeTextBlock(block: TextBlock): string {
    if (!hasChildren(block)) {
      return ''
    }

    const content = this.serializeSpans(block.children, block.markDefs || [])
    
    if (block.listItem) {
      return this.serializeListItem(block as ListBlock, content)
    }

    return this.wrapWithStyle(content, block.style || 'normal')
  }

  private serializeListItem(block: ListBlock, content: string): string {
    const indent = '  '.repeat((block.level || 1) - 1)
    const bullet = block.listItem === 'bullet' ? '-' : '1.'
    return `${indent}${bullet} ${content}`
  }

  private wrapWithStyle(content: string, style: string): string {
    switch (style) {
      case 'h1': return `# ${content}`
      case 'h2': return `## ${content}`
      case 'h3': return `### ${content}`
      case 'h4': return `#### ${content}`
      case 'h5': return `##### ${content}`
      case 'h6': return `###### ${content}`
      case 'blockquote': return `> ${content}`
      case 'normal':
      default:
        return content
    }
  }

  private serializeSpans(spans: PortableTextSpan[], markDefs: PortableTextMarkDefinition[]): string {
    return spans.map(span => this.serializeSpan(span, markDefs)).join('')
  }

  private serializeSpan(span: PortableTextSpan, markDefs: PortableTextMarkDefinition[]): string {
    let content = span.text
    
    if (!span.marks || span.marks.length === 0) {
      return content
    }

    // Apply marks
    for (const mark of span.marks) {
      content = this.applyMark(content, mark, markDefs)
    }

    return content
  }

  private applyMark(content: string, mark: string, markDefs: PortableTextMarkDefinition[]): string {
    switch (mark) {
      case 'strong': return `**${content}**`
      case 'em': return `*${content}*`
      case 'underline': return `<u>${content}</u>` // Markdown doesn't have native underline
      case 'strike-through': return `~~${content}~~`
      case 'code': return `\`${content}\``
      default:
        const markDef = markDefs.find(def => def._key === mark)
        if (markDef) {
          return this.applyAnnotation(content, markDef)
        }
        return content
    }
  }

  private applyAnnotation(content: string, markDef: PortableTextMarkDefinition): string {
    switch (markDef._type) {
      case 'link':
        const href = markDef.href || '#'
        const title = markDef.title ? ` "${markDef.title}"` : ''
        return `[${content}](${href}${title})`
      case 'internalLink':
        const ref = markDef.reference?._ref || '#'
        return `[${content}](#${ref})`
      case 'comment':
        return content // Comments don't translate well to markdown
      default:
        return content
    }
  }

  private serializeImageBlock(block: ImageBlock): string {
    const src = block.asset?._ref ? `/assets/${block.asset._ref}` : ''
    const alt = block.alt || ''
    const caption = block.caption ? `\n\n*${block.caption}*` : ''
    
    return `![${alt}](${src})${caption}`
  }

  private serializeCodeBlock(block: CodeBlock): string {
    const language = block.language || ''
    const filename = block.filename ? `// ${block.filename}\n` : ''
    const code = block.code || ''
    
    return `\`\`\`${language}\n${filename}${code}\n\`\`\``
  }

  private serializeCalloutBlock(block: CalloutBlock): string {
    const title = block.title ? `**${block.title}**\n\n` : ''
    const content = hasChildren(block) ? this.serializeSpans(block.children, []) : ''
    
    return `> ${title}${content}`
  }
}

// Plain Text Serializer
export class PortableTextPlainTextSerializer {
  serialize(blocks: PortableTextValue): string {
    return getPlainText(blocks)
  }
}

// React Serializer (returns JSX structure)
export class PortableTextReactSerializer {
  private options: SerializationOptions

  constructor(options: Partial<SerializationOptions> = {}) {
    this.options = {
      format: 'react',
      customComponents: {},
      markComponents: {},
      blockComponents: {},
      ...options
    }
  }

  serialize(blocks: PortableTextValue): any[] {
    return blocks.map((block, index) => this.serializeBlock(block, index))
  }

  private serializeBlock(block: PortableTextBlock, index: number): any {
    // Use custom block component if provided
    if (this.options.blockComponents?.[block._type]) {
      return this.options.blockComponents[block._type](block, index)
    }

    const key = block._key || `block-${index}`

    switch (block._type) {
      case 'block':
        return this.serializeTextBlock(block as TextBlock, key)
      case 'image':
        return this.serializeImageBlock(block as ImageBlock, key)
      case 'code':
        return this.serializeCodeBlock(block as CodeBlock, key)
      case 'callout':
        return this.serializeCalloutBlock(block as CalloutBlock, key)
      default:
        if (this.options.unknownBlockComponent) {
          return this.options.unknownBlockComponent(block, index)
        }
        return { type: 'div', props: { key, children: `Unknown block type: ${block._type}` } }
    }
  }

  private serializeTextBlock(block: TextBlock, key: string): any {
    if (!hasChildren(block)) {
      return null
    }

    const children = this.serializeSpans(block.children, block.markDefs || [])
    
    if (block.listItem) {
      return this.serializeListItem(block as ListBlock, children, key)
    }

    return this.wrapWithStyle(children, block.style || 'normal', key)
  }

  private serializeListItem(block: ListBlock, children: any[], key: string): any {
    return {
      type: 'li',
      props: {
        key,
        'data-list-type': block.listItem,
        'data-list-level': block.level || 1,
        children
      }
    }
  }

  private wrapWithStyle(children: any[], style: string, key: string): any {
    const styleMap: Record<string, string> = {
      h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6',
      blockquote: 'blockquote',
      normal: 'p'
    }

    return {
      type: styleMap[style] || 'p',
      props: { key, children }
    }
  }

  private serializeSpans(spans: PortableTextSpan[], markDefs: PortableTextMarkDefinition[]): any[] {
    return spans.map((span, index) => this.serializeSpan(span, markDefs, index))
  }

  private serializeSpan(span: PortableTextSpan, markDefs: PortableTextMarkDefinition[], index: number): any {
    let content: any = span.text
    const key = span._key || `span-${index}`
    
    if (!span.marks || span.marks.length === 0) {
      return content
    }

    // Apply marks in reverse order for proper nesting
    const marks = [...span.marks].reverse()
    
    for (const mark of marks) {
      content = this.applyMark(content, mark, markDefs, key)
    }

    return content
  }

  private applyMark(content: any, mark: string, markDefs: PortableTextMarkDefinition[], key: string): any {
    // Use custom mark component if provided
    if (this.options.markComponents?.[mark]) {
      return this.options.markComponents[mark](content, markDefs.find(def => def._key === mark))
    }

    switch (mark) {
      case 'strong': 
        return { type: 'strong', props: { key: `${key}-${mark}`, children: content } }
      case 'em': 
        return { type: 'em', props: { key: `${key}-${mark}`, children: content } }
      case 'underline': 
        return { type: 'u', props: { key: `${key}-${mark}`, children: content } }
      case 'strike-through': 
        return { type: 's', props: { key: `${key}-${mark}`, children: content } }
      case 'code': 
        return { type: 'code', props: { key: `${key}-${mark}`, children: content } }
      default:
        const markDef = markDefs.find(def => def._key === mark)
        if (markDef) {
          return this.applyAnnotation(content, markDef, key)
        }
        if (this.options.unknownMarkComponent) {
          return this.options.unknownMarkComponent(content, mark)
        }
        return content
    }
  }

  private applyAnnotation(content: any, markDef: PortableTextMarkDefinition, key: string): any {
    switch (markDef._type) {
      case 'link':
        return {
          type: 'a',
          props: {
            key: `${key}-${markDef._key}`,
            href: markDef.href || '#',
            title: markDef.title,
            target: markDef.target,
            children: content
          }
        }
      case 'internalLink':
        return {
          type: 'a',
          props: {
            key: `${key}-${markDef._key}`,
            href: `#${markDef.reference?._ref || ''}`,
            'data-internal-link': markDef.reference?._ref,
            children: content
          }
        }
      case 'comment':
        return {
          type: 'span',
          props: {
            key: `${key}-${markDef._key}`,
            className: 'comment',
            'data-comment': markDef.comment,
            children: content
          }
        }
      default:
        return content
    }
  }

  private serializeImageBlock(block: ImageBlock, key: string): any {
    return {
      type: 'figure',
      props: {
        key,
        children: [
          {
            type: 'img',
            props: {
              key: `${key}-img`,
              src: block.asset?._ref ? `/assets/${block.asset._ref}` : '',
              alt: block.alt || ''
            }
          },
          block.caption && {
            type: 'figcaption',
            props: {
              key: `${key}-caption`,
              children: block.caption
            }
          }
        ].filter(Boolean)
      }
    }
  }

  private serializeCodeBlock(block: CodeBlock, key: string): any {
    return {
      type: 'div',
      props: {
        key,
        className: 'code-block',
        children: [
          block.filename && {
            type: 'div',
            props: {
              key: `${key}-filename`,
              className: 'code-filename',
              children: block.filename
            }
          },
          {
            type: 'pre',
            props: {
              key: `${key}-pre`,
              children: {
                type: 'code',
                props: {
                  className: block.language ? `language-${block.language}` : undefined,
                  children: block.code || ''
                }
              }
            }
          }
        ].filter(Boolean)
      }
    }
  }

  private serializeCalloutBlock(block: CalloutBlock, key: string): any {
    return {
      type: 'div',
      props: {
        key,
        className: `callout callout-${block.calloutType || 'info'}`,
        children: [
          block.title && {
            type: 'div',
            props: {
              key: `${key}-title`,
              className: 'callout-title',
              children: block.title
            }
          },
          {
            type: 'div',
            props: {
              key: `${key}-content`,
              className: 'callout-content',
              children: hasChildren(block) ? this.serializeSpans(block.children, []) : []
            }
          }
        ].filter(Boolean)
      }
    }
  }
}

// Convenience functions
export function toHTML(blocks: PortableTextValue, options?: Partial<SerializationOptions>): string {
  return new PortableTextHTMLSerializer(options).serialize(blocks)
}

export function toMarkdown(blocks: PortableTextValue, options?: Partial<SerializationOptions>): string {
  return new PortableTextMarkdownSerializer(options).serialize(blocks)
}

export function toPlainText(blocks: PortableTextValue): string {
  return new PortableTextPlainTextSerializer().serialize(blocks)
}

export function toReact(blocks: PortableTextValue, options?: Partial<SerializationOptions>): any[] {
  return new PortableTextReactSerializer(options).serialize(blocks)
}