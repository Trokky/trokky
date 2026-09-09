/**
 * Exercises a real (unmocked) Tiptap 3 editor over the studio's own extension set.
 *
 * The mocked read-only test next door proves we do not build an editor when we
 * should not; this one proves the editor we do build still behaves after the
 * v2 -> v3 upgrade. It guards three things that broke or nearly broke during
 * that migration: text landing in the order it was typed, every toolbar command
 * still resolving to a real command, and HTML surviving a serialise/reparse
 * round trip with the Trokky image attributes intact.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { Editor } from '@tiptap/core'
import { createRichTextExtensions } from '../fields/definitions/RichTextField/extensions'

const openEditors: Editor[] = []

function createEditor(content = ''): Editor {
  const editor = new Editor({
    element: document.createElement('div'),
    extensions: createRichTextExtensions({ placeholder: 'Start typing...' }, 500),
    content,
  })
  openEditors.push(editor)
  return editor
}

afterEach(() => {
  while (openEditors.length) {
    openEditors.pop()?.destroy()
  }
})

describe('Tiptap 3 editor with the studio extension set', () => {
  it('should build without duplicate extension names', () => {
    const editor = createEditor('<p>hello</p>')

    const names = editor.extensionManager.extensions.map(extension => extension.name)
    expect(new Set(names).size).toBe(names.length)

    // The extensions StarterKit absorbed in v3 must be present exactly once each.
    for (const name of ['underline', 'link', 'gapCursor', 'listKeymap']) {
      expect(names.filter(entry => entry === name)).toHaveLength(1)
    }
    // ...and the one v3 added that we deliberately keep off.
    expect(names).not.toContain('trailingNode')
    // CodeBlockLowlight replaces the StarterKit code block, under the same name.
    expect(names.filter(entry => entry === 'codeBlock')).toHaveLength(1)
    expect(editor.getHTML()).toBe('<p>hello</p>')
  })

  describe('typing order', () => {
    it('should keep sequentially inserted text in the order it was typed', () => {
      const editor = createEditor('')

      for (const char of 'Hello world') {
        editor.commands.insertContent(char)
      }

      expect(editor.getText()).toBe('Hello world')
      expect(editor.getHTML()).toBe('<p>Hello world</p>')
    })

    it('should append to existing content rather than writing at the start', () => {
      const editor = createEditor('<p>Start</p>')

      editor.commands.focus('end')
      for (const char of ' then end') {
        editor.commands.insertContent(char)
      }

      expect(editor.getText()).toBe('Start then end')
    })

    it('should not emit an update when setContent opts out of it', () => {
      const editor = createEditor('<p>one</p>')
      let updates = 0
      editor.on('update', () => {
        updates += 1
      })

      editor.commands.setContent('<p>two</p>', { emitUpdate: false })
      expect(updates).toBe(0)
      expect(editor.getHTML()).toBe('<p>two</p>')

      // ...and still emits when we do not opt out, so the flag is doing the work.
      editor.commands.setContent('<p>three</p>')
      expect(updates).toBe(1)
    })
  })

  describe('toolbar commands', () => {
    it('should toggle bold', () => {
      const editor = createEditor('<p>bold me</p>')
      editor.commands.selectAll()
      editor.chain().focus().toggleBold().run()
      expect(editor.getHTML()).toContain('<strong>bold me</strong>')

      editor.chain().focus().toggleBold().run()
      expect(editor.getHTML()).not.toContain('<strong>')
    })

    it('should toggle underline', () => {
      const editor = createEditor('<p>underline me</p>')
      editor.commands.selectAll()
      editor.chain().focus().toggleUnderline().run()
      expect(editor.getHTML()).toContain('<u>underline me</u>')
    })

    it('should toggle a heading', () => {
      const editor = createEditor('<p>title</p>')
      editor.chain().focus().toggleHeading({ level: 2 }).run()
      expect(editor.getHTML()).toBe('<h2>title</h2>')
      expect(editor.isActive('heading', { level: 2 })).toBe(true)
    })

    it('should insert bullet and ordered lists', () => {
      const editor = createEditor('<p>item</p>')

      editor.chain().focus().toggleBulletList().run()
      expect(editor.getHTML()).toContain('<ul><li><p>item</p></li></ul>')

      editor.chain().focus().toggleOrderedList().run()
      expect(editor.getHTML()).toContain('<ol><li><p>item</p></li></ol>')
    })

    it('should set and unset a link', () => {
      const editor = createEditor('<p>trokky</p>')
      editor.commands.selectAll()
      editor.chain().focus().setLink({ href: 'https://example.com' }).run()
      expect(editor.getHTML()).toContain('href="https://example.com"')

      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      expect(editor.getHTML()).not.toContain('href=')
    })

    it('should insert an image carrying the Trokky attributes', () => {
      const editor = createEditor('<p></p>')
      editor
        .chain()
        .focus()
        .setImage({
          src: 'https://cdn.example.com/a.png',
          alt: 'An asset',
          'data-trokky-id': 'asset-1',
          'data-trokky-variant': 'thumb',
        } as Parameters<typeof editor.commands.setImage>[0])
        .run()

      const html = editor.getHTML()
      expect(html).toContain('src="https://cdn.example.com/a.png"')
      expect(html).toContain('data-trokky-id="asset-1"')
      expect(html).toContain('data-trokky-variant="thumb"')
    })

    it('should insert a table and add and delete rows and columns', () => {
      const editor = createEditor('<p></p>')

      editor
        .chain()
        .focus()
        .insertTable({ rows: 2, cols: 2, withHeaderRow: true })
        .run()
      const countRows = (): number => (editor.getHTML().match(/<tr>/g) || []).length
      const countCellsInFirstRow = (): number =>
        (editor.getHTML().split('</tr>')[0].match(/<t[hd]/g) || []).length

      expect(editor.getHTML()).toContain('<table')
      expect(countRows()).toBe(2)
      expect(countCellsInFirstRow()).toBe(2)

      editor.chain().focus().addRowAfter().run()
      expect(countRows()).toBe(3)

      editor.chain().focus().addColumnAfter().run()
      expect(countCellsInFirstRow()).toBe(3)

      editor.chain().focus().deleteRow().run()
      expect(countRows()).toBe(2)

      editor.chain().focus().deleteTable().run()
      expect(editor.getHTML()).not.toContain('<table')
    })

    it('should toggle a code block', () => {
      const editor = createEditor('<p>const a = 1</p>')
      editor.chain().focus().toggleCodeBlock().run()
      expect(editor.getHTML()).toContain('<pre')
      expect(editor.isActive('codeBlock')).toBe(true)
    })

    it('should expose the character count storage the stats footer reads', () => {
      const editor = createEditor('<p>12345</p>')
      expect(editor.storage.characterCount?.characters()).toBe(5)
    })
  })

  describe('HTML round trip', () => {
    const rich = [
      '<p>Intro paragraph</p>',
      '<p><a href="https://example.com">a link</a></p>',
      '<img src="https://cdn.example.com/a.png" alt="An asset" data-trokky-id="asset-42" data-trokky-variant="hero">',
      '<table><tbody><tr><th><p>Head</p></th><th><p>Two</p></th></tr>' +
        '<tr><td><p>Cell</p></td><td><p>Other</p></td></tr></tbody></table>',
    ].join('')

    it('should survive edit, serialise and reparse into a fresh editor', () => {
      const first = createEditor(rich)

      first.commands.focus('start')
      first.commands.insertContent('Edited: ')
      const serialised = first.getHTML()
      expect(serialised).toContain('Edited: Intro paragraph')

      const second = createEditor(serialised)
      const reserialised = second.getHTML()

      expect(reserialised).toBe(serialised)
      expect(reserialised).toContain('Edited: Intro paragraph')
      expect(reserialised).toContain('href="https://example.com"')
      expect(reserialised).toContain('data-trokky-id="asset-42"')
      expect(reserialised).toContain('data-trokky-variant="hero"')
      expect(reserialised).toContain('<table')
      expect(reserialised).toContain('<th')
      expect(second.getText()).toContain('Cell')
    })

    it('should not append a trailing node to stored content', () => {
      const editor = createEditor('<p>only paragraph</p>')
      expect(editor.getHTML()).toBe('<p>only paragraph</p>')
    })
  })
})
