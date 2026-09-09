/**
 * Regression guard for the caret scrambling that hit any document with an image.
 *
 * The external-value-sync effect compared `editor.getHTML()` against the stored
 * value as raw strings. The two serialise `<img>` differently (Tiptap emits
 * `class` first; storage rebuilds the tag in a fixed order with a relative src),
 * so for a document containing an image the guard was permanently true: every
 * keystroke round-tripped through the controlled `value` and re-ran
 * `setContent`, which re-anchored the ProseMirror selection to the end of the
 * document. Typing "ABCDE" at the end of the heading produced "A" in the heading
 * and "BCDE" in the last table cell. `{ emitUpdate: false }` stopped the
 * onChange feedback loop but did nothing for the caret.
 *
 * This mounts the real field with a real Tiptap editor in the controlled pattern
 * a real form uses, and types into the middle of a document with an image.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'
import type { Editor } from '@tiptap/core'

const setContentSpy = vi.fn()
let capturedEditor: Editor | null = null

vi.mock('@tiptap/react', async () => {
  const actual = await vi.importActual<typeof import('@tiptap/react')>('@tiptap/react')
  return {
    ...actual,
    useEditor: (...args: any[]) => {
      const editor = (actual.useEditor as any)(...args) as Editor | null
      if (editor && editor !== capturedEditor) {
        capturedEditor = editor
        // `editor.commands` is a prototype getter that rebuilds the command bag
        // on every access, so shadow it with an own property to observe
        // setContent calls without changing behaviour.
        const proto = Object.getPrototypeOf(editor)
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'commands')!
        Object.defineProperty(editor, 'commands', {
          configurable: true,
          get() {
            const commands = descriptor.get!.call(editor) as any
            return {
              ...commands,
              setContent: (...setContentArgs: unknown[]) => {
                setContentSpy(...setContentArgs)
                return commands.setContent(...setContentArgs)
              },
            }
          },
        })
      }
      return editor
    },
  }
})

vi.mock('@trokky/trokky/i18n', () => ({
  useT: () => ({ t: (key: string) => key }),
}))

const { RichTextFieldComponent } = await import(
  '../fields/definitions/RichTextField/component'
)

const HEADING_TEXT = 'Quarterly Report'

/** Heading, image (in storage attribute order), paragraph, table - the shape the browser repro uses. */
const DOC_WITH_IMAGE = [
  `<h2>${HEADING_TEXT}</h2>`,
  '<img src="/media/asset-42/file" alt="Chart" title="Chart" class="max-w-full h-auto rounded-lg" data-trokky-id="asset-42" data-trokky-variant="thumbnail">',
  '<p>Read the report.</p>',
  '<table><tbody><tr><th>Region</th><th>Revenue</th></tr><tr><td>North</td><td>120</td></tr></tbody></table>',
].join('')

let setExternalValue: React.Dispatch<React.SetStateAction<unknown>> | null = null

function Harness({ initial }: { initial: string }): React.ReactElement {
  const [value, setValue] = React.useState<unknown>(initial)
  setExternalValue = setValue
  return (
    <RichTextFieldComponent
      fieldId="body"
      value={value}
      onChange={(next: unknown) => setValue(next)}
      definition={{ type: 'richtext', options: {}, validation: {} } as any}
      isDisabled={false}
      isReadonly={false}
      studioContext={undefined}
      mode="edit"
    />
  )
}

function editor(): Editor {
  expect(capturedEditor, 'Tiptap editor').toBeTruthy()
  return capturedEditor!
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('RichTextField caret in a document containing an image', () => {
  beforeEach(() => {
    capturedEditor = null
    setExternalValue = null
    setContentSpy.mockClear()
  })

  it('should keep typed text where it was typed instead of pushing it to the document end', async () => {
    render(<Harness initial={DOC_WITH_IMAGE} />)
    await flush()

    // Put the caret at the end of the heading, as a user clicking there would.
    await act(async () => {
      editor().commands.setTextSelection(1 + HEADING_TEXT.length)
    })

    // Mount-time sync is legitimate; only what happens while typing matters.
    setContentSpy.mockClear()

    for (const character of 'ABCDE') {
      await act(async () => {
        editor().commands.insertContent(character)
      })
      // Let the reported value flow back in through the controlled prop and the
      // sync effect re-run, exactly as a real form does.
      await flush()
    }

    const html = editor().getHTML()
    expect(html).toContain(`<h2>${HEADING_TEXT}ABCDE</h2>`)
    // Nothing leaked into the trailing table.
    expect(html).toContain('<p>120</p>')
    expect(editor().getText()).not.toContain('120ABCDE')
    expect(editor().getText()).not.toContain('120BCDE')
  })

  it('should not re-set content while typing in a document containing an image', async () => {
    render(<Harness initial={DOC_WITH_IMAGE} />)
    await flush()

    await act(async () => {
      editor().commands.setTextSelection(1 + HEADING_TEXT.length)
    })
    setContentSpy.mockClear()

    for (const character of 'ABCDE') {
      await act(async () => {
        editor().commands.insertContent(character)
      })
      await flush()
    }

    expect(setContentSpy).not.toHaveBeenCalled()
  })

  it('should still sync content that genuinely changed outside the editor', async () => {
    render(<Harness initial={DOC_WITH_IMAGE} />)
    await flush()
    setContentSpy.mockClear()

    // A revision restore replaces the value wholesale.
    await act(async () => {
      setExternalValue?.('<h2>Restored revision</h2><p>Body</p>')
    })
    await flush()

    expect(setContentSpy).toHaveBeenCalled()
    expect(editor().getText()).toContain('Restored revision')
  })
})
