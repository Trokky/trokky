/**
 * The external-value-sync guard compares live editor HTML against stored HTML.
 *
 * Those two strings are produced by different serialisers: Tiptap's Image
 * extension emits `class` first and keeps the absolute src, while the stored
 * value has been through `normalizeHtmlImages`, which rebuilds every `<img>` as
 * `src, alt, title, class, data-trokky-id, data-trokky-variant` with a relative
 * src. A raw string compare was therefore permanently unequal for any document
 * containing an image, so the guard fired on every keystroke.
 */
import { describe, it, expect } from 'vitest'
import { isEditorContentEquivalent } from '../fields/definitions/RichTextField/format-converter'

const EDITOR_IMG =
  '<img class="max-w-full h-auto rounded-lg" src="/media/asset-42/file" alt="Chart" title="Chart" data-trokky-id="asset-42" data-trokky-variant="thumbnail">'
const STORED_IMG =
  '<img src="/media/asset-42/file" alt="Chart" title="Chart" class="max-w-full h-auto rounded-lg" data-trokky-id="asset-42" data-trokky-variant="thumbnail">'

describe('isEditorContentEquivalent', () => {
  it('should treat editor-order and storage-order image markup as equivalent', () => {
    expect(isEditorContentEquivalent(EDITOR_IMG, STORED_IMG)).toBe(true)
  })

  it('should ignore an absolute src the editor kept but storage made relative', () => {
    const absolute =
      '<img class="rounded-lg" src="http://localhost:3000/media/asset-42/file" alt="Chart">'
    const relative = '<img src="/media/asset-42/file" alt="Chart" class="rounded-lg">'
    expect(isEditorContentEquivalent(absolute, relative)).toBe(true)
  })

  it('should compare surrounding content as equivalent when only image order differs', () => {
    expect(
      isEditorContentEquivalent(
        `<h2>Quarterly Report</h2>${EDITOR_IMG}<p>After</p>`,
        `<h2>Quarterly Report</h2>${STORED_IMG}<p>After</p>`
      )
    ).toBe(true)
  })

  it('should report genuinely different text as different', () => {
    expect(
      isEditorContentEquivalent(
        `<h2>Quarterly Report</h2>${EDITOR_IMG}`,
        `<h2>Quarterly ReportABCDE</h2>${STORED_IMG}`
      )
    ).toBe(false)
  })

  it('should report a different image as different', () => {
    expect(
      isEditorContentEquivalent(
        EDITOR_IMG,
        STORED_IMG.replace('asset-42', 'asset-99')
      )
    ).toBe(false)
  })

  // The guard must keep firing for real external changes, or legacy documents
  // never load. Tiptap re-renders `<li>x</li>` as `<li><p>x</p></li>`.
  it('should report legacy list markup as different so it still syncs on mount', () => {
    expect(
      isEditorContentEquivalent('<ul><li><p>x</p></li></ul>', '<ul><li>x</li></ul>')
    ).toBe(false)
  })

  it('should report an empty editor against stored content as different', () => {
    expect(isEditorContentEquivalent('<p></p>', '<h2>Quarterly Report</h2>')).toBe(false)
  })
})
