/**
 * Format Converter for RichTextField
 *
 * Handles conversion between storage formats:
 * - HTML (default)
 * - ProseMirror JSON (TipTap document structure)
 * - Markdown
 */

import type { Editor } from '@tiptap/react'
import type { RichTextOutputFormat, ProseMirrorDocument, ProseMirrorNode } from './definition'
import { resolveShortcodes, type MediaUrlGenerator } from './shortcodes'

/**
 * Convert editor content to the specified output format for storage
 */
export function editorToStorageFormat(
  editor: Editor,
  outputFormat: RichTextOutputFormat
): string | ProseMirrorDocument {
  switch (outputFormat) {
    case 'prosemirror':
      return editorToProseMirror(editor)
    case 'markdown':
      return editorToMarkdown(editor)
    case 'html':
    default:
      return editorToHtml(editor)
  }
}

/**
 * Convert stored content to HTML for the editor
 */
export function storageToEditorFormat(
  content: string | ProseMirrorDocument | undefined,
  outputFormat: RichTextOutputFormat,
  mediaUrlGenerator?: MediaUrlGenerator
): string | ProseMirrorDocument {
  if (!content) {
    return outputFormat === 'prosemirror'
      ? { type: 'doc', content: [] }
      : ''
  }

  // Detect format from content if not explicitly known
  const detectedFormat = detectContentFormat(content)

  // If format matches what editor expects (ProseMirror), return as-is after resolving shortcodes
  if (outputFormat === 'prosemirror' && detectedFormat === 'prosemirror') {
    return resolveShortcodesInProseMirror(content as ProseMirrorDocument, mediaUrlGenerator)
  }

  // Convert to HTML for editor display
  let html: string

  if (detectedFormat === 'prosemirror') {
    html = proseMirrorToHtml(content as ProseMirrorDocument)
  } else if (detectedFormat === 'markdown') {
    html = markdownToHtml(content as string)
  } else {
    html = content as string
  }

  // Resolve shortcodes to real URLs for display
  if (mediaUrlGenerator) {
    html = resolveShortcodes(html, mediaUrlGenerator)
  }

  return html
}

/**
 * Detect the format of stored content
 */
export function detectContentFormat(
  content: string | ProseMirrorDocument | undefined
): RichTextOutputFormat {
  if (!content) return 'html'

  // ProseMirror JSON is an object with type: 'doc'
  if (typeof content === 'object' && content.type === 'doc') {
    return 'prosemirror'
  }

  if (typeof content === 'string') {
    // Check for markdown patterns (not in HTML tags)
    const hasMarkdownHeading = /^#{1,6}\s/m.test(content)
    const hasMarkdownList = /^[\s]*[-*+]\s/m.test(content)
    const hasMarkdownLink = /\[([^\]]+)\]\(([^)]+)\)/.test(content)
    const hasNoHtmlTags = !/<[^>]+>/.test(content)

    if (hasNoHtmlTags && (hasMarkdownHeading || hasMarkdownList || hasMarkdownLink)) {
      return 'markdown'
    }
  }

  return 'html'
}

/**
 * Convert absolute URL to relative path
 * e.g., "http://localhost:3000/api/media/xxx" -> "/api/media/xxx"
 */
function toRelativeUrl(url: string): string {
  if (!url) return url

  try {
    // If it's already a relative URL, return as-is
    if (url.startsWith('/')) return url

    // Parse and extract pathname
    const parsed = new URL(url)
    return parsed.pathname + parsed.search + parsed.hash
  } catch {
    // If URL parsing fails, return original
    return url
  }
}

/**
 * Convert editor content to HTML for storage
 *
 * For HTML format, we use relative URLs (without host) for portability
 * The data-trokky-id is preserved for reference
 */
function editorToHtml(editor: Editor): string {
  const html = editor.getHTML()
  return normalizeHtmlImages(html)
}

/**
 * Normalize HTML images - convert to relative URLs and ensure consistent attribute order
 */
function normalizeHtmlImages(html: string): string {
  return html.replace(
    /<img([^>]*)>/g,
    (_match, attrs) => {
      // Extract attributes
      const src = attrs.match(/src="([^"]*)"/)?.[1] || ''
      const alt = attrs.match(/alt="([^"]*)"/)?.[1] || ''
      const title = attrs.match(/title="([^"]*)"/)?.[1]
      const trokkyId = attrs.match(/data-trokky-id="([^"]*)"/)?.[1]
      const trokkyVariant = attrs.match(/data-trokky-variant="([^"]*)"/)?.[1]
      const className = attrs.match(/class="([^"]*)"/)?.[1]

      // Convert to relative URL for portability
      const relativeSrc = toRelativeUrl(src)

      // Build normalized img tag
      let imgAttrs = `src="${relativeSrc}"`
      if (alt) imgAttrs += ` alt="${alt}"`
      if (title) imgAttrs += ` title="${title}"`
      if (className) imgAttrs += ` class="${className}"`
      if (trokkyId) imgAttrs += ` data-trokky-id="${trokkyId}"`
      if (trokkyVariant) imgAttrs += ` data-trokky-variant="${trokkyVariant}"`

      return `<img ${imgAttrs}>`
    }
  )
}

/**
 * Convert editor content to ProseMirror JSON with shortcodes for storage
 *
 * For ProseMirror format, we use shortcode references since this format
 * is meant for re-editing and needs the media ID for the editor
 */
function editorToProseMirror(editor: Editor): ProseMirrorDocument {
  const json = editor.getJSON() as ProseMirrorDocument
  return convertImagesToProseMirrorShortcodes(json)
}

/**
 * Convert editor content to Markdown for storage
 *
 * For Markdown format, we output standard Markdown image syntax
 * with actual URLs, making it ready for rendering
 */
function editorToMarkdown(editor: Editor): string {
  const html = editor.getHTML()
  return htmlToMarkdown(html)
}

/**
 * Convert HTML to Markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html || html === '<p></p>') return ''

  let markdown = html

  // Convert headings
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')

  // Convert formatting
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
  markdown = markdown.replace(/<u[^>]*>(.*?)<\/u>/gi, '<u>$1</u>') // Keep underline as HTML
  markdown = markdown.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
  markdown = markdown.replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~')
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')

  // Convert links
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')

  // Convert images - parse attributes regardless of order, use relative URLs
  markdown = markdown.replace(/<img([^>]*)>/gi, (_match, attrs) => {
    const src = attrs.match(/src="([^"]*)"/)?.[1] || ''
    const alt = attrs.match(/alt="([^"]*)"/)?.[1] || ''
    const title = attrs.match(/title="([^"]*)"/)?.[1]

    // Convert to relative URL for portability
    const relativeSrc = toRelativeUrl(src)

    if (title) {
      return `![${alt}](${relativeSrc} "${title}")`
    }
    return `![${alt}](${relativeSrc})`
  })

  // Convert lists
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n') + '\n'
  })
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    let index = 0
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => {
      index++
      return `${index}. $1\n`
    }) + '\n'
  })

  // Convert blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
    return content.split('\n').map((line: string) => `> ${line}`).join('\n') + '\n\n'
  })

  // Convert code blocks
  markdown = markdown.replace(/<pre[^>]*><code[^>]*class="[^"]*language-([^"]*)"[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```$1\n$2\n```\n\n')
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n')

  // Convert paragraphs
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')

  // Convert line breaks
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n')

  // Convert horizontal rules
  markdown = markdown.replace(/<hr\s*\/?>/gi, '\n---\n\n')

  // Clean up remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  markdown = markdown.replace(/&nbsp;/g, ' ')
  markdown = markdown.replace(/&amp;/g, '&')
  markdown = markdown.replace(/&lt;/g, '<')
  markdown = markdown.replace(/&gt;/g, '>')
  markdown = markdown.replace(/&quot;/g, '"')

  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n')
  markdown = markdown.trim()

  return markdown
}

/**
 * Convert Markdown to HTML
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return ''

  let html = markdown

  // Convert code blocks first (to protect their content)
  const codeBlocks: string[] = []
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const index = codeBlocks.length
    codeBlocks.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${escapeHtml(code.trim())}</code></pre>`)
    return `__CODE_BLOCK_${index}__`
  })

  // Convert inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Convert headings
  html = html.replace(/^###### (.*)$/gm, '<h6>$1</h6>')
  html = html.replace(/^##### (.*)$/gm, '<h5>$1</h5>')
  html = html.replace(/^#### (.*)$/gm, '<h4>$1</h4>')
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>')

  // Convert bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>')

  // Convert links and images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // Convert horizontal rules
  html = html.replace(/^---$/gm, '<hr>')

  // Convert blockquotes
  html = html.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>')
  // Merge consecutive blockquotes
  html = html.replace(/<\/blockquote>\n<blockquote>/g, '\n')

  // Convert unordered lists
  html = html.replace(/(?:^[-*+] .*$\n?)+/gm, (match) => {
    const items = match.trim().split('\n').map(line =>
      `<li>${line.replace(/^[-*+] /, '')}</li>`
    ).join('')
    return `<ul>${items}</ul>`
  })

  // Convert ordered lists
  html = html.replace(/(?:^\d+\. .*$\n?)+/gm, (match) => {
    const items = match.trim().split('\n').map(line =>
      `<li>${line.replace(/^\d+\. /, '')}</li>`
    ).join('')
    return `<ol>${items}</ol>`
  })

  // Restore code blocks
  codeBlocks.forEach((block, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, block)
  })

  // Convert paragraphs (lines that aren't already wrapped)
  html = html.split('\n\n').map(block => {
    if (block.match(/^<(h[1-6]|ul|ol|blockquote|pre|hr)/)) {
      return block
    }
    if (block.trim()) {
      return `<p>${block.replace(/\n/g, '<br>')}</p>`
    }
    return ''
  }).join('\n')

  return html
}

/**
 * Convert ProseMirror JSON to HTML
 */
export function proseMirrorToHtml(doc: ProseMirrorDocument): string {
  if (!doc || !doc.content) return ''

  return doc.content.map(node => nodeToHtml(node)).join('')
}

/**
 * Convert a single ProseMirror node to HTML
 */
function nodeToHtml(node: ProseMirrorNode): string {
  const { type, attrs, content, marks, text } = node

  // Text node
  if (type === 'text' && text) {
    let result = escapeHtml(text)

    // Apply marks
    if (marks) {
      for (const mark of marks) {
        switch (mark.type) {
          case 'bold':
            result = `<strong>${result}</strong>`
            break
          case 'italic':
            result = `<em>${result}</em>`
            break
          case 'underline':
            result = `<u>${result}</u>`
            break
          case 'strike':
            result = `<s>${result}</s>`
            break
          case 'code':
            result = `<code>${result}</code>`
            break
          case 'link':
            const href = mark.attrs?.href || ''
            result = `<a href="${href}">${result}</a>`
            break
        }
      }
    }

    return result
  }

  // Container nodes
  const childContent = content ? content.map(child => nodeToHtml(child)).join('') : ''

  switch (type) {
    case 'doc':
      return childContent
    case 'paragraph':
      return `<p>${childContent}</p>`
    case 'heading':
      const level = attrs?.level || 1
      return `<h${level}>${childContent}</h${level}>`
    case 'bulletList':
      return `<ul>${childContent}</ul>`
    case 'orderedList':
      return `<ol>${childContent}</ol>`
    case 'listItem':
      return `<li>${childContent}</li>`
    case 'blockquote':
      return `<blockquote>${childContent}</blockquote>`
    case 'codeBlock':
      const lang = attrs?.language || ''
      return `<pre><code${lang ? ` class="language-${lang}"` : ''}>${childContent}</code></pre>`
    case 'horizontalRule':
      return '<hr>'
    case 'hardBreak':
      return '<br>'
    case 'image':
      const src = attrs?.src || ''
      const alt = attrs?.alt || ''
      const trokkyId = attrs?.['data-trokky-id'] || ''
      const trokkyVariant = attrs?.['data-trokky-variant'] || ''

      let imgAttrs = `src="${src}"`
      if (alt) imgAttrs += ` alt="${alt}"`
      if (trokkyId) imgAttrs += ` data-trokky-id="${trokkyId}"`
      if (trokkyVariant) imgAttrs += ` data-trokky-variant="${trokkyVariant}"`

      return `<img ${imgAttrs}>`
    case 'table':
      return `<table>${childContent}</table>`
    case 'tableRow':
      return `<tr>${childContent}</tr>`
    case 'tableHeader':
      return `<th>${childContent}</th>`
    case 'tableCell':
      return `<td>${childContent}</td>`
    default:
      return childContent
  }
}

/**
 * Convert images in ProseMirror JSON to use shortcodes for storage
 */
function convertImagesToProseMirrorShortcodes(doc: ProseMirrorDocument): ProseMirrorDocument {
  return {
    ...doc,
    content: doc.content.map(node => convertNodeImages(node))
  }
}

/**
 * Recursively convert images in a node to shortcodes
 */
function convertNodeImages(node: ProseMirrorNode): ProseMirrorNode {
  if (node.type === 'image' && node.attrs) {
    const trokkyId = node.attrs['data-trokky-id'] as string
    if (trokkyId) {
      // Store as shortcode reference
      return {
        ...node,
        attrs: {
          ...node.attrs,
          // Remove src (will be resolved on load), keep trokky attributes
          src: `[trokky-image:${trokkyId}]`
        }
      }
    }
  }

  if (node.content) {
    return {
      ...node,
      content: node.content.map(child => convertNodeImages(child))
    }
  }

  return node
}

/**
 * Resolve shortcodes in ProseMirror JSON to real URLs
 */
function resolveShortcodesInProseMirror(
  doc: ProseMirrorDocument,
  mediaUrlGenerator?: MediaUrlGenerator
): ProseMirrorDocument {
  if (!mediaUrlGenerator) return doc

  return {
    ...doc,
    content: doc.content.map(node => resolveNodeShortcodes(node, mediaUrlGenerator))
  }
}

/**
 * Recursively resolve shortcodes in a node
 */
function resolveNodeShortcodes(
  node: ProseMirrorNode,
  mediaUrlGenerator: MediaUrlGenerator
): ProseMirrorNode {
  if (node.type === 'image' && node.attrs) {
    const src = node.attrs.src as string
    if (src?.startsWith('[trokky-image:')) {
      const match = src.match(/\[trokky-image:([^\]]+)\]/)
      if (match) {
        const mediaId = match[1]
        const variant = node.attrs['data-trokky-variant'] as string
        return {
          ...node,
          attrs: {
            ...node.attrs,
            src: mediaUrlGenerator.getMediaUrl(mediaId, variant)
          }
        }
      }
    }
  }

  if (node.content) {
    return {
      ...node,
      content: node.content.map(child => resolveNodeShortcodes(child, mediaUrlGenerator))
    }
  }

  return node
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
