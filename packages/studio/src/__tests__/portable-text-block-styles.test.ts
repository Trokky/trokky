import { describe, it, expect } from 'vitest'
import {
  getBlockPresentation,
  getMarkClasses,
} from '../fields/definitions/PortableTextField/blockStyles'

describe('getBlockPresentation', () => {
  it('should render an unknown or missing style as a paragraph', () => {
    expect(getBlockPresentation(undefined)).toEqual({
      BlockElement: 'p',
      blockClasses: 'mb-2',
    })
    expect(getBlockPresentation('normal').BlockElement).toBe('p')
    expect(getBlockPresentation('something-else').BlockElement).toBe('p')
  })

  it('should map each heading level to its own element', () => {
    expect(getBlockPresentation('h1').BlockElement).toBe('h1')
    expect(getBlockPresentation('h2').BlockElement).toBe('h2')
    expect(getBlockPresentation('h3').BlockElement).toBe('h3')
    expect(getBlockPresentation('h4').BlockElement).toBe('h4')
    expect(getBlockPresentation('h5').BlockElement).toBe('h5')
    expect(getBlockPresentation('h6').BlockElement).toBe('h6')
  })

  it('should map a quote to a blockquote with its border', () => {
    const { BlockElement, blockClasses } = getBlockPresentation('blockquote')
    expect(BlockElement).toBe('blockquote')
    expect(blockClasses).toContain('border-l-4')
    expect(blockClasses).toContain('italic')
  })
})

describe('getMarkClasses', () => {
  it('should return nothing for a span with no marks', () => {
    expect(getMarkClasses([])).toBe('')
  })

  it('should map each mark to its class', () => {
    expect(getMarkClasses(['strong'])).toBe(' font-semibold')
    expect(getMarkClasses(['em'])).toBe(' italic')
    expect(getMarkClasses(['underline'])).toBe(' underline')
    expect(getMarkClasses(['strike'])).toBe(' line-through')
    expect(getMarkClasses(['code'])).toContain('font-mono')
  })

  it('should combine marks in a fixed order', () => {
    expect(getMarkClasses(['em', 'strong'])).toBe(' font-semibold italic')
  })

  it('should ignore a mark it does not know, such as a link markDef key', () => {
    expect(getMarkClasses(['link', 'strong'])).toBe(' font-semibold')
  })
})
