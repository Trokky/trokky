/**
 * Rules-of-hooks guard for the field components that used to declare hooks
 * after an early return (readonly display branch, or an invalid-definition
 * bail-out). Toggling the guard flag on an already mounted instance changed the
 * number of hooks React saw between renders, which throws
 * "Rendered fewer hooks than expected".
 *
 * Each test mounts the real component, flips the guard back and forth, and
 * asserts both that no hook-order error is raised and that each mode still
 * renders what it rendered before.
 *
 * Where the guard sat before every hook (ColorField, ObjectField,
 * ReferenceField) React cannot detect the mismatch and throws nothing - it
 * silently drops the hook state instead, so those tests also assert that local
 * state survives a round trip through the guarded branch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import { NumberFieldComponent } from '../fields/definitions/NumberField/component'
import { TextareaFieldComponent } from '../fields/definitions/TextareaField/component'
import { ColorFieldComponent } from '../fields/definitions/ColorField/component'
import { ObjectFieldComponent } from '../fields/definitions/ObjectField/component'
import { ReferenceFieldComponent } from '../fields/definitions/ReferenceField/component'

const HOOK_ERROR = /Rendered fewer hooks than expected|Rendered more hooks than|change in the order of Hooks|Should have a queue/

const consoleErrors: string[] = []
let restoreConsoleError: () => void

beforeEach(() => {
  consoleErrors.length = 0
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    consoleErrors.push(args.map(part => String(part)).join(' '))
  })
  restoreConsoleError = () => spy.mockRestore()
})

afterEach(() => {
  restoreConsoleError()
})

function expectNoHookError() {
  expect(consoleErrors.filter(message => HOOK_ERROR.test(message))).toEqual([])
}

const baseProps = {
  fieldId: 'f1',
  onChange: () => {},
  hasError: false,
  isDisabled: false,
}

describe('NumberFieldComponent readonly toggle', () => {
  it('keeps hook order stable and renders both modes', () => {
    const definition = { name: 'count', type: 'number', title: 'Count' } as any
    const props = (isReadonly: boolean) => ({
      ...baseProps,
      definition,
      value: 42,
      isReadonly,
    })

    const { rerender, container } = render(<NumberFieldComponent {...props(false)} />)
    expect(container.querySelector('input')).toBeTruthy()

    expect(() => rerender(<NumberFieldComponent {...props(true)} />)).not.toThrow()
    expect(container.querySelector('input')).toBeNull()
    expect(container.textContent).toContain('42')

    expect(() => rerender(<NumberFieldComponent {...props(false)} />)).not.toThrow()
    expect(container.querySelector('input')).toBeTruthy()

    expectNoHookError()
  })
})

describe('TextareaFieldComponent readonly toggle', () => {
  it('keeps hook order stable and renders both modes', () => {
    const definition = { name: 'body', type: 'text', title: 'Body' } as any
    const props = (isReadonly: boolean) => ({
      ...baseProps,
      definition,
      value: 'hello world',
      isReadonly,
    })

    const { rerender, container } = render(<TextareaFieldComponent {...props(false)} />)
    expect(container.querySelector('textarea')).toBeTruthy()

    expect(() => rerender(<TextareaFieldComponent {...props(true)} />)).not.toThrow()
    expect(container.querySelector('textarea')).toBeNull()
    expect(container.textContent).toContain('hello world')

    expect(() => rerender(<TextareaFieldComponent {...props(false)} />)).not.toThrow()
    expect(container.querySelector('textarea')).toBeTruthy()

    expectNoHookError()
  })
})

describe('ColorFieldComponent definition and readonly toggle', () => {
  it('keeps hook order stable when the definition guard flips', () => {
    const definition = { name: 'brand', type: 'color', title: 'Brand' } as any
    const props = (hasDefinition: boolean, isReadonly = false) => ({
      ...baseProps,
      definition: (hasDefinition ? definition : undefined) as any,
      value: '#ff0000',
      isReadonly,
    })

    const { rerender, container } = render(<ColorFieldComponent {...props(true)} />)
    expect(container.querySelector('input[type="text"]')).toBeTruthy()

    // The readonly toggle must not disturb the hook order either
    expect(() => rerender(<ColorFieldComponent {...props(true, true)} />)).not.toThrow()
    expect(container.querySelector('input[type="text"]')).toBeTruthy()
    expect((container.querySelector('input[type="text"]') as HTMLInputElement).disabled).toBe(true)

    expect(() => rerender(<ColorFieldComponent {...props(true)} />)).not.toThrow()
    expect((container.querySelector('input[type="text"]') as HTMLInputElement).disabled).toBe(false)

    // Local state that must survive the trip through the guarded branch
    fireEvent.change(container.querySelector('input[type="text"]')!, {
      target: { value: '#00ff00' },
    })
    expect((container.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('#00ff00')

    expect(() => rerender(<ColorFieldComponent {...props(false)} />)).not.toThrow()
    expect(container.textContent).toContain('errors.definitionMissing')

    expect(() => rerender(<ColorFieldComponent {...props(true)} />)).not.toThrow()
    expect(container.querySelector('input[type="text"]')).toBeTruthy()
    expect((container.querySelector('input[type="text"]') as HTMLInputElement).disabled).toBe(false)
    expect((container.querySelector('input[type="text"]') as HTMLInputElement).value).toBe('#00ff00')

    expectNoHookError()
  })
})

describe('ObjectFieldComponent definition and readonly toggle', () => {
  it('keeps hook order stable when the definition guard flips', () => {
    const objectDefinition = {
      name: 'seo',
      type: 'object',
      title: 'SEO',
      fields: { metaTitle: { type: 'string', title: 'Meta Title' } },
    } as any
    const stringDefinition = { name: 'seo', type: 'string', title: 'SEO' } as any

    const props = (isObject: boolean, isReadonly = false) => ({
      ...baseProps,
      definition: isObject ? objectDefinition : stringDefinition,
      value: { metaTitle: 'Hi' },
      isReadonly,
    })

    const { rerender, container } = render(<ObjectFieldComponent {...props(true)} />)
    expect(container.textContent).toContain('SEO')

    expect(() => rerender(<ObjectFieldComponent {...props(true, true)} />)).not.toThrow()
    expect((container.querySelector('button') as HTMLButtonElement).disabled).toBe(true)

    expect(() => rerender(<ObjectFieldComponent {...props(true)} />)).not.toThrow()

    // Local state that must survive the trip through the guarded branch
    fireEvent.click(container.querySelector('button')!)
    expect(document.body.textContent).toContain('Meta Title')

    expect(() => rerender(<ObjectFieldComponent {...props(false)} />)).not.toThrow()
    expect(container.textContent).toContain('types.object.invalidConfig')

    expect(() => rerender(<ObjectFieldComponent {...props(true)} />)).not.toThrow()
    expect(container.textContent).toContain('SEO')
    expect(document.body.textContent).toContain('Meta Title')

    expectNoHookError()
  })
})

describe('ReferenceFieldComponent definition and readonly toggle', () => {
  it('keeps hook order stable when the definition guard flips', () => {
    const referenceDefinition = {
      name: 'author',
      type: 'reference',
      title: 'Author',
      to: 'author',
    } as any
    const stringDefinition = { name: 'author', type: 'string', title: 'Author' } as any

    const props = (isReference: boolean, isReadonly = false) => ({
      ...baseProps,
      definition: isReference ? referenceDefinition : stringDefinition,
      value: null,
      isReadonly,
    })

    const { rerender, container } = render(<ReferenceFieldComponent {...props(true)} />)
    expect(container.querySelector('.reference-field')).toBeTruthy()
    expect(container.textContent).toContain('types.reference.placeholder')

    // Readonly hides the add-reference button but must not change the hook order
    expect(() => rerender(<ReferenceFieldComponent {...props(true, true)} />)).not.toThrow()
    expect(container.textContent).not.toContain('types.reference.placeholder')

    expect(() => rerender(<ReferenceFieldComponent {...props(true)} />)).not.toThrow()

    // Local state that must survive the trip through the guarded branch
    fireEvent.click(container.querySelector('button')!)
    expect(container.textContent).toContain('types.reference.close')

    expect(() => rerender(<ReferenceFieldComponent {...props(false)} />)).not.toThrow()
    expect(container.textContent).toContain('types.object.invalidConfig')

    expect(() => rerender(<ReferenceFieldComponent {...props(true)} />)).not.toThrow()
    expect(container.textContent).toContain('types.reference.placeholder')
    expect(container.textContent).toContain('types.reference.close')

    expectNoHookError()
  })
})
